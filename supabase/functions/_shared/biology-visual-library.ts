import type {
  AssetRef,
  BiologyAsset,
  Review,
  VisualLevel,
  VisualRole,
  PublicVisualFile,
  ReviewedBiologyAsset,
} from "./biology-visual-types.ts";
import {
  APPROVED_VISUAL_FILES,
  publicVisualFile,
  shapesToSvg,
} from "./biology-visual-public.ts";
/** Internal audit ledger. No approvals are fabricated or inferred from hosting. */
export const BIOLOGY_ASSET_LEDGER: ReviewedBiologyAsset[] = [];
/** The repository is public: live answers MUST NOT be committed here. */
export const PRIVATE_ANNOTATIONS_SETTING = "BIOLOGY_VISUAL_MARKING_ANNOTATIONS";
export function privateAnnotationRecord(asset: ReviewedBiologyAsset) {
  return {
    assetId: asset.assetId,
    version: asset.version,
    checksum: asset.checksum,
    structures: asset.structures,
    organisms: asset.organisms,
    features: (asset.features ?? []).map((f) => ({
      id: f.id,
      x: f.x,
      y: f.y,
      accepted: f.accepted,
    })),
    identityAnswers: asset.identityAnswers ?? [],
    evidenceGuidance: asset.evidenceGuidance ?? "",
  };
}
export function privateReviewedLibrary(
  ledger: ReviewedBiologyAsset[],
  secret: string | undefined,
): ReviewedBiologyAsset[] {
  if (!ledger.length) return [];
  if (
    ledger.some(
      (a) =>
        a.features !== undefined ||
        a.identityAnswers !== undefined ||
        a.evidenceGuidance !== undefined ||
        a.structures.length > 0 ||
        a.organisms.length > 0,
    )
  )
    throw new Error(
      "Live marking annotations must not be committed in the public asset ledger.",
    );
  let parsed: any;
  try {
    parsed = JSON.parse(secret ?? "");
  } catch {
    throw new Error(
      "missing-private-reviewed-annotations: configure the server-only Biology annotation setting after human review.",
    );
  }
  if (
    parsed?.version !== 1 ||
    !Array.isArray(parsed.assets) ||
    parsed.assets.length > 200 ||
    Object.keys(parsed).some((k) => !["version", "assets"].includes(k))
  )
    throw new Error("Invalid private Biology annotation envelope.");
  const refs = new Set<string>();
  for (const a of parsed.assets) {
    if (
      !a ||
      Object.keys(a).some(
        (k) =>
          ![
            "assetId",
            "version",
            "checksum",
            "structures",
            "organisms",
            "features",
            "identityAnswers",
            "evidenceGuidance",
          ].includes(k),
      ) ||
      !/^bio_va_[a-z0-9_]+$/.test(a.assetId) ||
      !Number.isInteger(a.version) ||
      a.version < 1 ||
      !/^[a-f0-9]{64}$/.test(a.checksum) ||
      [a.structures, a.organisms].some(
        (tags) =>
          !Array.isArray(tags) ||
          tags.length > 50 ||
          tags.some(
            (s: unknown) =>
              typeof s !== "string" || !s.trim() || s.length > 200,
          ),
      ) ||
      !Array.isArray(a.features) ||
      a.features.length > 12 ||
      !Array.isArray(a.identityAnswers) ||
      a.identityAnswers.some(
        (s: unknown) => typeof s !== "string" || !s.trim() || s.length > 200,
      ) ||
      typeof a.evidenceGuidance !== "string" ||
      a.evidenceGuidance.length > 4000
    )
      throw new Error("Invalid private Biology annotations.");
    const ref = a.assetId + "@" + a.version;
    if (refs.has(ref))
      throw new Error("Duplicate private Biology annotation version.");
    refs.add(ref);
    const featureIds = new Set<string>();
    for (const f of a.features) {
      if (
        !f ||
        Object.keys(f).some((k) => !["id", "x", "y", "accepted"].includes(k)) ||
        !/^feature_[1-9][0-9]?$/.test(f.id) ||
        featureIds.has(f.id) ||
        [f.x, f.y].some(
          (n) => typeof n !== "number" || !Number.isFinite(n) || n < 0 || n > 1,
        ) ||
        !Array.isArray(f.accepted) ||
        !f.accepted.length ||
        f.accepted.some(
          (s: unknown) => typeof s !== "string" || !s.trim() || s.length > 200,
        )
      )
        throw new Error("Invalid private scientific anchors.");
      featureIds.add(f.id);
    }
  }
  return ledger.map((asset) => {
    const found = parsed.assets.find(
      (a: any) => a.assetId === asset.assetId && a.version === asset.version,
    );
    if (!found || found.checksum !== asset.checksum)
      throw new Error(
        "missing-private-reviewed-annotations: immutable asset reference does not match private review.",
      );
    return {
      ...asset,
      structures: found.structures,
      organisms: found.organisms,
      features: found.features,
      identityAnswers: found.identityAnswers,
      evidenceGuidance: found.evidenceGuidance,
    };
  });
}
export function reviewedLibrary() {
  const approved = BIOLOGY_ASSET_LEDGER.filter(
    (a) => a.usage === "production" && a.state === "approved",
  );
  const env = (
    globalThis as unknown as {
      Deno?: { env: { get(name: string): string | undefined } };
    }
  ).Deno?.env;
  return privateReviewedLibrary(
    approved,
    approved.length ? env?.get(PRIVATE_ANNOTATIONS_SETTING) : undefined,
  );
}
export async function verifyVisualAnnotations(asset: ReviewedBiologyAsset) {
  if (
    !asset.annotationsChecksum ||
    (await checksumBytes(
      new TextEncoder().encode(JSON.stringify(privateAnnotationRecord(asset))),
    )) !== asset.annotationsChecksum
  )
    throw new Error(
      "Private Biology annotations differ from the scientifically reviewed checksum.",
    );
}
export const SCIENTIFIC_CHECKS = [
  "identity",
  "orientation",
  "magnification",
  "labels",
  "scale",
  "level",
  "artefacts",
  "answerSafety",
  "accessibility",
  "print",
];
export const LICENCE_CHECKS = [
  "evidence",
  "creator",
  "licence",
  "commercial",
  "modification",
  "attribution",
  "provenance",
];
export const permittedAssetLicence = (asset: BiologyAsset) =>
  asset.licence.commercial &&
  asset.licence.modification &&
  ((asset.licence.name === "CC0" &&
    asset.licence.version === "1.0" &&
    asset.licence.url ===
      "https://creativecommons.org/publicdomain/zero/1.0/") ||
    (asset.licence.name === "CC BY" &&
      asset.licence.version === "4.0" &&
      asset.licence.url === "https://creativecommons.org/licenses/by/4.0/") ||
    (asset.licence.name === "Public Domain" &&
      asset.licence.url ===
        "https://creativecommons.org/publicdomain/mark/1.0/"));
export async function checksumBytes(bytes: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new Uint8Array(bytes));
  return Array.from(new Uint8Array(hash), (n) =>
    n.toString(16).padStart(2, "0"),
  ).join("");
}
export async function verifyVisualBytes(file: PublicVisualFile) {
  if (file.mediaType === "image/svg+xml" && !file.geometry)
    throw new Error("Deterministic SVG requires validated geometry.");
  if (
    (file.svg && file.mediaType !== "image/svg+xml") ||
    (file.dataUri && !file.dataUri.startsWith(`data:${file.mediaType};base64,`))
  )
    throw new Error("Visual media type disagrees with immutable bytes.");
  if (
    file.geometry &&
    (file.width !== 400 ||
      file.height !== 260 ||
      file.svg !== shapesToSvg(file.geometry))
  )
    throw new Error("Invalid deterministic SVG dimensions or geometry.");
  const bytes = file.svg
    ? new TextEncoder().encode(file.svg)
    : file.dataUri
      ? Uint8Array.from(atob(file.dataUri.split(",")[1]), (c) =>
          c.charCodeAt(0),
        )
      : null;
  if (!bytes || (await checksumBytes(bytes)) !== file.checksum)
    throw new Error("Biology visual checksum mismatch.");
}
export function approvedReview(review: Review, checks: string[]) {
  return (
    review.status === "approved" &&
    !!review.reviewer?.trim() &&
    !!review.reviewedAt &&
    Number.isFinite(Date.parse(review.reviewedAt)) &&
    review.evidence.length > 0 &&
    review.evidence.every(
      (item) => typeof item === "string" && item.trim().length > 0,
    ) &&
    checks.every((c) => review.checks[c] === true)
  );
}
export function assetReady(
  asset: BiologyAsset,
  level: VisualLevel,
  role: VisualRole,
): boolean {
  return (
    /^bio_va_[a-z0-9_]+$/.test(asset.assetId) &&
    Number.isInteger(asset.version) &&
    asset.version > 0 &&
    /^[a-f0-9]{64}$/.test(asset.checksum) &&
    /^[a-f0-9]{64}$/.test(
      (asset as ReviewedBiologyAsset).annotationsChecksum ?? "",
    ) &&
    !!asset.creator?.trim() &&
    !!asset.attribution?.trim() &&
    !!asset.sourceUrl &&
    !!asset.originalUrl &&
    !!asset.evidenceId?.trim() &&
    Number.isFinite(Date.parse(asset.retrievedAt)) &&
    Number.isFinite(asset.width) &&
    asset.width > 0 &&
    Number.isFinite(asset.height) &&
    asset.height > 0 &&
    asset.concepts.length > 0 &&
    asset.usage === "production" &&
    asset.state === "approved" &&
    permittedAssetLicence(asset) &&
    asset.printSuitable &&
    asset.levels.includes(level) &&
    asset.roles.includes(role) &&
    asset.identityDisclosure === "neutral" &&
    ["original_code", "licensed_file"].includes(
      (asset as ReviewedBiologyAsset).origin,
    ) &&
    approvedReview(asset.licenceReview, LICENCE_CHECKS) &&
    approvedReview(asset.scientificReview, SCIENTIFIC_CHECKS)
  );
}
export function reviewedAsset(
  ref: AssetRef,
  level: VisualLevel,
  role: VisualRole,
  ledger = reviewedLibrary(),
  files = APPROVED_VISUAL_FILES,
) {
  const matches = ledger.filter(
    (a) => a.assetId === ref.assetId && a.version === ref.version,
  );
  if (
    matches.length !== 1 ||
    matches[0].checksum !== ref.checksum ||
    !assetReady(matches[0], level, role)
  )
    throw new Error(
      `missing-approved-asset: ${ref.assetId} v${ref.version} (${level}/${role}).`,
    );
  const file = publicVisualFile(ref, files);
  if (
    file.usage !== "production" ||
    file.width !== matches[0].width ||
    file.height !== matches[0].height ||
    file.mediaType !== matches[0].mediaType
  )
    throw new Error("Public asset and reviewed ledger disagree.");
  const a = matches[0];
  if (
    file.credit.assetId !== a.assetId ||
    file.credit.version !== a.version ||
    !file.credit.description?.trim() ||
    file.credit.licence !== `${a.licence.name} ${a.licence.version}` ||
    file.credit.creator !== a.creator ||
    file.credit.sourceUrl !== a.sourceUrl ||
    file.credit.licenceUrl !== a.licence.url ||
    file.credit.attribution !== a.attribution ||
    JSON.stringify(file.credit.modifications) !==
      JSON.stringify(a.modifications)
  )
    throw new Error("Public attribution disagrees with reviewed evidence.");
  const publicText = JSON.stringify({
    svg: file.svg,
    credit: file.credit,
  }).toLocaleLowerCase("en-GB");
  const answers = [
    ...(a.identityAnswers ?? []),
    ...(a.features ?? []).flatMap((f) => f.accepted),
  ].filter((word) => word.length >= 4);
  if (
    answers.some((word) => publicText.includes(word.toLocaleLowerCase("en-GB")))
  )
    throw new Error("Answer disclosed in public source, SVG or attribution.");
  return a;
}
/** Separate reviewers record evidence. Reviewing never rewrites bytes or versions. */
export function recordAssetReview(
  asset: BiologyAsset,
  kind: "scientific" | "licence",
  review: Review,
): BiologyAsset {
  if (asset.state === "deprecated" || asset.state === "rejected")
    throw new Error(
      "Create a new immutable version for rejected/deprecated material.",
    );
  if (
    kind === "licence" &&
    asset.licenceReview.status === "manual_legal_review"
  )
    throw new Error(
      "Share-alike material needs a separate legal-policy decision; ordinary approval cannot promote it.",
    );
  const next = structuredClone(asset);
  next[kind === "scientific" ? "scientificReview" : "licenceReview"] =
    structuredClone(review);
  if (
    review.status === "approved" &&
    !approvedReview(
      review,
      kind === "scientific" ? SCIENTIFIC_CHECKS : LICENCE_CHECKS,
    )
  )
    throw new Error("Incomplete review record.");
  next.state =
    review.status === "rejected"
      ? "rejected"
      : approvedReview(next.scientificReview, SCIENTIFIC_CHECKS) &&
          approvedReview(next.licenceReview, LICENCE_CHECKS) &&
          permittedAssetLicence(next)
        ? "approved"
        : "quarantined";
  return next;
}
