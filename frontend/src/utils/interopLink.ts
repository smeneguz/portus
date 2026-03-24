import type { IotaClient } from '@iota/iota-sdk/client';
import { PACKAGE_ID } from '../config/constants';
import { parseInteropDocumentFields, type InteropDocumentData } from '../hooks/useInterop';

export type LinkedInteropControl = {
  controlObjectId: string;
  data: InteropDocumentData;
};

export async function findLinkedInteropControlForEbl(client: IotaClient, eblId: string): Promise<LinkedInteropControl | null> {
  if (!eblId) return null;

  const events = await client.queryEvents({
    query: { MoveEventType: `${PACKAGE_ID}::interop_control::DocumentRegistered` },
    limit: 100,
  });

  const match = [...events.data]
    .reverse()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .find((event: any) => String(event.parsedJson?.linked_ebl_id || '').toLowerCase() === eblId.toLowerCase());

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const controlObjectId = String((match as any)?.parsedJson?.document_id || '');
  if (!controlObjectId) return null;

  const obj = await client.getObject({
    id: controlObjectId,
    options: { showContent: true },
  });
  if (obj.data?.content?.dataType !== 'moveObject') return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fields = (obj.data.content as any).fields;
  return {
    controlObjectId,
    data: parseInteropDocumentFields(fields),
  };
}
