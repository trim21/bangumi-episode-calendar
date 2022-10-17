import { Client } from "undici";
import type { RequestOptions, ResponseData } from "undici/types/dispatcher";

const commonHeader = { "user-agent": "trim21/bangumi/workers" } as const;
const client = new Client("https://api.bgm.tv");

export function get(path: string, option?: Omit<RequestOptions, "method" | "path">): Promise<ResponseData> {
  return req("GET", path, option);
}

function req(
  method: "GET" | "POST",
  path: string,
  option?: Omit<RequestOptions, "method" | "path">,
): Promise<ResponseData> {
  if (option === undefined) {
    option = { headers: commonHeader };
  } else {
    option.headers = Object.assign(option.headers ?? {}, commonHeader);
  }

  return client.request({ ...option, path, method });
}
