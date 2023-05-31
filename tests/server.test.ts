import test from "ava";

import { createServer } from "../src/server";

test("should get index page", async (t) => {
  const app = await createServer();
  const res = await app.inject("/episode-calendar");
  t.snapshot(res.body);
});

test("should get user calendar", async (t) => {
  const app = await createServer();
  const res = await app.inject("/episode-calendar/382951.ics");
  t.snapshot(res.body);
});
