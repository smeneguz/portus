import { useEffect, useState } from 'react';
import { useCurrentAccount, useIotaClient } from '@iota/dapp-kit';
import { useRegisterCarrier, useIssueEBL } from '../hooks/useEBL';
import { useRegisterInRegistry } from '../hooks/useCarrier';
import { computeSHA256 } from '../hooks/useNotarization';
import { explorerTxUrl, PACKAGE_ID } from '../config/constants';

type Notice = {
  tone: 'ok' | 'error';
  text: string;
};

export default function CarrierDashboard() {
  const account = useCurrentAccount();
  const client = useIotaClient();
  const { registerCarrier, isPending: regPending } = useRegisterCarrier();
  const { register: regInRegistry, isPending: regRegPending } = useRegisterInRegistry();
  const { issueEBL, isPending: issuePending } = useIssueEBL();

  const [carrierName, setCarrierName] = useState('Portus Shipping');
  const [scacCode, setScacCode] = useState('PRTS');
  const [country, setCountry] = useState('DE');
  const [carrierCapId, setCarrierCapId] = useState('');
  const [lastTx, setLastTx] = useState('');
  const [notice, setNotice] = useState<Notice | null>(null);

  const [blNumber, setBlNumber] = useState('');
  const [shipper, setShipper] = useState('');
  const [consignee, setConsignee] = useState('');
  const [notifyParty, setNotifyParty] = useState('');
  const [vesselName, setVesselName] = useState('');
  const [voyageNumber, setVoyageNumber] = useState('');
  const [portOfLoading, setPortOfLoading] = useState('');
  const [portOfDischarge, setPortOfDischarge] = useState('');
  const [commodity, setCommodity] = useState('');
  const [containers, setContainers] = useState('');
  const [weight, setWeight] = useState('');
  const [packages, setPackages] = useState('');
  const [freightTerms, setFreightTerms] = useState(0);
  const [contentHash, setContentHash] = useState('');

  const canIssue =
    Boolean(carrierCapId) &&
    Boolean(blNumber) &&
    Boolean(shipper) &&
    Boolean(consignee) &&
    Boolean(vesselName) &&
    Boolean(voyageNumber) &&
    Boolean(portOfLoading) &&
    Boolean(portOfDischarge) &&
    Boolean(commodity) &&
    Boolean(weight) &&
    Boolean(packages) &&
    Boolean(contentHash);

  const extractCarrierCapId = (
    changes: Array<{ type?: string; objectType?: string; objectId?: string }> | undefined,
  ): string => {
    if (!changes?.length) return '';
    const cap = changes.find(
      (c) =>
        c.type === 'created' &&
        (c.objectType === `${PACKAGE_ID}::ebl::CarrierCap` || c.objectType?.endsWith('::ebl::CarrierCap')),
    );
    return cap?.objectId || '';
  };

  useEffect(() => {
    const loadExistingCap = async () => {
      if (!account?.address) return;
      try {
        const owned = await client.getOwnedObjects({
          owner: account.address,
          filter: { StructType: `${PACKAGE_ID}::ebl::CarrierCap` },
          options: { showType: true },
          limit: 50,
        });
        const latest = owned.data
          .map((entry) => entry.data)
          .filter((d): d is NonNullable<typeof d> => Boolean(d))
          .sort((a, b) => Number((b as { version?: string | number }).version ?? 0) - Number((a as { version?: string | number }).version ?? 0))[0];
        if (latest?.objectId) setCarrierCapId(latest.objectId);
      } catch (err) {
        console.warn('Failed to auto-load existing CarrierCap:', err);
      }
    };
    void loadExistingCap();
  }, [account?.address, client]);

  const handleRegister = async () => {
    setNotice(null);
    try {
      await regInRegistry(carrierName, scacCode, country);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = (await registerCarrier(carrierName)) as any;
      const digest = result.digest as string | undefined;

      let capId = extractCarrierCapId(
        (result.objectChanges ?? []) as Array<{ type: string; objectType?: string; objectId?: string }>,
      );

      if (!capId && digest) {
        try {
          const tx = await client.getTransactionBlock({
            digest,
            options: { showObjectChanges: true },
          });
          capId = extractCarrierCapId(
            (tx.objectChanges ?? []) as Array<{ type: string; objectType?: string; objectId?: string }>,
          );
        } catch (fetchErr) {
          console.warn('Failed to fetch tx object changes for cap resolution:', fetchErr);
        }
      }

      if (!capId && account?.address) {
        try {
          const owned = await client.getOwnedObjects({
            owner: account.address,
            filter: { StructType: `${PACKAGE_ID}::ebl::CarrierCap` },
            options: { showType: true },
            limit: 50,
          });
          const latest = owned.data
            .map((entry) => entry.data)
            .filter((d): d is NonNullable<typeof d> => Boolean(d))
            .sort((a, b) => Number((b as { version?: string | number }).version ?? 0) - Number((a as { version?: string | number }).version ?? 0))[0];
          capId = latest?.objectId || '';
        } catch (ownedErr) {
          console.warn('Failed to fetch owned CarrierCap objects:', ownedErr);
        }
      }

      if (capId) setCarrierCapId(capId);
      if (result.digest) setLastTx(result.digest as string);
      setNotice({
        tone: capId ? 'ok' : 'error',
        text: capId
          ? 'Carrier registered successfully. You can now issue new eBLs.'
          : 'Carrier registered, but CarrierCap was not auto-detected. Reload page or paste the CarrierCap ID manually.',
      });
    } catch (err) {
      console.error('Registration failed:', err);
      setNotice({ tone: 'error', text: 'Carrier registration failed. Check wallet permissions and try again.' });
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setNotice(null);
      const hash = await computeSHA256(file);
      setContentHash(hash);
      setNotice({ tone: 'ok', text: `Document hash generated from ${file.name}.` });
    }
  };

  const handleIssue = async () => {
    if (!carrierCapId) return;
    setNotice(null);
    try {
      const result = await issueEBL({
        carrierCapId,
        blNumber,
        shipper,
        consignee,
        notifyParty: notifyParty || shipper,
        vesselName,
        voyageNumber,
        portOfLoading,
        portOfDischarge,
        commodityDescription: commodity,
        containerNumbers: containers,
        grossWeightKg: Number(weight),
        numberOfPackages: Number(packages),
        freightTerms,
        contentHash,
      });
      if (result.digest) setLastTx(result.digest);
      setNotice({ tone: 'ok', text: 'eBL issued successfully and anchored on-chain.' });
    } catch (err) {
      console.error('Issue failed:', err);
      setNotice({ tone: 'error', text: 'Issuance failed. Verify addresses, hash and wallet balance.' });
    }
  };

  if (!account) {
    return (
      <div className="surface p-10 text-center">
        <h2 className="section-title">Carrier Desk</h2>
        <p className="section-subtitle mt-2">Connect your IOTA wallet to register as carrier and issue eBLs.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="surface p-5 md:p-6">
        <h2 className="section-title">Carrier onboarding</h2>
        <p className="section-subtitle mt-1">Register your legal carrier profile and mint a `CarrierCap` to issue Bills of Lading.</p>

        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className="field-label">Carrier name</label>
            <input className="field-input" placeholder="Portus Shipping GmbH" value={carrierName} onChange={(e) => setCarrierName(e.target.value)} />
          </div>
          <div>
            <label className="field-label">SCAC code</label>
            <input className="field-input uppercase" placeholder="PRTS" value={scacCode} onChange={(e) => setScacCode(e.target.value.toUpperCase())} />
          </div>
          <div>
            <label className="field-label">Country</label>
            <input className="field-input uppercase" placeholder="DE" value={country} onChange={(e) => setCountry(e.target.value.toUpperCase())} />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button onClick={handleRegister} disabled={regPending || regRegPending} className="btn-main">
            {regPending || regRegPending ? 'Registering...' : 'Register Carrier'}
          </button>
          <p className="text-xs text-[#5f7389]">Action signs two transactions: registry profile + carrier capability.</p>
        </div>

        <div className="mt-4 rounded-xl border border-[#d6e1ef] bg-[#f4f8ff] p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#3d5e81]">CarrierCap</p>
          <p className="mt-1 break-all font-mono text-xs text-[#23405f]">{carrierCapId || 'Not minted yet. Register as carrier first.'}</p>
        </div>
      </section>

      <section className="surface p-5 md:p-6">
        <h2 className="section-title">Issue a new eBL</h2>
        <p className="section-subtitle mt-1">Fill shipment data, attach notarized hash, then sign and publish the eBL object on IOTA.</p>

        {!carrierCapId && (
          <div className="mt-4 rounded-xl border border-[#ffe6b0] bg-[#fff8e7] p-3 text-sm text-[#825600]">
            No CarrierCap detected in this session. Paste an existing `CarrierCap ID` below if you already registered before.
          </div>
        )}

        <div className="mt-5">
          <label className="field-label">CarrierCap ID</label>
          <input className="field-input font-mono text-xs" placeholder="0x..." value={carrierCapId} onChange={(e) => setCarrierCapId(e.target.value)} />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="field-label">BL number</label>
            <input className="field-input" placeholder="PRTS-2026-HAM-SHA-001" value={blNumber} onChange={(e) => setBlNumber(e.target.value)} />
          </div>
          <div>
            <label className="field-label">Vessel name</label>
            <input className="field-input" placeholder="MV Portus One" value={vesselName} onChange={(e) => setVesselName(e.target.value)} />
          </div>
          <div>
            <label className="field-label">Voyage number</label>
            <input className="field-input" placeholder="VOY-9912" value={voyageNumber} onChange={(e) => setVoyageNumber(e.target.value)} />
          </div>
          <div>
            <label className="field-label">Commodity</label>
            <input className="field-input" placeholder="Lithium carbonate" value={commodity} onChange={(e) => setCommodity(e.target.value)} />
          </div>
          <div>
            <label className="field-label">Port of loading</label>
            <input className="field-input" placeholder="Hamburg" value={portOfLoading} onChange={(e) => setPortOfLoading(e.target.value)} />
          </div>
          <div>
            <label className="field-label">Port of discharge</label>
            <input className="field-input" placeholder="Shanghai" value={portOfDischarge} onChange={(e) => setPortOfDischarge(e.target.value)} />
          </div>
          <div>
            <label className="field-label">Shipper address</label>
            <input className="field-input font-mono text-xs" placeholder="0x..." value={shipper} onChange={(e) => setShipper(e.target.value)} />
          </div>
          <div>
            <label className="field-label">Consignee address</label>
            <input className="field-input font-mono text-xs" placeholder="0x..." value={consignee} onChange={(e) => setConsignee(e.target.value)} />
          </div>
          <div>
            <label className="field-label">Notify party (optional)</label>
            <input className="field-input font-mono text-xs" placeholder="Defaults to shipper if empty" value={notifyParty} onChange={(e) => setNotifyParty(e.target.value)} />
          </div>
          <div>
            <label className="field-label">Container numbers</label>
            <input className="field-input" placeholder="MSCU12345, MSCU67890" value={containers} onChange={(e) => setContainers(e.target.value)} />
          </div>
          <div>
            <label className="field-label">Gross weight (kg)</label>
            <input className="field-input" placeholder="25000" type="number" value={weight} onChange={(e) => setWeight(e.target.value)} />
          </div>
          <div>
            <label className="field-label">Number of packages</label>
            <input className="field-input" placeholder="440" type="number" value={packages} onChange={(e) => setPackages(e.target.value)} />
          </div>
        </div>

        <div className="mt-4">
          <p className="field-label">Freight terms</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={`rounded-xl border px-3 py-2 text-sm font-semibold ${freightTerms === 0 ? 'border-[#0e4fbf] bg-[#e6efff] text-[#0e4fbf]' : 'border-[#cfd9e8] bg-white text-[#4e647d]'}`}
              onClick={() => setFreightTerms(0)}
            >
              Prepaid
            </button>
            <button
              type="button"
              className={`rounded-xl border px-3 py-2 text-sm font-semibold ${freightTerms === 1 ? 'border-[#0e4fbf] bg-[#e6efff] text-[#0e4fbf]' : 'border-[#cfd9e8] bg-white text-[#4e647d]'}`}
              onClick={() => setFreightTerms(1)}
            >
              Collect
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-[1.2fr_1fr]">
          <div>
            <label className="field-label">Upload BoL PDF to compute hash</label>
            <input
              type="file"
              accept=".pdf"
              onChange={handleFileUpload}
              className="block w-full rounded-xl border border-[#cfd9e8] bg-white p-2.5 text-sm text-[#4f657d] file:mr-3 file:rounded-lg file:border-0 file:bg-[#e6efff] file:px-3 file:py-2 file:text-xs file:font-semibold file:text-[#0e4fbf]"
            />
          </div>
          <div>
            <label className="field-label">Or paste existing SHA-256 hash</label>
            <input
              className="field-input font-mono text-xs"
              placeholder="ab12c3..."
              value={contentHash}
              onChange={(e) => setContentHash(e.target.value)}
            />
          </div>
        </div>

        {contentHash && (
          <p className="mt-2 break-all rounded-lg bg-[#f4f8ff] px-3 py-2 font-mono text-xs text-[#365575]">
            Content hash: {contentHash}
          </p>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button onClick={handleIssue} disabled={issuePending || !canIssue} className="btn-success">
            {issuePending ? 'Issuing eBL...' : 'Issue eBL'}
          </button>
          <p className="text-xs text-[#5f7389]">Required fields must be complete before submitting.</p>
        </div>
      </section>

      {notice && (
        <div
          className={`rounded-xl border p-3 text-sm ${
            notice.tone === 'ok'
              ? 'border-[#b7e6d3] bg-[#eafaf3] text-[#0e6a47]'
              : 'border-[#f2c2c2] bg-[#fff0f0] text-[#9f2d2d]'
          }`}
        >
          {notice.text}
        </div>
      )}

      {lastTx && (
        <div className="rounded-xl border border-[#c9dff8] bg-[#eef6ff] p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#3a6289]">Last transaction</p>
          <a href={explorerTxUrl(lastTx)} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block font-mono text-xs text-[#0e4fbf] underline">
            {lastTx}
          </a>
        </div>
      )}
    </div>
  );
}
