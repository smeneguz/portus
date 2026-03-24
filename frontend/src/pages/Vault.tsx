import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCurrentAccount, useIotaClient } from '@iota/dapp-kit';
import DocumentVaultCard from '../components/DocumentVaultCard';
import LocalFilePreview from '../components/LocalFilePreview';
import { explorerObjectUrl } from '../config/constants';
import { parseEBLFields, type EBLData } from '../hooks/useEBL';
import { computeSHA256 } from '../hooks/useNotarization';
import { clearVault, getVaultRecord, listVaultRecords, saveVaultRecord, type VaultRecord } from '../utils/documentVault';
import { findLinkedInteropControlForEbl, type LinkedInteropControl } from '../utils/interopLink';

type Banner = {
  tone: 'ok' | 'error';
  text: string;
};

function sameAddress(a?: string, b?: string) {
  return (a || '').toLowerCase() === (b || '').toLowerCase();
}

export default function Vault() {
  const account = useCurrentAccount();
  const client = useIotaClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [lookupId, setLookupId] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [banner, setBanner] = useState<Banner | null>(null);
  const [ebl, setEbl] = useState<EBLData | null>(null);
  const [vaultRecord, setVaultRecord] = useState<VaultRecord | null>(null);
  const [linkedInterop, setLinkedInterop] = useState<LinkedInteropControl | null>(null);
  const [recentVaultRecords, setRecentVaultRecords] = useState<VaultRecord[]>([]);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreviewUrl, setImportPreviewUrl] = useState('');
  const [importHash, setImportHash] = useState('');
  const [importPending, setImportPending] = useState(false);

  const refreshVault = () => setRecentVaultRecords(listVaultRecords('ebl').slice(0, 10));

  useEffect(() => {
    refreshVault();
  }, []);

  const loadEbl = async (eblId: string) => {
    if (!eblId) return;
    setLookupLoading(true);
    setBanner(null);
    try {
      const obj = await client.getObject({
        id: eblId,
        options: { showContent: true },
      });
      if (obj.data?.content?.dataType !== 'moveObject') {
        throw new Error('Object not found or not a Move object.');
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fields = (obj.data.content as any).fields;
      const parsed = parseEBLFields(fields);
      setLookupId(eblId);
      setEbl(parsed);
      setVaultRecord(getVaultRecord('ebl', eblId));
      setLinkedInterop(await findLinkedInteropControlForEbl(client, eblId));
      setImportFile(null);
      setImportHash('');
      if (importPreviewUrl) {
        URL.revokeObjectURL(importPreviewUrl);
        setImportPreviewUrl('');
      }
    } catch (err) {
      console.error(err);
      setEbl(null);
      setVaultRecord(null);
      setLinkedInterop(null);
      setBanner({ tone: 'error', text: err instanceof Error ? err.message : 'Failed to load eBL object.' });
    } finally {
      setLookupLoading(false);
    }
  };

  const handleLookup = async () => {
    await loadEbl(lookupId);
  };

  const handleClearVault = () => {
    clearVault('ebl');
    setRecentVaultRecords([]);
    setVaultRecord(null);
    setBanner({ tone: 'ok', text: 'Local eBL vault cleared for the current deployment scope.' });
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (importPreviewUrl) URL.revokeObjectURL(importPreviewUrl);
    setImportFile(file);
    setImportPreviewUrl(URL.createObjectURL(file));
    const hash = await computeSHA256(file);
    setImportHash(hash);
  };

  const handleAttach = async () => {
    if (!account?.address || !lookupId || !ebl || !importFile) return;
    const isHolder = sameAddress(account.address, ebl.current_holder);
    const isLinkedController = sameAddress(account.address, linkedInterop?.data.controller);
    if (!isHolder && !isLinkedController) {
      setBanner({ tone: 'error', text: 'Only the current holder or the linked interop controller can attach or recover a file for this eBL.' });
      return;
    }
    if (importHash !== ebl.content_hash) {
      setBanner({ tone: 'error', text: 'The selected file does not match the on-chain content hash.' });
      return;
    }

    setImportPending(true);
    setBanner(null);
    try {
      const saved = await saveVaultRecord({
        anchorType: 'ebl',
        anchorId: lookupId,
        title: ebl.bl_number || 'Electronic Bill of Lading',
        file: importFile,
        hash: importHash,
        createdBy: account.address,
        initialOwner: isHolder ? ebl.current_holder : (linkedInterop?.data.controller || ebl.current_holder),
      });
      setVaultRecord(saved);
      refreshVault();
      setBanner({ tone: 'ok', text: 'File attached to the local browser vault and linked to this eBL ID.' });
    } catch (err) {
      console.error(err);
      setBanner({ tone: 'error', text: err instanceof Error ? err.message : 'Failed to save file in the local vault.' });
    } finally {
      setImportPending(false);
    }
  };

  const canAttach = Boolean(
    account?.address &&
    ebl &&
    (sameAddress(account.address, ebl.current_holder) || sameAddress(account.address, linkedInterop?.data.controller)) &&
    importFile &&
    importHash &&
    importHash === ebl.content_hash,
  );

  return (
    <div className="space-y-6">
      <section className="surface p-5 md:p-6">
        <h2 className="section-title">Document vault</h2>
        <p className="section-subtitle mt-1">
          Recover locally stored shipment files by `eBL ID`, or reattach a file to an existing eBL when the connected wallet is the current holder or the linked interop controller.
        </p>

        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-[1fr_auto]">
          <div>
            <label className="field-label">eBL object ID</label>
            <input
              className="field-input font-mono text-xs"
              placeholder="0x..."
              value={lookupId}
              onChange={(e) => setLookupId(e.target.value)}
            />
          </div>
          <button type="button" onClick={handleLookup} disabled={lookupLoading || !lookupId} className="btn-main self-end">
            {lookupLoading ? 'Loading...' : 'Load eBL'}
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="button" onClick={refreshVault} className="btn-alt">
            Refresh local vault
          </button>
          <button type="button" onClick={handleClearVault} className="btn-alt">
            Clear vault
          </button>
          <p className="text-xs text-[#5f7389]">This vault is local to the current browser profile. It is not remote storage.</p>
        </div>
      </section>

      <section className="surface p-5 md:p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="section-title">Local entries</h2>
            <p className="section-subtitle mt-1">Recent eBL files already saved in this browser.</p>
          </div>
        </div>

        {recentVaultRecords.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-[#cfd9e8] bg-[#fbfdff] p-4 text-sm text-[#5f7389]">
            No local eBL files found in this browser yet.
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {recentVaultRecords.map((record) => (
              <div key={record.id} className="rounded-2xl border border-[#d7e2ef] bg-white p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#173a5a]">{record.title}</p>
                    <p className="mt-1 truncate text-xs text-[#5f7389]">{record.fileName}</p>
                    <p className="mt-2 break-all font-mono text-[11px] text-[#365575]">{record.anchorId}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="btn-alt" onClick={() => void loadEbl(record.anchorId)}>
                      Load
                    </button>
                    <Link to={`/ebl/${record.anchorId}`} className="btn-alt">
                      Open eBL
                    </Link>
                  </div>
                </div>
              </div>
            ))}
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

      {ebl && (
        <>
          <section className="surface p-5 md:p-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <h2 className="section-title">{ebl.bl_number || 'Loaded eBL'}</h2>
                <p className="section-subtitle mt-1">{ebl.port_of_loading} {'->'} {ebl.port_of_discharge}</p>
              </div>
              <a href={explorerObjectUrl(lookupId)} target="_blank" rel="noopener noreferrer" className="btn-alt">
                View on Explorer
              </a>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-[#d7e2ef] bg-[#f8fbff] p-3">
                <p className="text-xs uppercase tracking-wide text-[#60758c]">Current holder</p>
                <p className="mt-1 break-all font-mono text-xs text-[#20415f]">{ebl.current_holder || '—'}</p>
              </div>
              <div className="rounded-xl border border-[#d7e2ef] bg-[#f8fbff] p-3">
                <p className="text-xs uppercase tracking-wide text-[#60758c]">Content hash</p>
                <p className="mt-1 break-all font-mono text-xs text-[#20415f]">{ebl.content_hash || '—'}</p>
              </div>
              {linkedInterop && (
                <div className="rounded-xl border border-[#d7e2ef] bg-[#f8fbff] p-3 md:col-span-2">
                  <p className="text-xs uppercase tracking-wide text-[#60758c]">Linked interop controller</p>
                  <p className="mt-1 break-all font-mono text-xs text-[#20415f]">{linkedInterop.data.controller}</p>
                </div>
              )}
            </div>
          </section>

          <section className="surface p-5 md:p-6">
            <h2 className="section-title">Attached document access</h2>
            <p className="section-subtitle mt-1">If the file already exists in this browser vault, you can open it here using the on-chain holder check and any linked interop controller.</p>
            <div className="mt-4">
              <DocumentVaultCard
                record={vaultRecord}
                currentOwner={ebl.current_holder}
                connectedAddress={account?.address}
                ownerLabel="Holder"
                expectedHash={ebl.content_hash}
                delegatedViewerLabel={linkedInterop ? 'Linked interop controller' : undefined}
                delegatedViewerAddress={linkedInterop?.data.controller}
              />
            </div>
          </section>

          {!vaultRecord && (
            <section className="surface p-5 md:p-6">
              <h2 className="section-title">Reattach local file</h2>
              <p className="section-subtitle mt-1">
                If the file is not already in this browser, select it again. The app will attach it only when the connected wallet is the current holder or the linked interop controller, and the hash matches the on-chain record.
              </p>

              {!sameAddress(account?.address, ebl.current_holder) && !sameAddress(account?.address, linkedInterop?.data.controller) && (
                <div className="mt-4 rounded-xl border border-[#f2c2c2] bg-[#fff7f7] p-4 text-sm text-[#9f2d2d]">
                  Only the current holder wallet or the linked interop controller can reattach a file for this eBL.
                </div>
              )}

              <div className="mt-4">
                <input ref={fileInputRef} type="file" accept=".pdf,.json,.txt,image/*" onChange={handleImportFile} className="hidden" />
                <div className="flex min-h-[52px] items-center gap-3 rounded-xl border border-[#cfd9e8] bg-white px-3 py-2.5">
                  <button type="button" className="btn-alt shrink-0" onClick={() => fileInputRef.current?.click()}>
                    Choose file
                  </button>
                  <span className="truncate text-sm text-[#4f657d]">{importFile?.name || 'No file selected'}</span>
                </div>
              </div>

              {importHash && (
                <div className={`mt-3 rounded-xl border p-3 text-xs ${
                  importHash === ebl.content_hash
                    ? 'border-[#b7e6d3] bg-[#eafaf3] text-[#0e6a47]'
                    : 'border-[#f2c2c2] bg-[#fff0f0] text-[#9f2d2d]'
                }`}>
                  {importHash === ebl.content_hash ? 'Hash matches the on-chain eBL record.' : 'Hash mismatch: selected file does not match the on-chain eBL hash.'}
                </div>
              )}

              {importFile && importPreviewUrl && (
                <div className="mt-4">
                  <LocalFilePreview
                    title="Selected recovery file"
                    fileName={importFile.name}
                    mimeType={importFile.type}
                    size={importFile.size}
                    sourceUrl={importPreviewUrl}
                    storageNote="This preview is local. Saving will link the file to the eBL ID in the browser vault."
                  />
                </div>
              )}

              <div className="mt-4">
                <button type="button" onClick={handleAttach} disabled={!canAttach || importPending} className="btn-main">
                  {importPending ? 'Attaching...' : 'Attach file to this eBL'}
                </button>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
