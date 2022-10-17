import { request } from "undici";
import type { ResponseData } from "undici/types/dispatcher";

const commonHeader = { "user-agent": "trim21/bangumi/workers" } as const;

export function get(url: string, headers?: Record<string, string>): Promise<ResponseData> {
  return req("GET", url, headers);
}

function req(method: "GET" | "POST", url: string, headers?: Record<string, string>): Promise<ResponseData> {
  headers = Object.assign(headers ?? {}, commonHeader);

  return request(url, { headers: headers, method });
}
