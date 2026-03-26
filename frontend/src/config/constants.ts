export const NETWORK = (import.meta.env.VITE_NETWORK || 'mainnet') as 'testnet' | 'mainnet';
export const PACKAGE_ID = import.meta.env.VITE_PACKAGE_ID || '';
export const BL_REGISTRY_ID = import.meta.env.VITE_BL_REGISTRY_ID || '';
export const CARRIER_REGISTRY_ID = import.meta.env.VITE_CARRIER_REGISTRY_ID || '';
export const INTEROP_REGISTRY_ID = import.meta.env.VITE_INTEROP_REGISTRY_ID || '';
export const RPC_URL = import.meta.env.VITE_RPC_URL || '';
export const CLOCK_ID = '0x6';

export const EXPLORER_URL = 'https://explorer.iota.org';

export const STATUS_LABELS: Record<number, string> = {
  0: 'Issued',
  1: 'In Transit',
  2: 'Arrived',
  3: 'Surrendered',
  4: 'Accomplished',
};

export const ENDORSEMENT_TYPES: Record<number, string> = {
  0: 'Blank',
  1: 'To Order',
  2: 'Straight',
};

export const INTEROP_PLATFORM_LABELS: Record<number, string> = {
  1: 'Platform A',
  2: 'Platform B',
  3: 'Platform C',
  255: 'Unset',
};

export const INTEROP_STATE_LABELS: Record<number, string> = {
  0: 'Active',
  1: 'Pending Transfer',
};

export function explorerObjectUrl(objectId: string): string {
  return `${EXPLORER_URL}/object/${objectId}?network=${NETWORK}`;
}

export function explorerTxUrl(digest: string): string {
  return `${EXPLORER_URL}/txblock/${digest}?network=${NETWORK}`;
}
