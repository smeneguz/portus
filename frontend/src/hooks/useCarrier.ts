import { useSignAndExecuteTransaction } from '@iota/dapp-kit';
import { Transaction } from '@iota/iota-sdk/transactions';
import { PACKAGE_ID, CARRIER_REGISTRY_ID, CLOCK_ID } from '../config/constants';

export function useRegisterInRegistry() {
  const { mutateAsync: signAndExecute, isPending } = useSignAndExecuteTransaction();

  const register = async (name: string, scacCode: string, country: string) => {
    const tx = new Transaction();
    tx.moveCall({
      target: `${PACKAGE_ID}::carrier_registry::register`,
      arguments: [
        tx.object(CARRIER_REGISTRY_ID),
        tx.pure.string(name),
        tx.pure.string(scacCode),
        tx.pure.string(country),
        tx.object(CLOCK_ID),
      ],
    });
    return signAndExecute({
      transaction: tx,
      options: { showEffects: true, showObjectChanges: true, showEvents: true },
    });
  };

  return { register, isPending };
}
