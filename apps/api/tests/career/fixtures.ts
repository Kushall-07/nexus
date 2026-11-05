import JSZip from "jszip";

export const SAMPLE_RESUME_LINES = [
  "Asha Verma",
  "asha.verma@example.com | +91 98765 43210 | github.com/ashaverma",
  "",
  "Education",
  "B.Tech in Computer Science, Example Institute of Technology, 2026",
  "",
  "Experience",
  "Backend Intern, Sample Systems, Jun 2025 - Aug 2025",
  "Built REST APIs with Node.js and PostgreSQL. Wrote unit testing suites.",
  "",
  "Projects",
  "Campus Marketplace",
  "A full-stack app using React, Node.js and MongoDB deployed with Docker.",
  "",
  "Skills",
  "Languages: JavaScript, TypeScript, Python",
  "Tools: Docker, Git",
  "",
  "Certifications",
  "Example Cloud Practitioner",
];

const escapeXml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export async function buildDocx(lines: string[] = SAMPLE_RESUME_LINES): Promise<Buffer> {
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
  );
  zip.file(
    "_rels/.rels",
    '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
  );
  const paragraphs = lines.map((line) => `<w:p><w:r><w:t xml:space="preserve">${escapeXml(line)}</w:t></w:r></w:p>`).join("");
  zip.file(
    "word/document.xml",
    `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paragraphs}</w:body></w:document>`,
  );
  return Buffer.from(await zip.generateAsync({ type: "uint8array" }));
}

// Minimal single-page text PDF with a correct xref table.
export function buildPdf(lines: string[] = SAMPLE_RESUME_LINES): Buffer {
  const text = lines
    .filter((line) => line.trim() !== "")
    .map((line, index) => `BT /F1 11 Tf 40 ${780 - index * 16} Td (${line.replace(/[\\()]/g, "\\$&")}) Tj ET`)
    .join("\n");

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${Buffer.byteLength(text)} >>\nstream\n${text}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];

  let body = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(body));
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(body);
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) body += `${String(offset).padStart(10, "0")} 00000 n \n`;
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(body, "latin1");
}
