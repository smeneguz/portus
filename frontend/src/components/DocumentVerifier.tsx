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
        <label className="block text-sm font-medium text-gray-700 mb-1">Upload document to verify</label>
        <input
          type="file"
          onChange={handleFile}
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
        />
        {computing && <p className="text-sm text-gray-500 mt-1">Computing hash...</p>}
        {fileName && !computing && <p className="text-sm text-gray-500 mt-1">File: {fileName}</p>}
      </div>

      {match && (
        <div className="rounded-lg bg-green-50 border border-green-200 p-4">
          <p className="text-green-800 font-semibold">Authentic &mdash; matches on-chain record</p>
          <p className="text-xs text-green-600 font-mono mt-1 break-all">Hash: {uploadedHash}</p>
        </div>
      )}

      {mismatch && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4">
          <p className="text-red-800 font-semibold">FRAUD DETECTED &mdash; hash does not match notarised document</p>
          <div className="mt-2 text-xs font-mono space-y-1">
            <p className="text-green-700 break-all">On-chain: {onChainHash}</p>
            <p className="text-red-700 break-all">Uploaded: {uploadedHash}</p>
          </div>
        </div>
      )}
    </div>
  );
}
