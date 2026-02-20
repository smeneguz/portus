import { STATUS_LABELS } from '../config/constants';

const STATUS_COLORS: Record<number, string> = {
  0: 'bg-blue-100 text-blue-800',
  1: 'bg-yellow-100 text-yellow-800',
  2: 'bg-orange-100 text-orange-800',
  3: 'bg-purple-100 text-purple-800',
  4: 'bg-green-100 text-green-800',
};

export default function BLStatusBadge({ status }: { status: number }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-800'}`}>
      {STATUS_LABELS[status] ?? 'Unknown'}
    </span>
  );
}
