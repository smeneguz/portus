import { useState } from 'react';
import { useCurrentAccount } from '@iota/dapp-kit';
import { useSurrender, useAccomplish } from '../hooks/useEBL';
import { explorerTxUrl } from '../config/constants';

type Banner = {
  tone: 'ok' | 'error';
  text: string;
};

export default function SurrenderPort() {
  const account = useCurrentAccount();
  const { surrender, isPending: surrenderPending } = useSurrender();
  const { accomplish, isPending: accomplishPending } = useAccomplish();

  const [eblId, setEblId] = useState('');
  const [lastTx, setLastTx] = useState('');
  const [message, setMessage] = useState<Banner | null>(null);

  const handleSurrender = async () => {
    setMessage(null);
    try {
      const result = await surrender(eblId);
      if (result.digest) {
        setLastTx(result.digest);
      }
      setMessage({ tone: 'ok', text: 'eBL surrendered successfully. Carrier can now confirm cargo release.' });
    } catch (err) {
      console.error('Surrender failed:', err);
      setMessage({ tone: 'error', text: 'Surrender failed. Ensure you are the current eBL holder.' });
    }
  };

  const handleAccomplish = async () => {
    setMessage(null);
    try {
      const result = await accomplish(eblId);
      if (result.digest) {
        setLastTx(result.digest);
      }
      setMessage({ tone: 'ok', text: 'Goods release confirmed. eBL status is now accomplished.' });
    } catch (err) {
      console.error('Accomplish failed:', err);
      setMessage({ tone: 'error', text: 'Accomplish failed. eBL must be surrendered and signed by the carrier.' });
    }
  };

  if (!account) {
    return (
      <div className="surface p-10 text-center">
        <h2 className="section-title">Port Release</h2>
        <p className="section-subtitle mt-2">Connect your wallet to perform surrender or accomplish actions.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="surface p-5 md:p-6">
        <h2 className="section-title">Surrender and cargo release</h2>
        <p className="section-subtitle mt-1">Use the same eBL object ID for both operations, signed by the correct role.</p>

        <div className="mt-4">
          <label className="field-label">eBL object ID</label>
          <input
            className="field-input font-mono text-xs"
            placeholder="0x..."
            value={eblId}
            onChange={(e) => setEblId(e.target.value)}
          />
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-[#d4e0ee] bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#60758c]">Role: Consignee</p>
            <h3 className="mt-1 text-lg font-bold text-[#123a61]">Surrender eBL</h3>
            <p className="mt-2 text-sm text-[#5f7389]">Transfer documentary control back to the carrier before release.</p>
            <button onClick={handleSurrender} disabled={surrenderPending || !eblId} className="btn-main mt-4 w-full">
              {surrenderPending ? 'Surrendering...' : 'Surrender'}
            </button>
          </div>

          <div className="rounded-2xl border border-[#d4e0ee] bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#60758c]">Role: Carrier</p>
            <h3 className="mt-1 text-lg font-bold text-[#123a61]">Confirm release</h3>
            <p className="mt-2 text-sm text-[#5f7389]">Finalize delivery after valid surrender to close the eBL lifecycle.</p>
            <button onClick={handleAccomplish} disabled={accomplishPending || !eblId} className="btn-success mt-4 w-full">
              {accomplishPending ? 'Confirming...' : 'Accomplish'}
            </button>
          </div>
        </div>
      </section>

      {message && (
        <div
          className={`rounded-xl border p-3 text-sm ${
            message.tone === 'ok'
              ? 'border-[#b7e6d3] bg-[#eafaf3] text-[#0e6a47]'
              : 'border-[#f2c2c2] bg-[#fff0f0] text-[#9f2d2d]'
          }`}
        >
          {message.text}
        </div>
      )}

      {lastTx && (
        <div className="rounded-xl border border-[#c9dff8] bg-[#eef6ff] p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#3a6289]">Last transaction</p>
          <a href={explorerTxUrl(lastTx)} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block font-mono text-xs text-[#0e4fbf] underline">
            {lastTx}
          </a>
        </div>
      )}
    </div>
  );
}
