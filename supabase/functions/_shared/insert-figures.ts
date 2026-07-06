// FILE: supabase/functions/_shared/insert-figures.ts
// Insert-figure schema and server-side validation, mirroring the graph and
// circuit gates: the AI proposes figure data, this code disposes. A point
// in the sea, a junk category, or an off-region coordinate never reaches a
// student. Coastline: Natural Earth 50m (public domain), coarsened — the
// COASTAL_BUFFER_DEG tolerance (~5km) absorbs estuary/port towns that sit a
// hair offshore at this resolution (Liverpool, Dover — found in the PoC).

export interface MapFigurePoint { name: string; lat: number; lng: number; category: string; value?: number; }
export interface MapFigureCategory { id: string; label: string; color: string; }
export interface MapFigureData {
  figureNumber?: string;      // e.g. "2" -> rendered as "Figure 2"
  title: string;
  type: "map_points";
  region: "uk";
  points: MapFigurePoint[];
  categories: MapFigureCategory[];
}

const COASTAL_BUFFER_DEG = 0.07; // ~5-7 km at UK latitudes

// UK outer rings [lng,lat][] — Natural Earth 50m, simplified + coarsened.
const UK_RINGS: number[][][] = [[[-2.433,51.741],[-2.979,51.539],[-3.562,51.414],[-3.891,51.592],[-4.115,51.566],[-4.174,51.627],[-4.276,51.683],[-4.386,51.741],[-4.601,51.738],[-4.902,51.626],[-5.168,51.741],[-5.201,51.861],[-5.183,51.95],[-4.879,52.042],[-4.383,52.197],[-4.149,52.326],[-3.98,52.542],[-4.079,52.608],[-4.039,52.704],[-4.118,52.82],[-4.356,52.897],[-4.683,52.806],[-4.638,52.891],[-4.328,53.105],[-4.111,53.219],[-3.646,53.298],[-3.428,53.341],[-3.098,53.26],[-3.065,53.427],[-2.864,53.293],[-2.794,53.331],[-2.97,53.389],[-3.059,53.586],[-2.984,53.747],[-3.045,53.844],[-2.9,53.961],[-2.846,54.135],[-2.994,54.171],[-3.166,54.128],[-3.569,54.468],[-3.465,54.773],[-3.036,54.953],[-3.55,54.947],[-3.783,54.87],[-4.133,54.779],[-4.253,54.847],[-4.818,54.846],[-4.89,54.772],[-5.032,54.761],[-5.17,54.918],[-5.117,55.012],[-4.965,55.149],[-4.677,55.501],[-4.724,55.598],[-4.872,55.874],[-4.807,55.94],[-4.671,55.967],[-4.841,56.081],[-4.856,56.115],[-4.97,56.008],[-5.115,55.945],[-5.215,55.889],[-5.246,55.929],[-5.223,56.066],[-4.997,56.233],[-5.383,56.019],[-5.373,55.828],[-5.556,55.39],[-5.647,55.327],[-5.768,55.363],[-5.681,55.624],[-5.504,55.802],[-5.623,55.813],[-5.555,56.135],[-5.392,56.515],[-5.313,56.619],[-5.564,56.566],[-5.865,56.562],[-5.969,56.69],[-6.134,56.707],[-6.035,56.764],[-5.731,56.853],[-5.85,56.918],[-5.591,57.102],[-5.631,57.294],[-5.795,57.379],[-5.802,57.468],[-5.582,57.547],[-5.715,57.601],[-5.695,57.778],[-5.349,57.878],[-5.29,57.905],[-5.177,57.906],[-5.413,58.07],[-5.356,58.212],[-5.27,58.251],[-5.008,58.263],[-5.09,58.385],[-5.017,58.567],[-4.81,58.573],[-4.715,58.51],[-4.433,58.513],[-3.454,58.617],[-3.053,58.635],[-3.057,58.589],[-3.101,58.434],[-3.212,58.321],[-3.775,58.052],[-4.02,57.914],[-3.907,57.84],[-3.888,57.787],[-4.135,57.578],[-3.403,57.708],[-3.036,57.672],[-2.244,57.681],[-1.962,57.677],[-1.778,57.494],[-1.835,57.42],[-2.02,57.259],[-2.26,56.863],[-2.501,56.637],[-2.681,56.514],[-3.047,56.449],[-3.31,56.363],[-2.653,56.318],[-2.768,56.202],[-3.178,56.08],[-3.362,56.028],[-3.789,56.095],[-3.608,56.016],[-2.837,56.026],[-2.147,55.903],[-1.655,55.57],[-1.423,55.026],[-1.232,54.704],[-0.759,54.541],[-0.37,54.279],[-0.084,54.118],[-0.206,54.022],[0.115,53.609],[-0.074,53.644],[-0.461,53.716],[-0.485,53.694],[0.128,53.468],[0.356,53.16],[0.208,53.03],[0.28,52.809],[0.559,52.967],[0.949,52.953],[1.271,52.925],[1.657,52.754],[1.743,52.579],[1.647,52.279],[1.559,52.087],[1.317,51.957],[1.232,51.971],[1.274,51.902],[1.188,51.803],[0.955,51.808],[0.898,51.689],[0.891,51.571],[0.507,51.501],[0.528,51.484],[0.646,51.405],[0.889,51.36],[1.373,51.375],[1.398,51.182],[1.044,51.047],[0.96,50.926],[0.684,50.886],[0.3,50.776],[-0.204,50.814],[-0.785,50.765],[-1.133,50.845],[-1.416,50.897],[-1.517,50.747],[-1.688,50.735],[-2.031,50.725],[-1.962,50.628],[-2.35,50.637],[-2.433,50.599],[-2.659,50.67],[-2.901,50.722],[-3.405,50.632],[-3.526,50.428],[-3.68,50.24],[-3.9,50.286],[-4.195,50.393],[-4.507,50.341],[-5.01,50.161],[-5.119,50.038],[-5.323,50.083],[-5.551,50.083],[-5.655,50.077],[-5.571,50.197],[-5.142,50.374],[-4.956,50.523],[-4.861,50.582],[-4.56,50.821],[-4.296,51.027],[-4.158,51.201],[-3.608,51.229],[-3.136,51.205],[-2.881,51.406],[-2.433,51.741]],[[-6.218,54.089],[-6.403,54.061],[-6.664,54.085],[-6.67,54.185],[-6.803,54.214],[-6.877,54.329],[-7.008,54.407],[-7.203,54.302],[-7.307,54.156],[-7.355,54.121],[-7.544,54.134],[-7.679,54.187],[-7.884,54.284],[-8.145,54.454],[-7.794,54.571],[-7.746,54.616],[-7.911,54.698],[-7.737,54.71],[-7.451,54.877],[-7.377,55.028],[-7.179,55.057],[-7.031,55.081],[-6.699,55.193],[-6.129,55.217],[-5.986,55.03],[-5.717,54.817],[-5.765,54.725],[-5.879,54.641],[-5.583,54.663],[-5.47,54.5],[-5.526,54.46],[-5.671,54.55],[-5.656,54.382],[-5.607,54.273],[-5.826,54.236],[-5.938,54.089],[-6.12,54.059]],[[-6.199,58.363],[-6.376,58.185],[-6.555,58.093],[-6.403,58.076],[-6.425,58.021],[-6.683,57.911],[-6.854,57.827],[-6.957,57.75],[-7.083,57.814],[-6.944,57.894],[-7.057,58.003],[-6.985,58.05],[-7.088,58.095],[-7.085,58.182],[-6.95,58.218],[-6.812,58.196],[-6.788,58.284],[-6.237,58.503],[-6.199,58.363]],[[-6.145,57.505],[-6.136,57.314],[-5.88,57.263],[-5.672,57.253],[-5.696,57.198],[-5.914,57.063],[-5.987,57.044],[-6.034,57.201],[-6.266,57.184],[-6.442,57.327],[-6.741,57.412],[-6.704,57.496],[-6.583,57.507],[-6.379,57.603],[-6.306,57.672],[-6.166,57.585]],[[-1.308,60.538],[-1.236,60.485],[-1.118,60.418],[-1.066,60.382],[-1.179,60.114],[-1.245,59.971],[-1.299,59.879],[-1.276,60.115],[-1.323,60.188],[-1.481,60.173],[-1.641,60.237],[-1.577,60.298],[-1.375,60.333],[-1.549,60.481],[-1.553,60.517],[-1.414,60.599],[-1.302,60.608]],[[-5.778,56.344],[-6.176,56.289],[-6.313,56.294],[-6.326,56.321],[-6.298,56.339],[-6.185,56.357],[-6.139,56.491],[-6.311,56.552],[-6.32,56.569],[-6.286,56.612],[-6.182,56.643],[-6.103,56.646],[-6.03,56.61],[-5.947,56.535],[-5.836,56.523],[-5.761,56.491],[-5.778,56.344]],[[-4.197,53.321],[-4.155,53.303],[-4.049,53.306],[-4.084,53.264],[-4.373,53.134],[-4.419,53.178],[-4.472,53.176],[-4.553,53.26],[-4.568,53.386],[-4.462,53.419],[-4.315,53.417],[-4.197,53.321]],[[-6.129,55.931],[-6.058,55.723],[-6.055,55.695],[-6.088,55.658],[-6.253,55.607],[-6.305,55.607],[-6.27,55.67],[-6.302,55.728],[-6.286,55.773],[-6.302,55.781],[-6.334,55.774],[-6.452,55.704],[-6.491,55.697],[-6.463,55.808],[-6.413,55.855],[-6.344,55.874],[-6.311,55.856],[-6.216,55.905],[-6.129,55.931]],[[-3.02,59.058],[-2.818,58.982],[-2.793,58.907],[-2.864,58.891],[-3.167,58.919],[-3.242,59.0],[-3.332,58.971],[-3.347,59.065],[-3.249,59.144],[-3.051,59.099],[-3.02,59.058]],[[-5.105,55.449],[-5.231,55.448],[-5.331,55.481],[-5.393,55.618],[-5.371,55.667],[-5.318,55.709],[-5.252,55.717],[-5.185,55.691],[-5.105,55.574],[-5.095,55.494],[-5.105,55.449]],[[-1.066,50.69],[-1.149,50.656],[-1.196,50.599],[-1.251,50.589],[-1.306,50.589],[-1.515,50.67],[-1.563,50.666],[-1.516,50.703],[-1.386,50.734],[-1.313,50.773],[-1.144,50.735],[-1.066,50.69]],[[-5.797,56.006],[-5.991,55.804],[-6.042,55.807],[-6.071,55.848],[-6.072,55.893],[-6.041,55.926],[-5.912,55.975],[-5.97,55.992],[-5.973,56.004],[-5.939,56.045],[-5.8,56.109],[-5.725,56.119],[-5.797,56.006]],[[-7.206,57.683],[-7.093,57.627],[-7.183,57.533],[-7.321,57.534],[-7.515,57.602],[-7.499,57.636],[-7.47,57.653],[-7.392,57.645],[-7.325,57.663],[-7.271,57.657],[-7.206,57.683]],[[-7.25,57.115],[-7.347,57.115],[-7.381,57.131],[-7.416,57.192],[-7.422,57.229],[-7.407,57.298],[-7.411,57.381],[-7.296,57.384],[-7.267,57.372],[-7.25,57.115]]];

function pointInRing(lng: number, lat: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]; const [xj, yj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  const cx = ax + t * dx, cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

/** Land test with coastal buffer: inside any ring, or within ~5km of a coast edge. */
export function isOnUkLand(lng: number, lat: number): boolean {
  for (const ring of UK_RINGS) {
    if (pointInRing(lng, lat, ring)) return true;
  }
  for (const ring of UK_RINGS) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      if (distToSegment(lng, lat, ring[j][0], ring[j][1], ring[i][0], ring[i][1]) <= COASTAL_BUFFER_DEG) return true;
    }
  }
  return false;
}

export interface MapFigureValidation {
  ok: boolean;
  figure: MapFigureData | null; // cleaned figure, or null if unsalvageable
  rejectedPoints: Array<{ name: string; reason: string }>;
  reasons: string[];
}

const MIN_POINTS = 6;

export function validateMapFigure(raw: any): MapFigureValidation {
  const reasons: string[] = [];
  const rejectedPoints: Array<{ name: string; reason: string }> = [];
  if (!raw || typeof raw !== "object" || raw.type !== "map_points" || raw.region !== "uk") {
    return { ok: false, figure: null, rejectedPoints, reasons: ["not a uk map_points figure"] };
  }
  const categories: MapFigureCategory[] = Array.isArray(raw.categories) ? raw.categories.filter(
    (c: any) => c && typeof c.id === "string" && typeof c.label === "string" && typeof c.color === "string"
  ) : [];
  if (categories.length < 2) {
    return { ok: false, figure: null, rejectedPoints, reasons: ["fewer than 2 valid categories"] };
  }
  const catIds = new Set(categories.map((c) => c.id));

  const clean: MapFigurePoint[] = [];
  for (const p of Array.isArray(raw.points) ? raw.points : []) {
    const name = typeof p?.name === "string" ? p.name : "unnamed";
    if (typeof p?.lat !== "number" || typeof p?.lng !== "number" || !isFinite(p.lat) || !isFinite(p.lng)) {
      rejectedPoints.push({ name, reason: "invalid coordinates" }); continue;
    }
    if (!catIds.has(p.category)) {
      rejectedPoints.push({ name, reason: `unknown category "${p.category}"` }); continue;
    }
    if (!isOnUkLand(p.lng, p.lat)) {
      rejectedPoints.push({ name, reason: "not on UK land (incl. 5km coastal buffer)" }); continue;
    }
    const point: MapFigurePoint = { name, lat: p.lat, lng: p.lng, category: p.category };
    // Optional quantitative value -> proportional circle size on the map.
    if (typeof p.value === "number" && isFinite(p.value) && p.value >= 0) point.value = p.value;
    clean.push(point);
  }

  if (rejectedPoints.length > 0) reasons.push(`${rejectedPoints.length} point(s) rejected`);
  if (clean.length < MIN_POINTS) {
    return { ok: false, figure: null, rejectedPoints, reasons: [...reasons, `only ${clean.length} valid points (min ${MIN_POINTS})`] };
  }
  return {
    ok: true,
    figure: {
      figureNumber: typeof raw.figureNumber === "string" ? raw.figureNumber : undefined,
      title: typeof raw.title === "string" && raw.title.trim() ? raw.title.trim() : "Untitled figure",
      type: "map_points", region: "uk",
      points: clean, categories,
    },
    rejectedPoints, reasons,
  };
}

/** Prompt block for figure-first generation (Option A). The generated figure
 *  is validated with validateMapFigure, then its CLEAN data is handed to the
 *  question-writer so questions are true to the figure by construction. */
export function buildMapFigurePrompt(subjectContext: string): string {
  return `
## INSERT FIGURE: UK POINT MAP
Generate the DATA for a UK map figure (the coastline is rendered from real
geographic data — you only supply points). Output JSON:
{
  "type": "map_points", "region": "uk",
  "title": "<figure title, exam register>",
  "categories": [{"id":"<snake_case>","label":"<Key label>","color":"<hex>"}],   // 3-5 categories
  "points": [{"name":"<nearby town>","lat":<num>,"lng":<num>,"category":"<id>","value":<num, optional>}] // 12-25 points
}
Rules:
- Real UK locations with accurate lat/lng, spread across England, Wales and Scotland.
- Every point's category must be one of your declared category ids.
- The spatial pattern MUST be describable (e.g. a clear north-west/south-east gradient) so exam questions can reference it.
- OPTIONAL: when the data is quantitative (population, rainfall mm, visitor numbers), give every point a numeric "value" — it renders as PROPORTIONAL CIRCLES (bigger circle = bigger value), like a real proportional-symbol map. Use values with a describable range (e.g. 40 to 900), and either all points have a value or none do.
- Context: ${subjectContext}`;
}


// ── Phase 2: data-table figures + multi-figure generation ──────────────────
export interface TableFigureData {
  figureNumber?: string;
  title: string;
  type: "data_table";
  columns: string[];              // e.g. ["City", "Rainfall (mm)", "Population"]
  rows: Array<Array<string | number>>;
  unitsNote?: string;             // e.g. "All values are annual totals"
}

export function validateTableFigure(raw: any): { ok: boolean; figure: TableFigureData | null; reasons: string[] } {
  const reasons: string[] = [];
  if (!raw || raw.type !== "data_table") return { ok: false, figure: null, reasons: ["not a data_table"] };
  const columns = Array.isArray(raw.columns) ? raw.columns.filter((x: any) => typeof x === "string" && x.trim()) : [];
  if (columns.length < 2) return { ok: false, figure: null, reasons: ["fewer than 2 columns"] };
  const rows: Array<Array<string | number>> = [];
  for (const r of Array.isArray(raw.rows) ? raw.rows : []) {
    if (!Array.isArray(r) || r.length !== columns.length) { reasons.push("row width mismatch dropped"); continue; }
    if (!r.every((cell: any) => typeof cell === "string" || (typeof cell === "number" && isFinite(cell)))) { reasons.push("bad cell dropped"); continue; }
    rows.push(r);
  }
  if (rows.length < 3) return { ok: false, figure: null, reasons: [...reasons, `only ${rows.length} valid rows (min 3)`] };
  // A data table must contain real numbers somewhere — it exists to support calculation.
  const hasNumbers = rows.some((r) => r.some((cell) => typeof cell === "number"));
  if (!hasNumbers) return { ok: false, figure: null, reasons: [...reasons, "no numeric cells — table figures must carry raw numbers"] };
  return {
    ok: true,
    figure: {
      figureNumber: typeof raw.figureNumber === "string" ? raw.figureNumber : undefined,
      title: typeof raw.title === "string" && raw.title.trim() ? raw.title.trim() : "Untitled table",
      type: "data_table", columns, rows: rows.slice(0, 15),
      unitsNote: typeof raw.unitsNote === "string" ? raw.unitsNote : undefined,
    },
    reasons,
  };
}

/** Validate a mixed array of figures; keeps valid ones, renumbers 1..n. */
export function validateInsertFigures(raw: any): { figures: any[]; rejected: string[] } {
  const figures: any[] = [];
  const rejected: string[] = [];
  for (const f of Array.isArray(raw) ? raw : []) {
    if (f?.type === "map_points") {
      const v = validateMapFigure(f);
      if (v.ok && v.figure) figures.push(v.figure);
      else rejected.push(`map "${f?.title ?? "?"}": ${v.reasons.join("; ")}`);
    } else if (f?.type === "data_table") {
      const v = validateTableFigure(f);
      if (v.ok && v.figure) figures.push(v.figure);
      else rejected.push(`table "${f?.title ?? "?"}": ${v.reasons.join("; ")}`);
    } else {
      rejected.push(`unknown figure type "${f?.type}"`);
    }
  }
  figures.forEach((f, i) => { f.figureNumber = String(i + 1); });
  return { figures: figures.slice(0, 3), rejected };
}

/** Phase-2 prompt: 1-3 figures, type matched to question need, per-topic. */
export function buildInsertFiguresPrompt(subjectContext: string, topics: string[]): string {
  const topicLine = topics.length ? `The paper's topic scope: ${topics.slice(0, 6).join("; ")}.` : "";
  return `
## INSERT FIGURES (1-3, TYPE-MATCHED)
Generate the DATA for 1 to 3 insert figures. Output a JSON ARRAY of figure objects. Two types are available:

1) UK point map (distribution/pattern questions):
${buildMapFigurePrompt(subjectContext).split("Rules:")[1] ? "" : ""}{"type":"map_points","region":"uk","title":"...","categories":[{"id":"...","label":"...","color":"#hex"}],"points":[{"name":"<town>","lat":<num>,"lng":<num>,"category":"<id>","value":<num optional>}]}
   - Real UK locations, accurate lat/lng, describable spatial pattern. Optional "value" renders proportional circles.

2) Data table (calculation/comparison questions — MUST carry raw numbers):
{"type":"data_table","title":"...","columns":["Place","<Measure> (units)"],"rows":[["London",615],["Fort William",2184]],"unitsNote":"..."}
   - 4-10 rows, exact numeric values so students can calculate differences, percentages, means.

RULES:
- ${topicLine}
- Each figure must serve a DIFFERENT topic/question cluster — never one figure for everything.
- If any question will require calculation, a data_table with raw numbers MUST exist for it; category-band maps cannot support precise calculation.
- Context: ${subjectContext}
Return ONLY the JSON array.`;
}
