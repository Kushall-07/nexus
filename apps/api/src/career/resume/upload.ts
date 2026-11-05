import { AppError, AuthErrorCode } from "../../utils/errors.js";

// Upload validation and text extraction. Files are processed entirely in
// memory and never written to disk; only the extracted, user-reviewed fields
// are ever persisted. Content is treated strictly as data.

export type ResumeFileType = "pdf" | "docx";

const MAX_TEXT_CHARS = 200_000;
const MAX_PDF_PAGES = 12;
const PARSE_TIMEOUT_MS = 15_000;

const PDF_MAGIC = Buffer.from("%PDF-");
const ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

function unsupported(message: string): AppError {
  return new AppError(AuthErrorCode.UNSUPPORTED_FILE, 415, message);
}

function unreadable(message: string): AppError {
  return new AppError(AuthErrorCode.RESUME_UNREADABLE, 422, message);
}

// Extension AND file signature must agree. MIME type from the client is not trusted.
export function detectResumeType(buffer: Buffer, fileName: string): ResumeFileType {
  if (buffer.length === 0) throw unreadable("The uploaded file is empty.");

  const extension = fileName.toLowerCase().match(/\.([a-z0-9]{1,5})$/)?.[1];

  if (extension === "pdf") {
    if (!buffer.subarray(0, 5).equals(PDF_MAGIC)) throw unsupported("The file does not look like a valid PDF.");
    return "pdf";
  }
  if (extension === "docx") {
    if (!buffer.subarray(0, 4).equals(ZIP_MAGIC)) throw unsupported("The file does not look like a valid DOCX document.");
    return "docx";
  }
  throw unsupported("Only PDF and DOCX resumes are supported.");
}

const MAX_ZIP_ENTRIES = 1000;
const MAX_ZIP_UNCOMPRESSED_BYTES = 50_000_000;

// Reads the zip central directory (without decompressing anything) and refuses
// archives that would expand beyond a safe size: a small DOCX must not become a zip bomb.
export function assertSafeZip(buffer: Buffer): void {
  const searchFrom = Math.max(0, buffer.length - 22 - 65_535);
  let eocd = -1;
  for (let index = buffer.length - 22; index >= searchFrom; index -= 1) {
    if (buffer.readUInt32LE(index) === 0x06054b50) {
      eocd = index;
      break;
    }
  }
  if (eocd < 0) throw unreadable("The document could not be read. It may be corrupted.");

  const entries = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);
  let total = 0;

  if (entries > MAX_ZIP_ENTRIES) throw unreadable("The document contains too many parts to be a normal resume.");

  for (let entry = 0; entry < entries; entry += 1) {
    if (offset + 46 > buffer.length || buffer.readUInt32LE(offset) !== 0x02014b50) {
      throw unreadable("The document could not be read. It may be corrupted.");
    }
    total += buffer.readUInt32LE(offset + 24);
    if (total > MAX_ZIP_UNCOMPRESSED_BYTES) throw unreadable("The document expands to an unreasonable size.");
    offset += 46 + buffer.readUInt16LE(offset + 28) + buffer.readUInt16LE(offset + 30) + buffer.readUInt16LE(offset + 32);
  }
}

function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(unreadable(`The ${label} took too long to read.`)), PARSE_TIMEOUT_MS);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function pdfText(buffer: Buffer): Promise<string> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: new Uint8Array(buffer) });

  try {
    const result = await parser.getText({ first: MAX_PDF_PAGES });
    return result.text;
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}

async function docxText(buffer: Buffer): Promise<string> {
  assertSafeZip(buffer);
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

export async function extractResumeText(buffer: Buffer, type: ResumeFileType): Promise<string> {
  let text: string;

  try {
    text = await withTimeout(type === "pdf" ? pdfText(buffer) : docxText(buffer), "document");
  } catch (error) {
    if (error instanceof AppError) throw error;
    // Parser messages can echo document content, so they are discarded.
    throw unreadable("The document could not be read. It may be corrupted or password-protected.");
  }

  const cleaned = text.replace(/\r\n?/g, "\n").replace(/[^\S\n]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, MAX_TEXT_CHARS);

  if (cleaned.length < 30) {
    throw unreadable(
      "No readable text was found. Scanned or image-only documents are not supported (there is no OCR); upload a text-based PDF or DOCX.",
    );
  }
  return cleaned;
}
