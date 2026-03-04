interface PartyCardProps {
  role: string;
  address: string;
  highlight?: boolean;
}

export default function PartyCard({ role, address, highlight }: PartyCardProps) {
  const short = address ? `${address.slice(0, 8)}...${address.slice(-6)}` : '---';
  return (
    <div className={`rounded-xl border p-3 ${highlight ? 'border-[#9bd6c1] bg-[#e9f8f1]' : 'border-[#d7e2ef] bg-white'}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-[#60758c]">{role}</p>
      <p className="mt-1 break-all font-mono text-xs text-[#20415f]" title={address}>
        {short}
      </p>
    </div>
  );
}
