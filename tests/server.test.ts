import { test, expect } from "vitest";

import { createServer } from "../src/server";

test("should get index page", async () => {
  const app = await createServer();
  const res = await app.inject("/episode-calendar");
  expect(res.body).toMatchSnapshot();
});

test("should get user calendar", async () => {
  const app = await createServer();
  const res = await app.inject("/episode-calendar/382951.ics");
  expect(res.body).toMatchSnapshot();
});
