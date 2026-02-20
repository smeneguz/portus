/**
 * Portus Seed Demo — Pre-populates testnet with demo data for the frontend
 * Run: npx tsx seed-demo.ts
 */

import { getFullnodeUrl, IotaClient } from '@iota/iota-sdk/client';
import { Ed25519Keypair } from '@iota/iota-sdk/keypairs/ed25519';
import { Transaction } from '@iota/iota-sdk/transactions';
import { decodeIotaPrivateKey } from '@iota/iota-sdk/cryptography';

const PACKAGE_ID = '0xcd4c2548a8995de4ad5aa8af33c76cf846b86a2eccafc99311afc33fe2c97159';
const BL_REGISTRY_ID = '0xce1750a4c1cc8dff96ecdfdf61cd6be649283f58abd7e5f16e13c9b32b48be8e';
const CARRIER_REGISTRY_ID = '0x6e6f141e6ffb7ba7323a1e8a34924cac7920a84f5aadb38f4b4be0332f7e70a4';
const CLOCK_ID = '0x6';

const client = new IotaClient({ url: getFullnodeUrl('testnet') });

function keypairFromPrivKey(privkey: string): Ed25519Keypair {
  const { secretKey } = decodeIotaPrivateKey(privkey);
  return Ed25519Keypair.fromSecretKey(secretKey);
}

const carrierKey = process.env.CARRIER_PRIVKEY;
const shipperKey = process.env.SHIPPER_PRIVKEY;
if (!carrierKey || !shipperKey) {
  console.error('Set CARRIER_PRIVKEY and SHIPPER_PRIVKEY environment variables');
  process.exit(1);
}
const carrier = keypairFromPrivKey(carrierKey);
const shipper = keypairFromPrivKey(shipperKey);

async function main() {
  console.log('Seeding demo data...');

  const carrierAddr = carrier.toIotaAddress();
  const shipperAddr = shipper.toIotaAddress();

  // Register carrier
  const tx1 = new Transaction();
  tx1.moveCall({
    target: `${PACKAGE_ID}::carrier_registry::register`,
    arguments: [
      tx1.object(CARRIER_REGISTRY_ID),
      tx1.pure.string('Portus Shipping Line'),
      tx1.pure.string('PRTS'),
      tx1.pure.string('DE'),
      tx1.object(CLOCK_ID),
    ],
  });
  tx1.moveCall({
    target: `${PACKAGE_ID}::ebl::register_carrier`,
    arguments: [
      tx1.pure.string('Portus Shipping Line'),
      tx1.object(CLOCK_ID),
    ],
  });

  const result1 = await client.signAndExecuteTransaction({
    signer: carrier,
    transaction: tx1,
    options: { showObjectChanges: true },
  });
  const capId = result1.objectChanges?.find(
    (c: any) => c.type === 'created' && c.objectType?.includes('CarrierCap'),
  )?.objectId;

  console.log(`  CarrierCap: ${capId}`);

  // Issue a demo eBL
  const tx2 = new Transaction();
  tx2.moveCall({
    target: `${PACKAGE_ID}::ebl::issue_ebl`,
    arguments: [
      tx2.object(capId!),
      tx2.object(BL_REGISTRY_ID),
      tx2.pure.string('PRTS-2026-HAM-SHA-001'),
      tx2.pure.address(shipperAddr),
      tx2.pure.address(carrierAddr),
      tx2.pure.address(shipperAddr),
      tx2.pure.string('MV Terra Nova'),
      tx2.pure.string('V2026-042'),
      tx2.pure.string('Hamburg, Germany'),
      tx2.pure.string('Shanghai, China'),
      tx2.pure.string('Automotive parts — engine components, transmission assemblies'),
      tx2.pure.string('MSKU1234567, MSKU1234568, MSKU1234569'),
      tx2.pure.u64(36000),
      tx2.pure.u64(720),
      tx2.pure.u8(0),
      tx2.pure.string('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'),
      tx2.object(CLOCK_ID),
    ],
  });

  const result2 = await client.signAndExecuteTransaction({
    signer: carrier,
    transaction: tx2,
    options: { showObjectChanges: true },
  });
  const eblId = result2.objectChanges?.find(
    (c: any) => c.type === 'created' && c.objectType?.includes('ElectronicBL'),
  )?.objectId;

  console.log(`  eBL: ${eblId}`);
  console.log('');
  console.log('Demo data seeded! Use these IDs in the frontend.');
}

main().catch(console.error);
