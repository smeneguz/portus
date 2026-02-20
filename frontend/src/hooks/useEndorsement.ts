import { useSignAndExecuteTransaction, useIotaClient } from '@iota/dapp-kit';
import { Transaction } from '@iota/iota-sdk/transactions';
import { PACKAGE_ID, CLOCK_ID } from '../config/constants';

export interface EndorsementRecord {
  from: string;
  to: string;
  endorsement_type: string;
  timestamp: string;
}

export function useCreateChain() {
  const { mutateAsync: signAndExecute, isPending } = useSignAndExecuteTransaction();

  const createChain = async (blId: string, initialHolder: string) => {
    const tx = new Transaction();
    tx.moveCall({
      target: `${PACKAGE_ID}::endorsement::create_chain`,
      arguments: [
        tx.pure.address(blId),
        tx.pure.address(initialHolder),
        tx.object(CLOCK_ID),
      ],
    });
    return signAndExecute({
      transaction: tx,
      options: { showEffects: true, showObjectChanges: true },
    });
  };

  return { createChain, isPending };
}

export function useEndorseAndTransfer() {
  const { mutateAsync: signAndExecute, isPending } = useSignAndExecuteTransaction();

  const endorseAndTransfer = async (
    chainId: string,
    eblId: string,
    to: string,
    endorsementType: number,
    note: string,
  ) => {
    const tx = new Transaction();
    tx.moveCall({
      target: `${PACKAGE_ID}::endorsement::endorse_and_transfer`,
      arguments: [
        tx.object(chainId),
        tx.object(eblId),
        tx.pure.address(to),
        tx.pure.u8(endorsementType),
        tx.pure.string(note),
        tx.object(CLOCK_ID),
      ],
    });
    return signAndExecute({
      transaction: tx,
      options: { showEffects: true, showObjectChanges: true, showEvents: true },
    });
  };

  return { endorseAndTransfer, isPending };
}

export function useGetEndorsementChain(chainId: string | undefined) {
  const client = useIotaClient();

  const fetchChain = async () => {
    if (!chainId) return null;
    const obj = await client.getObject({
      id: chainId,
      options: { showContent: true },
    });
    if (obj.data?.content?.dataType !== 'moveObject') return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fields = (obj.data.content as any).fields;
    return {
      bl_id: fields.bl_id as string,
      current_holder: fields.current_holder as string,
      endorsements: (fields.endorsements || []) as EndorsementRecord[],
    };
  };

  return { fetchChain };
}
