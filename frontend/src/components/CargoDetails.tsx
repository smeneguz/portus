import type { EBLData } from '../hooks/useEBL';

export default function CargoDetails({ ebl }: { ebl: EBLData }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h3 className="font-semibold text-gray-700 mb-3">Cargo Details</h3>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <dt className="text-gray-500">Commodity</dt>
        <dd>{ebl.commodity_description}</dd>
        <dt className="text-gray-500">Containers</dt>
        <dd className="font-mono text-xs">{ebl.container_numbers}</dd>
        <dt className="text-gray-500">Weight</dt>
        <dd>{Number(ebl.gross_weight_kg).toLocaleString()} kg</dd>
        <dt className="text-gray-500">Packages</dt>
        <dd>{Number(ebl.number_of_packages).toLocaleString()}</dd>
        <dt className="text-gray-500">Freight</dt>
        <dd>{ebl.freight_terms === '0' ? 'Prepaid' : 'Collect'}</dd>
      </dl>
    </div>
  );
}
