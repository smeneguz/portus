import type { EBLData } from '../hooks/useEBL';

export default function CargoDetails({ ebl }: { ebl: EBLData }) {
  return (
    <div className="rounded-2xl border border-[#d7e2ef] bg-white p-4">
      <h3 className="font-bold text-[#123a61]">Cargo details</h3>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <dt className="text-[#60758c]">Commodity</dt>
        <dd className="font-semibold text-[#173a5a]">{ebl.commodity_description}</dd>
        <dt className="text-[#60758c]">Containers</dt>
        <dd className="font-mono text-xs text-[#20415f]">{ebl.container_numbers}</dd>
        <dt className="text-[#60758c]">Weight</dt>
        <dd className="font-semibold text-[#173a5a]">{Number(ebl.gross_weight_kg).toLocaleString()} kg</dd>
        <dt className="text-[#60758c]">Packages</dt>
        <dd className="font-semibold text-[#173a5a]">{Number(ebl.number_of_packages).toLocaleString()}</dd>
        <dt className="text-[#60758c]">Freight</dt>
        <dd className="font-semibold text-[#173a5a]">{ebl.freight_terms === '0' ? 'Prepaid' : 'Collect'}</dd>
      </dl>
    </div>
  );
}
