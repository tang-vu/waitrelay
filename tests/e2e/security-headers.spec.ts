import { expect, test } from "@playwright/test";

test("host and sandbox routes keep distinct security policies", async ({ request }) => {
  const host = await request.get("/demo?scenario=fast&seed=headers-001");
  const flight = await request.get("/flight");
  const hostHeaders = host.headers();
  const flightHeaders = flight.headers();

  expect(hostHeaders["content-security-policy"]).toContain("frame-src 'self'");
  expect(hostHeaders["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(hostHeaders["x-frame-options"]).toBe("DENY");
  expect(hostHeaders["strict-transport-security"]).toBe("max-age=31536000");

  expect(flightHeaders["content-security-policy"]).toContain("connect-src 'none'");
  expect(flightHeaders["content-security-policy"]).toContain("frame-ancestors 'self'");
  expect(flightHeaders["x-frame-options"]).toBe("SAMEORIGIN");
});
