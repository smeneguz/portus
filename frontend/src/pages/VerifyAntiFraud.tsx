import { useState } from 'react';
import { useIotaClient } from '@iota/dapp-kit';
import { parseEBLFields, type EBLData } from '../hooks/useEBL';
import BLStatusBadge from '../components/BLStatusBadge';
import DocumentVerifier from '../components/DocumentVerifier';
import { explorerObjectUrl } from '../config/constants';

export default function VerifyAntiFraud() {
  const client = useIotaClient();
  const [objectId, setObjectId] = useState('');
  const [ebl, setEbl] = useState<EBLData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLookup = async () => {
    if (!objectId) return;
    setLoading(true);
    setError('');
    setEbl(null);
    try {
      const obj = await client.getObject({
        id: objectId,
        options: { showContent: true },
      });
      if (obj.data?.content?.dataType === 'moveObject') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const fields = (obj.data.content as any).fields;
        setEbl(parseEBLFields(fields));
      } else {
        setError('Object not found or not a valid eBL move object.');
      }
    } catch {
      setError('Lookup failed. Verify the object ID and network configuration.');
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <section className="surface p-5 md:p-6">
        <h2 className="section-title">Anti-fraud verification</h2>
        <p className="section-subtitle mt-1">
          Resolve an eBL directly from IOTA, inspect its live status and compare document hash with the uploaded file.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto]">
          <input
            className="field-input font-mono text-xs"
            placeholder="Paste eBL object ID (0x...)"
            value={objectId}
            onChange={(e) => setObjectId(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
          />
          <button onClick={handleLookup} disabled={loading || !objectId} className="btn-main">
            {loading ? 'Resolving...' : 'Verify eBL'}
          </button>
        </div>

        {error && <p className="mt-3 rounded-lg border border-[#f2c2c2] bg-[#fff0f0] px-3 py-2 text-sm text-[#9f2d2d]">{error}</p>}
      </section>

      {ebl && (
        <div className="space-y-6">
          <section className="surface p-5 md:p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <h3 className="text-2xl font-bold tracking-tight text-[#0f2f50]">{ebl.bl_number}</h3>
                <p className="mt-1 text-sm text-[#5f7389]">{ebl.vessel_name} · Voyage {ebl.voyage_number}</p>
                <p className="text-sm text-[#5f7389]">{ebl.port_of_loading} → {ebl.port_of_discharge}</p>
              </div>
              <BLStatusBadge status={Number(ebl.status)} />
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-[#d7e2ef] bg-white p-3">
                <p className="text-xs uppercase tracking-wide text-[#60758c]">Carrier</p>
                <p className="mt-1 break-all font-mono text-xs text-[#20415f]">{ebl.carrier}</p>
              </div>
              <div className="rounded-xl border border-[#d7e2ef] bg-white p-3">
                <p className="text-xs uppercase tracking-wide text-[#60758c]">Current holder</p>
                <p className="mt-1 break-all font-mono text-xs text-[#20415f]">{ebl.current_holder}</p>
              </div>
              <div className="rounded-xl border border-[#d7e2ef] bg-white p-3">
                <p className="text-xs uppercase tracking-wide text-[#60758c]">Endorsements</p>
                <p className="mt-1 text-sm font-semibold text-[#1e3a58]">{ebl.endorsement_count}</p>
              </div>
              <div className="rounded-xl border border-[#d7e2ef] bg-white p-3">
                <p className="text-xs uppercase tracking-wide text-[#60758c]">Commodity</p>
                <p className="mt-1 text-sm font-semibold text-[#1e3a58]">{ebl.commodity_description}</p>
              </div>
            </div>

            <a href={explorerObjectUrl(objectId)} target="_blank" rel="noopener noreferrer" className="mt-4 inline-block text-xs font-semibold text-[#0e4fbf] underline">
              Open object in IOTA Explorer
            </a>
          </section>

          <section className="surface p-5 md:p-6">
            <h3 className="text-lg font-bold text-[#123a61]">Document integrity check</h3>
            <p className="mt-1 text-sm text-[#5f7389]">Upload the BoL file and compare the computed hash with the notarized value.</p>

            <div className="mt-4 rounded-xl border border-[#d7e2ef] bg-[#f4f8ff] p-3">
              <p className="text-xs uppercase tracking-wide text-[#60758c]">On-chain content hash</p>
              <p className="mt-1 break-all font-mono text-xs text-[#20415f]">{ebl.content_hash}</p>
            </div>

            <div className="mt-4">
              <DocumentVerifier onChainHash={ebl.content_hash} />
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
