import { Server } from 'node:http';
import { postJSON } from '../lib/api.js';

export async function syncExhibitionToDamai(
  server: Server,
  token: string,
  eid: string,
) {
  return postJSON<void>(
    server,
    `/exhibition/${eid}/ota/damai/sync`,
    { token },
  );
}
