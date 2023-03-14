import MockRedis from "ioredis-mock";
import { vi } from "vitest";

vi.mock("../src/redis", () => {
  return {
    default: new MockRedis(),
  };
});
