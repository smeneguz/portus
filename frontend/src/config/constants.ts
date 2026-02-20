export const NETWORK = (import.meta.env.VITE_NETWORK || 'testnet') as 'testnet' | 'mainnet';
export const PACKAGE_ID = import.meta.env.VITE_PACKAGE_ID || '0xcd4c2548a8995de4ad5aa8af33c76cf846b86a2eccafc99311afc33fe2c97159';
export const BL_REGISTRY_ID = import.meta.env.VITE_BL_REGISTRY_ID || '0xce1750a4c1cc8dff96ecdfdf61cd6be649283f58abd7e5f16e13c9b32b48be8e';
export const CARRIER_REGISTRY_ID = import.meta.env.VITE_CARRIER_REGISTRY_ID || '0x6e6f141e6ffb7ba7323a1e8a34924cac7920a84f5aadb38f4b4be0332f7e70a4';
export const RPC_URL = import.meta.env.VITE_RPC_URL || 'https://api.testnet.iota.cafe:443';
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

export function explorerObjectUrl(objectId: string): string {
  return `${EXPLORER_URL}/object/${objectId}?network=${NETWORK}`;
}

export function explorerTxUrl(digest: string): string {
  return `${EXPLORER_URL}/txblock/${digest}?network=${NETWORK}`;
}
