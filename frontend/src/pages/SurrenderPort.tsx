import { useState } from 'react';
import { useCurrentAccount } from '@iota/dapp-kit';
import { useSurrender, useAccomplish } from '../hooks/useEBL';
import { explorerTxUrl } from '../config/constants';

export default function SurrenderPort() {
  const account = useCurrentAccount();
  const { surrender, isPending: surrenderPending } = useSurrender();
  const { accomplish, isPending: accomplishPending } = useAccomplish();

  const [eblId, setEblId] = useState('');
  const [lastTx, setLastTx] = useState('');
  const [message, setMessage] = useState('');

  const handleSurrender = async () => {
    try {
      const result = await surrender(eblId);
      if (result.digest) {
        setLastTx(result.digest);
        setMessage('eBL surrendered successfully! Goods can now be released.');
      }
    } catch (err) {
      console.error('Surrender failed:', err);
      setMessage('Surrender failed. Make sure you are the current holder.');
    }
  };

  const handleAccomplish = async () => {
    try {
      const result = await accomplish(eblId);
      if (result.digest) {
        setLastTx(result.digest);
        setMessage('Goods released! eBL is now accomplished.');
      }
    } catch (err) {
      console.error('Accomplish failed:', err);
      setMessage('Accomplish failed. Make sure the eBL is surrendered and you are the carrier.');
    }
  };

  if (!account) {
    return (
      <div className="text-center py-16">
        <h1 className="text-3xl font-bold text-gray-800 mb-4">Surrender at Port</h1>
        <p className="text-gray-500">Connect your wallet to surrender or release eBLs.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-gray-800">Surrender at Port</h1>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <label className="block text-sm font-medium text-gray-700 mb-1">eBL Object ID</label>
        <input
          className="border rounded px-3 py-2 text-sm font-mono w-full mb-6"
          placeholder="0x..."
          value={eblId}
          onChange={(e) => setEblId(e.target.value)}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Consignee: Surrender */}
          <div className="border rounded-lg p-4">
            <h3 className="font-semibold text-gray-700 mb-2">For Consignees</h3>
            <p className="text-sm text-gray-500 mb-4">
              Surrender the eBL to the carrier to release goods.
            </p>
            <button
              onClick={handleSurrender}
              disabled={surrenderPending || !eblId}
              className="bg-purple-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-purple-700 disabled:opacity-50 w-full"
            >
              {surrenderPending ? 'Surrendering...' : 'Surrender eBL'}
            </button>
          </div>

          {/* Carrier: Accomplish */}
          <div className="border rounded-lg p-4">
            <h3 className="font-semibold text-gray-700 mb-2">For Carriers</h3>
            <p className="text-sm text-gray-500 mb-4">
              Confirm goods have been released after surrender.
            </p>
            <button
              onClick={handleAccomplish}
              disabled={accomplishPending || !eblId}
              className="bg-green-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-green-700 disabled:opacity-50 w-full"
            >
              {accomplishPending ? 'Confirming...' : 'Confirm Goods Released'}
            </button>
          </div>
        </div>
      </div>

      {message && (
        <div className={`rounded-lg p-4 border ${message.includes('failed') ? 'bg-red-50 border-red-200 text-red-800' : 'bg-green-50 border-green-200 text-green-800'}`}>
          <p className="text-sm font-medium">{message}</p>
        </div>
      )}

      {lastTx && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            Transaction:{' '}
            <a href={explorerTxUrl(lastTx)} target="_blank" rel="noopener noreferrer" className="underline font-mono text-xs">
              {lastTx.slice(0, 16)}...
            </a>
          </p>
        </div>
      )}
    </div>
  );
}
