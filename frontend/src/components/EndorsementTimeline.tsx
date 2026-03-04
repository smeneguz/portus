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
      <div className="rounded-xl border border-dashed border-[#c8d6e7] bg-[#f8fbff] p-4 text-sm italic text-[#5f7389]">
        No endorsements yet.
      </div>
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
              <div className={`mt-1.5 h-3 w-3 rounded-full ${isLast ? 'bg-[#0e8d5b]' : 'bg-[#0e4fbf]'}`} />
              {!isLast && <div className="w-0.5 flex-1 bg-[#d0dceb]" />}
            </div>
            <div className="pb-4">
              <p className="text-sm font-semibold text-[#173a5a]">
                <span className="font-mono text-xs">{shortAddr(e.from)}</span>
                {' → '}
                <span className="font-mono text-xs">{shortAddr(e.to)}</span>
              </p>
              <p className="text-xs text-[#5f7389]">
                {type} &middot; {ts}
              </p>
            </div>
          </div>
        );
      })}
      <div className="flex gap-3 items-center">
        <div className="h-3 w-3 rounded-full bg-[#0e8d5b] ring-2 ring-[#c8ebdc]" />
        <p className="text-sm font-semibold text-[#0e6a47]">
          Current holder: <span className="font-mono text-xs">{shortAddr(currentHolder)}</span>
        </p>
      </div>
    </div>
  );
}
