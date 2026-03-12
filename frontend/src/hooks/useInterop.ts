import { useSignAndExecuteTransaction } from '@iota/dapp-kit';
import { Transaction } from '@iota/iota-sdk/transactions';
import { CLOCK_ID, INTEROP_REGISTRY_ID, PACKAGE_ID } from '../config/constants';

export interface InteropDocumentData {
  document_hash: string;
  document_type: string;
  source_platform: string;
  current_platform: string;
  controller: string;
  pending_controller: string;
  pending_platform: string;
  last_transfer_proof_hash: string;
  transfer_count: string;
  state: string;
  created_at: string;
  updated_at: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseInteropDocumentFields(fields: any): InteropDocumentData {
  return {
    document_hash: fields.document_hash || '',
    document_type: fields.document_type || '',
    source_platform: String(fields.source_platform ?? '0'),
    current_platform: String(fields.current_platform ?? '0'),
    controller: fields.controller || '',
    pending_controller: fields.pending_controller || '',
    pending_platform: String(fields.pending_platform ?? '255'),
    last_transfer_proof_hash: fields.last_transfer_proof_hash || '',
    transfer_count: String(fields.transfer_count ?? '0'),
    state: String(fields.state ?? '0'),
    created_at: String(fields.created_at ?? '0'),
    updated_at: String(fields.updated_at ?? '0'),
  };
}

export function useRegisterInteropDocument() {
  const { mutateAsync: signAndExecute, isPending } = useSignAndExecuteTransaction();

  const registerDocument = async (params: {
    documentHash: string;
    documentType: string;
    sourcePlatform: number;
  }) => {
    if (!INTEROP_REGISTRY_ID) {
      throw new Error('VITE_INTEROP_REGISTRY_ID is not configured');
    }

    const tx = new Transaction();
    tx.moveCall({
      target: `${PACKAGE_ID}::interop_control::register_document`,
      arguments: [
        tx.object(INTEROP_REGISTRY_ID),
        tx.pure.string(params.documentHash),
        tx.pure.string(params.documentType),
        tx.pure.u8(params.sourcePlatform),
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
    toPlatform: number;
    proofHash: string;
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
        tx.pure.u8(params.toPlatform),
        tx.pure.string(params.proofHash),
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

  const acceptTransfer = async (documentId: string) => {
    if (!INTEROP_REGISTRY_ID) {
      throw new Error('VITE_INTEROP_REGISTRY_ID is not configured');
    }

    const tx = new Transaction();
    tx.moveCall({
      target: `${PACKAGE_ID}::interop_control::accept_transfer`,
      arguments: [
        tx.object(INTEROP_REGISTRY_ID),
        tx.object(documentId),
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
