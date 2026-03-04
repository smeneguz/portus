import { STATUS_LABELS } from '../config/constants';

const STATUS_COLORS: Record<number, string> = {
  0: 'border-[#a6c4f2] bg-[#e8f1ff] text-[#114f99]',
  1: 'border-[#f1dc99] bg-[#fff6db] text-[#8a6300]',
  2: 'border-[#f0cd9e] bg-[#fff2df] text-[#89531a]',
  3: 'border-[#b8d6fb] bg-[#eaf4ff] text-[#1f5e9d]',
  4: 'border-[#a8ddca] bg-[#e8f9f1] text-[#0d6a49]',
};

export default function BLStatusBadge({ status }: { status: number }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold ${STATUS_COLORS[status] ?? 'border-[#d8e2ef] bg-[#f3f6fa] text-[#4a6078]'}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
      {STATUS_LABELS[status] ?? 'Unknown'}
    </span>
  );
}
