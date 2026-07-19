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
      <div className="max-w-3xl mx-auto p-6 sm:p-10">
        <div className="rounded-token-lg border border-dashed border-border bg-surface-elevated/40 px-6 py-10 text-center">
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Resource insert
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            No reference figures required for this paper.
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="max-w-3xl mx-auto p-3 sm:p-6 space-y-10">
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
          {fig.type === "passage" && (
            <div className="rounded-xl border border-border bg-card p-3 sm:p-5">
              <p className="text-[11px] text-muted-foreground mb-3 italic">{fig.styleNote}</p>
              <div className="space-y-0.5">
                {fig.lines.map((ln: string, i: number) =>
                  ln === "" ? (
                    <div key={i} className="h-3" />
                  ) : (
                    <div key={i} className="flex gap-2 sm:gap-3">
                      <span className="w-6 sm:w-7 shrink-0 text-right text-[9px] sm:text-[10px] leading-[1.6] sm:leading-relaxed text-muted-foreground/70 tabular-nums select-none pt-[3px]">
                        {i + 1}
                      </span>
                      <p className="text-[13px] sm:text-sm leading-[1.6] sm:leading-relaxed font-serif flex-1 break-words">{ln}</p>
                    </div>
                  )
                )}
              </div>
            </div>
          )}
          {fig.type === "data_texts" && (
            <div className="space-y-4">
              {fig.texts.map((t: any) => (
                <div key={t.label} className="rounded-xl border border-border bg-card p-3 sm:p-5">
                  <p className="text-xs font-semibold mb-1.5">Text {t.label} — <span className="font-normal text-muted-foreground">{t.textType}</span></p>
                  <div className="mb-3 pb-3 border-b border-border/50 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-0.5 text-[11px] text-muted-foreground">
                    <span><span className="text-foreground/70">Author/speaker:</span> {t.meta.author}</span>
                    <span><span className="text-foreground/70">Date:</span> {t.meta.date}</span>
                    <span><span className="text-foreground/70">Audience:</span> {t.meta.audience}</span>
                    <span><span className="text-foreground/70">Purpose:</span> {t.meta.purpose}</span>
                  </div>
                  <div className="space-y-0.5">
                    {t.lines.map((ln: string, i: number) =>
                      ln === "" ? (
                        <div key={i} className="h-3" />
                      ) : (
                        <div key={i} className="flex gap-2 sm:gap-3">
                          <span className="w-6 sm:w-7 shrink-0 text-right text-[9px] sm:text-[10px] leading-[1.6] text-muted-foreground/70 tabular-nums select-none pt-[3px]">{i + 1}</span>
                          <p className="text-[13px] sm:text-sm leading-[1.6] font-serif flex-1 break-words">{ln}</p>
                        </div>
                      )
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-3 italic text-right">Illustrative data text (fictional, AI-original)</p>
                </div>
              ))}
            </div>
          )}
          {fig.type === "source" && (
            <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
              <div className="mb-3 pb-3 border-b border-border/50">
                <p className="text-xs font-medium">{fig.provenance.author} · {fig.provenance.date}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{fig.form}{fig.provenance.context ? ` — ${fig.provenance.context}` : ""}</p>
              </div>
              <div className="space-y-3">
                {fig.paragraphs.map((para: string, pi: number) => (
                  <p key={pi} className="text-sm leading-relaxed font-serif">{para}</p>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground mt-3 italic text-right">Illustrative source (fictional, AI-original)</p>
            </div>
          )}
          {fig.type === "interpretations_pair" && (
            <div className="space-y-3">
              {fig.interpretations.map((interp: any) => (
                <div key={interp.label} className="rounded-xl border border-border bg-card p-4 sm:p-5">
                  <p className="text-xs font-semibold mb-2">Interpretation {interp.label}</p>
                  <p className="text-sm leading-relaxed font-serif">{interp.text}</p>
                  <p className="text-[10px] text-muted-foreground mt-3 italic text-right">— {interp.attribution}</p>
                </div>
              ))}
            </div>
          )}
          {fig.type === "text_extract" && (
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="border-l-2 border-primary/40 pl-4 space-y-3">
                {fig.paragraphs.map((para: string, pi: number) => (
                  <p key={pi} className="text-sm leading-relaxed font-serif">{para}</p>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground mt-3 italic text-right">— {fig.sourceLine}</p>
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
