/** Structured Commons evidence only. Runtime generation never imports this module. */
export type LicenceDecision = {
  state: "review_queue" | "manual_legal_review" | "rejected";
  name: string;
  version: string;
  url: string;
  commercial: boolean;
  modification: boolean;
  reason: string;
};
export function commonsLicence(
  metadata: Record<string, { value?: unknown }>,
): LicenceDecision {
  const get = (k: string) =>
    typeof metadata[k]?.value === "string"
      ? String(metadata[k].value).trim()
      : "";
  const name = get("LicenseShortName"),
    url = get("LicenseUrl")
      .replace(
        /^http:\/\/creativecommons\.org\//,
        "https://creativecommons.org/",
      )
      .replace(/\/deed\.[a-z-]+$/, "")
      .replace(/\/$/, ""),
    restrictions = get("Restrictions");
  const decision = (
    state: LicenceDecision["state"],
    version: string,
    commercial: boolean,
    modification: boolean,
    reason: string,
  ) => ({ state, name, version, url, commercial, modification, reason });
  if (
    !name ||
    !url ||
    !get("Artist") ||
    /unknown|anonymous/i.test(get("Artist")) ||
    restrictions
  )
    return decision(
      "rejected",
      "",
      false,
      false,
      "Missing/ambiguous creator, licence evidence or restrictions.",
    );
  if (
    /^CC BY-SA(?: 4\.0)?$/.test(name) &&
    url === "https://creativecommons.org/licenses/by-sa/4.0"
  )
    return decision(
      "manual_legal_review",
      "4.0",
      false,
      false,
      "Share-alike requires a separate manual legal-policy review; not production eligible.",
    );
  if (
    /^CC BY 4\.0$/.test(name) &&
    url === "https://creativecommons.org/licenses/by/4.0"
  )
    return decision(
      "review_queue",
      "4.0",
      true,
      true,
      "Individual CC BY 4.0 evidence; licence and scientific approvals still required.",
    );
  if (
    /^CC0(?: 1\.0)?$/.test(name) &&
    url === "https://creativecommons.org/publicdomain/zero/1.0"
  )
    return decision(
      "review_queue",
      "1.0",
      true,
      true,
      "Individual CC0 evidence; approvals still required.",
    );
  if (
    /^Public domain$/i.test(name) &&
    get("Copyrighted") === "False" &&
    url === "https://creativecommons.org/publicdomain/mark/1.0"
  )
    return decision(
      "review_queue",
      "1.0",
      true,
      true,
      "Public-domain mark and copyright statement require reviewer confirmation.",
    );
  return decision(
    "rejected",
    "",
    false,
    false,
    "Unsupported, contradictory or unproven commercial/modification rights.",
  );
}
export function commonsCandidate(page: any, retrievedAt: string) {
  if (
    page?.ns !== 6 ||
    !Number.isInteger(page.pageid) ||
    !Array.isArray(page.imageinfo) ||
    page.imageinfo.length !== 1
  )
    throw new Error("Expected one structured Commons file record.");
  const info = page.imageinfo[0],
    metadata = info.extmetadata ?? {},
    decision = commonsLicence(metadata);
  const original = new URL(info.url),
    source = new URL(info.descriptionurl);
  if (
    original.protocol !== "https:" ||
    original.hostname !== "upload.wikimedia.org" ||
    original.username ||
    original.password ||
    source.protocol !== "https:" ||
    source.hostname !== "commons.wikimedia.org" ||
    !source.pathname.startsWith("/wiki/File:")
  )
    throw new Error("Unapproved candidate origin.");
  if (
    /\b(?:ocr|aqa|edexcel|wjec|exam(?:ination)? paper|ai.generated|artificial intelligence|midjourney|stable diffusion)\b/i.test(
      page.title + " " + String(metadata.ImageDescription?.value ?? ""),
    )
  )
    throw new Error(
      "Examination material cannot enter this ingestion workflow.",
    );
  const plain = (value: any) =>
    String(value ?? "")
      .replace(/<[^>]*>/g, "")
      .replace(/&[^;]{1,20};/g, " ")
      .trim();
  return {
    evidenceVersion: 1,
    evidenceId: `commons_${page.pageid}`,
    pageId: page.pageid,
    retrievedAt,
    sourceUrl: source.href,
    originalUrl: original.href,
    creator: plain(metadata.Artist?.value),
    licence: decision,
    state: "quarantined",
    licenceReview:
      decision.state === "manual_legal_review"
        ? "manual_legal_review"
        : "pending",
    scientificReview: "pending",
    checksum: null,
    width: info.width,
    height: info.height,
    rawEvidence: page,
    attribution: `${plain(metadata.Artist?.value)}; ${source.href}; ${decision.name} (${decision.url}).`,
    modifications: [],
  };
}
