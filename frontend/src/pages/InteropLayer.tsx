import { useEffect, useRef, useState } from 'react';
import { useCurrentAccount, useIotaClient } from '@iota/dapp-kit';
import {
  INTEROP_PLATFORM_LABELS,
  INTEROP_REGISTRY_ID,
  INTEROP_STATE_LABELS,
  explorerObjectUrl,
  explorerTxUrl,
} from '../config/constants';
import { computeSHA256 } from '../hooks/useNotarization';
import DocumentVaultCard from '../components/DocumentVaultCard';
import LocalFilePreview from '../components/LocalFilePreview';
import {
  parseInteropDocumentFields,
  type InteropDocumentData,
  useAcceptInteropTransfer,
  useCancelInteropTransfer,
  useInitiateInteropTransfer,
  useRegisterInteropDocument,
} from '../hooks/useInterop';
import {
  defaultInteropDid,
  defaultPartyCode,
  formatExpiryTimestamp,
  generateSignedCredentialJwt,
  generateSignedPresentationJwt,
  generateTransferNonce,
  validateCredentialInput,
  validatePresentationInput,
} from '../utils/interopIdentity';
import { getVaultRecord, saveVaultRecord, type VaultRecord } from '../utils/documentVault';
import { recordTx } from '../utils/txHistory';

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
  const { cancelTransfer, isPending: cancelPending } = useCancelInteropTransfer();

  const [documentHash, setDocumentHash] = useState('');
  const [documentType, setDocumentType] = useState('EBL_ENVELOPE');
  const [linkedEblId, setLinkedEblId] = useState('');
  const [sourcePlatform, setSourcePlatform] = useState(1);
  const [controllerDid, setControllerDid] = useState('');
  const [controllerPartyCode, setControllerPartyCode] = useState('');
  const [credentialJson, setCredentialJson] = useState('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadedPreviewUrl, setUploadedPreviewUrl] = useState('');

  const [documentId, setDocumentId] = useState('');
  const [toController, setToController] = useState('');
  const [toControllerDid, setToControllerDid] = useState('');
  const [toPartyCode, setToPartyCode] = useState('');
  const [toPlatform, setToPlatform] = useState(2);
  const [proofHash, setProofHash] = useState('');
  const [transferNonce, setTransferNonce] = useState(generateTransferNonce());
  const [expiryMinutes, setExpiryMinutes] = useState('30');
  const [presentationJson, setPresentationJson] = useState('');
  const [cancelReason, setCancelReason] = useState('Receiver validation failed');

  const [acceptDid, setAcceptDid] = useState('');
  const [acceptPartyCode, setAcceptPartyCode] = useState('');
  const [acceptPresentationJson, setAcceptPresentationJson] = useState('');

  const [lookupId, setLookupId] = useState('');
  const [lookupResult, setLookupResult] = useState<InteropDocumentData | null>(null);
  const [lookupVaultRecord, setLookupVaultRecord] = useState<VaultRecord | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [recoveryFile, setRecoveryFile] = useState<File | null>(null);
  const [recoveryPreviewUrl, setRecoveryPreviewUrl] = useState('');
  const [recoveryHash, setRecoveryHash] = useState('');
  const [recoveryPending, setRecoveryPending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const recoveryInputRef = useRef<HTMLInputElement | null>(null);

  const [lastTx, setLastTx] = useState('');
  const [banner, setBanner] = useState<Banner | null>(null);

  useEffect(() => {
    if (!account?.address) return;
    setControllerDid((current) => current || defaultInteropDid(account.address, sourcePlatform));
    setControllerPartyCode((current) => current || defaultPartyCode(sourcePlatform, account.address));
  }, [account?.address, sourcePlatform]);

  useEffect(() => {
    if (!lookupResult) return;
    setAcceptDid((current) => current || lookupResult.pending_controller_did || lookupResult.controller_did);
    setAcceptPartyCode((current) => current || lookupResult.pending_party_code || lookupResult.controller_party_code);
  }, [lookupResult]);

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
    if (uploadedPreviewUrl) URL.revokeObjectURL(uploadedPreviewUrl);
    setUploadedFile(file);
    setUploadedPreviewUrl(URL.createObjectURL(file));
    const hash = await computeSHA256(file);
    setDocumentHash(hash);
    setBanner({ tone: 'ok', text: `Envelope hash generated from ${file.name}. Local preview is available below.` });
  };

  const platformLabel = (platformId: number) => `${INTEROP_PLATFORM_LABELS[platformId] || `Platform ${platformId}`} (ID ${platformId})`;
  const sameAddress = (a?: string, b?: string) => (a || '').toLowerCase() === (b || '').toLowerCase();

  const handleLoadCredentialSample = async () => {
    setBanner(null);
    try {
      const sample = await generateSignedCredentialJwt(controllerDid, controllerPartyCode, 'carrier');
      setCredentialJson(sample.jwt);
      setBanner({ tone: 'ok', text: `Signed VC JWT generated with IOTA Identity. Issuer DID: ${sample.issuerDid}` });
    } catch (err) {
      console.error(err);
      setBanner({ tone: 'error', text: err instanceof Error ? err.message : 'Failed to generate signed VC sample.' });
    }
  };

  const handleLoadRecipientPresentationSample = async () => {
    setBanner(null);
    try {
      const reusableDid = toControllerDid.startsWith('did:jwk:') ? toControllerDid : undefined;
      const sample = await generateSignedPresentationJwt(toPartyCode, 'consignee', reusableDid);
      setToControllerDid(sample.did);
      setPresentationJson(sample.presentationJwt);
      setBanner({ tone: 'ok', text: `Signed VP JWT generated with IOTA Identity. Recipient DID updated to ${sample.did}` });
    } catch (err) {
      console.error(err);
      setBanner({ tone: 'error', text: err instanceof Error ? err.message : 'Failed to generate signed VP sample.' });
    }
  };

  const handleLoadAcceptPresentationSample = async () => {
    setBanner(null);
    try {
      if (acceptDid && !acceptDid.startsWith('did:jwk:')) {
        throw new Error('Accept sample VP can only be generated for a did:jwk recipient DID. Use the DID created during initiate step or paste a manual VP.');
      }
      const reusableDid = acceptDid.startsWith('did:jwk:') ? acceptDid : undefined;
      const sample = await generateSignedPresentationJwt(acceptPartyCode, 'consignee', reusableDid);
      if (!acceptDid) setAcceptDid(sample.did);
      setAcceptPresentationJson(sample.presentationJwt);
      setBanner({ tone: 'ok', text: `Signed VP JWT generated for accept flow. Holder DID: ${sample.did}` });
    } catch (err) {
      console.error(err);
      setBanner({ tone: 'error', text: err instanceof Error ? err.message : 'Failed to generate signed accept VP sample.' });
    }
  };

  const handleRegister = async () => {
    setBanner(null);
    try {
      const credential = await validateCredentialInput(credentialJson, controllerDid, controllerPartyCode);
      const result = await registerDocument({
        linkedEblId: linkedEblId || '0x0000000000000000000000000000000000000000000000000000000000000000',
        documentHash,
        documentType,
        sourcePlatform,
        controllerDid,
        controllerPartyCode,
        controllerIdentityHash: credential.hash,
      });
      let createdId = readCreatedControlId(result);
      if (!createdId && result.digest) {
        try {
          const tx = await client.getTransactionBlock({
            digest: result.digest,
            options: { showObjectChanges: true },
          });
          createdId = readCreatedControlId(tx);
        } catch (resolveErr) {
          console.warn('Failed to resolve created control object from tx:', resolveErr);
        }
      }
      if (createdId) {
        setDocumentId(createdId);
        setLookupId(createdId);
        setLookupVaultRecord(getVaultRecord('interop', createdId));
      }
      if (uploadedFile && createdId && account?.address) {
        try {
          const saved = await saveVaultRecord({
            anchorType: 'interop',
            anchorId: createdId,
            title: documentType || 'Trade document envelope',
            file: uploadedFile,
            hash: documentHash,
            createdBy: account.address,
            initialOwner: account.address,
          });
          setLookupVaultRecord(saved);
        } catch (vaultErr) {
          console.warn('Failed to save interop file into local vault:', vaultErr);
        }
      }
      if (result.digest) {
        setLastTx(result.digest);
        recordTx({
          digest: result.digest,
          action: 'Interop Register Document',
          area: 'interop',
          referenceId: createdId || undefined,
          referenceLabel: 'Control Object ID',
          details: `${documentType} · ${controllerPartyCode} · ${platformLabel(sourcePlatform)}${linkedEblId ? ` · linked eBL ${linkedEblId}` : ''}`,
        });
      }
      setBanner({ tone: 'ok', text: `Document registered with DID + VC metadata on the control registry (${credential.mode === 'jwt-signature' ? 'IOTA Identity JWT verified' : 'structured VC validated'}).` });
    } catch (err) {
      console.error(err);
      setBanner({ tone: 'error', text: err instanceof Error ? err.message : 'Registration failed. Check DID, party code and VC JSON/JWT.' });
    }
  };

  const handleInitiate = async () => {
    setBanner(null);
    try {
      const presentation = await validatePresentationInput(presentationJson, toControllerDid, toPartyCode);
      const expiryMs = Date.now() + Number(expiryMinutes || 0) * 60_000;
      const result = await initiateTransfer({
        documentId,
        toController,
        toControllerDid,
        toPartyCode,
        toPlatform,
        proofHash,
        expectedIdentityHash: presentation.hash,
        transferNonce,
        expiryMs,
      });
      if (result.digest) {
        setLastTx(result.digest);
        recordTx({
          digest: result.digest,
          action: 'Interop Initiate Transfer',
          area: 'interop',
          referenceId: documentId || undefined,
          referenceLabel: 'Control Object ID',
          details: `${toPartyCode} · ${platformLabel(sourcePlatform)} -> ${platformLabel(toPlatform)} · nonce ${transferNonce}`,
        });
      }
      setBanner({ tone: 'ok', text: `Transfer initiated with PINT-lite metadata and ${presentation.mode === 'jwt-signature' ? 'IOTA Identity JWT VP verification' : 'structured VP validation'}.` });
    } catch (err) {
      console.error(err);
      setBanner({ tone: 'error', text: err instanceof Error ? err.message : 'Initiate transfer failed. Ensure controller and VP JSON/JWT metadata are valid.' });
    }
  };

  const handleAccept = async () => {
    setBanner(null);
    try {
      const presentation = await validatePresentationInput(acceptPresentationJson, acceptDid, acceptPartyCode);
      const result = await acceptTransfer({
        documentId,
        recipientDid: acceptDid,
        recipientPartyCode: acceptPartyCode,
        identityHash: presentation.hash,
      });
      if (result.digest) {
        setLastTx(result.digest);
        recordTx({
          digest: result.digest,
          action: 'Interop Accept Transfer',
          area: 'interop',
          referenceId: documentId || undefined,
          referenceLabel: 'Control Object ID',
          details: `${acceptPartyCode} accepted control on ${platformLabel(Number(lookupResult?.pending_platform || lookupResult?.current_platform || 0))}`,
        });
      }
      setBanner({ tone: 'ok', text: `Transfer accepted. DID, party code and VP evidence matched the pending transfer (${presentation.mode === 'jwt-signature' ? 'JWT signature verified' : 'structured VP validated'}).` });
    } catch (err) {
      console.error(err);
      setBanner({ tone: 'error', text: err instanceof Error ? err.message : 'Accept transfer failed. Wallet and VP JSON/JWT data must match the pending metadata.' });
    }
  };

  const handleCancel = async () => {
    setBanner(null);
    try {
      const result = await cancelTransfer({
        documentId,
        rejectionReason: cancelReason,
      });
      if (result.digest) {
        setLastTx(result.digest);
        recordTx({
          digest: result.digest,
          action: 'Interop Cancel Transfer',
          area: 'interop',
          referenceId: documentId || undefined,
          referenceLabel: 'Control Object ID',
          details: cancelReason,
        });
      }
      setBanner({ tone: 'ok', text: 'Pending transfer cancelled and rejection reason stored on-chain.' });
    } catch (err) {
      console.error(err);
      setBanner({ tone: 'error', text: 'Cancel transfer failed. Current controller must sign this action.' });
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
        setLookupVaultRecord(getVaultRecord('interop', lookupId));
        setRecoveryFile(null);
        setRecoveryHash('');
        if (recoveryPreviewUrl) {
          URL.revokeObjectURL(recoveryPreviewUrl);
          setRecoveryPreviewUrl('');
        }
      } else {
        setBanner({ tone: 'error', text: 'Object not found or not a trade document control token.' });
      }
    } catch (err) {
      console.error(err);
      setBanner({ tone: 'error', text: 'Lookup failed. Verify object ID and network.' });
    }
    setLookupLoading(false);
  };

  const handleRecoveryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (recoveryPreviewUrl) URL.revokeObjectURL(recoveryPreviewUrl);
    setRecoveryFile(file);
    setRecoveryPreviewUrl(URL.createObjectURL(file));
    const hash = await computeSHA256(file);
    setRecoveryHash(hash);
  };

  const handleAttachRecoveryFile = async () => {
    if (!lookupId || !lookupResult || !recoveryFile || !account?.address) return;
    if (!sameAddress(account.address, lookupResult.controller)) {
      setBanner({ tone: 'error', text: 'Only the current controller can attach a local file to this control object.' });
      return;
    }
    if (recoveryHash !== lookupResult.document_hash) {
      setBanner({ tone: 'error', text: 'The selected file does not match the on-chain document hash.' });
      return;
    }

    setRecoveryPending(true);
    setBanner(null);
    try {
      const saved = await saveVaultRecord({
        anchorType: 'interop',
        anchorId: lookupId,
        title: lookupResult.document_hash ? `${lookupResult.controller_party_code || 'Interop'} envelope` : 'Trade document envelope',
        file: recoveryFile,
        hash: recoveryHash,
        createdBy: account.address,
        initialOwner: lookupResult.controller,
      });
      setLookupVaultRecord(saved);
      setBanner({ tone: 'ok', text: 'File attached to the local browser vault for this control object.' });
    } catch (err) {
      console.error(err);
      setBanner({ tone: 'error', text: err instanceof Error ? err.message : 'Failed to save the file into the local vault.' });
    } finally {
      setRecoveryPending(false);
    }
  };

  if (!account) {
    return (
      <div className="surface p-10 text-center">
        <h2 className="section-title">Interoperability Layer</h2>
        <p className="section-subtitle mt-2">Connect wallet to use decentralized control tracking, DID metadata, signed VC/VP verification and PINT-lite settlement flow.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="surface p-5 md:p-6">
        <h2 className="section-title">Quick flow</h2>
        <p className="section-subtitle mt-1">Register envelope + controller DID, initiate with recipient DID/party code/VP hash, accept with matching signed or structured VP evidence.</p>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-[#d7e2ef] bg-white p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#3d5e81]">1. Register identity metadata</p>
            <p className="mt-1 text-sm text-[#4f657d]">Anchor envelope hash, controller DID, party code and VC evidence hash in the same control object.</p>
          </div>
          <div className="rounded-xl border border-[#d7e2ef] bg-white p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#3d5e81]">2. Initiate PINT-lite transfer</p>
            <p className="mt-1 text-sm text-[#4f657d]">Set source and destination platform IDs, DID, party code, VP hash, nonce and expiry before handover.</p>
          </div>
          <div className="rounded-xl border border-[#d7e2ef] bg-white p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#3d5e81]">3. Accept with identity proof</p>
            <p className="mt-1 text-sm text-[#4f657d]">Recipient wallet must match pending controller and present the expected VP bundle hash.</p>
          </div>
        </div>
      </section>

      {!INTEROP_REGISTRY_ID && (
        <div className="rounded-xl border border-[#f2c2c2] bg-[#fff0f0] p-3 text-sm text-[#9f2d2d]">
          `VITE_INTEROP_REGISTRY_ID` is not configured. Deploy contracts again and set this value in frontend `.env`.
        </div>
      )}

      <section className="surface p-5 md:p-6">
        <h2 className="section-title">Register document control token</h2>
        <p className="section-subtitle mt-1">
          Register the eBL envelope hash and bind the initial controller with DID, party code and VC evidence hash. The input accepts either structured VC JSON or a signed VC JWT.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="field-label">Envelope/document hash</label>
            <input className="field-input font-mono text-xs" placeholder="SHA-256 hash" value={documentHash} onChange={(e) => setDocumentHash(e.target.value)} />
            <input ref={fileInputRef} type="file" className="hidden" onChange={uploadAndHash} />
            <div className="mt-2 flex min-h-[52px] items-center gap-3 rounded-xl border border-[#cfd9e8] bg-white px-3 py-2.5">
              <button type="button" className="btn-alt shrink-0" onClick={() => fileInputRef.current?.click()}>
                Choose file
              </button>
              <span className="truncate text-sm text-[#4f657d]">{uploadedFile?.name || 'No file selected'}</span>
            </div>
          </div>
          <div>
            <label className="field-label">Document type</label>
            <input className="field-input" value={documentType} onChange={(e) => setDocumentType(e.target.value)} />
            <label className="field-label mt-2">Linked eBL object ID (optional)</label>
            <input className="field-input font-mono text-xs" placeholder="0x..." value={linkedEblId} onChange={(e) => setLinkedEblId(e.target.value)} />
          </div>
          <div>
            <label className="field-label mt-2">Source platform ID</label>
            <select className="field-input" value={sourcePlatform} onChange={(e) => setSourcePlatform(Number(e.target.value))}>
              <option value={1}>Platform A (1)</option>
              <option value={2}>Platform B (2)</option>
              <option value={3}>Platform C (3)</option>
            </select>
          </div>
          <div>
            <label className="field-label">Controller DID</label>
            <input className="field-input" placeholder="did:iota:testnet:platform-1:..." value={controllerDid} onChange={(e) => setControllerDid(e.target.value)} />
          </div>
          <div>
            <label className="field-label">Controller party code</label>
            <input className="field-input" placeholder="PLAT-1-ABC123" value={controllerPartyCode} onChange={(e) => setControllerPartyCode(e.target.value)} />
          </div>
        </div>

        {uploadedFile && uploadedPreviewUrl && (
          <div className="mt-4">
            <LocalFilePreview
              title="Selected envelope file"
              fileName={uploadedFile.name}
              mimeType={uploadedFile.type}
              size={uploadedFile.size}
              sourceUrl={uploadedPreviewUrl}
              storageNote="This preview is local. After document registration, the file is linked to the interop control object in the browser vault."
            />
          </div>
        )}

        <div className="mt-4">
          <div className="flex items-center justify-between gap-3">
            <label className="field-label !mb-0">Verifiable Credential JSON or JWT</label>
            <button type="button" onClick={handleLoadCredentialSample} className="btn-alt">
              Generate signed VC
            </button>
          </div>
          <textarea
            className="field-input mt-2 min-h-[180px] font-mono text-xs"
            placeholder='Paste either a VC JSON object or a signed VC JWT. Sample button generates a JWT signed with IOTA Identity.'
            value={credentialJson}
            onChange={(e) => setCredentialJson(e.target.value)}
          />
        </div>

        <div className="mt-4">
          <button
            onClick={handleRegister}
            disabled={registerPending || !documentHash || !documentType || !controllerDid || !controllerPartyCode || !credentialJson || !INTEROP_REGISTRY_ID}
            className="btn-main"
          >
            {registerPending ? 'Registering...' : 'Register Document'}
          </button>
        </div>
      </section>

      <section className="surface p-5 md:p-6">
        <h2 className="section-title">Initiate transfer with PINT-lite metadata</h2>
        <p className="section-subtitle mt-1">Store source/destination platform IDs, pending recipient identity, VP hash, transfer nonce, expiry and proof hash in the same shared control object.</p>

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
            <label className="field-label">Recipient DID</label>
            <input className="field-input" placeholder="did:iota:testnet:platform-2:..." value={toControllerDid} onChange={(e) => setToControllerDid(e.target.value)} />
          </div>
          <div>
            <label className="field-label">Recipient party code</label>
            <input className="field-input" placeholder="PLAT-2-XYZ789" value={toPartyCode} onChange={(e) => setToPartyCode(e.target.value)} />
          </div>
          <div>
            <label className="field-label">Recipient platform ID</label>
            <select className="field-input" value={toPlatform} onChange={(e) => setToPlatform(Number(e.target.value))}>
              <option value={1}>Platform A (1)</option>
              <option value={2}>Platform B (2)</option>
              <option value={3}>Platform C (3)</option>
            </select>
          </div>
          <div>
            <label className="field-label">Transfer proof hash</label>
            <input className="field-input font-mono text-xs" placeholder="hash of transfer receipt / envelope delta" value={proofHash} onChange={(e) => setProofHash(e.target.value)} />
          </div>
          <div>
            <label className="field-label">Transfer nonce</label>
            <div className="flex gap-2">
              <input className="field-input font-mono text-xs" value={transferNonce} onChange={(e) => setTransferNonce(e.target.value)} />
              <button type="button" onClick={() => setTransferNonce(generateTransferNonce())} className="btn-alt">
                Regen
              </button>
            </div>
          </div>
          <div>
            <label className="field-label">Expiry window (minutes)</label>
            <input className="field-input" type="number" min="1" value={expiryMinutes} onChange={(e) => setExpiryMinutes(e.target.value)} />
          </div>
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between gap-3">
            <label className="field-label !mb-0">Recipient Verifiable Presentation JSON or JWT</label>
            <button type="button" onClick={handleLoadRecipientPresentationSample} className="btn-alt">
              Generate signed VP
            </button>
          </div>
          <textarea
            className="field-input mt-2 min-h-[200px] font-mono text-xs"
            placeholder='Paste either a VP JSON object or a signed VP JWT. Sample button generates a JWT VP signed with IOTA Identity.'
            value={presentationJson}
            onChange={(e) => setPresentationJson(e.target.value)}
          />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-[1fr_auto_auto]">
          <div>
            <label className="field-label">Cancellation / rejection reason</label>
            <input className="field-input" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
          </div>
          <button
            onClick={handleInitiate}
            disabled={initiatePending || !documentId || !toController || !toControllerDid || !toPartyCode || !proofHash || !presentationJson || !INTEROP_REGISTRY_ID}
            className="btn-main self-end"
          >
            {initiatePending ? 'Initiating...' : 'Initiate Transfer'}
          </button>
          <button
            onClick={handleCancel}
            disabled={cancelPending || !documentId || !cancelReason || !INTEROP_REGISTRY_ID}
            className="btn-alt self-end"
          >
            {cancelPending ? 'Cancelling...' : 'Cancel Transfer'}
          </button>
        </div>
      </section>

      <section className="surface p-5 md:p-6">
        <h2 className="section-title">Accept transfer with VP verification</h2>
        <p className="section-subtitle mt-1">Recipient must submit a VP bundle whose DID, party code and hash match the pending metadata stored on-chain. Signed JWT VP is supported through IOTA Identity.</p>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="field-label">Recipient DID</label>
            <input className="field-input" value={acceptDid} onChange={(e) => setAcceptDid(e.target.value)} />
          </div>
          <div>
            <label className="field-label">Recipient party code</label>
            <input className="field-input" value={acceptPartyCode} onChange={(e) => setAcceptPartyCode(e.target.value)} />
          </div>
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between gap-3">
            <label className="field-label !mb-0">Recipient VP JSON or JWT</label>
            <button type="button" onClick={handleLoadAcceptPresentationSample} className="btn-alt">
              Generate signed VP
            </button>
          </div>
          <textarea
            className="field-input mt-2 min-h-[200px] font-mono text-xs"
            value={acceptPresentationJson}
            onChange={(e) => setAcceptPresentationJson(e.target.value)}
          />
        </div>

        <div className="mt-4">
          <button onClick={handleAccept} disabled={acceptPending || !documentId || !acceptDid || !acceptPartyCode || !acceptPresentationJson || !INTEROP_REGISTRY_ID} className="btn-success">
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
              <p className="mt-1 text-sm font-semibold text-[#173a5a]">{platformLabel(Number(lookupResult.current_platform))}</p>
            </div>
            <div className="rounded-xl border border-[#d7e2ef] bg-white p-3">
              <p className="text-xs uppercase tracking-wide text-[#60758c]">Source platform</p>
              <p className="mt-1 text-sm font-semibold text-[#173a5a]">{platformLabel(Number(lookupResult.source_platform))}</p>
            </div>
            <div className="rounded-xl border border-[#d7e2ef] bg-white p-3">
              <p className="text-xs uppercase tracking-wide text-[#60758c]">Current DID</p>
              <p className="mt-1 break-all font-mono text-xs text-[#20415f]">{lookupResult.controller_did || '—'}</p>
            </div>
            <div className="rounded-xl border border-[#d7e2ef] bg-white p-3">
              <p className="text-xs uppercase tracking-wide text-[#60758c]">Current party code</p>
              <p className="mt-1 text-sm font-semibold text-[#173a5a]">{lookupResult.controller_party_code || '—'}</p>
            </div>
            <div className="rounded-xl border border-[#d7e2ef] bg-white p-3">
              <p className="text-xs uppercase tracking-wide text-[#60758c]">Current identity hash</p>
              <p className="mt-1 break-all font-mono text-xs text-[#20415f]">{lookupResult.controller_identity_hash || '—'}</p>
            </div>
            <div className="rounded-xl border border-[#d7e2ef] bg-white p-3">
              <p className="text-xs uppercase tracking-wide text-[#60758c]">Linked eBL object</p>
              <p className="mt-1 break-all font-mono text-xs text-[#20415f]">{lookupResult.linked_ebl_id || '—'}</p>
            </div>
            <div className="rounded-xl border border-[#d7e2ef] bg-white p-3">
              <p className="text-xs uppercase tracking-wide text-[#60758c]">Pending controller</p>
              <p className="mt-1 break-all font-mono text-xs text-[#20415f]">{lookupResult.pending_controller || '—'}</p>
            </div>
            <div className="rounded-xl border border-[#d7e2ef] bg-white p-3">
              <p className="text-xs uppercase tracking-wide text-[#60758c]">Pending platform</p>
              <p className="mt-1 text-sm font-semibold text-[#173a5a]">{platformLabel(Number(lookupResult.pending_platform))}</p>
            </div>
            <div className="rounded-xl border border-[#d7e2ef] bg-white p-3">
              <p className="text-xs uppercase tracking-wide text-[#60758c]">Pending DID</p>
              <p className="mt-1 break-all font-mono text-xs text-[#20415f]">{lookupResult.pending_controller_did || '—'}</p>
            </div>
            <div className="rounded-xl border border-[#d7e2ef] bg-white p-3">
              <p className="text-xs uppercase tracking-wide text-[#60758c]">Pending party code</p>
              <p className="mt-1 text-sm font-semibold text-[#173a5a]">{lookupResult.pending_party_code || '—'}</p>
            </div>
            <div className="rounded-xl border border-[#d7e2ef] bg-white p-3">
              <p className="text-xs uppercase tracking-wide text-[#60758c]">Pending identity hash</p>
              <p className="mt-1 break-all font-mono text-xs text-[#20415f]">{lookupResult.pending_identity_hash || '—'}</p>
            </div>
            <div className="rounded-xl border border-[#d7e2ef] bg-white p-3">
              <p className="text-xs uppercase tracking-wide text-[#60758c]">Transfer nonce</p>
              <p className="mt-1 break-all font-mono text-xs text-[#20415f]">{lookupResult.transfer_nonce || '—'}</p>
            </div>
            <div className="rounded-xl border border-[#d7e2ef] bg-white p-3">
              <p className="text-xs uppercase tracking-wide text-[#60758c]">Pending expiry</p>
              <p className="mt-1 text-sm font-semibold text-[#173a5a]">{formatExpiryTimestamp(lookupResult.pending_transfer_expiry_ms)}</p>
            </div>
            <div className="rounded-xl border border-[#d7e2ef] bg-white p-3 md:col-span-2">
              <p className="text-xs uppercase tracking-wide text-[#60758c]">Document hash</p>
              <p className="mt-1 break-all font-mono text-xs text-[#20415f]">{lookupResult.document_hash}</p>
            </div>
            <div className="rounded-xl border border-[#d7e2ef] bg-white p-3 md:col-span-2">
              <p className="text-xs uppercase tracking-wide text-[#60758c]">Last transfer proof hash</p>
              <p className="mt-1 break-all font-mono text-xs text-[#20415f]">{lookupResult.last_transfer_proof_hash || '—'}</p>
            </div>
            <div className="rounded-xl border border-[#d7e2ef] bg-white p-3 md:col-span-2">
              <p className="text-xs uppercase tracking-wide text-[#60758c]">Last rejection reason</p>
              <p className="mt-1 text-sm text-[#20415f]">{lookupResult.last_rejection_reason || '—'}</p>
            </div>
            <div className="md:col-span-2">
              <DocumentVaultCard
                record={lookupVaultRecord}
                currentOwner={lookupResult.controller}
                connectedAddress={account?.address}
                ownerLabel="Controller"
                expectedHash={lookupResult.document_hash}
              />
            </div>
            {!lookupVaultRecord && (
              <div className="md:col-span-2 rounded-2xl border border-[#d7e2ef] bg-[#fbfdff] p-4">
                <div>
                  <p className="text-sm font-semibold text-[#173a5a]">Attach or recover local envelope file</p>
                  <p className="mt-1 text-sm text-[#5f7389]">
                    This control object has no file in the current browser vault. You can attach it again only if the connected wallet is the current controller and the file hash matches the on-chain document hash.
                  </p>
                </div>

                {!sameAddress(account?.address, lookupResult.controller) && (
                  <div className="mt-4 rounded-xl border border-[#f2c2c2] bg-[#fff7f7] p-4 text-sm text-[#9f2d2d]">
                    The connected wallet is not the current controller, so local recovery is locked.
                  </div>
                )}

                <div className="mt-4">
                  <input ref={recoveryInputRef} type="file" className="hidden" onChange={handleRecoveryUpload} />
                  <div className="flex min-h-[52px] items-center gap-3 rounded-xl border border-[#cfd9e8] bg-white px-3 py-2.5">
                    <button type="button" className="btn-alt shrink-0" onClick={() => recoveryInputRef.current?.click()}>
                      Choose file
                    </button>
                    <span className="truncate text-sm text-[#4f657d]">{recoveryFile?.name || 'No file selected'}</span>
                  </div>
                </div>

                {recoveryHash && (
                  <div className={`mt-3 rounded-xl border p-3 text-xs ${
                    recoveryHash === lookupResult.document_hash
                      ? 'border-[#b7e6d3] bg-[#eafaf3] text-[#0e6a47]'
                      : 'border-[#f2c2c2] bg-[#fff0f0] text-[#9f2d2d]'
                  }`}>
                    {recoveryHash === lookupResult.document_hash ? 'Hash matches the on-chain document record.' : 'Hash mismatch: selected file does not match the on-chain document hash.'}
                  </div>
                )}

                {recoveryFile && recoveryPreviewUrl && (
                  <div className="mt-4">
                    <LocalFilePreview
                      title="Selected recovery file"
                      fileName={recoveryFile.name}
                      mimeType={recoveryFile.type}
                      size={recoveryFile.size}
                      sourceUrl={recoveryPreviewUrl}
                      storageNote="This preview is local. Saving will link the file to the interop control object in the current browser vault."
                    />
                  </div>
                )}

                <div className="mt-4">
                  <button
                    type="button"
                    onClick={handleAttachRecoveryFile}
                    disabled={!sameAddress(account?.address, lookupResult.controller) || !recoveryFile || !recoveryHash || recoveryHash !== lookupResult.document_hash || recoveryPending}
                    className="btn-main"
                  >
                    {recoveryPending ? 'Attaching...' : 'Attach file to this control object'}
                  </button>
                </div>
              </div>
            )}
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
