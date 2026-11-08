import http from 'node:http';
import sharp from 'sharp';

import {
  THUMBNAIL_WIDTH,
  fetchPdf,
  renderPdfPage,
} from '../../../backend/helpers/pdfThumbnail';

// A two-page PDF: page 1 has black text, page 2 is filled blue.
function makePdf() {
  const page = (contents) =>
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${contents} 0 R /Resources << /Font << /F1 7 0 R >> >> >>`;
  const stream = (body) =>
    `<< /Length ${body.length} >>\nstream\n${body}\nendstream`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>',
    page(5),
    page(6),
    stream('BT /F1 48 Tf 72 700 Td (Dear Secretary) Tj ET'),
    stream('0 0 1 rg 0 0 612 792 re f'),
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = objects.map((object, i) => {
    const offset = pdf.length;
    pdf += `${i + 1} 0 obj\n${object}\nendobj\n`;
    return offset;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets
    .map((o) => `${String(o).padStart(10, '0')} 00000 n \n`)
    .join('');
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf);
}

describe('renderPdfPage', () => {
  it('draws the first page as a WebP at thumbnail width, keeping its shape', async () => {
    const image = await renderPdfPage(makePdf());
    const meta = await sharp(image).metadata();
    expect(meta.format).toBe('webp');
    expect(meta.width).toBe(THUMBNAIL_WIDTH);
    expect(meta.height).toBe(Math.ceil((THUMBNAIL_WIDTH * 792) / 612));
    // White page with some dark text on it
    const { channels } = await sharp(image).stats();
    expect(channels[0].max).toBeGreaterThan(240);
    expect(channels[0].min).toBeLessThan(80);
  });

  it('draws another page when asked, and the last page for one past the end', async () => {
    for (const page of [2, 9]) {
      const { channels } = await sharp(
        await renderPdfPage(makePdf(), { page }),
      ).stats();
      expect(channels[2].mean).toBeGreaterThan(200); // Blue
      expect(channels[0].mean).toBeLessThan(40);
    }
  });

  it('refuses something that isn’t a PDF', async () => {
    await expect(
      renderPdfPage(Buffer.from('<html>Please log in</html>')),
    ).rejects.toThrow();
  });
});

describe('fetchPdf', () => {
  let server;
  let base;
  beforeAll(async () => {
    server = http.createServer((req, res) => {
      if (req.url === '/blocked.pdf') {
        res.writeHead(403).end('Access denied');
      } else if (req.url === '/login.pdf') {
        res
          .writeHead(200, { 'Content-Type': 'application/pdf' })
          .end('<html>Log in</html>');
      } else {
        res
          .writeHead(200, { 'Content-Type': 'application/octet-stream' })
          .end(makePdf());
      }
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${server.address().port}`;
  });
  afterAll(() => new Promise((resolve) => server.close(resolve)));

  it('downloads a PDF whatever the server calls it', async () => {
    expect(
      (await fetchPdf(`${base}/letter.pdf`)).subarray(0, 5).toString(),
    ).toBe('%PDF-');
  });

  it('says plainly when a site refuses the download', async () => {
    await expect(fetchPdf(`${base}/blocked.pdf`)).rejects.toThrow(
      '127.0.0.1 refused to let the server download it (403)',
    );
  });

  it('refuses a page that only claims to be a PDF', async () => {
    await expect(fetchPdf(`${base}/login.pdf`)).rejects.toThrow(
      'didn’t return a PDF',
    );
  });
});
