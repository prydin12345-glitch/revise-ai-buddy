import type jsPDF from 'jspdf';
import { scientificFontBase64 } from './pdf-scientific-font';

const registered = new WeakSet<jsPDF>();
const fontName = 'ScientificSymbols';

/** Keep ordinary PDF typography; embed Unicode glyphs for scientific symbols. */
function notationRuns(doc: jsPDF, text: string, visit: (run: string) => void): void {
  const original = doc.getFont();
  try {
    for (const run of text.match(/[\u0100-\uffff]+|[^\u0100-\uffff]+/g) ?? []) {
      if (run.charCodeAt(0) > 255) {
        if (!registered.has(doc)) {
          doc.addFileToVFS('ScientificSymbols.ttf', scientificFontBase64);
          doc.addFont('ScientificSymbols.ttf', fontName, 'normal');
          registered.add(doc);
        }
        doc.setFont(fontName, 'normal');
      } else doc.setFont(original.fontName, original.fontStyle);
      visit(run);
    }
  } finally { doc.setFont(original.fontName, original.fontStyle); }
}

export function measurePDFNotation(doc: jsPDF, text: string): number {
  let width = 0;
  notationRuns(doc, text, run => { width += doc.getTextWidth(run); });
  return width;
}

export function drawPDFNotation(doc: jsPDF, text: string, x: number, y: number): number {
  let cursor = x;
  notationRuns(doc, text, run => {
    doc.text(run, cursor, y);
    cursor += doc.getTextWidth(run);
  });
  return cursor;
}

export function wrapPDFNotation(doc: jsPDF, text: string, width: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    for (const word of paragraph.split(/\s+/)) {
      const candidate = line ? `${line} ${word}` : word;
      if (line && measurePDFNotation(doc, candidate) > width) { lines.push(line); line = ''; }
      if (measurePDFNotation(doc, word) > width) {
        for (const character of word) {
          if (line && measurePDFNotation(doc, line + character) > width) { lines.push(line); line = ''; }
          line += character;
        }
      } else line = line ? `${line} ${word}` : word;
    }
    lines.push(line);
  }
  return lines;
}
