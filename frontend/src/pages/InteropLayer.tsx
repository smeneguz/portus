import { useState } from 'react';
import { useCurrentAccount, useIotaClient } from '@iota/dapp-kit';
import {
  INTEROP_PLATFORM_LABELS,
  INTEROP_REGISTRY_ID,
  INTEROP_STATE_LABELS,
  explorerObjectUrl,
  explorerTxUrl,
} from '../config/constants';
import { computeSHA256 } from '../hooks/useNotarization';
import {
  parseInteropDocumentFields,
  type InteropDocumentData,
  useAcceptInteropTransfer,
  useInitiateInteropTransfer,
  useRegisterInteropDocument,
} from '../hooks/useInterop';

type Banner = {
  tone: 'ok' | 'error';
  text: string;
};

export default function InteropLayer() {
  const account = useCurrentAccount();
  const client = useIotaClient();
  const { registerDocument, isPending: registerPending } = useRegisterInteropDocument();
  const { initiateTransfer, isPending: initiatePending } = useInitiateInteropTransfer();
  const { acceptTransfer, isPending: acceptPending } = useAcceptInteropTransfer();

  const [documentHash, setDocumentHash] = useState('');
  const [documentType, setDocumentType] = useState('EBL_ENVELOPE');
  const [sourcePlatform, setSourcePlatform] = useState(1);

  const [documentId, setDocumentId] = useState('');
  const [toController, setToController] = useState('');
  const [toPlatform, setToPlatform] = useState(2);
  const [proofHash, setProofHash] = useState('');

  const [lookupId, setLookupId] = useState('');
  const [lookupResult, setLookupResult] = useState<InteropDocumentData | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);

  const [lastTx, setLastTx] = useState('');
  const [banner, setBanner] = useState<Banner | null>(null);

  const readCreatedControlId = (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    result: any,
  ): string => {
    const changes = (result.objectChanges ?? []) as Array<{ type?: string; objectType?: string; objectId?: string }>;
    const created = changes.find(
      (c) =>
        c.type === 'created' &&
        c.objectType?.includes('interop_control::TradeDocumentControl'),
    );
    return created?.objectId || '';
  };

  const uploadAndHash = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const hash = await computeSHA256(file);
    setDocumentHash(hash);
    setBanner({ tone: 'ok', text: `Envelope hash generated from ${file.name}` });
  };

  const handleRegister = async () => {
    setBanner(null);
    try {
      const result = await registerDocument({
        documentHash,
        documentType,
        sourcePlatform,
      });
      const createdId = readCreatedControlId(result);
      if (createdId) {
        setDocumentId(createdId);
        setLookupId(createdId);
      }
      if (result.digest) setLastTx(result.digest);
      setBanner({ tone: 'ok', text: 'Document envelope registered on decentralized control registry.' });
    } catch (err) {
      console.error(err);
      setBanner({ tone: 'error', text: 'Registration failed. Check registry ID, hash and wallet permissions.' });
    }
  };

  const handleInitiate = async () => {
    setBanner(null);
    try {
      const result = await initiateTransfer({
        documentId,
        toController,
        toPlatform,
        proofHash,
      });
      if (result.digest) setLastTx(result.digest);
      setBanner({ tone: 'ok', text: 'Transfer initiated. Pending recipient acceptance.' });
    } catch (err) {
      console.error(err);
      setBanner({ tone: 'error', text: 'Initiate transfer failed. Ensure you are the current controller.' });
    }
  };

  const handleAccept = async () => {
    setBanner(null);
    try {
      const result = await acceptTransfer(documentId);
      if (result.digest) setLastTx(result.digest);
      setBanner({ tone: 'ok', text: 'Transfer accepted. Control switched to the recipient.' });
    } catch (err) {
      console.error(err);
      setBanner({ tone: 'error', text: 'Accept transfer failed. Wallet must match pending controller.' });
    }
  };

  const handleLookup = async () => {
    if (!lookupId) return;
    setLookupLoading(true);
    setLookupResult(null);
    setBanner(null);
    try {
      const obj = await client.getObject({
        id: lookupId,
        options: { showContent: true },
      });
      if (obj.data?.content?.dataType === 'moveObject') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const fields = (obj.data.content as any).fields;
        setLookupResult(parseInteropDocumentFields(fields));
      } else {
        setBanner({ tone: 'error', text: 'Object not found or not a trade document control token.' });
      }
    } catch (err) {
      console.error(err);
      setBanner({ tone: 'error', text: 'Lookup failed. Verify object ID and network.' });
    }
    setLookupLoading(false);
  };

  if (!account) {
    return (
      <div className="surface p-10 text-center">
        <h2 className="section-title">Interoperability Layer</h2>
        <p className="section-subtitle mt-2">Connect wallet to use decentralized control tracking and settlement flow.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {!INTEROP_REGISTRY_ID && (
        <div className="rounded-xl border border-[#f2c2c2] bg-[#fff0f0] p-3 text-sm text-[#9f2d2d]">
          `VITE_INTEROP_REGISTRY_ID` is not configured. Deploy contracts again and set this value in frontend `.env`.
        </div>
      )}

      <section className="surface p-5 md:p-6">
        <h2 className="section-title">Register document control token</h2>
        <p className="section-subtitle mt-1">
          This is the universal settlement/control layer: register hash, bind controller, and make the document interoperable by design.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="field-label">Envelope/document hash</label>
            <input className="field-input font-mono text-xs" placeholder="SHA-256 hash" value={documentHash} onChange={(e) => setDocumentHash(e.target.value)} />
            <input
              type="file"
              className="mt-2 block w-full rounded-xl border border-[#cfd9e8] bg-white p-2.5 text-sm text-[#4f657d] file:mr-3 file:rounded-lg file:border-0 file:bg-[#e6efff] file:px-3 file:py-2 file:text-xs file:font-semibold file:text-[#0e4fbf]"
              onChange={uploadAndHash}
            />
          </div>
          <div>
            <label className="field-label">Document type</label>
            <input className="field-input" value={documentType} onChange={(e) => setDocumentType(e.target.value)} />
            <label className="field-label mt-2">Source platform</label>
            <select className="field-input" value={sourcePlatform} onChange={(e) => setSourcePlatform(Number(e.target.value))}>
              <option value={1}>Platform A</option>
              <option value={2}>Platform B</option>
              <option value={3}>Platform C</option>
            </select>
          </div>
        </div>

        <div className="mt-4">
          <button
            onClick={handleRegister}
            disabled={registerPending || !documentHash || !documentType || !INTEROP_REGISTRY_ID}
            className="btn-main"
          >
            {registerPending ? 'Registering...' : 'Register Document'}
          </button>
        </div>
      </section>

      <section className="surface p-5 md:p-6">
        <h2 className="section-title">Transfer control across platforms</h2>
        <p className="section-subtitle mt-1">Two-phase handshake: initiate by current controller, accept by recipient controller.</p>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="field-label">Document control object ID</label>
            <input className="field-input font-mono text-xs" placeholder="0x..." value={documentId} onChange={(e) => setDocumentId(e.target.value)} />
          </div>
          <div>
            <label className="field-label">Recipient controller address</label>
            <input className="field-input font-mono text-xs" placeholder="0x..." value={toController} onChange={(e) => setToController(e.target.value)} />
          </div>
          <div>
            <label className="field-label">Recipient platform</label>
            <select className="field-input" value={toPlatform} onChange={(e) => setToPlatform(Number(e.target.value))}>
              <option value={1}>Platform A</option>
              <option value={2}>Platform B</option>
              <option value={3}>Platform C</option>
            </select>
          </div>
          <div>
            <label className="field-label">Transfer proof hash</label>
            <input className="field-input font-mono text-xs" placeholder="proof hash / envelope hash v2" value={proofHash} onChange={(e) => setProofHash(e.target.value)} />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <button onClick={handleInitiate} disabled={initiatePending || !documentId || !toController || !proofHash || !INTEROP_REGISTRY_ID} className="btn-main">
            {initiatePending ? 'Initiating...' : 'Initiate Transfer'}
          </button>
          <button onClick={handleAccept} disabled={acceptPending || !documentId || !INTEROP_REGISTRY_ID} className="btn-success">
            {acceptPending ? 'Accepting...' : 'Accept Transfer'}
          </button>
        </div>
      </section>

      <section className="surface p-5 md:p-6">
        <h2 className="section-title">Lookup control state</h2>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto]">
          <input className="field-input font-mono text-xs" placeholder="Document control object ID" value={lookupId} onChange={(e) => setLookupId(e.target.value)} />
          <button onClick={handleLookup} disabled={lookupLoading || !lookupId} className="btn-alt">
            {lookupLoading ? 'Loading...' : 'Lookup'}
          </button>
        </div>

        {lookupResult && (
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-[#d7e2ef] bg-white p-3">
              <p className="text-xs uppercase tracking-wide text-[#60758c]">Controller</p>
              <p className="mt-1 break-all font-mono text-xs text-[#20415f]">{lookupResult.controller}</p>
            </div>
            <div className="rounded-xl border border-[#d7e2ef] bg-white p-3">
              <p className="text-xs uppercase tracking-wide text-[#60758c]">State</p>
              <p className="mt-1 text-sm font-semibold text-[#173a5a]">{INTEROP_STATE_LABELS[Number(lookupResult.state)] ?? lookupResult.state}</p>
            </div>
            <div className="rounded-xl border border-[#d7e2ef] bg-white p-3">
              <p className="text-xs uppercase tracking-wide text-[#60758c]">Current platform</p>
              <p className="mt-1 text-sm font-semibold text-[#173a5a]">{INTEROP_PLATFORM_LABELS[Number(lookupResult.current_platform)] ?? lookupResult.current_platform}</p>
            </div>
            <div className="rounded-xl border border-[#d7e2ef] bg-white p-3">
              <p className="text-xs uppercase tracking-wide text-[#60758c]">Pending controller</p>
              <p className="mt-1 break-all font-mono text-xs text-[#20415f]">{lookupResult.pending_controller}</p>
            </div>
            <div className="rounded-xl border border-[#d7e2ef] bg-white p-3 md:col-span-2">
              <p className="text-xs uppercase tracking-wide text-[#60758c]">Document hash</p>
              <p className="mt-1 break-all font-mono text-xs text-[#20415f]">{lookupResult.document_hash}</p>
            </div>
            <div className="rounded-xl border border-[#d7e2ef] bg-white p-3 md:col-span-2">
              <p className="text-xs uppercase tracking-wide text-[#60758c]">Last transfer proof hash</p>
              <p className="mt-1 break-all font-mono text-xs text-[#20415f]">{lookupResult.last_transfer_proof_hash || '—'}</p>
            </div>
            <a href={explorerObjectUrl(lookupId)} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-[#0e4fbf] underline">
              Open object in IOTA Explorer
            </a>
          </div>
        )}
      </section>

      {banner && (
        <div
          className={`rounded-xl border p-3 text-sm ${
            banner.tone === 'ok'
              ? 'border-[#b7e6d3] bg-[#eafaf3] text-[#0e6a47]'
              : 'border-[#f2c2c2] bg-[#fff0f0] text-[#9f2d2d]'
          }`}
        >
          {banner.text}
        </div>
      )}

      {lastTx && (
        <div className="rounded-xl border border-[#c9dff8] bg-[#eef6ff] p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#3a6289]">Last transaction</p>
          <a href={explorerTxUrl(lastTx)} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block break-all font-mono text-xs text-[#0e4fbf] underline">
            {lastTx}
          </a>
        </div>
      )}
    </div>
  );
}
