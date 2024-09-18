import { v5 as uuidV5 } from "uuid";

export function uuidByString(v: string): string {
  // uuid v5 will generate same result for same (name, namespace) pair
  return uuidV5(v, "ef2256c4-162e-446b-9ccf-81050809d0c9");
}

export function notNull<T>(x: T): x is Exclude<T, null> {
  return x !== null;
}

export function unix(): number {
  return Math.trunc(new Date().getTime() / 1000);
}
