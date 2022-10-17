import { Client } from "undici";
import type { ResponseData } from "undici/types/dispatcher";

const commonHeader = { "user-agent": "trim21/bangumi/workers" } as const;

const client = new Client("https://api.bgm.tv");

export function get(path: string, headers?: Record<string, string>): Promise<ResponseData> {
  return req("GET", path, headers);
}

/*
 * gc will free request conn, but it's better to make sure it's consumed so no gc pressure.
 * */
export function consumeBody(body) {
  (async () => {
    // eslint-disable-next-line no-empty
    for await (const _ of body) {
    }
  })();
}

function req(method: "GET" | "POST", path: string, headers?: Record<string, string>): Promise<ResponseData> {
  headers = Object.assign(headers ?? {}, commonHeader);

  return client.request({ path: path, method, headers });
}
