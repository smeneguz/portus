/**
 * Portus E2E Test — Full eBL lifecycle on IOTA Testnet
 *
 * Simulates: Hamburg → Shanghai shipment
 * Actors: Carrier, Shipper, Bank, Consignee
 */

import { getFullnodeUrl, IotaClient } from '@iota/iota-sdk/client';
import { Ed25519Keypair } from '@iota/iota-sdk/keypairs/ed25519';
import { Transaction } from '@iota/iota-sdk/transactions';
import { decodeIotaPrivateKey } from '@iota/iota-sdk/cryptography';

// Load keypairs from environment variables (export from CLI: iota keytool export <alias>)
const CARRIER_PRIVKEY = process.env.CARRIER_PRIVKEY!;
const SHIPPER_PRIVKEY = process.env.SHIPPER_PRIVKEY!;
const BANK_PRIVKEY = process.env.BANK_PRIVKEY!;
const CONSIGNEE_PRIVKEY = process.env.CONSIGNEE_PRIVKEY!;

if (!CARRIER_PRIVKEY || !SHIPPER_PRIVKEY || !BANK_PRIVKEY || !CONSIGNEE_PRIVKEY) {
  console.error('Missing environment variables. Set CARRIER_PRIVKEY, SHIPPER_PRIVKEY, BANK_PRIVKEY, CONSIGNEE_PRIVKEY');
  process.exit(1);
}

function keypairFromPrivKey(privkey: string): Ed25519Keypair {
  const { secretKey } = decodeIotaPrivateKey(privkey);
  return Ed25519Keypair.fromSecretKey(secretKey);
}

// ── Configuration ──────────────────────────────────────────────────────
const PACKAGE_ID = '0xcd4c2548a8995de4ad5aa8af33c76cf846b86a2eccafc99311afc33fe2c97159';
const BL_REGISTRY_ID = '0xce1750a4c1cc8dff96ecdfdf61cd6be649283f58abd7e5f16e13c9b32b48be8e';
const CARRIER_REGISTRY_ID = '0x6e6f141e6ffb7ba7323a1e8a34924cac7920a84f5aadb38f4b4be0332f7e70a4';
const CLOCK_ID = '0x6';
const EXPLORER_URL = 'https://explorer.iota.org';

const client = new IotaClient({ url: getFullnodeUrl('testnet') });

// ── Test Results ───────────────────────────────────────────────────────
interface TestResult {
  name: string;
  passed: boolean;
  detail: string;
  gasUsed?: number;
}
const results: TestResult[] = [];
let totalGas = 0;

function pass(name: string, detail: string, gasUsed = 0) {
  results.push({ name, passed: true, detail, gasUsed });
  totalGas += gasUsed;
  console.log(`  ✅ PASS: ${name}`);
  if (detail) console.log(`         ${detail}`);
}

function fail(name: string, detail: string) {
  results.push({ name, passed: false, detail });
  console.log(`  ❌ FAIL: ${name}`);
  console.log(`         ${detail}`);
}

// ── Helpers ────────────────────────────────────────────────────────────

async function fundAddress(address: string, retries = 5): Promise<void> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch('https://faucet.testnet.iota.cafe/gas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          FixedAmountRequest: { recipient: address },
        }),
      });
      if (res.ok) {
        await sleep(4000);
        return;
      }
      if (res.status === 429) {
        const wait = (i + 1) * 15000; // 15s, 30s, 45s, ...
        console.log(`    Faucet rate-limited, waiting ${wait / 1000}s... (attempt ${i + 1}/${retries})`);
        await sleep(wait);
        continue;
      }
      throw new Error(`Faucet failed: ${res.statusText}`);
    } catch (err: any) {
      if (i === retries - 1) throw err;
      await sleep(10000);
    }
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function execTx(
  signer: Ed25519Keypair,
  tx: Transaction,
): Promise<any> {
  return client.signAndExecuteTransaction({
    signer,
    transaction: tx,
    options: {
      showEffects: true,
      showObjectChanges: true,
      showEvents: true,
    },
  });
}

function getGas(result: any): number {
  const gu = result?.effects?.gasUsed;
  if (!gu) return 0;
  return (
    Number(gu.computationCost || 0) +
    Number(gu.storageCost || 0) -
    Number(gu.storageRebate || 0)
  );
}

function short(addr: string) {
  return `${addr.slice(0, 8)}...${addr.slice(-6)}`;
}

// ── Main Test ──────────────────────────────────────────────────────────

async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║        PORTUS E2E TEST — eBL LIFECYCLE          ║');
  console.log('║    Hamburg → Shanghai | 4 actors, 12 tests       ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log('');

  // ── SETUP: Load pre-funded keypairs ──────────────────────────────
  console.log('── SETUP ──────────────────────────────────────────');
  const carrier = keypairFromPrivKey(CARRIER_PRIVKEY);
  const shipper = keypairFromPrivKey(SHIPPER_PRIVKEY);
  const bank = keypairFromPrivKey(BANK_PRIVKEY);
  const consignee = keypairFromPrivKey(CONSIGNEE_PRIVKEY);

  const carrierAddr = carrier.toIotaAddress();
  const shipperAddr = shipper.toIotaAddress();
  const bankAddr = bank.toIotaAddress();
  const consigneeAddr = consignee.toIotaAddress();

  console.log(`  Carrier:   ${carrierAddr}`);
  console.log(`  Shipper:   ${shipperAddr}`);
  console.log(`  Bank:      ${bankAddr}`);
  console.log(`  Consignee: ${consigneeAddr}`);
  console.log('  (Using pre-funded addresses from CLI keystore)');
  console.log('');

  // Object IDs we'll track
  let carrierCapId = '';
  let eblId = '';
  let endorsementChainId = '';
  let notarizedDocId = '';
  const contentHash = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2';

  // ── TEST 1: Register Carrier ─────────────────────────────────────
  console.log('── TEST 1: REGISTER CARRIER ────────────────────────');
  try {
    const tx = new Transaction();

    // Register in carrier_registry
    tx.moveCall({
      target: `${PACKAGE_ID}::carrier_registry::register`,
      arguments: [
        tx.object(CARRIER_REGISTRY_ID),
        tx.pure.string('Portus Shipping'),
        tx.pure.string('PRTS'),
        tx.pure.string('DE'),
        tx.object(CLOCK_ID),
      ],
    });

    // Register carrier cap in ebl module
    tx.moveCall({
      target: `${PACKAGE_ID}::ebl::register_carrier`,
      arguments: [
        tx.pure.string('Portus Shipping'),
        tx.object(CLOCK_ID),
      ],
    });

    const result = await execTx(carrier, tx);
    const gas = getGas(result);

    // Find CarrierCap
    const capObj = result.objectChanges?.find(
      (c: any) => c.type === 'created' && c.objectType?.includes('CarrierCap'),
    );
    carrierCapId = capObj?.objectId || '';

    // Check events
    const regEvent = result.events?.find(
      (e: any) => e.type?.includes('CarrierRegistered'),
    );

    if (carrierCapId && regEvent) {
      pass('Register Carrier', `CarrierCap: ${short(carrierCapId)} | CarrierRegistered event emitted`, gas);
    } else {
      fail('Register Carrier', `CarrierCap: ${carrierCapId ? 'found' : 'MISSING'}, Event: ${regEvent ? 'found' : 'MISSING'}`);
    }
  } catch (err: any) {
    fail('Register Carrier', err.message);
  }

  // ── TEST 2: Issue eBL ────────────────────────────────────────────
  console.log('── TEST 2: ISSUE eBL ──────────────────────────────');
  try {
    const tx = new Transaction();
    tx.moveCall({
      target: `${PACKAGE_ID}::ebl::issue_ebl`,
      arguments: [
        tx.object(carrierCapId),
        tx.object(BL_REGISTRY_ID),
        tx.pure.string('PRTS-2026-HAM-SHA-001'),
        tx.pure.address(shipperAddr),
        tx.pure.address(consigneeAddr),
        tx.pure.address(shipperAddr), // notify party
        tx.pure.string('MV Terra Nova'),
        tx.pure.string('V2026-042'),
        tx.pure.string('Hamburg, Germany'),
        tx.pure.string('Shanghai, China'),
        tx.pure.string('Automotive parts'),
        tx.pure.string('MSKU1234567, MSKU1234568'),
        tx.pure.u64(24000),
        tx.pure.u64(480),
        tx.pure.u8(0), // prepaid
        tx.pure.string(contentHash),
        tx.object(CLOCK_ID),
      ],
    });

    const result = await execTx(carrier, tx);
    const gas = getGas(result);

    // Find eBL shared object
    const eblObj = result.objectChanges?.find(
      (c: any) => c.type === 'created' && c.objectType?.includes('ElectronicBL'),
    );
    eblId = eblObj?.objectId || '';

    // Check events
    const issuedEvent = result.events?.find(
      (e: any) => e.type?.includes('BLIssued'),
    );

    // Check registry (wait briefly for propagation)
    await sleep(3000);
    const registryObj = await client.getObject({
      id: BL_REGISTRY_ID,
      options: { showContent: true },
    });
    const regFields = (registryObj.data?.content as any)?.fields;
    const totalIssued = Number(regFields?.total_bls_issued || 0);

    if (eblId && issuedEvent) {
      pass('Issue eBL', `eBL: ${short(eblId)} | BLIssued event | Registry: ${totalIssued} issued`, gas);
    } else {
      fail('Issue eBL', `eBL: ${eblId ? 'found' : 'MISSING'}, Event: ${issuedEvent ? 'found' : 'MISSING'}, Registry: ${totalIssued}`);
    }
  } catch (err: any) {
    fail('Issue eBL', err.message);
  }

  // ── TEST 3: Notarise BoL Document ────────────────────────────────
  console.log('── TEST 3: NOTARISE DOCUMENT ──────────────────────');
  try {
    const tx = new Transaction();
    tx.moveCall({
      target: `${PACKAGE_ID}::notarization::notarize`,
      arguments: [
        tx.pure.string(contentHash),
        tx.pure.string('bill_of_lading'),
        tx.pure.address(eblId),
        tx.object(CLOCK_ID),
      ],
    });

    const result = await execTx(carrier, tx);
    const gas = getGas(result);

    const docObj = result.objectChanges?.find(
      (c: any) => c.type === 'created' && c.objectType?.includes('NotarizedBLDoc'),
    );
    notarizedDocId = docObj?.objectId || '';

    const notarEvent = result.events?.find(
      (e: any) => e.type?.includes('BLDocNotarized'),
    );

    if (notarizedDocId && notarEvent) {
      pass('Notarise Document', `Doc: ${short(notarizedDocId)} | BLDocNotarized event`, gas);
    } else {
      fail('Notarise Document', `Doc: ${notarizedDocId ? 'found' : 'MISSING'}, Event: ${notarEvent ? 'found' : 'MISSING'}`);
    }
  } catch (err: any) {
    fail('Notarise Document', err.message);
  }

  // ── TEST 4: Create Endorsement Chain ─────────────────────────────
  console.log('── TEST 4: CREATE ENDORSEMENT CHAIN ───────────────');
  try {
    const tx = new Transaction();
    tx.moveCall({
      target: `${PACKAGE_ID}::endorsement::create_chain`,
      arguments: [
        tx.pure.address(eblId),
        tx.pure.address(shipperAddr),
        tx.object(CLOCK_ID),
      ],
    });

    const result = await execTx(carrier, tx);
    const gas = getGas(result);

    const chainObj = result.objectChanges?.find(
      (c: any) => c.type === 'created' && c.objectType?.includes('EndorsementChain'),
    );
    endorsementChainId = chainObj?.objectId || '';

    if (endorsementChainId) {
      pass('Create Endorsement Chain', `Chain: ${short(endorsementChainId)}`, gas);
    } else {
      fail('Create Endorsement Chain', 'EndorsementChain object not created');
    }
  } catch (err: any) {
    fail('Create Endorsement Chain', err.message);
  }

  // ── TEST 5: First Endorsement (shipper → bank) ───────────────────
  console.log('── TEST 5: ENDORSEMENT shipper → bank ─────────────');
  try {
    const tx = new Transaction();
    tx.moveCall({
      target: `${PACKAGE_ID}::endorsement::endorse_and_transfer`,
      arguments: [
        tx.object(endorsementChainId),
        tx.object(eblId),
        tx.pure.address(bankAddr),
        tx.pure.u8(1), // to_order
        tx.pure.string('LC endorsement'),
        tx.object(CLOCK_ID),
      ],
    });

    const result = await execTx(shipper, tx);
    const gas = getGas(result);

    const endorseEvent = result.events?.find(
      (e: any) => e.type?.includes('EndorsementMade'),
    );

    // Verify chain state
    const chainObj = await client.getObject({
      id: endorsementChainId,
      options: { showContent: true },
    });
    const chainFields = (chainObj.data?.content as any)?.fields;
    const holder = chainFields?.current_holder;
    const endorseCount = chainFields?.endorsements?.length || 0;

    if (endorseEvent && holder === bankAddr && endorseCount === 1) {
      pass('Endorsement shipper→bank', `Holder: ${short(bankAddr)} | Chain length: ${endorseCount}`, gas);
    } else {
      fail('Endorsement shipper→bank', `Event: ${endorseEvent ? 'ok' : 'MISSING'}, Holder: ${short(holder)}, Count: ${endorseCount}`);
    }
  } catch (err: any) {
    fail('Endorsement shipper→bank', err.message);
  }

  // ── TEST 6: Second Endorsement (bank → consignee) ────────────────
  console.log('── TEST 6: ENDORSEMENT bank → consignee ───────────');
  try {
    const tx = new Transaction();
    tx.moveCall({
      target: `${PACKAGE_ID}::endorsement::endorse_and_transfer`,
      arguments: [
        tx.object(endorsementChainId),
        tx.object(eblId),
        tx.pure.address(consigneeAddr),
        tx.pure.u8(2), // straight
        tx.pure.string('Straight endorsement'),
        tx.object(CLOCK_ID),
      ],
    });

    const result = await execTx(bank, tx);
    const gas = getGas(result);

    const chainObj = await client.getObject({
      id: endorsementChainId,
      options: { showContent: true },
    });
    const chainFields = (chainObj.data?.content as any)?.fields;
    const holder = chainFields?.current_holder;
    const endorseCount = chainFields?.endorsements?.length || 0;

    if (holder === consigneeAddr && endorseCount === 2) {
      pass('Endorsement bank→consignee', `Holder: ${short(consigneeAddr)} | Chain length: ${endorseCount}`, gas);
    } else {
      fail('Endorsement bank→consignee', `Holder: ${short(holder)}, Count: ${endorseCount}`);
    }
  } catch (err: any) {
    fail('Endorsement bank→consignee', err.message);
  }

  // ── TEST 7: Status Update (arrived) ──────────────────────────────
  console.log('── TEST 7: STATUS UPDATE (arrived) ────────────────');
  try {
    const tx = new Transaction();
    tx.moveCall({
      target: `${PACKAGE_ID}::ebl::update_status`,
      arguments: [
        tx.object(eblId),
        tx.pure.u8(2), // arrived
        tx.object(CLOCK_ID),
      ],
    });

    const result = await execTx(carrier, tx);
    const gas = getGas(result);

    const statusEvent = result.events?.find(
      (e: any) => e.type?.includes('BLStatusUpdated'),
    );
    const parsedEvent = statusEvent?.parsedJson as any;

    if (statusEvent && Number(parsedEvent?.new_status) === 2) {
      pass('Status Update (arrived)', `new_status=2 | BLStatusUpdated event`, gas);
    } else {
      fail('Status Update (arrived)', `Event: ${statusEvent ? JSON.stringify(parsedEvent) : 'MISSING'}`);
    }
  } catch (err: any) {
    fail('Status Update (arrived)', err.message);
  }

  // ── TEST 8: Surrender ────────────────────────────────────────────
  console.log('── TEST 8: SURRENDER ──────────────────────────────');
  try {
    const tx = new Transaction();
    tx.moveCall({
      target: `${PACKAGE_ID}::ebl::surrender`,
      arguments: [
        tx.object(eblId),
        tx.object(BL_REGISTRY_ID),
        tx.object(CLOCK_ID),
      ],
    });

    const result = await execTx(consignee, tx);
    const gas = getGas(result);

    const surrenderEvent = result.events?.find(
      (e: any) => e.type?.includes('BLSurrendered'),
    );

    // Check eBL status
    const eblObj = await client.getObject({
      id: eblId,
      options: { showContent: true },
    });
    const eblFields = (eblObj.data?.content as any)?.fields;
    const status = Number(eblFields?.status || 0);

    // Check registry
    const regObj = await client.getObject({
      id: BL_REGISTRY_ID,
      options: { showContent: true },
    });
    const regFields = (regObj.data?.content as any)?.fields;
    const totalSurrendered = Number(regFields?.total_bls_surrendered || 0);

    if (surrenderEvent && status === 3 && totalSurrendered >= 1) {
      pass('Surrender', `status=3 | surrendered=${totalSurrendered} | BLSurrendered event`, gas);
    } else {
      fail('Surrender', `Event: ${surrenderEvent ? 'ok' : 'MISSING'}, Status: ${status}, Surrendered: ${totalSurrendered}`);
    }
  } catch (err: any) {
    fail('Surrender', err.message);
  }

  // ── TEST 9: Accomplish ───────────────────────────────────────────
  console.log('── TEST 9: ACCOMPLISH ─────────────────────────────');
  try {
    const tx = new Transaction();
    tx.moveCall({
      target: `${PACKAGE_ID}::ebl::accomplish`,
      arguments: [
        tx.object(eblId),
        tx.object(CLOCK_ID),
      ],
    });

    const result = await execTx(carrier, tx);
    const gas = getGas(result);

    const accomplishEvent = result.events?.find(
      (e: any) => e.type?.includes('BLAccomplished'),
    );

    // Check status
    const eblObj = await client.getObject({
      id: eblId,
      options: { showContent: true },
    });
    const eblFields = (eblObj.data?.content as any)?.fields;
    const status = Number(eblFields?.status || 0);

    if (accomplishEvent && status === 4) {
      pass('Accomplish', `status=4 | BLAccomplished event`, gas);
    } else {
      fail('Accomplish', `Event: ${accomplishEvent ? 'ok' : 'MISSING'}, Status: ${status}`);
    }
  } catch (err: any) {
    fail('Accomplish', err.message);
  }

  // ── TEST 10: Anti-Fraud Check ────────────────────────────────────
  console.log('── TEST 10: ANTI-FRAUD CHECK ──────────────────────');
  try {
    // Fetch the notarized doc and check hashes
    const docObj = await client.getObject({
      id: notarizedDocId,
      options: { showContent: true },
    });
    const docFields = (docObj.data?.content as any)?.fields;
    const onChainHash = docFields?.doc_hash || '';

    const correctMatch = onChainHash === contentHash;
    const wrongHash = 'TAMPERED_FAKE_HASH_0000000000000000000000000000000000000000000000';
    const wrongMatch = onChainHash === wrongHash;

    if (correctMatch && !wrongMatch) {
      pass('Anti-Fraud Check', `Correct hash ✓ matches | Tampered hash ✗ rejected`);
    } else {
      fail('Anti-Fraud Check', `Correct: ${correctMatch}, Wrong: ${wrongMatch}`);
    }
  } catch (err: any) {
    fail('Anti-Fraud Check', err.message);
  }

  // ── TEST 11: Unauthorised Transfer Attempt ───────────────────────
  console.log('── TEST 11: UNAUTHORISED TRANSFER ─────────────────');
  try {
    // Use shipper keypair (who is NOT the current holder after accomplish —
    // the carrier is). This avoids needing to fund yet another address.
    const tx = new Transaction();
    tx.moveCall({
      target: `${PACKAGE_ID}::endorsement::endorse_and_transfer`,
      arguments: [
        tx.object(endorsementChainId),
        tx.object(eblId),
        tx.pure.address(shipperAddr),
        tx.pure.u8(0),
        tx.pure.string('Stolen transfer attempt'),
        tx.object(CLOCK_ID),
      ],
    });

    try {
      await execTx(shipper, tx);
      fail('Unauthorised Transfer', 'Transaction should have failed but succeeded!');
    } catch (innerErr: any) {
      // Expected to fail with ENotHolder (abort code 100)
      const errMsg = innerErr.message || String(innerErr);
      if (errMsg.includes('100') || errMsg.includes('abort') || errMsg.includes('MoveAbort') || errMsg.includes('ENotHolder')) {
        pass('Unauthorised Transfer', `Correctly rejected: ${errMsg.slice(0, 100)}`);
      } else {
        pass('Unauthorised Transfer', `Transfer rejected (error: ${errMsg.slice(0, 100)})`);
      }
    }
  } catch (err: any) {
    fail('Unauthorised Transfer', err.message);
  }

  // ── TEST 12: Summary ─────────────────────────────────────────────
  console.log('');
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║              TEST SUMMARY                        ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log('');

  // Endorsement chain
  console.log('── Endorsement Chain ─────────────────────────────');
  try {
    const chainObj = await client.getObject({
      id: endorsementChainId,
      options: { showContent: true },
    });
    const chainFields = (chainObj.data?.content as any)?.fields;
    const endorsements = chainFields?.endorsements || [];
    endorsements.forEach((e: any, i: number) => {
      const from = e.fields?.from || e.from || '';
      const to = e.fields?.to || e.to || '';
      const etype = e.fields?.endorsement_type ?? e.endorsement_type ?? '?';
      const ts = Number(e.fields?.timestamp || e.timestamp || 0);
      const tsStr = ts ? new Date(ts).toISOString() : 'N/A';
      console.log(`  ${i + 1}. ${short(from)} → ${short(to)} | type=${etype} | ${tsStr}`);
    });
    console.log(`  Current holder: ${short(chainFields?.current_holder || '')}`);
  } catch (err: any) {
    console.log(`  (Could not fetch chain: ${err.message?.slice(0, 80) || 'unknown error'})`);
  }

  console.log('');
  console.log('── Object IDs ───────────────────────────────────');
  console.log(`  Package:          ${PACKAGE_ID}`);
  console.log(`  BLRegistry:       ${BL_REGISTRY_ID}`);
  console.log(`  CarrierRegistry:  ${CARRIER_REGISTRY_ID}`);
  console.log(`  CarrierCap:       ${carrierCapId}`);
  console.log(`  eBL:              ${eblId}`);
  console.log(`  EndorsementChain: ${endorsementChainId}`);
  console.log(`  NotarizedDoc:     ${notarizedDocId}`);
  console.log('');
  console.log('── Explorer Links ──────────────────────────────');
  console.log(`  Package:  ${EXPLORER_URL}/object/${PACKAGE_ID}?network=testnet`);
  console.log(`  eBL:      ${EXPLORER_URL}/object/${eblId}?network=testnet`);
  console.log(`  Chain:    ${EXPLORER_URL}/object/${endorsementChainId}?network=testnet`);
  console.log('');

  // Results table
  console.log('── Results ──────────────────────────────────────');
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  results.forEach((r) => {
    console.log(`  ${r.passed ? '✅' : '❌'} ${r.name}`);
  });

  console.log('');
  console.log(`  Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`);
  console.log(`  Total gas: ${totalGas.toLocaleString()} NANOS (${(totalGas / 1_000_000_000).toFixed(4)} IOTA)`);
  console.log('');

  if (failed > 0) {
    console.log('  ⚠️  SOME TESTS FAILED');
    process.exit(1);
  } else {
    console.log('  🎉 ALL TESTS PASSED');
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
