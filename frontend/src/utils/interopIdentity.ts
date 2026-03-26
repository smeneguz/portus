import wasmUrl from '@iota/identity-wasm/web/identity_wasm_bg.wasm?url';
import type * as IdentitySdk from '@iota/identity-wasm/web/index.js';
import { NETWORK } from '../config/constants';

export type IdentityClaims = {
  did: string;
  partyCode: string;
  role: string;
  issuerDid?: string;
};

type CredentialSubject = {
  id?: string;
  partyCode?: string;
  role?: string;
};

type CredentialLike = {
  type?: string[] | string;
  issuer?: string;
  issuanceDate?: string;
  credentialSubject?: CredentialSubject;
};

type PresentationLike = {
  type?: string[] | string;
  holder?: string;
  verifiableCredential?: CredentialLike[] | CredentialLike;
};

type RuntimeIdentity = {
  did: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  document: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  storage: any;
  fragment: string;
};

type JwtPayload = {
  iss?: string;
  sub?: string;
  vc?: {
    credentialSubject?: {
      id?: string;
      partyCode?: string;
      role?: string;
    };
  };
  vp?: {
    holder?: string;
    verifiableCredential?: string[];
  };
};

const runtimeIdentityCache = new Map<string, RuntimeIdentity>();
let authorityIdentity: RuntimeIdentity | null = null;
let sdkPromise: Promise<typeof import('@iota/identity-wasm/web/index.js')> | null = null;

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([key, nested]) => `${JSON.stringify(key)}:${stableStringify(nested)}`).join(',')}}`;
}

async function sha256Hex(input: string): Promise<string> {
  const encoded = new TextEncoder().encode(input);
  const digest = await window.crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function ensureType(type: string[] | string | undefined, expected: string, context: string): void {
  const values = Array.isArray(type) ? type : type ? [type] : [];
  if (!values.includes(expected)) {
    throw new Error(`${context} must include type "${expected}".`);
  }
}

function parseCredential(raw: string): CredentialLike {
  const parsed = JSON.parse(raw) as CredentialLike;
  ensureType(parsed.type, 'VerifiableCredential', 'Credential');
  return parsed;
}

function parsePresentation(raw: string): PresentationLike {
  const parsed = JSON.parse(raw) as PresentationLike;
  ensureType(parsed.type, 'VerifiablePresentation', 'Presentation');
  return parsed;
}

function isJwtLike(raw: string): boolean {
  return raw.trim().split('.').length === 3;
}

function decodeBase64Url(segment: string): string {
  const normalized = segment.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
  const binary = atob(padded);
  return new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
}

function decodeJwtPayload(raw: string): JwtPayload {
  const [, payload] = raw.trim().split('.');
  if (!payload) {
    throw new Error('JWT payload is missing.');
  }
  return JSON.parse(decodeBase64Url(payload)) as JwtPayload;
}

async function getIdentitySdk(): Promise<typeof import('@iota/identity-wasm/web/index.js')> {
  if (!sdkPromise) {
    sdkPromise = (async () => {
      const sdk = await import('@iota/identity-wasm/web/index.js');
      await sdk.init(wasmUrl);
      return sdk;
    })();
  }
  return sdkPromise;
}

async function resolveDidDocument(sdk: typeof IdentitySdk, did: string) {
  if (!did) {
    throw new Error('DID is required for identity verification.');
  }

  if (did.startsWith('did:jwk:')) {
    return sdk.CoreDocument.expandDIDJwk(sdk.DIDJwk.parse(did));
  }

  const cached = runtimeIdentityCache.get(did);
  if (cached) {
    return cached.document;
  }

  throw new Error(`No resolver available for DID ${did}. Use a did:jwk sample identity or add DID document resolution.`);
}

async function createRuntimeIdentity(role: string, partyCode: string, existingDid?: string): Promise<RuntimeIdentity> {
  if (existingDid && runtimeIdentityCache.has(existingDid)) {
    return runtimeIdentityCache.get(existingDid)!;
  }

  const sdk = await getIdentitySdk();
  const storage = new sdk.Storage(new sdk.JwkMemStore(), new sdk.KeyIdMemStore());
  const document = await sdk.CoreDocument.newDidJwk(
    storage,
    sdk.JwkMemStore.ed25519KeyType(),
    'EdDSA' as never,
  );
  const did = document.id().toString();

  document.setPropertyUnchecked('role', role);
  document.setPropertyUnchecked('partyCode', partyCode);

  const runtimeIdentity: RuntimeIdentity = {
    did,
    document,
    storage,
    fragment: '#0',
  };

  runtimeIdentityCache.set(did, runtimeIdentity);
  return runtimeIdentity;
}

async function getAuthorityIdentity(): Promise<RuntimeIdentity> {
  if (authorityIdentity) return authorityIdentity;

  const runtimeIdentity = await createRuntimeIdentity('authority', 'PORTUS-AUTH');
  authorityIdentity = runtimeIdentity;
  return runtimeIdentity;
}

export async function generateSignedCredentialJwt(subjectDid: string, partyCode: string, role: string): Promise<{ jwt: string; issuerDid: string }> {
  const sdk = await getIdentitySdk();
  const authority = await getAuthorityIdentity();

  const credential = new sdk.Credential({
    type: ['VerifiableCredential', 'InteropPartyCredential'],
    issuer: authority.did,
    credentialSubject: {
      id: subjectDid,
      partyCode,
      role,
    },
  });

  const jwt = await authority.document.createCredentialJwt(
    authority.storage,
    authority.fragment,
    credential,
    new sdk.JwsSignatureOptions(),
  );

  return {
    jwt: jwt.toString(),
    issuerDid: authority.did,
  };
}

export async function generateSignedPresentationJwt(
  partyCode: string,
  role: string,
  existingDid?: string,
): Promise<{ did: string; credentialJwt: string; presentationJwt: string; issuerDid: string }> {
  const sdk = await getIdentitySdk();
  const authority = await getAuthorityIdentity();

  const holder = existingDid
    ? runtimeIdentityCache.get(existingDid) || (() => { throw new Error(`No local signing keys found for ${existingDid}. Generate the VP from the initiate step or paste a signed JWT manually.`); })()
    : await createRuntimeIdentity(role, partyCode);

  const credentialJwt = await authority.document.createCredentialJwt(
    authority.storage,
    authority.fragment,
    new sdk.Credential({
      type: ['VerifiableCredential', 'InteropPartyCredential'],
      issuer: authority.did,
      credentialSubject: {
        id: holder.did,
        partyCode,
        role,
      },
    }),
    new sdk.JwsSignatureOptions(),
  );

  const presentationJwt = await holder.document.createPresentationJwt(
    holder.storage,
    holder.fragment,
    new sdk.Presentation({
      type: ['VerifiablePresentation'],
      holder: holder.did,
      verifiableCredential: [credentialJwt],
    }),
    new sdk.JwsSignatureOptions(),
    new sdk.JwtPresentationOptions(),
  );

  return {
    did: holder.did,
    credentialJwt: credentialJwt.toString(),
    presentationJwt: presentationJwt.toString(),
    issuerDid: authority.did,
  };
}

async function validateJwtCredential(
  raw: string,
  expectedDid: string,
  expectedPartyCode: string,
): Promise<{ hash: string; claims: IdentityClaims; mode: 'jwt-signature' }> {
  const sdk = await getIdentitySdk();
  const payload = decodeJwtPayload(raw);
  const issuerDid = payload.iss || '';
  const subjectDid = payload.sub || payload.vc?.credentialSubject?.id || '';
  const partyCode = payload.vc?.credentialSubject?.partyCode || '';
  const role = payload.vc?.credentialSubject?.role || '';

  if (!issuerDid) {
    throw new Error('Credential JWT is missing issuer DID.');
  }
  if (!subjectDid || !partyCode || !role) {
    throw new Error('Credential JWT is missing subject DID, party code or role claims.');
  }
  if (subjectDid !== expectedDid) {
    throw new Error('Credential DID does not match the form DID.');
  }
  if (partyCode !== expectedPartyCode) {
    throw new Error('Credential party code does not match the form party code.');
  }

  const issuerDoc = await resolveDidDocument(sdk, issuerDid);
  const validator = new sdk.JwtCredentialValidator();
  validator.validate(
    new sdk.Jwt(raw.trim()),
    issuerDoc,
    new sdk.JwtCredentialValidationOptions(),
    sdk.FailFast.FirstError,
  );

  return {
    hash: await sha256Hex(raw.trim()),
    claims: {
      did: subjectDid,
      partyCode,
      role,
      issuerDid,
    },
    mode: 'jwt-signature',
  };
}

async function validateJsonCredential(
  raw: string,
  expectedDid: string,
  expectedPartyCode: string,
): Promise<{ hash: string; claims: IdentityClaims; mode: 'structured-json' }> {
  const sdk = await getIdentitySdk();
  const parsed = parseCredential(raw);
  sdk.Credential.fromJSON(parsed);

  const subject = parsed.credentialSubject;
  const claims: IdentityClaims = {
    did: subject?.id || '',
    partyCode: subject?.partyCode || '',
    role: subject?.role || '',
    issuerDid: parsed.issuer,
  };

  if (!claims.did || !claims.partyCode || !claims.role) {
    throw new Error('Credential is missing credentialSubject.id, credentialSubject.partyCode or credentialSubject.role.');
  }
  if (claims.did !== expectedDid) {
    throw new Error('Credential DID does not match the form DID.');
  }
  if (claims.partyCode !== expectedPartyCode) {
    throw new Error('Credential party code does not match the form party code.');
  }

  return {
    hash: await sha256Hex(stableStringify(parsed)),
    claims,
    mode: 'structured-json',
  };
}

export async function validateCredentialInput(raw: string, expectedDid: string, expectedPartyCode: string) {
  return isJwtLike(raw)
    ? validateJwtCredential(raw, expectedDid, expectedPartyCode)
    : validateJsonCredential(raw, expectedDid, expectedPartyCode);
}

async function validateJwtPresentation(
  raw: string,
  expectedDid: string,
  expectedPartyCode: string,
): Promise<{ hash: string; claims: IdentityClaims; mode: 'jwt-signature' }> {
  const sdk = await getIdentitySdk();
  const payload = decodeJwtPayload(raw);
  const holderDid = payload.iss || payload.vp?.holder || '';
  const embeddedCredentialJwt = payload.vp?.verifiableCredential?.[0] || '';

  if (!holderDid) {
    throw new Error('Presentation JWT is missing holder DID.');
  }
  if (!embeddedCredentialJwt) {
    throw new Error('Presentation JWT must contain an embedded credential JWT.');
  }
  if (holderDid !== expectedDid) {
    throw new Error('Presentation holder does not match the recipient DID.');
  }

  const holderDoc = await resolveDidDocument(sdk, holderDid);
  const presentationValidator = new sdk.JwtPresentationValidator();
  presentationValidator.validate(
    new sdk.Jwt(raw.trim()),
    holderDoc,
    new sdk.JwtPresentationValidationOptions(),
  );

  const credentialCheck = await validateJwtCredential(embeddedCredentialJwt, expectedDid, expectedPartyCode);
  return {
    hash: await sha256Hex(raw.trim()),
    claims: credentialCheck.claims,
    mode: 'jwt-signature',
  };
}

async function validateJsonPresentation(
  raw: string,
  expectedDid: string,
  expectedPartyCode: string,
): Promise<{ hash: string; claims: IdentityClaims; mode: 'structured-json' }> {
  const sdk = await getIdentitySdk();
  const parsed = parsePresentation(raw);
  const presentation = sdk.Presentation.fromJSON(parsed);
  sdk.JwtPresentationValidator.checkStructure(presentation);

  if ((parsed.holder || '') !== expectedDid) {
    throw new Error('Presentation holder does not match the recipient DID.');
  }

  const embeddedCredential = Array.isArray(parsed.verifiableCredential)
    ? parsed.verifiableCredential[0]
    : parsed.verifiableCredential;
  if (!embeddedCredential || typeof embeddedCredential !== 'object') {
    throw new Error('Presentation must include at least one embedded verifiable credential object.');
  }
  ensureType((embeddedCredential as CredentialLike).type, 'VerifiableCredential', 'Embedded credential');

  const subject = (embeddedCredential as CredentialLike).credentialSubject;
  const claims: IdentityClaims = {
    did: subject?.id || '',
    partyCode: subject?.partyCode || '',
    role: subject?.role || '',
    issuerDid: (embeddedCredential as CredentialLike).issuer,
  };

  if (!claims.did || !claims.partyCode || !claims.role) {
    throw new Error('Embedded credential is missing id, partyCode or role.');
  }
  if (claims.did !== expectedDid) {
    throw new Error('Presentation credential DID does not match the recipient DID.');
  }
  if (claims.partyCode !== expectedPartyCode) {
    throw new Error('Presentation credential party code does not match the recipient party code.');
  }

  return {
    hash: await sha256Hex(stableStringify(parsed)),
    claims,
    mode: 'structured-json',
  };
}

export async function validatePresentationInput(raw: string, expectedDid: string, expectedPartyCode: string) {
  return isJwtLike(raw)
    ? validateJwtPresentation(raw, expectedDid, expectedPartyCode)
    : validateJsonPresentation(raw, expectedDid, expectedPartyCode);
}

export function defaultInteropDid(address: string | undefined, platform: number): string {
  const normalized = (address || '').toLowerCase().replace(/^0x/, '');
  if (!normalized) return '';
  return `did:iota:${NETWORK}:platform-${platform}:${normalized}`;
}

export function defaultPartyCode(platform: number, address: string | undefined): string {
  const normalized = (address || '').toLowerCase().replace(/^0x/, '');
  const suffix = normalized ? normalized.slice(-6).toUpperCase() : 'PARTY';
  return `PLAT-${platform}-${suffix}`;
}

export function generateTransferNonce(): string {
  if (typeof window !== 'undefined' && typeof window.crypto?.randomUUID === 'function') {
    return window.crypto.randomUUID();
  }
  return `nonce-${Date.now()}`;
}

export function formatExpiryTimestamp(timestampMs: string | number): string {
  const numeric = Number(timestampMs || 0);
  if (!numeric) return '—';
  return new Date(numeric).toLocaleString();
}

export function formatPlatformWithCode(platform: string | number): string {
  const numeric = Number(platform || 0);
  const label = Number.isFinite(numeric) ? `Platform ${numeric}` : 'Platform';
  return `${label}`;
}
