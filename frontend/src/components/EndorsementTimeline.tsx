import { ENDORSEMENT_TYPES } from '../config/constants';
import type { EndorsementRecord } from '../hooks/useEndorsement';

interface Props {
  endorsements: EndorsementRecord[];
  currentHolder: string;
}

function shortAddr(addr: string) {
  return addr ? `${addr.slice(0, 8)}...${addr.slice(-6)}` : '---';
}

export default function EndorsementTimeline({ endorsements, currentHolder }: Props) {
  if (!endorsements.length) {
    return (
      <div className="text-sm text-gray-500 italic p-4">No endorsements yet.</div>
    );
  }

  return (
    <div className="space-y-0">
      {endorsements.map((e, i) => {
        const isLast = i === endorsements.length - 1;
        const type = ENDORSEMENT_TYPES[Number(e.endorsement_type)] ?? 'Unknown';
        const ts = Number(e.timestamp) ? new Date(Number(e.timestamp)).toLocaleString() : '';

        return (
          <div key={i} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className={`w-3 h-3 rounded-full mt-1.5 ${isLast ? 'bg-green-500' : 'bg-blue-500'}`} />
              {!isLast && <div className="w-0.5 flex-1 bg-gray-200" />}
            </div>
            <div className="pb-4">
              <p className="text-sm font-medium">
                <span className="font-mono text-xs">{shortAddr(e.from)}</span>
                {' → '}
                <span className="font-mono text-xs">{shortAddr(e.to)}</span>
              </p>
              <p className="text-xs text-gray-500">
                {type} &middot; {ts}
              </p>
            </div>
          </div>
        );
      })}
      <div className="flex gap-3 items-center">
        <div className="w-3 h-3 rounded-full bg-green-500 ring-2 ring-green-200" />
        <p className="text-sm font-medium text-green-700">
          Current holder: <span className="font-mono text-xs">{shortAddr(currentHolder)}</span>
        </p>
      </div>
    </div>
  );
}
