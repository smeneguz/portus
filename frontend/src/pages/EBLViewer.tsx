import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useIotaClient } from '@iota/dapp-kit';
import { parseEBLFields, type EBLData } from '../hooks/useEBL';
import type { EndorsementRecord } from '../hooks/useEndorsement';
import BLStatusBadge from '../components/BLStatusBadge';
import PartyCard from '../components/PartyCard';
import CargoDetails from '../components/CargoDetails';
import EndorsementTimeline from '../components/EndorsementTimeline';
import { explorerObjectUrl, PACKAGE_ID } from '../config/constants';

export default function EBLViewer() {
  const { id } = useParams<{ id: string }>();
  const client = useIotaClient();
  const [ebl, setEbl] = useState<EBLData | null>(null);
  const [endorsements, setEndorsements] = useState<EndorsementRecord[]>([]);
  const [currentHolder, setCurrentHolder] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      setLoading(true);
      try {
        const obj = await client.getObject({ id, options: { showContent: true } });
        if (obj.data?.content?.dataType === 'moveObject') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const fields = (obj.data.content as any).fields;
          setEbl(parseEBLFields(fields));
          setCurrentHolder(fields.current_holder || '');
        }

        // Try to find the endorsement chain for this eBL
        const eblType = `${PACKAGE_ID}::endorsement::EndorsementChain`;
        const events = await client.queryEvents({
          query: { MoveEventType: `${PACKAGE_ID}::endorsement::EndorsementMade` },
          limit: 50,
        });
        // Find chain object by querying owned objects isn't straightforward,
        // so we show endorsement events instead
        const blEndorsements: EndorsementRecord[] = events.data
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .filter((ev: any) => ev.parsedJson?.bl_id === id)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((ev: any) => ({
            from: ev.parsedJson?.from || '',
            to: ev.parsedJson?.to || '',
            endorsement_type: String(ev.parsedJson?.endorsement_type || 0),
            timestamp: String(ev.parsedJson?.timestamp || 0),
          }));
        setEndorsements(blEndorsements);
        void eblType; // used for type reference
      } catch (err) {
        console.error('Failed to load eBL:', err);
      }
      setLoading(false);
    };
    load();
  }, [id, client]);

  if (loading) return <div className="py-16 text-center text-gray-500">Loading eBL...</div>;
  if (!ebl) return <div className="py-16 text-center text-red-500">eBL not found.</div>;

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">{ebl.bl_number}</h1>
            <p className="text-gray-500 mt-1">{ebl.vessel_name} &middot; Voyage {ebl.voyage_number}</p>
            <p className="text-gray-500">{ebl.port_of_loading} &rarr; {ebl.port_of_discharge}</p>
          </div>
          <BLStatusBadge status={Number(ebl.status)} />
        </div>
        <a href={explorerObjectUrl(id!)} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 underline mt-2 inline-block">
          View on Explorer
        </a>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left: Cargo */}
        <CargoDetails ebl={ebl} />

        {/* Right: Parties */}
        <div className="space-y-3">
          <h3 className="font-semibold text-gray-700">Parties</h3>
          <PartyCard role="Carrier" address={ebl.carrier} />
          <PartyCard role="Shipper" address={ebl.shipper} />
          <PartyCard role="Consignee" address={ebl.consignee} />
          <PartyCard role="Notify Party" address={ebl.notify_party} />
          <PartyCard role="Current Holder" address={currentHolder} highlight />
        </div>
      </div>

      {/* Endorsement Chain */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-700 mb-4">Endorsement Chain</h3>
        <EndorsementTimeline endorsements={endorsements} currentHolder={currentHolder} />
      </div>

      {/* Content Hash */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="font-semibold text-gray-700 mb-2">Content Hash</h3>
        <p className="font-mono text-xs break-all text-gray-600">{ebl.content_hash}</p>
      </div>
    </div>
  );
}
