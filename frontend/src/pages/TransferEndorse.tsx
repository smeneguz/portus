import { useState } from 'react';
import { useCurrentAccount } from '@iota/dapp-kit';
import { useEndorseAndTransfer, useCreateChain } from '../hooks/useEndorsement';
import { explorerTxUrl, ENDORSEMENT_TYPES } from '../config/constants';

type StatusMessage = {
  kind: 'ok' | 'error';
  text: string;
};

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
  const [message, setMessage] = useState<StatusMessage | null>(null);

  const canTransfer = Boolean(chainId && eblId && recipientAddress);

  const handleCreateChain = async () => {
    setMessage(null);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = (await createChain(newChainBlId, initialHolder)) as any;
      const changes = (result.objectChanges ?? []) as Array<{ type: string; objectType?: string; objectId?: string }>;
      const chainObj = changes.find((c) => c.type === 'created' && c.objectType?.includes('EndorsementChain'));
      if (chainObj?.objectId) {
        setChainId(chainObj.objectId);
      }
      if (result.digest) setLastTx(result.digest as string);
      setMessage({ kind: 'ok', text: 'Endorsement chain created successfully.' });
    } catch (err) {
      console.error('Create chain failed:', err);
      setMessage({ kind: 'error', text: 'Failed to create chain. Check IDs and wallet role.' });
    }
  };

  const handleTransfer = async () => {
    setMessage(null);
    try {
      const result = await endorseAndTransfer(chainId, eblId, recipientAddress, endorsementType, note || 'Endorsement');
      if (result.digest) setLastTx(result.digest);
      setMessage({ kind: 'ok', text: 'Endorsement and transfer submitted on-chain.' });
    } catch (err) {
      console.error('Transfer failed:', err);
      setMessage({ kind: 'error', text: 'Transfer failed. Ensure you are the current holder of the eBL.' });
    }
  };

  if (!account) {
    return (
      <div className="surface p-10 text-center">
        <h2 className="section-title">Transfer Hub</h2>
        <p className="section-subtitle mt-2">Connect your IOTA wallet to endorse and transfer title.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="surface p-5 md:p-6">
        <h2 className="section-title">Create endorsement chain</h2>
        <p className="section-subtitle mt-1">Run once for each eBL before the first transfer in the chain of title.</p>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="field-label">eBL object ID</label>
            <input className="field-input font-mono text-xs" placeholder="0x..." value={newChainBlId} onChange={(e) => setNewChainBlId(e.target.value)} />
          </div>
          <div>
            <label className="field-label">Initial holder address</label>
            <input className="field-input font-mono text-xs" placeholder="0x..." value={initialHolder} onChange={(e) => setInitialHolder(e.target.value)} />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button onClick={handleCreateChain} disabled={chainPending || !newChainBlId || !initialHolder} className="btn-main">
            {chainPending ? 'Creating chain...' : 'Create Chain'}
          </button>
          <p className="text-xs text-[#5f7389]">Chain ID is auto-detected from transaction object changes.</p>
        </div>

        <div className="mt-4 rounded-xl border border-[#d6e1ef] bg-[#f4f8ff] p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#3d5e81]">EndorsementChain ID</p>
          <p className="mt-1 break-all font-mono text-xs text-[#23405f]">{chainId || 'No chain selected yet.'}</p>
        </div>
      </section>

      <section className="surface p-5 md:p-6">
        <h2 className="section-title">Endorse and transfer</h2>
        <p className="section-subtitle mt-1">Move eBL title to the next party and preserve an auditable transfer record.</p>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="field-label">EndorsementChain ID</label>
            <input className="field-input font-mono text-xs" placeholder="0x..." value={chainId} onChange={(e) => setChainId(e.target.value)} />
          </div>
          <div>
            <label className="field-label">eBL object ID</label>
            <input className="field-input font-mono text-xs" placeholder="0x..." value={eblId} onChange={(e) => setEblId(e.target.value)} />
          </div>
          <div>
            <label className="field-label">Recipient address</label>
            <input className="field-input font-mono text-xs" placeholder="0x..." value={recipientAddress} onChange={(e) => setRecipientAddress(e.target.value)} />
          </div>
          <div>
            <label className="field-label">Endorsement type</label>
            <select className="field-input" value={endorsementType} onChange={(e) => setEndorsementType(Number(e.target.value))}>
              {Object.entries(ENDORSEMENT_TYPES).map(([val, label]) => (
                <option key={val} value={val}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4">
          <label className="field-label">Transfer note (optional)</label>
          <input className="field-input" placeholder="e.g. Endorsed to financing bank" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>

        <div className="mt-5">
          <button onClick={handleTransfer} disabled={isPending || !canTransfer} className="btn-success">
            {isPending ? 'Submitting transfer...' : 'Endorse & Transfer'}
          </button>
        </div>
      </section>

      {message && (
        <div
          className={`rounded-xl border p-3 text-sm ${
            message.kind === 'ok'
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
