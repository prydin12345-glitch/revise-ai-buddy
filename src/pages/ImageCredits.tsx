import { Link } from "react-router-dom";
import { APPROVED_VISUAL_FILES } from "../../supabase/functions/_shared/biology-visual-public";
import type { PublicVisualFile } from "../../supabase/functions/_shared/biology-visual-types";
export function ImageCreditsContent({
  files = APPROVED_VISUAL_FILES,
}: {
  files?: PublicVisualFile[];
}) {
  return (
    <main className="mx-auto max-w-3xl space-y-8 px-4 py-12 text-foreground">
      <h1 className="font-serif text-3xl font-semibold">
        Biology image credits
      </h1>
      <p>
        Credits for approved, immutable versions of Biology visuals. The source
        and licence belong to each individual asset.
      </p>
      {!files.length && (
        <p role="status">
          No Biology visual assets have completed both licence and scientific
          review yet.
        </p>
      )}
      {files
        .filter((f) => f.usage === "production")
        .map((f) => (
          <section
            key={`${f.assetId}-${f.version}`}
            id={`${f.assetId}-v${f.version}`}
            className="space-y-2 border-t border-border pt-4"
          >
            <h2 className="font-medium">
              {f.assetId} · Version {f.version}
            </h2>
            <p>{f.credit.description}</p>
            <p>
              Creator: {f.credit.creator}. {f.credit.attribution}
            </p>
            <p>
              <a
                className="underline"
                href={f.credit.sourceUrl}
                rel="noopener noreferrer"
              >
                Source
              </a>{" "}
              ·{" "}
              <a
                className="underline"
                href={f.credit.licenceUrl}
                rel="noopener noreferrer"
              >
                {f.credit.licence}
              </a>
            </p>
            <p>
              Modifications:{" "}
              {f.credit.modifications.length
                ? f.credit.modifications.join(" ")
                : "None."}
            </p>
          </section>
        ))}
      <section className="space-y-3 border-t border-border pt-6">
        <h2 className="font-serif text-xl">Image sourcing FAQ</h2>
        <h3 className="font-medium">Where do images come from?</h3>
        <p>
          Original deterministic diagrams and individually licensed sources can
          enter a review queue. Hosting on Wikimedia Commons does not
          automatically approve a file.
        </p>
        <h3 className="font-medium">What is reviewed?</h3>
        <p>
          Licence evidence and scientific suitability are reviewed separately.
          Reviews cover biological identity, scale and labels, age suitability,
          answer safety, accessibility and print legibility.
        </p>
        <h3 className="font-medium">Are generated photographs used?</h3>
        <p>
          AI-generated scientific raster images are not enabled for assessed
          questions. Unreviewed candidates and synthetic test fixtures cannot be
          selected for live assessments.
        </p>
        <h3 className="font-medium">Can the image change during an exam?</h3>
        <p>
          Questions retain an exact asset ID, version and checksum. Student
          overlays and private marking material are stored separately.
        </p>
      </section>
      <p>
        <Link className="underline" to="/terms">
          Terms and third-party content
        </Link>{" "}
        ·{" "}
        <Link className="underline" to="/">
          Examly home
        </Link>
      </p>
    </main>
  );
}
export default function ImageCredits() {
  return (
    <div className="min-h-screen bg-background">
      <ImageCreditsContent />
    </div>
  );
}
