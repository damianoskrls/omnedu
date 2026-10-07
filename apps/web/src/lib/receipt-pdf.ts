import { PDFDocument, PDFFont, PDFPage, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { methodLabel } from './payment-note';

export type ReceiptInput = {
  schoolName: string;
  logoBytes?: Uint8Array | null;
  logoType?: string;
  studentName: string;
  addresseeName: string;
  payerName: string;
  title: string;
  paidAt: string;
  method: string;
  receiptAmount: number;
  receiptNumber: string;
};

const PURPLE = rgb(0.467, 0.196, 0.553);

function wrap(text: string, font: PDFFont, size: number, maxWidth: number) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

function euro(amount: number) {
  return `${amount.toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

function greekDate(iso: string) {
  const [year, month, day] = iso.split('-').map(Number);
  if (!year || !month || !day) return iso;
  return new Date(year, month - 1, day).toLocaleDateString('el-GR', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

function drawLines(page: PDFPage, lines: string[], x: number, y: number, font: PDFFont, size: number, color: ReturnType<typeof rgb>) {
  let cursor = y;
  for (const line of lines) {
    page.drawText(line, { x, y: cursor, size, font, color });
    cursor -= size + 4;
  }
  return cursor;
}

export async function buildReceiptPdf(input: ReceiptInput, regular: ArrayBuffer, bold: ArrayBuffer) {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(regular);
  const fontBold = await pdf.embedFont(bold);
  const page = pdf.addPage([595, 842]);
  page.drawRectangle({ x: 0, y: 742, width: 595, height: 100, color: PURPLE });

  let textLeft = 48;
  if (input.logoBytes && input.logoBytes.length > 8) {
    try {
      const isPng = input.logoType?.includes('png') || input.logoBytes[0] === 0x89;
      const image = isPng ? await pdf.embedPng(input.logoBytes) : await pdf.embedJpg(input.logoBytes);
      const max = 64;
      const scale = Math.min(max / image.width, max / image.height);
      const w = image.width * scale;
      const h = image.height * scale;
      page.drawRectangle({ x: 40, y: 758, width: w + 12, height: h + 12, color: rgb(1, 1, 1) });
      page.drawImage(image, { x: 46, y: 764, width: w, height: h });
      textLeft = 46 + w + 28;
    } catch {
      textLeft = 48;
    }
  }

  page.drawText(input.schoolName || 'Σχολείο', {
    x: textLeft, y: 800, size: 16, font: fontBold, color: rgb(1, 1, 1),
  });
  page.drawText('ΑΠΟΔΕΙΞΗ ΕΙΣΠΡΑΞΗΣ', {
    x: textLeft, y: 776, size: 12, font, color: rgb(1, 1, 1),
  });

  page.drawText(input.receiptNumber, {
    x: 48, y: 700, size: 10, font, color: rgb(0.4, 0.4, 0.45),
  });

  const rows: [string, string][] = [
    ['Προς', input.addresseeName || input.payerName],
    ['Μαθητής', input.studentName],
    ['Αιτιολογία', input.title],
    ['Ημερομηνία', greekDate(input.paidAt)],
    ['Τρόπος πληρωμής', methodLabel(input.method)],
    ['Εισπράχθηκε από', input.payerName],
  ];

  let y = 660;
  for (const [label, value] of rows) {
    page.drawText(label, { x: 48, y, size: 10, font, color: rgb(0.45, 0.45, 0.5) });
    y = drawLines(page, wrap(value || '—', fontBold, 13, 470), 48, y - 16, fontBold, 13, rgb(0.1, 0.1, 0.12));
    y -= 14;
  }

  page.drawRectangle({ x: 48, y: y - 70, width: 499, height: 78, color: rgb(0.97, 0.94, 0.98) });
  page.drawText('Ποσό απόδειξης', { x: 64, y: y - 22, size: 11, font, color: PURPLE });
  page.drawText(euro(input.receiptAmount), { x: 64, y: y - 52, size: 26, font: fontBold, color: PURPLE });

  const footer = 'Η απόδειξη εκδόθηκε από τη γραμματεία και αφορά το ποσό που αναγράφεται, ανεξάρτητα από το σύνολο της οφειλής.';
  drawLines(page, wrap(footer, font, 9, 499), 48, 72, font, 9, rgb(0.45, 0.45, 0.5));

  return pdf.save();
}

export async function createReceiptFile(input: Omit<ReceiptInput, 'logoBytes' | 'logoType' | 'receiptNumber'> & { logoUrl?: string }) {
  const [regular, bold] = await Promise.all([
    fetch('/fonts/NotoSans-Regular.ttf').then(res => res.arrayBuffer()),
    fetch('/fonts/NotoSans-Bold.ttf').then(res => res.arrayBuffer()),
  ]);
  let logoBytes: Uint8Array | null = null;
  let logoType = '';
  if (input.logoUrl) {
    try {
      const res = await fetch(`/api/receipt-logo?url=${encodeURIComponent(input.logoUrl)}`);
      if (res.ok) {
        logoType = res.headers.get('content-type') ?? '';
        logoBytes = new Uint8Array(await res.arrayBuffer());
      }
    } catch {
      logoBytes = null;
    }
  }
  const stamp = input.paidAt.replace(/-/g, '');
  const receiptNumber = `ΑΠ-${stamp}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const bytes = await buildReceiptPdf({ ...input, logoBytes, logoType, receiptNumber }, regular, bold);
  const filename = `apodeixi-${stamp}.pdf`;
  const blob = new Blob([bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer], { type: 'application/pdf' });
  return new File([blob], filename, { type: 'application/pdf' });
}

export function downloadFile(file: File) {
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.name;
  link.click();
  URL.revokeObjectURL(url);
}
