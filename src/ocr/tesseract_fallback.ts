const TESSERACT_SCALE = 2;
/** Pre-crop to title line only; avoids description/progress bleed. Full crop kept for arrow detection. */
const TITLE_LINE_HEIGHT_PX = 22;
/** Skip left px (pin/emblem/number); avoids leading garbage from UI elements. */
const OCR_LEFT_TRIM_PX = 48;

function cropToTitleLine(source: ImageData): ImageData {
  const h = Math.min(TITLE_LINE_HEIGHT_PX, source.height);
  const left = Math.min(OCR_LEFT_TRIM_PX, source.width - 1);
  const w = Math.max(1, source.width - left);
  const out = new ImageData(w, h);
  for (let row = 0; row < h; row++) {
    const srcOffset = (row * source.width + left) * 4;
    const dstOffset = row * w * 4;
    out.data.set(source.data.subarray(srcOffset, srcOffset + w * 4), dstOffset);
  }
  return out;
}

/**
 * Tesseract.js fallback for achievement title OCR.
 * Used when Alt1 fonts fail. Isolated so it can be removed when custom font is added.
 *
 * Pre-crops to title line only before OCR; full crop remains available for arrow detection.
 * Scale 2x before OCR - Tesseract performs better with ~20-30px character height.
 */
export async function readTitleWithTesseract(image: ImageData): Promise<string | null> {
  const titleOnly = cropToTitleLine(image);
  const scaledW = titleOnly.width * TESSERACT_SCALE;
  const scaledH = titleOnly.height * TESSERACT_SCALE;
  const temp = document.createElement("canvas");
  temp.width = titleOnly.width;
  temp.height = titleOnly.height;
  const tempCtx = temp.getContext("2d");
  if (!tempCtx) return null;
  tempCtx.putImageData(titleOnly, 0, 0);

  const canvas = document.createElement("canvas");
  canvas.width = scaledW;
  canvas.height = scaledH;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(temp, 0, 0, titleOnly.width, titleOnly.height, 0, 0, scaledW, scaledH);

  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng");
  try {
    const { data } = await worker.recognize(canvas);
    const line = data.text?.trim().split(/\r?\n/)[0] ?? "";
    return line || null;
  } finally {
    await worker.terminate();
  }
}
