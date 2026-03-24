import type { VaultRecord } from '../utils/documentVault';
import LocalFilePreview from './LocalFilePreview';

type DocumentVaultCardProps = {
  record: VaultRecord | null;
  currentOwner: string;
  connectedAddress?: string;
  ownerLabel: string;
  expectedHash?: string;
  delegatedViewerLabel?: string;
  delegatedViewerAddress?: string;
};

function sameAddress(a: string | undefined, b: string | undefined): boolean {
  return (a || '').toLowerCase() === (b || '').toLowerCase();
}

export default function DocumentVaultCard({
  record,
  currentOwner,
  connectedAddress,
  ownerLabel,
  expectedHash,
  delegatedViewerLabel,
  delegatedViewerAddress,
}: DocumentVaultCardProps) {
  if (!record) {
    return (
      <div className="rounded-2xl border border-dashed border-[#cfd9e8] bg-[#fbfdff] p-4 text-sm text-[#5f7389]">
        No file is attached to this object in the current browser vault.
      </div>
    );
  }

  const canAccess = sameAddress(connectedAddress, currentOwner) || sameAddress(connectedAddress, delegatedViewerAddress);
  const hashMatches = !expectedHash || expectedHash === record.hash;

  return (
    <div className="space-y-4 rounded-2xl border border-[#d7e2ef] bg-white p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#60758c]">Local document vault</p>
          <p className="mt-1 text-sm font-semibold text-[#173a5a]">{record.title}</p>
          <p className="text-xs text-[#5f7389]">Stored locally in this browser and linked to {record.anchorType === 'ebl' ? 'the eBL object' : 'the interop control object'}.</p>
        </div>
        <div className={`rounded-xl px-3 py-2 text-xs font-semibold ${hashMatches ? 'bg-[#eafaf3] text-[#0e6a47]' : 'bg-[#fff0f0] text-[#9f2d2d]'}`}>
          {hashMatches ? 'Hash matches on-chain record' : 'Hash mismatch detected'}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-[#d7e2ef] bg-[#f8fbff] p-3">
          <p className="text-xs uppercase tracking-wide text-[#60758c]">Current {ownerLabel}</p>
          <p className="mt-1 break-all font-mono text-xs text-[#20415f]">{currentOwner || '—'}</p>
        </div>
        <div className="rounded-xl border border-[#d7e2ef] bg-[#f8fbff] p-3">
          <p className="text-xs uppercase tracking-wide text-[#60758c]">Connected wallet access</p>
          <p className={`mt-1 text-sm font-semibold ${canAccess ? 'text-[#0e6a47]' : 'text-[#9f2d2d]'}`}>
            {canAccess ? 'Preview and download enabled' : 'Locked for the current wallet'}
          </p>
        </div>
        {delegatedViewerAddress && (
          <div className="rounded-xl border border-[#d7e2ef] bg-[#f8fbff] p-3 md:col-span-2">
            <p className="text-xs uppercase tracking-wide text-[#60758c]">{delegatedViewerLabel || 'Delegated viewer'}</p>
            <p className="mt-1 break-all font-mono text-xs text-[#20415f]">{delegatedViewerAddress}</p>
          </div>
        )}
      </div>

      {canAccess ? (
        <LocalFilePreview
          title="Attached file"
          fileName={record.fileName}
          mimeType={record.mimeType}
          size={record.size}
          sourceUrl={record.dataUrl}
          storageNote="This file stays local to this browser. Access follows the on-chain holder and any linked interop controller shown above."
        />
      ) : (
        <div className="rounded-xl border border-[#f2c2c2] bg-[#fff7f7] p-4 text-sm text-[#9f2d2d]">
          The file is present in the local vault, but preview and download are disabled because the connected wallet is not an authorized on-chain viewer.
        </div>
      )}
    </div>
  );
}
