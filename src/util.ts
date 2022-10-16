import * as crypto from "crypto";

export function uuidByString(v: string): string {
  const h = crypto.createHash("sha1");
  h.write(v);

  return h.digest("hex");
}
