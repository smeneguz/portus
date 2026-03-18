export type IdentityClaims = {
  did: string;
  partyCode: string;
  role: string;
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

export async function validateCredentialJson(raw: string, expectedDid: string, expectedPartyCode: string): Promise<{ hash: string; claims: IdentityClaims }> {
  const credential = parseCredential(raw);
  const subject = credential.credentialSubject;
  const claims: IdentityClaims = {
    did: subject?.id || '',
    partyCode: subject?.partyCode || '',
    role: subject?.role || '',
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

  const hash = await sha256Hex(stableStringify(credential));
  return { hash, claims };
}

export async function validatePresentationJson(raw: string, expectedDid: string, expectedPartyCode: string): Promise<{ hash: string; claims: IdentityClaims }> {
  const presentation = parsePresentation(raw);
  if ((presentation.holder || '') !== expectedDid) {
    throw new Error('Presentation holder does not match the recipient DID.');
  }

  const embeddedCredential = Array.isArray(presentation.verifiableCredential)
    ? presentation.verifiableCredential[0]
    : presentation.verifiableCredential;
  if (!embeddedCredential) {
    throw new Error('Presentation must include at least one embedded verifiable credential.');
  }
  ensureType(embeddedCredential.type, 'VerifiableCredential', 'Embedded credential');

  const subject = embeddedCredential.credentialSubject;
  const claims: IdentityClaims = {
    did: subject?.id || '',
    partyCode: subject?.partyCode || '',
    role: subject?.role || '',
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

  const hash = await sha256Hex(stableStringify(presentation));
  return { hash, claims };
}

export function defaultInteropDid(address: string | undefined, platform: number): string {
  const normalized = (address || '').toLowerCase().replace(/^0x/, '');
  if (!normalized) return '';
  return `did:iota:testnet:platform-${platform}:${normalized}`;
}

export function defaultPartyCode(platform: number, address: string | undefined): string {
  const normalized = (address || '').toLowerCase().replace(/^0x/, '');
  const suffix = normalized ? normalized.slice(-6).toUpperCase() : 'PARTY';
  return `PLAT-${platform}-${suffix}`;
}

export function buildSampleCredentialJson(did: string, partyCode: string, role: string): string {
  return JSON.stringify(
    {
      '@context': ['https://www.w3.org/2018/credentials/v1'],
      type: ['VerifiableCredential', 'InteropPartyCredential'],
      issuer: 'did:iota:testnet:portus-authority',
      issuanceDate: new Date().toISOString(),
      credentialSubject: {
        id: did,
        partyCode,
        role,
      },
    },
    null,
    2,
  );
}

export function buildSamplePresentationJson(did: string, partyCode: string, role: string): string {
  return JSON.stringify(
    {
      '@context': ['https://www.w3.org/2018/credentials/v1'],
      type: ['VerifiablePresentation'],
      holder: did,
      verifiableCredential: [
        {
          '@context': ['https://www.w3.org/2018/credentials/v1'],
          type: ['VerifiableCredential', 'InteropPartyCredential'],
          issuer: 'did:iota:testnet:portus-authority',
          issuanceDate: new Date().toISOString(),
          credentialSubject: {
            id: did,
            partyCode,
            role,
          },
        },
      ],
    },
    null,
    2,
  );
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
