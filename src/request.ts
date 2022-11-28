import got from "got";
import type { OptionsInit } from "got/dist/source/core/options";

interface Res {
  code: number;
  body: string;
  ok: boolean;
}

interface CommonReq {
  query?: OptionsInit["searchParams"];
}

const commonHeader = { "user-agent": "trim21/bangumi/workers" } as const;

const g = got.extend({
  prefixUrl: "https://api.bgm.tv",
  headers: commonHeader,
  http2: true,
});

export async function get(path: string, option: CommonReq = {}): Promise<Res> {
  const res = await g.get(path, {
    throwHttpErrors: false,
    searchParams: option.query,
  });

  return {
    code: res.statusCode,
    body: res.body,
    ok: res.ok,
  };
}
