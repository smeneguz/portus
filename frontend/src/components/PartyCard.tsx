interface PartyCardProps {
  role: string;
  address: string;
  highlight?: boolean;
}

export default function PartyCard({ role, address, highlight }: PartyCardProps) {
  const short = address ? `${address.slice(0, 8)}...${address.slice(-6)}` : '---';
  return (
    <div className={`rounded-lg border p-3 ${highlight ? 'border-green-400 bg-green-50' : 'border-gray-200 bg-white'}`}>
      <p className="text-xs font-medium text-gray-500 uppercase">{role}</p>
      <p className="text-sm font-mono mt-1 break-all" title={address}>{short}</p>
    </div>
  );
}
