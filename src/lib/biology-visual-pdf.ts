import type jsPDF from "jspdf";
import type { BiologyVisualResource } from "../../supabase/functions/_shared/biology-visual-types";
import {
  parseVisualResource,
  publicVisualFile,
  imageCredit,
} from "../../supabase/functions/_shared/biology-visual-public";
/** Assessment PDF takes public geometry/letters only. No key or response argument. */
export function drawBiologyVisualPDF(
  doc: jsPDF,
  input: BiologyVisualResource,
  layout: {
    x: number;
    y: number;
    width: number;
    bottom: number;
    nextPage: () => number;
  },
): number {
  const resource = parseVisualResource(input);
  let y = layout.y;
  const { x, width, bottom } = layout;
  const columns = Math.min(3, resource.panels.length),
    panelWidth = (width - (columns - 1) * 4) / columns;
  if (panelWidth < 45)
    throw new Error("Visual panels cannot be printed legibly at this width.");
  for (let start = 0; start < resource.panels.length; start += columns) {
    const group = resource.panels.slice(start, start + columns);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    const bandHeight = Math.max(
      ...group.map((p) => {
        const f = publicVisualFile(p.asset);
        return (
          (panelWidth * f.height) / f.width +
          (
            doc.splitTextToSize(
              f.assetId +
                " v" +
                f.version +
                ". " +
                imageCredit(f.credit) +
                " Source: " +
                f.credit.sourceUrl +
                " Licence: " +
                f.credit.licenceUrl,
              panelWidth,
            ) as string[]
          ).length *
            4 +
          18
        );
      }),
    );
    if (bandHeight > bottom - 35)
      throw new Error(
        "Visual or attribution exceeds a legible printable page.",
      );
    if (y + bandHeight > bottom) y = layout.nextPage();
    const bandY = y;
    for (const [column, panel] of group.entries()) {
      const px = x + column * (panelWidth + 4);
      const file = publicVisualFile(panel.asset),
        h = (panelWidth * file.height) / file.width;
      y = bandY;
      const attribution =
        file.assetId +
        " v" +
        file.version +
        ". " +
        imageCredit(file.credit) +
        " Source: " +
        file.credit.sourceUrl +
        " Licence: " +
        file.credit.licenceUrl;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      const lines = doc.splitTextToSize(attribution, panelWidth) as string[];
      if (h + lines.length * 4 + 18 > bottom - 35)
        throw new Error(
          "Visual or attribution exceeds a legible printable page.",
        );
      if (y + h + lines.length * 4 + 18 > bottom) y = layout.nextPage();
      doc.setTextColor(25, 25, 25);
      doc.setFontSize(10);
      doc.text("Panel " + panel.id, px, y);
      y += 6;
      if (file.geometry) {
        const sx = panelWidth / 400,
          sy = h / 260;
        doc.setLineWidth(Math.max(0.18, 2 * sx));
        for (const s of file.geometry) {
          doc.setDrawColor(s.stroke);
          if (s.fill !== "none") doc.setFillColor(s.fill);
          const style = s.fill === "none" ? "S" : "FD";
          if (s.kind === "ellipse")
            doc.ellipse(px + s.x * sx, y + s.y * sy, s.w * sx, s.h * sy, style);
          else if (s.kind === "rect")
            doc.rect(px + s.x * sx, y + s.y * sy, s.w * sx, s.h * sy, style);
          else
            doc.line(px + s.x * sx, y + s.y * sy, px + s.w * sx, y + s.h * sy);
        }
      } else if (file.dataUri)
        doc.addImage(
          file.dataUri,
          file.mediaType === "image/png" ? "PNG" : "JPEG",
          px,
          y,
          panelWidth,
          h,
        );
      else
        throw new Error(
          "Approved visual lacks a printable immutable representation.",
        );
      doc.setFontSize(12);
      doc.setDrawColor(17, 17, 17);
      doc.setFillColor(17, 17, 17);
      doc.setLineWidth(Math.max(0.18, (2 * panelWidth) / file.width));
      for (const t of panel.targets) {
        const tx = px + t.x * panelWidth,
          ty = y + t.y * h,
          ex = px + t.endX * panelWidth,
          ey = y + t.endY * h;
        if (t.style === "blank") doc.rect(tx, ty - 3, 15, 6);
        else doc.text(t.letter, tx, ty);
        doc.line(tx + (t.style === "blank" ? 16 : 4), ty, ex, ey);
        if (t.style === "arrow") {
          const dx = ex - tx,
            dy = ey - ty,
            length = Math.hypot(dx, dy) || 1;
          doc.triangle(
            ex,
            ey,
            ex - (2.5 * dx) / length + dy / length,
            ey - (2.5 * dy) / length - dx / length,
            ex - (2.5 * dx) / length - dy / length,
            ey - (2.5 * dy) / length + dx / length,
            "F",
          );
        }
      }
      y += h + 5;
      doc.setFontSize(8);
      for (const line of lines) {
        doc.text(line, px, y);
        y += 4;
      }
      y += 7;
    }
    y = bandY + bandHeight;
  }
  return y;
}
