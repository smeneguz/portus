import { useState } from 'react';
import { useCurrentAccount } from '@iota/dapp-kit';
import { useRegisterCarrier, useIssueEBL } from '../hooks/useEBL';
import { useRegisterInRegistry } from '../hooks/useCarrier';
import { computeSHA256 } from '../hooks/useNotarization';
import { explorerTxUrl } from '../config/constants';

export default function CarrierDashboard() {
  const account = useCurrentAccount();
  const { registerCarrier, isPending: regPending } = useRegisterCarrier();
  const { register: regInRegistry, isPending: regRegPending } = useRegisterInRegistry();
  const { issueEBL, isPending: issuePending } = useIssueEBL();

  const [carrierName, setCarrierName] = useState('Portus Shipping');
  const [scacCode, setScacCode] = useState('PRTS');
  const [country, setCountry] = useState('DE');
  const [carrierCapId, setCarrierCapId] = useState('');
  const [lastTx, setLastTx] = useState('');

  // Issue eBL form
  const [blNumber, setBlNumber] = useState('');
  const [shipper, setShipper] = useState('');
  const [consignee, setConsignee] = useState('');
  const [notifyParty, setNotifyParty] = useState('');
  const [vesselName, setVesselName] = useState('');
  const [voyageNumber, setVoyageNumber] = useState('');
  const [portOfLoading, setPortOfLoading] = useState('');
  const [portOfDischarge, setPortOfDischarge] = useState('');
  const [commodity, setCommodity] = useState('');
  const [containers, setContainers] = useState('');
  const [weight, setWeight] = useState('');
  const [packages, setPackages] = useState('');
  const [freightTerms, setFreightTerms] = useState(0);
  const [contentHash, setContentHash] = useState('');

  const handleRegister = async () => {
    try {
      // Register in both carrier_registry and ebl modules
      await regInRegistry(carrierName, scacCode, country);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await registerCarrier(carrierName) as any;
      const changes = (result.objectChanges ?? []) as Array<{ type: string; objectType?: string; objectId?: string }>;
      const capObj = changes.find((c) => c.type === 'created' && c.objectType?.includes('CarrierCap'));
      if (capObj?.objectId) setCarrierCapId(capObj.objectId);
      if (result.digest) setLastTx(result.digest as string);
    } catch (err) {
      console.error('Registration failed:', err);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const hash = await computeSHA256(file);
      setContentHash(hash);
    }
  };

  const handleIssue = async () => {
    if (!carrierCapId) return alert('Register as carrier first');
    try {
      const result = await issueEBL({
        carrierCapId,
        blNumber,
        shipper,
        consignee,
        notifyParty: notifyParty || shipper,
        vesselName,
        voyageNumber,
        portOfLoading,
        portOfDischarge,
        commodityDescription: commodity,
        containerNumbers: containers,
        grossWeightKg: Number(weight),
        numberOfPackages: Number(packages),
        freightTerms,
        contentHash,
      });
      if (result.digest) setLastTx(result.digest);
    } catch (err) {
      console.error('Issue failed:', err);
    }
  };

  if (!account) {
    return (
      <div className="text-center py-16">
        <h1 className="text-3xl font-bold text-gray-800 mb-4">Carrier Dashboard</h1>
        <p className="text-gray-500">Connect your wallet to access the carrier dashboard.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-gray-800">Carrier Dashboard</h1>

      {/* Register Carrier */}
      <section className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold mb-4">Register as Carrier</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <input className="border rounded px-3 py-2 text-sm" placeholder="Carrier Name" value={carrierName} onChange={(e) => setCarrierName(e.target.value)} />
          <input className="border rounded px-3 py-2 text-sm" placeholder="SCAC Code" value={scacCode} onChange={(e) => setScacCode(e.target.value)} />
          <input className="border rounded px-3 py-2 text-sm" placeholder="Country" value={country} onChange={(e) => setCountry(e.target.value)} />
        </div>
        <button
          onClick={handleRegister}
          disabled={regPending || regRegPending}
          className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {regPending || regRegPending ? 'Registering...' : 'Register Carrier'}
        </button>
        {carrierCapId && (
          <p className="mt-2 text-sm text-green-600">CarrierCap: <span className="font-mono text-xs">{carrierCapId}</span></p>
        )}
      </section>

      {/* Issue eBL */}
      <section className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold mb-4">Issue New eBL</h2>
        {!carrierCapId && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">CarrierCap ID (paste if already registered)</label>
            <input className="border rounded px-3 py-2 text-sm w-full font-mono" placeholder="0x..." value={carrierCapId} onChange={(e) => setCarrierCapId(e.target.value)} />
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <input className="border rounded px-3 py-2 text-sm" placeholder="BL Number (e.g., PRTS-2026-HAM-SHA-001)" value={blNumber} onChange={(e) => setBlNumber(e.target.value)} />
          <input className="border rounded px-3 py-2 text-sm font-mono" placeholder="Shipper Address (0x...)" value={shipper} onChange={(e) => setShipper(e.target.value)} />
          <input className="border rounded px-3 py-2 text-sm font-mono" placeholder="Consignee Address (0x...)" value={consignee} onChange={(e) => setConsignee(e.target.value)} />
          <input className="border rounded px-3 py-2 text-sm font-mono" placeholder="Notify Party Address (0x...)" value={notifyParty} onChange={(e) => setNotifyParty(e.target.value)} />
          <input className="border rounded px-3 py-2 text-sm" placeholder="Vessel Name" value={vesselName} onChange={(e) => setVesselName(e.target.value)} />
          <input className="border rounded px-3 py-2 text-sm" placeholder="Voyage Number" value={voyageNumber} onChange={(e) => setVoyageNumber(e.target.value)} />
          <input className="border rounded px-3 py-2 text-sm" placeholder="Port of Loading" value={portOfLoading} onChange={(e) => setPortOfLoading(e.target.value)} />
          <input className="border rounded px-3 py-2 text-sm" placeholder="Port of Discharge" value={portOfDischarge} onChange={(e) => setPortOfDischarge(e.target.value)} />
          <input className="border rounded px-3 py-2 text-sm" placeholder="Commodity Description" value={commodity} onChange={(e) => setCommodity(e.target.value)} />
          <input className="border rounded px-3 py-2 text-sm" placeholder="Container Numbers (comma-separated)" value={containers} onChange={(e) => setContainers(e.target.value)} />
          <input className="border rounded px-3 py-2 text-sm" placeholder="Gross Weight (kg)" type="number" value={weight} onChange={(e) => setWeight(e.target.value)} />
          <input className="border rounded px-3 py-2 text-sm" placeholder="Number of Packages" type="number" value={packages} onChange={(e) => setPackages(e.target.value)} />
        </div>
        <div className="flex items-center gap-4 mb-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" checked={freightTerms === 0} onChange={() => setFreightTerms(0)} /> Prepaid
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" checked={freightTerms === 1} onChange={() => setFreightTerms(1)} /> Collect
          </label>
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Upload BoL PDF (for content hash)</label>
          <input type="file" accept=".pdf" onChange={handleFileUpload} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700" />
          {contentHash && <p className="mt-1 text-xs font-mono text-gray-500 break-all">SHA-256: {contentHash}</p>}
          {!contentHash && <input className="border rounded px-3 py-2 text-sm w-full font-mono mt-2" placeholder="Or paste content hash manually" onChange={(e) => setContentHash(e.target.value)} />}
        </div>
        <button
          onClick={handleIssue}
          disabled={issuePending || !carrierCapId}
          className="bg-green-600 text-white px-6 py-2 rounded text-sm font-medium hover:bg-green-700 disabled:opacity-50"
        >
          {issuePending ? 'Issuing...' : 'Issue eBL'}
        </button>
      </section>

      {lastTx && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            Last transaction:{' '}
            <a href={explorerTxUrl(lastTx)} target="_blank" rel="noopener noreferrer" className="underline font-mono text-xs">
              {lastTx.slice(0, 16)}...
            </a>
          </p>
        </div>
      )}
    </div>
  );
}
