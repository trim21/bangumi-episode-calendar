import type { Response, RequestInit, RequestInfo } from "node-fetch";
import nodeFetch from "node-fetch";

const commonHeader = { "user-agent": "trim21/bangumi/workers" } as const;

export function fetch(url: RequestInfo, init?: RequestInit): Promise<Response> {
  if (init === undefined) {
    init = { headers: commonHeader };
  } else {
    init.headers = Object.assign(init.headers ?? {}, commonHeader);
  }

  return nodeFetch(url, init);
}
