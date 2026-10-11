// @vitest-environment node
import { EventEmitter } from "node:events";
import { it, expect } from "vitest";
import {
  fetchReviewedSource,
  publicAddress,
  sourceUrl,
} from "../../scripts/profile-source-fetch.mjs";
const address = { address: "93.184.216.34", family: 4 };
function fakeRequest(responses: any[], capture: any[] = []) {
  return (url: any, options: any, cb: any) => {
    const req = new EventEmitter() as any;
    req.destroy = () => {};
    req.end = () =>
      queueMicrotask(() => {
        capture.push({ url: String(url), options });
        const fixture = responses.shift(),
          res = new EventEmitter() as any;
        res.destroy = () => {};
        res.statusCode = fixture.status ?? 200;
        res.headers = fixture.headers ?? { "content-type": "application/pdf" };
        cb(res);
        if (res.statusCode === 200)
          queueMicrotask(() => {
            res.emit("data", Buffer.from(fixture.body ?? "%PDF-synthetic"));
            res.emit("end");
          });
      });
    return req;
  };
}
it.each([
  "127.0.0.1",
  "10.2.3.4",
  "172.16.0.1",
  "192.168.1.1",
  "169.254.169.254",
  "0.0.0.0",
  "100.64.0.1",
  "198.19.0.1",
  "::1",
  "::ffff:127.0.0.1",
  "fc00::1",
  "fd00::1",
  "fe80::1",
  "ff02::1",
  "2001:db8::1",
  "2002:7f00:1::1",
])("rejects nonpublic destination %s", (ip) =>
  expect(publicAddress(ip)).toBe(false),
);
it("uses validated pinned DNS, normal TLS and no forwarded credentials", async () => {
  const capture: any[] = [],
    r = await fetchReviewedSource(
      "https://qualifications.pearson.com/test.pdf",
      { lookup: async () => [address], request: fakeRequest([{}], capture) },
    );
  expect(r.checksum).toHaveLength(64);
  expect(capture[0].options.rejectUnauthorized).toBe(true);
  expect(capture[0].options.agent).toBe(false);
  expect(capture[0].options.headers.Authorization).toBeUndefined();
  expect(capture[0].options.headers.Cookie).toBeUndefined();
  let pin: any;
  capture[0].options.lookup(
    "qualifications.pearson.com",
    {},
    (_e: any, ip: string) => {
      pin = ip;
    },
  );
  expect(pin).toBe(address.address);
});
it("rejects mixed public/private DNS and does not open a socket", async () => {
  let called = false;
  await expect(
    fetchReviewedSource("https://qualifications.pearson.com/test.pdf", {
      lookup: async () => [address, { address: "10.0.0.1", family: 4 }],
      request: () => {
        called = true;
      },
    }),
  ).rejects.toThrow(/DNS/);
  expect(called).toBe(false);
});
it("validates every redirect target and re-resolves each allowed redirect", async () => {
  await expect(
    fetchReviewedSource("https://qualifications.pearson.com/test.pdf", {
      lookup: async () => [address],
      request: fakeRequest([
        { status: 302, headers: { location: "https://127.0.0.1/private" } },
      ]),
    }),
  ).rejects.toThrow(/Unapproved/);
  let lookups = 0;
  await expect(
    fetchReviewedSource("https://qualifications.pearson.com/test.pdf", {
      lookup: async () =>
        ++lookups === 1 ? [address] : [{ address: "127.0.0.1", family: 4 }],
      request: fakeRequest([
        { status: 302, headers: { location: "/next.pdf" } },
      ]),
    }),
  ).rejects.toThrow(/DNS/);
  expect(lookups).toBe(2);
});
it.each([
  { headers: { "content-type": "text/html" }, body: "<script>run()</script>" },
  { headers: { "content-type": "application/pdf" }, body: "not a PDF" },
  {
    headers: { "content-type": "application/pdf", "content-length": "3000001" },
  },
])("rejects unsupported type/signature/size %j", async (response) => {
  await expect(
    fetchReviewedSource("https://qualifications.pearson.com/test.pdf", {
      lookup: async () => [address],
      request: fakeRequest([response]),
    }),
  ).rejects.toThrow();
});
it("bounds redirect chains and actual streamed bytes", async () => {
  await expect(
    fetchReviewedSource("https://qualifications.pearson.com/test.pdf", {
      lookup: async () => [address],
      maxRedirects: 1,
      request: fakeRequest([
        { status: 302, headers: { location: "/next.pdf" } },
        { status: 302, headers: { location: "/third.pdf" } },
      ]),
    }),
  ).rejects.toThrow(/redirects/);
  await expect(
    fetchReviewedSource("https://qualifications.pearson.com/test.pdf", {
      lookup: async () => [address],
      maxBytes: 10,
      request: fakeRequest([{ body: "%PDF-" + "x".repeat(20) }]),
    }),
  ).rejects.toThrow(/size/);
});
it("bounds an indefinitely delayed DNS result", async () => {
  await expect(
    fetchReviewedSource("https://qualifications.pearson.com/test.pdf", {
      lookup: () => new Promise(() => {}),
      timeoutMs: 5,
    }),
  ).rejects.toThrow(/timed out/);
});
