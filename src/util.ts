import * as crypto from "crypto";

export function uuidByString(v: string): string {
  const s = crypto.createHash("blake2b512").update(v, "utf-8").digest("hex");

  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20, 32)}`;
}

export function notNull<T>(x: T): x is Exclude<T, null> {
  return x !== null;
}

export function unix(): number {
  return Math.trunc(new Date().getTime() / 1000);
}
