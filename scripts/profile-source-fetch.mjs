import https from "node:https";
import dns from "node:dns/promises";
import net from "node:net";
import { createHash } from "node:crypto";
const HOSTS = new Set(["qualifications.pearson.com"]);
export function sourceUrl(raw) {
  const u = new URL(raw);
  if (
    u.protocol !== "https:" ||
    !HOSTS.has(u.hostname) ||
    u.username ||
    u.password ||
    (u.port && u.port !== "443") ||
    u.hash
  )
    throw Error("Unapproved source URL");
  return u;
}
export function publicAddress(address) {
  if (net.isIP(address) === 4) {
    const [a, b] = address.split(".").map(Number);
    return !(
      a === 0 ||
      a === 10 ||
      a === 127 ||
      a >= 224 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19))
    );
  }
  if (net.isIP(address) === 6) {
    const s = address.toLowerCase();
    return (
      /^[23]/.test(s) &&
      !s.startsWith("2002:") &&
      !s.startsWith("::") &&
      !s.startsWith("fc") &&
      !s.startsWith("fd") &&
      !/^fe[89ab]/.test(s) &&
      !s.startsWith("ff") &&
      !s.startsWith("2001:db8:") &&
      !s.startsWith("2001:0:") &&
      !s.startsWith("64:ff9b:")
    );
  }
  return false;
}
const deadline = (promise, ms) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(Error("Source refresh timed out")),
      ms,
    );
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
/** Read-only maintenance. Pin the validated destination to this TLS socket. */
export async function fetchReviewedSource(
  raw,
  {
    lookup = dns.lookup,
    request = https.request,
    maxBytes = 3_000_000,
    maxRedirects = 3,
    timeoutMs = 15000,
  } = {},
) {
  const started = Date.now();
  let url = sourceUrl(raw);
  for (let redirects = 0; redirects <= maxRedirects; redirects++) {
    const remaining = timeoutMs - (Date.now() - started);
    if (remaining <= 0) throw Error("Source refresh timed out");
    const addresses = await deadline(
      lookup(url.hostname, { all: true, verbatim: true }),
      remaining,
    );
    if (!addresses.length || addresses.some((a) => !publicAddress(a.address)))
      throw Error(
        "Source DNS resolves to a private, local or unsupported destination",
      );
    const chosen = addresses[0];
    const result = await new Promise((resolve, reject) => {
      let finished = false,
        timer;
      const finish = (error, value) => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        error ? reject(error) : resolve(value);
      };
      const req = request(
        url,
        {
          method: "GET",
          agent: false,
          rejectUnauthorized: true,
          servername: url.hostname,
          lookup: (_host, _opts, cb) => cb(null, chosen.address, chosen.family),
          headers: {
            Accept: "application/pdf, text/plain",
            "User-Agent": "Examly-source-review/1",
          },
        },
        (res) => {
          const status = res.statusCode ?? 0;
          if ([301, 302, 303, 307, 308].includes(status)) {
            res.destroy();
            finish(null, { redirect: res.headers.location });
            return;
          }
          if (status !== 200) {
            res.destroy();
            finish(Error("Source returned HTTP " + status));
            return;
          }
          const type = String(res.headers["content-type"] ?? "").split(";")[0];
          if (!["application/pdf", "text/plain"].includes(type)) {
            res.destroy();
            finish(Error("Unsupported source content type"));
            return;
          }
          if (Number(res.headers["content-length"] ?? 0) > maxBytes) {
            res.destroy();
            finish(Error("Source size exceeds limit"));
            return;
          }
          const chunks = [];
          let bytes = 0;
          res.on("data", (b) => {
            bytes += b.length;
            if (bytes > maxBytes) {
              res.destroy();
              finish(Error("Source size exceeds limit"));
            } else chunks.push(b);
          });
          res.on("error", (e) => finish(e));
          res.on("end", () =>
            finish(null, { bytes: Buffer.concat(chunks), type }),
          );
        },
      );
      if (!finished)
        timer = setTimeout(
          () => {
            req.destroy();
            finish(Error("Source refresh timed out"));
          },
          Math.max(1, timeoutMs - (Date.now() - started)),
        );
      req.on("error", (e) => finish(e));
      req.end();
    });
    if (result.redirect) {
      if (redirects === maxRedirects) throw Error("Too many redirects");
      url = sourceUrl(new URL(result.redirect, url).href);
      continue;
    }
    if (!result.bytes) throw Error("Empty source response");
    if (
      result.type === "application/pdf" &&
      result.bytes.subarray(0, 5).toString() !== "%PDF-"
    )
      throw Error("Invalid PDF signature");
    return {
      url: url.href,
      contentType: result.type,
      checksum: createHash("sha256").update(result.bytes).digest("hex"),
      bytes: result.bytes,
    };
  }
  throw Error("Source refresh failed");
}
