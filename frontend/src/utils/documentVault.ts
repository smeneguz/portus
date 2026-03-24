import { NETWORK, PACKAGE_ID } from '../config/constants';

export type VaultAnchorType = 'ebl' | 'interop';

export type VaultRecord = {
  id: string;
  anchorType: VaultAnchorType;
  anchorId: string;
  title: string;
  fileName: string;
  mimeType: string;
  size: number;
  hash: string;
  dataUrl: string;
  createdAt: number;
  createdBy: string;
  initialOwner: string;
};

function storageKey(): string {
  return `portus.document-vault.v1.${NETWORK}.${PACKAGE_ID.toLowerCase()}`;
}

function readVault(): VaultRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(storageKey());
    if (!raw) return [];
    const parsed = JSON.parse(raw) as VaultRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('Failed to read document vault:', err);
    return [];
  }
}

function writeVault(records: VaultRecord[]): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(storageKey(), JSON.stringify(records));
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Failed to read file.'));
    reader.readAsDataURL(file);
  });
}

export async function saveVaultRecord(params: {
  anchorType: VaultAnchorType;
  anchorId: string;
  title: string;
  file: File;
  hash: string;
  createdBy: string;
  initialOwner: string;
}): Promise<VaultRecord> {
  const dataUrl = await fileToDataUrl(params.file);
  const record: VaultRecord = {
    id: `${params.anchorType}:${params.anchorId}`,
    anchorType: params.anchorType,
    anchorId: params.anchorId,
    title: params.title,
    fileName: params.file.name,
    mimeType: params.file.type || 'application/octet-stream',
    size: params.file.size,
    hash: params.hash,
    dataUrl,
    createdAt: Date.now(),
    createdBy: params.createdBy,
    initialOwner: params.initialOwner,
  };

  const existing = readVault().filter((item) => item.id !== record.id);
  existing.unshift(record);
  writeVault(existing.slice(0, 50));
  return record;
}

export function getVaultRecord(anchorType: VaultAnchorType, anchorId: string): VaultRecord | null {
  if (!anchorId) return null;
  return readVault().find((item) => item.anchorType === anchorType && item.anchorId === anchorId) || null;
}

export function listVaultRecords(anchorType?: VaultAnchorType): VaultRecord[] {
  const records = readVault();
  if (!anchorType) return records;
  return records.filter((item) => item.anchorType === anchorType);
}

export function clearVault(anchorType?: VaultAnchorType): void {
  if (typeof window === 'undefined') return;
  if (!anchorType) {
    window.localStorage.removeItem(storageKey());
    return;
  }
  const filtered = readVault().filter((item) => item.anchorType !== anchorType);
  writeVault(filtered);
}
