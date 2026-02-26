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
        setError('Object not found or not an eBL.');
      }
    } catch {
      setError('Failed to fetch object. Check the ID and try again.');
    }
    setLoading(false);
  };

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-800">Verify eBL</h1>
        <p className="text-gray-500 mt-2">Anti-fraud verification - check any Bill of Lading against the on-chain record.</p>
      </div>

      {/* Search */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 max-w-2xl mx-auto">
        <label className="block text-sm font-medium text-gray-700 mb-1">eBL Object ID</label>
        <div className="flex gap-2">
          <input
            className="border rounded px-3 py-2 text-sm font-mono flex-1"
            placeholder="0x..."
            value={objectId}
            onChange={(e) => setObjectId(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
          />
          <button
            onClick={handleLookup}
            disabled={loading}
            className="bg-blue-600 text-white px-6 py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Looking up...' : 'Verify'}
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>

      {/* Results */}
      {ebl && (
        <div className="space-y-6 max-w-2xl mx-auto">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold text-gray-800">{ebl.bl_number}</h2>
                <p className="text-gray-500">{ebl.vessel_name} &middot; Voyage {ebl.voyage_number}</p>
                <p className="text-gray-500">{ebl.port_of_loading} &rarr; {ebl.port_of_discharge}</p>
              </div>
              <BLStatusBadge status={Number(ebl.status)} />
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Carrier</p>
                <p className="font-mono text-xs">{ebl.carrier.slice(0, 10)}...{ebl.carrier.slice(-6)}</p>
              </div>
              <div>
                <p className="text-gray-500">Current Holder</p>
                <p className="font-mono text-xs">{ebl.current_holder.slice(0, 10)}...{ebl.current_holder.slice(-6)}</p>
              </div>
              <div>
                <p className="text-gray-500">Endorsements</p>
                <p>{ebl.endorsement_count}</p>
              </div>
              <div>
                <p className="text-gray-500">Commodity</p>
                <p>{ebl.commodity_description}</p>
              </div>
            </div>

            <a href={explorerObjectUrl(objectId)} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 underline mt-4 inline-block">
              View on IOTA Explorer
            </a>
          </div>

          {/* Anti-Fraud Document Verification */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Anti-Fraud Check</h3>
            <div className="mb-4 p-3 bg-gray-50 rounded">
              <p className="text-xs text-gray-500">On-chain content hash:</p>
              <p className="font-mono text-xs break-all">{ebl.content_hash}</p>
            </div>
            <DocumentVerifier onChainHash={ebl.content_hash} />
          </div>
        </div>
      )}
    </div>
  );
}
