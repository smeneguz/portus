import { useState } from 'react';
import { computeSHA256 } from '../hooks/useNotarization';

interface Props {
  onChainHash: string;
}

export default function DocumentVerifier({ onChainHash }: Props) {
  const [uploadedHash, setUploadedHash] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [computing, setComputing] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setComputing(true);
    const hash = await computeSHA256(file);
    setUploadedHash(hash);
    setComputing(false);
  };

  const match = uploadedHash !== null && uploadedHash === onChainHash;
  const mismatch = uploadedHash !== null && uploadedHash !== onChainHash;

  return (
    <div className="space-y-4">
      <div>
        <label className="field-label">Upload document to verify</label>
        <input
          type="file"
          onChange={handleFile}
          className="block w-full rounded-xl border border-[#cfd9e8] bg-white p-2.5 text-sm text-[#4f657d] file:mr-3 file:rounded-lg file:border-0 file:bg-[#e6efff] file:px-3 file:py-2 file:text-xs file:font-semibold file:text-[#0e4fbf]"
        />
        {computing && <p className="mt-1 text-sm text-[#5f7389]">Computing hash...</p>}
        {fileName && !computing && <p className="mt-1 text-sm text-[#5f7389]">File: {fileName}</p>}
      </div>

      {match && (
        <div className="rounded-xl border border-[#b7e6d3] bg-[#eafaf3] p-4">
          <p className="font-semibold text-[#0e6a47]">Authentic: uploaded file matches the on-chain record.</p>
          <p className="mt-1 break-all font-mono text-xs text-[#1f6b4f]">Hash: {uploadedHash}</p>
        </div>
      )}

      {mismatch && (
        <div className="rounded-xl border border-[#f2c2c2] bg-[#fff0f0] p-4">
          <p className="font-semibold text-[#9f2d2d]">Mismatch detected: uploaded file does not match notarized hash.</p>
          <div className="mt-2 space-y-1 font-mono text-xs">
            <p className="break-all text-[#1e6d4f]">On-chain: {onChainHash}</p>
            <p className="break-all text-[#9f2d2d]">Uploaded: {uploadedHash}</p>
          </div>
        </div>
      )}
    </div>
  );
}
