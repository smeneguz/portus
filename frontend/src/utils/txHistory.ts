export interface TxHistoryEntry {
  digest: string;
  action: string;
  area: 'carrier' | 'transfer' | 'surrender' | 'interop';
  referenceId?: string;
  referenceLabel?: string;
  details?: string;
  createdAt: number;
}

const STORAGE_KEY = 'portus.tx.history.v1';
const MAX_ENTRIES = 250;

export function getTxHistory(): TxHistoryEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Partial<TxHistoryEntry>[];
    return parsed
      .filter((item) => item?.digest && item?.action && item?.createdAt && item?.area)
      .map((item) => ({
        digest: String(item.digest),
        action: String(item.action),
        area: item.area as TxHistoryEntry['area'],
        referenceId: item.referenceId ? String(item.referenceId) : undefined,
        referenceLabel: item.referenceLabel ? String(item.referenceLabel) : undefined,
        details: item.details ? String(item.details) : undefined,
        createdAt: Number(item.createdAt),
      }))
      .sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

export function recordTx(
  payload: Omit<TxHistoryEntry, 'createdAt'>,
): void {
  if (!payload.digest || typeof window === 'undefined') return;
  const nextEntry: TxHistoryEntry = {
    ...payload,
    createdAt: Date.now(),
  };

  const current = getTxHistory();
  const deduped = current.filter((item) => !(item.digest === nextEntry.digest && item.action === nextEntry.action));
  const next = [nextEntry, ...deduped].slice(0, MAX_ENTRIES);

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function clearTxHistory(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(STORAGE_KEY);
}
