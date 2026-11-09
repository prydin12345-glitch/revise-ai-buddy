import { getDocumentProxy } from 'unpdf';
import type jsPDF from 'jspdf';

export async function exportedPDFText(pdf: jsPDF): Promise<string> {
  const document = await getDocumentProxy(new Uint8Array(pdf.output('arraybuffer')));
  try {
    const pages = await Promise.all(Array.from({ length: document.numPages }, async (_, index) => {
      const page = await document.getPage(index + 1);
      const content = await page.getTextContent();
      return content.items.map(item => 'str' in item ? item.str : '').join('');
    }));
    return pages.join('\n');
  } finally { await document.loadingTask.destroy(); }
}
