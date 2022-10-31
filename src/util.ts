import * as crypto from "crypto";

export function uuidByString(v: string): string {
  return crypto.createHash("SHA-512/256").update(v, "utf-8").digest("hex");
}
