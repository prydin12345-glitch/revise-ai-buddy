import type {
  AssetRef,
  BiologyVisualResource,
  ImageCredit,
  PublicVisualFile,
  VisualShape,
} from "./biology-visual-types.ts";
/** Public files have no biological answer tags, expected labels or marking data.
 * A reviewed promotion must add a matching immutable production entry here.
 * Originals below are explicitly synthetic rendering fixtures, never live assets. */
export const APPROVED_VISUAL_FILES: PublicVisualFile[] = [];
export const shapesToSvg = (shapes: VisualShape[]) => {
  if (
    !Array.isArray(shapes) ||
    !shapes.length ||
    shapes.length > 500 ||
    shapes.some(
      (s) =>
        Object.keys(s).some(
          (k) => !["kind", "x", "y", "w", "h", "stroke", "fill"].includes(k),
        ) ||
        !["ellipse", "rect", "line"].includes(s.kind) ||
        [s.x, s.y, s.w, s.h].some(
          (n) => !Number.isFinite(n) || n < 0 || n > 400,
        ) ||
        !/^#[a-f0-9]{6}$/i.test(s.stroke) ||
        !(s.fill === "none" || /^#[a-f0-9]{6}$/i.test(s.fill)),
    )
  )
    throw new Error("Invalid deterministic SVG geometry.");
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 260" width="400" height="260"><rect width="400" height="260" fill="white"/>' +
    shapes
      .map((s) =>
        s.kind === "ellipse"
          ? `<ellipse cx="${s.x}" cy="${s.y}" rx="${s.w}" ry="${s.h}" stroke="${s.stroke}" fill="${s.fill}" stroke-width="2"/>`
          : s.kind === "line"
            ? `<line x1="${s.x}" y1="${s.y}" x2="${s.w}" y2="${s.h}" stroke="${s.stroke}" stroke-width="2"/>`
            : `<rect x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" stroke="${s.stroke}" fill="${s.fill}" stroke-width="2"/>`,
      )
      .join("") +
    "</svg>"
  );
};
const shape = (
  kind: VisualShape["kind"],
  x: number,
  y: number,
  w: number,
  h: number,
  fill = "none",
): VisualShape => ({ kind, x, y, w, h, fill, stroke: "#222222" });
const GEOMETRIES: VisualShape[][] = [
  [
    shape("ellipse", 200, 130, 170, 100),
    shape("ellipse", 200, 130, 140, 76),
    ...[
      [130, 95],
      [170, 95],
      [130, 135],
      [170, 135],
    ].map(([x, y]) => shape("ellipse", x, y, 15, 15)),
    ...[
      [245, 90],
      [275, 90],
      [245, 115],
      [275, 115],
    ].map(([x, y]) => shape("rect", x, y, 20, 20)),
  ],
  Array.from({ length: 8 }, (_, i) =>
    shape("rect", 40 + i * 40, 90, 40, 90),
  ).concat(
    Array.from({ length: 8 }, (_, i) =>
      shape("ellipse", 60 + i * 40, 135, 8, 12),
    ),
  ),
  Array.from({ length: 5 }, (_, i) =>
    shape("rect", 40, 45 + i * 35, 320, 26),
  ).concat(
    Array.from({ length: 12 }, (_, i) =>
      shape("line", 60 + i * 24, 45, 60 + i * 24, 210),
    ),
  ),
  [
    shape("ellipse", 130, 90, 25, 18),
    shape("ellipse", 255, 150, 30, 20),
    shape("ellipse", 190, 190, 20, 14),
    shape("line", 40, 70, 340, 200),
    shape("line", 60, 200, 330, 50),
  ],
];
const hashes = [
  "c1dba051a76c83a076a37a2ad60d1d690f6fb402c11da6133a930d09a1be2883",
  "5e86cd6695fac3a8de0a1cd73fb74764a18a188bc9fd3450e078d6694c99aca9",
  "a485aa85164d9564571a576ccbdd7272629ca9dea972584dd193f39318b6d33d",
  "7b38edd4bc410320474eb5af00b4f73e8c648b58a9e16db64c3c3390827f77cc",
];
export const SYNTHETIC_VISUAL_FILES: PublicVisualFile[] = GEOMETRIES.map(
  (geometry, i) => ({
    assetId: `bio_va_${String(i + 1).padStart(3, "0")}`,
    version: 1,
    checksum: hashes[i],
    usage: "fixture",
    width: 400,
    height: 260,
    mediaType: "image/svg+xml",
    geometry,
    svg: shapesToSvg(geometry),
    credit: {
      assetId: `bio_va_${String(i + 1).padStart(3, "0")}`,
      version: 1,
      creator: "Examly",
      description: `Original synthetic visual fixture ${i + 1}; not scientifically approved for assessment`,
      sourceUrl: "/image-credits",
      licence: "Original synthetic fixture; review pending",
      licenceUrl: "/image-credits",
      attribution:
        "Original synthetic fixture by Examly. Not an approved scientific assessment asset.",
      modifications: [
        "Created with deterministic code; schematic geometry, not a photomicrograph.",
      ],
    },
  }),
);
export function publicVisualFile(
  ref: AssetRef,
  files = [...APPROVED_VISUAL_FILES, ...SYNTHETIC_VISUAL_FILES],
): PublicVisualFile {
  const found = files.filter(
    (f) => f.assetId === ref.assetId && f.version === ref.version,
  );
  if (found.length !== 1 || found[0].checksum !== ref.checksum)
    throw new Error("Missing or changed immutable Biology visual asset.");
  return found[0];
}
const exact = (v: any, allowed: string[]) => {
  if (
    !v ||
    typeof v !== "object" ||
    Array.isArray(v) ||
    Object.keys(v).some((k) => !allowed.includes(k))
  )
    throw new Error("Unknown/private visual field.");
};
export function parseVisualResource(value: unknown): BiologyVisualResource {
  const r = value as BiologyVisualResource;
  exact(r, ["id", "type", "kind", "title", "version", "panels"]);
  if (
    r.type !== "biology_visual" ||
    r.kind !== "biology_visual" ||
    r.version !== 1 ||
    !/^visual_[a-z0-9_]+$/.test(r.id) ||
    r.title !== "Biological visual stimulus" ||
    !Array.isArray(r.panels) ||
    !r.panels.length ||
    r.panels.length > 6
  )
    throw new Error("Invalid visual resource.");
  const ids = new Set<string>(),
    checksums = new Set<string>(),
    fields = new Set<string>();
  for (const p of r.panels) {
    exact(p, ["id", "asset", "targets"]);
    exact(p.asset, ["assetId", "version", "checksum"]);
    if (
      !/^[A-F]$/.test(p.id) ||
      ids.has(p.id) ||
      !/^bio_va_[a-z0-9_]+$/.test(p.asset.assetId) ||
      !Number.isInteger(p.asset.version) ||
      p.asset.version < 1 ||
      !/^[a-f0-9]{64}$/.test(p.asset.checksum)
    )
      throw new Error("Invalid immutable visual reference.");
    ids.add(p.id);
    if (checksums.has(p.asset.checksum))
      throw new Error("Duplicate visual stimulus in a multi-panel resource.");
    checksums.add(p.asset.checksum);
    publicVisualFile(p.asset);
    if (!Array.isArray(p.targets) || p.targets.length > 12)
      throw new Error("Invalid visual targets.");
    for (const t of p.targets) {
      exact(t, ["fieldId", "letter", "style", "x", "y", "endX", "endY"]);
      if (
        !/^target_[1-9][0-9]?$/.test(t.fieldId) ||
        (t.style === "blank" ? t.letter !== "" : !/^[A-Z]$/.test(t.letter)) ||
        (t.style != null && !["letter", "arrow", "blank"].includes(t.style)) ||
        fields.has(t.fieldId) ||
        [t.x, t.y, t.endX, t.endY].some(
          (n) => typeof n !== "number" || !Number.isFinite(n) || n < 0 || n > 1,
        )
      )
        throw new Error("Invalid normalized public overlay.");
      fields.add(t.fieldId);
    }
  }
  return structuredClone(r);
}
export const imageCredit = (credit: ImageCredit) =>
  `${credit.creator}. ${credit.attribution} ${credit.licence}. ${credit.modifications.join(" ")}`;
