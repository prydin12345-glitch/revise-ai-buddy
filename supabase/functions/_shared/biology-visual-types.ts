/** Global identities contain no board or paper names. Assessment bindings live separately. */
export type VisualRole = "label" | "compare" | "observe";
export type VisualLevel =
  | "gcse"
  | "alevel"
  | "ap"
  | "ib"
  | "university"
  | "international";
export type AssetRef = { assetId: string; version: number; checksum: string };
export type VisualShape = {
  kind: "ellipse" | "rect" | "line";
  x: number;
  y: number;
  w: number;
  h: number;
  stroke: string;
  fill: string;
};
export type PublicVisualFile = AssetRef & {
  usage: "fixture" | "production";
  width: number;
  height: number;
  mediaType: "image/svg+xml" | "image/png" | "image/jpeg";
  svg?: string;
  dataUri?: string;
  geometry?: VisualShape[];
  credit: ImageCredit;
};
export type ImageCredit = {
  assetId: string;
  version: number;
  creator: string;
  description: string;
  sourceUrl: string;
  licence: string;
  licenceUrl: string;
  attribution: string;
  modifications: string[];
};
export type Review = {
  status: "pending" | "approved" | "rejected" | "manual_legal_review";
  reviewer: string | null;
  reviewedAt: string | null;
  evidence: string[];
  checks: Record<string, boolean>;
};
export type BiologyAsset = AssetRef & {
  type:
    | "photomicrograph"
    | "photograph"
    | "specimen"
    | "deterministic_svg"
    | "graph_base"
    | "table_base"
    | "sequence";
  concepts: string[];
  structures: string[];
  organisms: string[];
  levels: VisualLevel[];
  roles: VisualRole[];
  sourceUrl: string;
  originalUrl: string;
  creator: string;
  licence: {
    name: string;
    version: string;
    url: string;
    commercial: boolean;
    modification: boolean;
  };
  attribution: string;
  retrievedAt: string;
  modifications: string[];
  scientificReview: Review;
  licenceReview: Review;
  state: "quarantined" | "approved" | "rejected" | "deprecated";
  replacement: AssetRef | null;
  width: number;
  height: number;
  mediaType: string;
  printSuitable: boolean;
  identityDisclosure: "neutral" | "public_identity";
  usage: "fixture" | "production";
  evidenceId: string;
};
export type OverlayTarget = {
  fieldId: string;
  letter: string;
  style?: "letter" | "arrow" | "blank";
  x: number;
  y: number;
  endX: number;
  endY: number;
};
/** Server-only scientific annotations; never serialize these to a public file. */
export type ReviewedBiologyAsset = BiologyAsset & {
  origin: "original_code" | "licensed_file" | "ai_raster";
  annotationsChecksum?: string;
  features?: { id: string; x: number; y: number; accepted: string[] }[];
  identityAnswers?: string[];
  evidenceGuidance?: string;
};
export type VisualPanel = {
  id: string;
  asset: AssetRef;
  targets: OverlayTarget[];
};
export type BiologyVisualResource = {
  id: string;
  type: "biology_visual";
  kind: "biology_visual";
  title: string;
  version: 1;
  panels: VisualPanel[];
};
export type VisualAssignment = {
  questionNumber: string;
  configId: string;
  resource: BiologyVisualResource;
};
export type SavedVisualAssessment = {
  version: 1;
  configId: "ocr_h420_03_visual_v1";
  assignments: VisualAssignment[];
};
