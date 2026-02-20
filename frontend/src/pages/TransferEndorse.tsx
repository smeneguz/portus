import { useState } from 'react';
import { useCurrentAccount } from '@iota/dapp-kit';
import { useEndorseAndTransfer, useCreateChain } from '../hooks/useEndorsement';
import { explorerTxUrl, ENDORSEMENT_TYPES } from '../config/constants';

export default function TransferEndorse() {
  const account = useCurrentAccount();
  const { endorseAndTransfer, isPending } = useEndorseAndTransfer();
  const { createChain, isPending: chainPending } = useCreateChain();

  const [eblId, setEblId] = useState('');
  const [chainId, setChainId] = useState('');
  const [recipientAddress, setRecipientAddress] = useState('');
  const [endorsementType, setEndorsementType] = useState(1);
  const [note, setNote] = useState('');
  const [lastTx, setLastTx] = useState('');
  const [newChainBlId, setNewChainBlId] = useState('');
  const [initialHolder, setInitialHolder] = useState('');

  const handleCreateChain = async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await createChain(newChainBlId, initialHolder) as any;
      const changes = (result.objectChanges ?? []) as Array<{ type: string; objectType?: string; objectId?: string }>;
      const chainObj = changes.find((c) => c.type === 'created' && c.objectType?.includes('EndorsementChain'));
      if (chainObj?.objectId) {
        setChainId(chainObj.objectId);
      }
      if (result.digest) setLastTx(result.digest as string);
    } catch (err) {
      console.error('Create chain failed:', err);
    }
  };

  const handleTransfer = async () => {
    try {
      const result = await endorseAndTransfer(
        chainId,
        eblId,
        recipientAddress,
        endorsementType,
        note || 'Endorsement',
      );
      if (result.digest) setLastTx(result.digest);
    } catch (err) {
      console.error('Transfer failed:', err);
    }
  };

  if (!account) {
    return (
      <div className="text-center py-16">
        <h1 className="text-3xl font-bold text-gray-800 mb-4">Transfer / Endorse</h1>
        <p className="text-gray-500">Connect your wallet to transfer eBLs.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-gray-800">Transfer / Endorse eBL</h1>

      {/* Create Endorsement Chain */}
      <section className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold mb-4">Create Endorsement Chain</h2>
        <p className="text-sm text-gray-500 mb-4">Create once per eBL before the first endorsement.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <input className="border rounded px-3 py-2 text-sm font-mono" placeholder="eBL Object ID (0x...)" value={newChainBlId} onChange={(e) => setNewChainBlId(e.target.value)} />
          <input className="border rounded px-3 py-2 text-sm font-mono" placeholder="Initial Holder Address (0x...)" value={initialHolder} onChange={(e) => setInitialHolder(e.target.value)} />
        </div>
        <button
          onClick={handleCreateChain}
          disabled={chainPending}
          className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {chainPending ? 'Creating...' : 'Create Chain'}
        </button>
        {chainId && (
          <p className="mt-2 text-sm text-green-600">Chain ID: <span className="font-mono text-xs">{chainId}</span></p>
        )}
      </section>

      {/* Endorse & Transfer */}
      <section className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold mb-4">Endorse & Transfer</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <input className="border rounded px-3 py-2 text-sm font-mono" placeholder="EndorsementChain ID (0x...)" value={chainId} onChange={(e) => setChainId(e.target.value)} />
          <input className="border rounded px-3 py-2 text-sm font-mono" placeholder="eBL Object ID (0x...)" value={eblId} onChange={(e) => setEblId(e.target.value)} />
          <input className="border rounded px-3 py-2 text-sm font-mono" placeholder="Recipient Address (0x...)" value={recipientAddress} onChange={(e) => setRecipientAddress(e.target.value)} />
          <select className="border rounded px-3 py-2 text-sm" value={endorsementType} onChange={(e) => setEndorsementType(Number(e.target.value))}>
            {Object.entries(ENDORSEMENT_TYPES).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
        </div>
        <input className="border rounded px-3 py-2 text-sm w-full mb-4" placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
        <button
          onClick={handleTransfer}
          disabled={isPending}
          className="bg-green-600 text-white px-6 py-2 rounded text-sm font-medium hover:bg-green-700 disabled:opacity-50"
        >
          {isPending ? 'Transferring...' : 'Endorse & Transfer'}
        </button>
      </section>

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
