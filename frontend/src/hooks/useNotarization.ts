import { useSignAndExecuteTransaction } from '@iota/dapp-kit';
import { Transaction } from '@iota/iota-sdk/transactions';
import { PACKAGE_ID, CLOCK_ID } from '../config/constants';

export function useNotarize() {
  const { mutateAsync: signAndExecute, isPending } = useSignAndExecuteTransaction();

  const notarize = async (docHash: string, docType: string, blId: string) => {
    const tx = new Transaction();
    tx.moveCall({
      target: `${PACKAGE_ID}::notarization::notarize`,
      arguments: [
        tx.pure.string(docHash),
        tx.pure.string(docType),
        tx.pure.address(blId),
        tx.object(CLOCK_ID),
      ],
    });
    return signAndExecute({
      transaction: tx,
      options: { showEffects: true, showObjectChanges: true, showEvents: true },
    });
  };

  return { notarize, isPending };
}

export async function computeSHA256(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}
