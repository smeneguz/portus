import { useSignAndExecuteTransaction } from '@iota/dapp-kit';
import { Transaction } from '@iota/iota-sdk/transactions';
import { CLOCK_ID, INTEROP_REGISTRY_ID, PACKAGE_ID } from '../config/constants';

export interface InteropDocumentData {
  linked_ebl_id: string;
  document_hash: string;
  document_type: string;
  source_platform: string;
  current_platform: string;
  controller: string;
  controller_did: string;
  controller_party_code: string;
  controller_identity_hash: string;
  pending_controller: string;
  pending_controller_did: string;
  pending_party_code: string;
  pending_platform: string;
  pending_identity_hash: string;
  transfer_nonce: string;
  pending_transfer_expiry_ms: string;
  last_transfer_proof_hash: string;
  last_rejection_reason: string;
  transfer_count: string;
  state: string;
  created_at: string;
  updated_at: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseInteropDocumentFields(fields: any): InteropDocumentData {
  return {
    linked_ebl_id: fields.linked_ebl_id || '',
    document_hash: fields.document_hash || '',
    document_type: fields.document_type || '',
    source_platform: String(fields.source_platform ?? '0'),
    current_platform: String(fields.current_platform ?? '0'),
    controller: fields.controller || '',
    controller_did: fields.controller_did || '',
    controller_party_code: fields.controller_party_code || '',
    controller_identity_hash: fields.controller_identity_hash || '',
    pending_controller: fields.pending_controller || '',
    pending_controller_did: fields.pending_controller_did || '',
    pending_party_code: fields.pending_party_code || '',
    pending_platform: String(fields.pending_platform ?? '255'),
    pending_identity_hash: fields.pending_identity_hash || '',
    transfer_nonce: fields.transfer_nonce || '',
    pending_transfer_expiry_ms: String(fields.pending_transfer_expiry_ms ?? '0'),
    last_transfer_proof_hash: fields.last_transfer_proof_hash || '',
    last_rejection_reason: fields.last_rejection_reason || '',
    transfer_count: String(fields.transfer_count ?? '0'),
    state: String(fields.state ?? '0'),
    created_at: String(fields.created_at ?? '0'),
    updated_at: String(fields.updated_at ?? '0'),
  };
}

export function useRegisterInteropDocument() {
  const { mutateAsync: signAndExecute, isPending } = useSignAndExecuteTransaction();

  const registerDocument = async (params: {
    linkedEblId: string;
    documentHash: string;
    documentType: string;
    sourcePlatform: number;
    controllerDid: string;
    controllerPartyCode: string;
    controllerIdentityHash: string;
  }) => {
    if (!INTEROP_REGISTRY_ID) {
      throw new Error('VITE_INTEROP_REGISTRY_ID is not configured');
    }

    const tx = new Transaction();
    tx.moveCall({
      target: `${PACKAGE_ID}::interop_control::register_document`,
      arguments: [
        tx.object(INTEROP_REGISTRY_ID),
        tx.pure.address(params.linkedEblId),
        tx.pure.string(params.documentHash),
        tx.pure.string(params.documentType),
        tx.pure.u8(params.sourcePlatform),
        tx.pure.string(params.controllerDid),
        tx.pure.string(params.controllerPartyCode),
        tx.pure.string(params.controllerIdentityHash),
        tx.object(CLOCK_ID),
      ],
    });

    return signAndExecute({
      transaction: tx,
      options: { showEffects: true, showObjectChanges: true, showEvents: true },
    });
  };

  return { registerDocument, isPending };
}

export function useInitiateInteropTransfer() {
  const { mutateAsync: signAndExecute, isPending } = useSignAndExecuteTransaction();

  const initiateTransfer = async (params: {
    documentId: string;
    toController: string;
    toControllerDid: string;
    toPartyCode: string;
    toPlatform: number;
    proofHash: string;
    expectedIdentityHash: string;
    transferNonce: string;
    expiryDurationMs: number;
  }) => {
    if (!INTEROP_REGISTRY_ID) {
      throw new Error('VITE_INTEROP_REGISTRY_ID is not configured');
    }

    const tx = new Transaction();
    tx.moveCall({
      target: `${PACKAGE_ID}::interop_control::initiate_transfer`,
      arguments: [
        tx.object(INTEROP_REGISTRY_ID),
        tx.object(params.documentId),
        tx.pure.address(params.toController),
        tx.pure.string(params.toControllerDid),
        tx.pure.string(params.toPartyCode),
        tx.pure.u8(params.toPlatform),
        tx.pure.string(params.proofHash),
        tx.pure.string(params.expectedIdentityHash),
        tx.pure.string(params.transferNonce),
        tx.pure.u64(params.expiryDurationMs),
        tx.object(CLOCK_ID),
      ],
    });

    return signAndExecute({
      transaction: tx,
      options: { showEffects: true, showObjectChanges: true, showEvents: true },
    });
  };

  return { initiateTransfer, isPending };
}

export function useAcceptInteropTransfer() {
  const { mutateAsync: signAndExecute, isPending } = useSignAndExecuteTransaction();

  const acceptTransfer = async (params: {
    documentId: string;
    recipientDid: string;
    recipientPartyCode: string;
    identityHash: string;
  }) => {
    if (!INTEROP_REGISTRY_ID) {
      throw new Error('VITE_INTEROP_REGISTRY_ID is not configured');
    }

    const tx = new Transaction();
    tx.moveCall({
      target: `${PACKAGE_ID}::interop_control::accept_transfer`,
      arguments: [
        tx.object(INTEROP_REGISTRY_ID),
        tx.object(params.documentId),
        tx.pure.string(params.recipientDid),
        tx.pure.string(params.recipientPartyCode),
        tx.pure.string(params.identityHash),
        tx.object(CLOCK_ID),
      ],
    });

    return signAndExecute({
      transaction: tx,
      options: { showEffects: true, showObjectChanges: true, showEvents: true },
    });
  };

  return { acceptTransfer, isPending };
}

export function useCancelInteropTransfer() {
  const { mutateAsync: signAndExecute, isPending } = useSignAndExecuteTransaction();

  const cancelTransfer = async (params: {
    documentId: string;
    rejectionReason: string;
  }) => {
    if (!INTEROP_REGISTRY_ID) {
      throw new Error('VITE_INTEROP_REGISTRY_ID is not configured');
    }

    const tx = new Transaction();
    tx.moveCall({
      target: `${PACKAGE_ID}::interop_control::cancel_transfer`,
      arguments: [
        tx.object(INTEROP_REGISTRY_ID),
        tx.object(params.documentId),
        tx.pure.string(params.rejectionReason),
        tx.object(CLOCK_ID),
      ],
    });

    return signAndExecute({
      transaction: tx,
      options: { showEffects: true, showObjectChanges: true, showEvents: true },
    });
  };

  return { cancelTransfer, isPending };
}
