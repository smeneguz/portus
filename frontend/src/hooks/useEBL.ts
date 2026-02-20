import { useSignAndExecuteTransaction, useIotaClient, useCurrentAccount } from '@iota/dapp-kit';
import { Transaction } from '@iota/iota-sdk/transactions';
import { PACKAGE_ID, BL_REGISTRY_ID, CLOCK_ID } from '../config/constants';

export interface EBLData {
  bl_number: string;
  carrier: string;
  shipper: string;
  consignee: string;
  notify_party: string;
  vessel_name: string;
  voyage_number: string;
  port_of_loading: string;
  port_of_discharge: string;
  commodity_description: string;
  container_numbers: string;
  gross_weight_kg: string;
  number_of_packages: string;
  freight_terms: string;
  content_hash: string;
  status: string;
  current_holder: string;
  endorsement_count: string;
  issued_at: string;
  surrendered_at: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseEBLFields(fields: any): EBLData {
  return {
    bl_number: fields.bl_number || '',
    carrier: fields.carrier || '',
    shipper: fields.shipper || '',
    consignee: fields.consignee || '',
    notify_party: fields.notify_party || '',
    vessel_name: fields.vessel_name || '',
    voyage_number: fields.voyage_number || '',
    port_of_loading: fields.port_of_loading || '',
    port_of_discharge: fields.port_of_discharge || '',
    commodity_description: fields.commodity_description || '',
    container_numbers: fields.container_numbers || '',
    gross_weight_kg: fields.gross_weight_kg || '0',
    number_of_packages: fields.number_of_packages || '0',
    freight_terms: fields.freight_terms || '0',
    content_hash: fields.content_hash || '',
    status: fields.status || '0',
    current_holder: fields.current_holder || '',
    endorsement_count: fields.endorsement_count || '0',
    issued_at: fields.issued_at || '0',
    surrendered_at: fields.surrendered_at || '0',
  };
}

export function useRegisterCarrier() {
  const { mutateAsync: signAndExecute, isPending } = useSignAndExecuteTransaction();

  const registerCarrier = async (carrierName: string) => {
    const tx = new Transaction();
    tx.moveCall({
      target: `${PACKAGE_ID}::ebl::register_carrier`,
      arguments: [
        tx.pure.string(carrierName),
        tx.object(CLOCK_ID),
      ],
    });
    return signAndExecute({
      transaction: tx,
      options: { showEffects: true, showObjectChanges: true, showEvents: true },
    });
  };

  return { registerCarrier, isPending };
}

export function useIssueEBL() {
  const { mutateAsync: signAndExecute, isPending } = useSignAndExecuteTransaction();
  const account = useCurrentAccount();

  const issueEBL = async (params: {
    carrierCapId: string;
    blNumber: string;
    shipper: string;
    consignee: string;
    notifyParty: string;
    vesselName: string;
    voyageNumber: string;
    portOfLoading: string;
    portOfDischarge: string;
    commodityDescription: string;
    containerNumbers: string;
    grossWeightKg: number;
    numberOfPackages: number;
    freightTerms: number;
    contentHash: string;
  }) => {
    if (!account) throw new Error('Wallet not connected');
    const tx = new Transaction();
    tx.moveCall({
      target: `${PACKAGE_ID}::ebl::issue_ebl`,
      arguments: [
        tx.object(params.carrierCapId),
        tx.object(BL_REGISTRY_ID),
        tx.pure.string(params.blNumber),
        tx.pure.address(params.shipper),
        tx.pure.address(params.consignee),
        tx.pure.address(params.notifyParty),
        tx.pure.string(params.vesselName),
        tx.pure.string(params.voyageNumber),
        tx.pure.string(params.portOfLoading),
        tx.pure.string(params.portOfDischarge),
        tx.pure.string(params.commodityDescription),
        tx.pure.string(params.containerNumbers),
        tx.pure.u64(params.grossWeightKg),
        tx.pure.u64(params.numberOfPackages),
        tx.pure.u8(params.freightTerms),
        tx.pure.string(params.contentHash),
        tx.object(CLOCK_ID),
      ],
    });
    return signAndExecute({
      transaction: tx,
      options: { showEffects: true, showObjectChanges: true, showEvents: true },
    });
  };

  return { issueEBL, isPending };
}

export function useUpdateStatus() {
  const { mutateAsync: signAndExecute, isPending } = useSignAndExecuteTransaction();

  const updateStatus = async (eblId: string, newStatus: number) => {
    const tx = new Transaction();
    tx.moveCall({
      target: `${PACKAGE_ID}::ebl::update_status`,
      arguments: [
        tx.object(eblId),
        tx.pure.u8(newStatus),
        tx.object(CLOCK_ID),
      ],
    });
    return signAndExecute({
      transaction: tx,
      options: { showEffects: true, showEvents: true },
    });
  };

  return { updateStatus, isPending };
}

export function useSurrender() {
  const { mutateAsync: signAndExecute, isPending } = useSignAndExecuteTransaction();

  const surrender = async (eblId: string) => {
    const tx = new Transaction();
    tx.moveCall({
      target: `${PACKAGE_ID}::ebl::surrender`,
      arguments: [
        tx.object(eblId),
        tx.object(BL_REGISTRY_ID),
        tx.object(CLOCK_ID),
      ],
    });
    return signAndExecute({
      transaction: tx,
      options: { showEffects: true, showEvents: true },
    });
  };

  return { surrender, isPending };
}

export function useAccomplish() {
  const { mutateAsync: signAndExecute, isPending } = useSignAndExecuteTransaction();

  const accomplish = async (eblId: string) => {
    const tx = new Transaction();
    tx.moveCall({
      target: `${PACKAGE_ID}::ebl::accomplish`,
      arguments: [
        tx.object(eblId),
        tx.object(CLOCK_ID),
      ],
    });
    return signAndExecute({
      transaction: tx,
      options: { showEffects: true, showEvents: true },
    });
  };

  return { accomplish, isPending };
}

export function useGetEBL(eblId: string | undefined) {
  const client = useIotaClient();

  const fetchEBL = async () => {
    if (!eblId) return null;
    const obj = await client.getObject({
      id: eblId,
      options: { showContent: true },
    });
    if (obj.data?.content?.dataType !== 'moveObject') return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return parseEBLFields((obj.data.content as any).fields);
  };

  return { fetchEBL };
}
