// FILE: src/components/insert/InsertPanel.tsx
// The "Insert" tab in an exam: renders the exam's validated figure booklet.
// Styled like a real insert — each figure numbered and titled, students flip
// here from the Questions tab and back.

import { MapFigure } from "./MapFigure";

interface InsertPanelProps {
  figures: any[];
  subjectColor?: string;
}

export function InsertPanel({ figures, subjectColor }: InsertPanelProps) {
  if (!figures || figures.length === 0) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        This exam has no insert.
      </div>
    );
  }
  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-10">
      <div className="text-center border-b border-border pb-4">
        <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Resource insert</p>
        <p className="text-sm text-muted-foreground mt-1">
          Some questions refer to the figures below. You can switch back to the questions at any time.
        </p>
      </div>
      {figures.map((fig, i) => (
        <section key={i} className="space-y-3">
          <div className="text-center">
            <h3 className="font-serif font-bold text-lg">
              Figure {fig.figureNumber ?? i + 1}
            </h3>
            <p className="text-sm text-muted-foreground">{fig.title}</p>
          </div>
          {fig.type === "map_points" && (
            <div className="rounded-xl border border-border bg-card p-3">
              <MapFigure title={fig.title} points={fig.points} categories={fig.categories} showPointLabels />
            </div>
          )}
          {fig.type === "data_table" && (
            <div className="rounded-xl border border-border bg-card p-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {fig.columns.map((col: string) => (
                      <th key={col} className="text-left font-semibold px-3 py-2">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {fig.rows.map((row: any[], ri: number) => (
                    <tr key={ri} className={ri % 2 ? "bg-muted/30" : ""}>
                      {row.map((cell, ci) => (
                        <td key={ci} className={`px-3 py-1.5 ${typeof cell === "number" ? "tabular-nums text-right" : ""}`}>{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {fig.unitsNote && <p className="text-[11px] text-muted-foreground mt-2 px-1">{fig.unitsNote}</p>}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}

export default InsertPanel;
