import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  parseVisualResource,
  publicVisualFile,
  imageCredit,
} from "../../../supabase/functions/_shared/biology-visual-public";
import type {
  BiologyVisualResource,
  VisualPanel,
} from "../../../supabase/functions/_shared/biology-visual-types";
import type { PrivateResponseKey } from "@/lib/response-contract";
export function BiologyVisual({
  resource,
  privateKey,
  solutionsReleased = false,
}: {
  resource: BiologyVisualResource;
  privateKey?: PrivateResponseKey;
  solutionsReleased?: boolean;
}) {
  const validated = parseVisualResource(resource);
  const panelImage = (panel: VisualPanel) => {
    const file = publicVisualFile(panel.asset),
      src = file.svg
        ? "data:image/svg+xml;charset=utf-8," + encodeURIComponent(file.svg)
        : file.dataUri;
    const answer = (field: string) =>
      solutionsReleased
        ? privateKey?.units.find((u) => u.targetIds.includes(field))?.rule
        : null;
    const accepted = (field: string) => {
      const rule = answer(field);
      return rule?.kind === "text" ? rule.accepted.join(" / ") : null;
    };
    return (
      <div
        className="relative w-full overflow-hidden rounded border border-slate-300 bg-white text-slate-950"
        style={{ aspectRatio: `${file.width}/${file.height}` }}
      >
        <img
          src={src}
          alt={`Biological specimen in panel ${panel.id}. Use the accompanying assessed task.`}
          className="h-full w-full object-contain"
        />
        <svg
          viewBox={`0 0 ${file.width} ${file.height}`}
          className="pointer-events-none absolute inset-0 h-full w-full"
          aria-hidden="true"
        >
          {panel.targets.map((t) => {
            const x = t.x * file.width,
              y = t.y * file.height,
              ex = t.endX * file.width,
              ey = t.endY * file.height,
              dx = ex - x,
              dy = ey - y,
              length = Math.hypot(dx, dy) || 1;
            return (
              <g key={t.fieldId}>
                <line
                  x1={x + (t.style === "blank" ? 65 : 15)}
                  y1={y}
                  x2={ex}
                  y2={ey}
                  stroke="#111"
                  strokeWidth="2"
                />
                {t.style === "arrow" ? (
                  <polygon
                    points={`${ex},${ey} ${ex - (10 * dx) / length + (4 * dy) / length},${ey - (10 * dy) / length - (4 * dx) / length} ${ex - (10 * dx) / length - (4 * dy) / length},${ey - (10 * dy) / length + (4 * dx) / length}`}
                    fill="#111"
                  />
                ) : (
                  <circle cx={ex} cy={ey} r="3" fill="#111" />
                )}
                {t.style === "blank" ? (
                  <rect
                    x={x}
                    y={y - 12}
                    width="60"
                    height="24"
                    fill="white"
                    stroke="#111"
                  />
                ) : (
                  <text x={x} y={y} fontSize="22" fill="#111">
                    {t.letter}
                  </text>
                )}
                {accepted(t.fieldId) && (
                  <text x={x} y={y + 24} fontSize="14" fill="#111">
                    {accepted(t.fieldId)}
                  </text>
                )}
              </g>
            );
          })}
          {accepted("panel_" + panel.id.toLowerCase()) && (
            <text x="15" y="24" fontSize="16" fill="#111">
              {accepted("panel_" + panel.id.toLowerCase())}
            </text>
          )}
        </svg>
      </div>
    );
  };
  return (
    <figure aria-label={validated.title} className="my-4 min-w-0 space-y-3">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {validated.panels.map((panel) => {
          const file = publicVisualFile(panel.asset);
          return (
            <section
              key={panel.id}
              className={validated.panels.length === 1 ? "md:col-span-3" : ""}
              aria-label={`Panel ${panel.id}`}
            >
              <p className="mb-1 font-medium">Panel {panel.id}</p>
              {panelImage(panel)}
              {file.usage === "fixture" && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Original synthetic fixture. Not approved for assessed use.
                </p>
              )}
              <Dialog>
                <DialogTrigger asChild>
                  <button
                    className="my-1 min-h-11 rounded px-3 text-sm underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 print:hidden"
                    type="button"
                  >
                    Enlarge panel {panel.id}
                  </button>
                </DialogTrigger>
                <DialogContent className="max-h-[90dvh] max-w-4xl overflow-y-auto">
                  <DialogTitle>
                    Biological specimen: panel {panel.id}
                  </DialogTitle>
                  <DialogDescription>
                    Enlarged view of the same immutable image and overlay. Close
                    this view to answer.
                  </DialogDescription>
                  {panelImage(panel)}
                </DialogContent>
              </Dialog>
              <p className="text-xs leading-relaxed text-muted-foreground">
                <a
                  href={`/image-credits#${file.assetId}-v${file.version}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  Image credit
                </a>
                : {imageCredit(file.credit)}
                <span className="hidden break-all print:inline">
                  {" "}
                  {file.assetId} v{file.version}. Source:{" "}
                  {file.credit.sourceUrl}. Licence: {file.credit.licenceUrl}.
                </span>
              </p>
            </section>
          );
        })}
      </div>
      <figcaption className="text-sm text-muted-foreground">
        {validated.title}. Answer in the separately labelled fields.
      </figcaption>
    </figure>
  );
}
