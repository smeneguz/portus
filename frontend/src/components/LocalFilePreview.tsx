type LocalFilePreviewProps = {
  title: string;
  fileName: string;
  mimeType: string;
  size: number;
  sourceUrl: string;
  storageNote?: string;
};

function formatBytes(size: number): string {
  if (!size) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = size;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function renderPreview(sourceUrl: string, mimeType: string, fileName: string) {
  if (!sourceUrl) return null;
  if (mimeType.startsWith('image/')) {
    return <img src={sourceUrl} alt={fileName} className="max-h-[26rem] w-full rounded-xl border border-[#d7e2ef] object-contain bg-white" />;
  }
  if (mimeType === 'application/pdf' || mimeType.startsWith('text/') || mimeType.includes('json')) {
    return <iframe src={sourceUrl} title={fileName} className="h-[28rem] w-full rounded-xl border border-[#d7e2ef] bg-white" />;
  }
  return (
    <div className="rounded-xl border border-dashed border-[#cfd9e8] bg-white p-4 text-sm text-[#5f7389]">
      Inline preview is not available for this file type. Use the buttons below.
    </div>
  );
}

export default function LocalFilePreview({ title, fileName, mimeType, size, sourceUrl, storageNote }: LocalFilePreviewProps) {
  return (
    <div className="rounded-2xl border border-[#d7e2ef] bg-[#f8fbff] p-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#60758c]">{title}</p>
          <p className="mt-1 text-sm font-semibold text-[#173a5a]">{fileName}</p>
          <p className="text-xs text-[#5f7389]">{mimeType || 'application/octet-stream'} · {formatBytes(size)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="btn-alt">
            Open Preview
          </a>
          <a href={sourceUrl} download={fileName} className="btn-main">
            Download File
          </a>
        </div>
      </div>

      <div className="mt-4">{renderPreview(sourceUrl, mimeType, fileName)}</div>

      {storageNote && <p className="mt-3 text-xs text-[#5f7389]">{storageNote}</p>}
    </div>
  );
}
