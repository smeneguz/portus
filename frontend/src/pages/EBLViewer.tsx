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

  if (loading) return <div className="surface py-14 text-center text-[#5f7389]">Loading eBL data...</div>;
  if (!ebl) return <div className="surface py-14 text-center text-[#9f2d2d]">eBL not found.</div>;

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="surface p-5 md:p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#0f2f50]">{ebl.bl_number}</h1>
            <p className="mt-1 text-sm text-[#5f7389]">{ebl.vessel_name} &middot; Voyage {ebl.voyage_number}</p>
            <p className="text-sm text-[#5f7389]">{ebl.port_of_loading} &rarr; {ebl.port_of_discharge}</p>
          </div>
          <BLStatusBadge status={Number(ebl.status)} />
        </div>
        <a href={explorerObjectUrl(id!)} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-xs font-semibold text-[#0e4fbf] underline">
          View on Explorer
        </a>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left: Cargo */}
        <CargoDetails ebl={ebl} />

        {/* Right: Parties */}
        <div className="space-y-3">
          <h3 className="font-bold text-[#123a61]">Parties</h3>
          <PartyCard role="Carrier" address={ebl.carrier} />
          <PartyCard role="Shipper" address={ebl.shipper} />
          <PartyCard role="Consignee" address={ebl.consignee} />
          <PartyCard role="Notify Party" address={ebl.notify_party} />
          <PartyCard role="Current Holder" address={currentHolder} highlight />
        </div>
      </div>

      {/* Endorsement Chain */}
      <div className="surface p-5 md:p-6">
        <h3 className="mb-4 font-bold text-[#123a61]">Endorsement chain</h3>
        <EndorsementTimeline endorsements={endorsements} currentHolder={currentHolder} />
      </div>

      {/* Content Hash */}
      <div className="surface p-4">
        <h3 className="mb-2 font-bold text-[#123a61]">Content hash</h3>
        <p className="break-all rounded-xl border border-[#d7e2ef] bg-[#f4f8ff] p-3 font-mono text-xs text-[#20415f]">{ebl.content_hash}</p>
      </div>
    </div>
  );
}
