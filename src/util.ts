import * as crypto from "crypto";

export function uuidByString(v: string): string {
  return crypto.createHash("black2b-128").update(v, "utf-8").digest("hex");
}
