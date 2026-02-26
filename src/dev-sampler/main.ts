import * as a1lib from "alt1/base";
import "./styles.css";

type Rect = { x: number; y: number; width: number; height: number };

type SavedSample = {
  name: string;
  stateTag: string;
  role: "required" | "optional" | "negative";
  rect: Rect;
  frameSize: { width: number; height: number };
  fileName: string;
  capturedAtIso: string;
};

type DragState = {
  active: boolean;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
};

function must<T>(value: T | null, label: string): T {
  if (value == null) throw new Error(`Missing required UI element: ${label}`);
  return value;
}

const statusEl = must(document.getElementById("status"), "status");
const saveFolderEl = must(document.getElementById("save-folder"), "save-folder");
const selectionInfoEl = must(document.getElementById("selection-info"), "selection-info");
const testResultEl = must(document.getElementById("test-result"), "test-result");
const captureBtn = must(document.getElementById("capture-btn") as HTMLButtonElement | null, "capture-btn");
const setSaveFolderBtn = must(
  document.getElementById("set-save-folder-btn") as HTMLButtonElement | null,
  "set-save-folder-btn",
);
const saveBtn = must(document.getElementById("save-btn") as HTMLButtonElement | null, "save-btn");
const testBtn = must(document.getElementById("test-btn") as HTMLButtonElement | null, "test-btn");
const downloadManifestBtn = must(
  document.getElementById("download-manifest-btn") as HTMLButtonElement | null,
  "download-manifest-btn",
);
const sampleNameInput = must(document.getElementById("sample-name") as HTMLInputElement | null, "sample-name");
const stateTagInput = must(document.getElementById("state-tag") as HTMLInputElement | null, "state-tag");
const sampleRoleSelect = must(document.getElementById("sample-role") as HTMLSelectElement | null, "sample-role");
const samplesListEl = must(document.getElementById("samples-list"), "samples-list");
const canvas = must(document.getElementById("frame-canvas") as HTMLCanvasElement | null, "frame-canvas");

const ctx = must(canvas.getContext("2d"), "frame-canvas-2d-context");

let currentFrame: { imgRef: a1lib.ImgRefBind; image: ImageData } | null = null;
let selectedRect: Rect | null = null;
const savedSamples: SavedSample[] = [];
let saveFolderHandle: FileSystemDirectoryHandle | null = null;

const drag: DragState = {
  active: false,
  startX: 0,
  startY: 0,
  currentX: 0,
  currentY: 0,
};

function setStatus(text: string): void {
  statusEl.textContent = text;
}

function setSelectionInfo(text: string): void {
  selectionInfoEl.textContent = text;
}

function setSaveFolderText(text: string): void {
  saveFolderEl.textContent = text;
}

function setTestResult(text: string): void {
  testResultEl.textContent = text;
}

function updateButtons(): void {
  const hasSelection = !!selectedRect && !!currentFrame;
  saveBtn.disabled = !hasSelection;
  testBtn.disabled = !hasSelection;
  downloadManifestBtn.disabled = savedSamples.length === 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeRect(aX: number, aY: number, bX: number, bY: number): Rect {
  const x1 = Math.min(aX, bX);
  const y1 = Math.min(aY, bY);
  const x2 = Math.max(aX, bX);
  const y2 = Math.max(aY, bY);
  return {
    x: Math.floor(x1),
    y: Math.floor(y1),
    width: Math.max(1, Math.floor(x2 - x1)),
    height: Math.max(1, Math.floor(y2 - y1)),
  };
}

function redrawCanvas(): void {
  if (!currentFrame) return;
  ctx.putImageData(currentFrame.image, 0, 0);
  if (selectedRect) {
    ctx.strokeStyle = "#4df59a";
    ctx.lineWidth = 2;
    ctx.strokeRect(selectedRect.x, selectedRect.y, selectedRect.width, selectedRect.height);
  }
  if (drag.active) {
    const preview = normalizeRect(drag.startX, drag.startY, drag.currentX, drag.currentY);
    ctx.strokeStyle = "#ffd166";
    ctx.lineWidth = 1;
    ctx.strokeRect(preview.x, preview.y, preview.width, preview.height);
  }
}

function updateSamplesList(): void {
  samplesListEl.textContent = JSON.stringify(savedSamples, null, 2);
  updateButtons();
}

function toPngDataUrl(image: ImageData): string {
  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = image.width;
  tempCanvas.height = image.height;
  const tempCtx = tempCanvas.getContext("2d");
  if (!tempCtx) throw new Error("Unable to create temporary canvas.");
  tempCtx.putImageData(image, 0, 0);
  return tempCanvas.toDataURL("image/png");
}

function downloadFile(fileName: string, dataUrlOrBlobUrl: string): void {
  const anchor = document.createElement("a");
  anchor.href = dataUrlOrBlobUrl;
  anchor.download = fileName;
  anchor.click();
}

function supportsFsAccessApi(): boolean {
  return typeof (window as unknown as { showDirectoryPicker?: unknown }).showDirectoryPicker === "function";
}

async function chooseSaveFolder(): Promise<void> {
  if (!supportsFsAccessApi()) {
    setSaveFolderText("Save folder: browser file API unavailable (download fallback active)");
    return;
  }
  try {
    const picker = window as unknown as {
      showDirectoryPicker: () => Promise<FileSystemDirectoryHandle>;
    };
    const selected = await picker.showDirectoryPicker();
    const anchorsDir = await selected.getDirectoryHandle("data", { create: true });
    const anchorsDir2 = await anchorsDir.getDirectoryHandle("anchors", { create: true });
    saveFolderHandle = await anchorsDir2.getDirectoryHandle("dev-samples", { create: true });
    setSaveFolderText("Save folder: data/anchors/dev-samples (auto-write enabled)");
  } catch {
    setSaveFolderText("Save folder: selection cancelled (download fallback active)");
  }
}

async function writePngToSaveFolder(fileName: string, dataUrl: string): Promise<boolean> {
  if (!saveFolderHandle) return false;
  try {
    const base64 = dataUrl.split(",")[1] ?? "";
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const fileHandle = await saveFolderHandle.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(bytes);
    await writable.close();
    return true;
  } catch {
    return false;
  }
}

function captureFrame(): void {
  if (!a1lib.hasAlt1 || !window.alt1?.rsLinked) {
    setStatus("Sampler requires Alt1 with RS window linked.");
    return;
  }
  const width = window.alt1.rsWidth || 0;
  const height = window.alt1.rsHeight || 0;
  if (width <= 0 || height <= 0) {
    setStatus("RuneScape dimensions unavailable.");
    return;
  }
  const t0 = performance.now();
  const imgRef = a1lib.captureHoldFullRs();
  const image = imgRef.toData(0, 0, width, height);
  const ms = Math.round(performance.now() - t0);

  currentFrame = { imgRef, image };
  canvas.width = width;
  canvas.height = height;
  selectedRect = null;
  redrawCanvas();
  updateButtons();
  setStatus(`Captured ${width}x${height} in ${ms}ms.`);
  setSelectionInfo("Selection: none");
  setTestResult("Needle test: not run");
}

function getSelectedCrop(): ImageData | null {
  if (!currentFrame || !selectedRect) return null;
  const x = clamp(selectedRect.x, 0, currentFrame.image.width - 1);
  const y = clamp(selectedRect.y, 0, currentFrame.image.height - 1);
  const maxWidth = currentFrame.image.width - x;
  const maxHeight = currentFrame.image.height - y;
  const width = clamp(selectedRect.width, 1, maxWidth);
  const height = clamp(selectedRect.height, 1, maxHeight);
  const crop = new ImageData(width, height);
  for (let row = 0; row < height; row++) {
    const srcOffset = ((y + row) * currentFrame.image.width + x) * 4;
    const dstOffset = row * width * 4;
    crop.data.set(currentFrame.image.data.slice(srcOffset, srcOffset + width * 4), dstOffset);
  }
  return crop;
}

async function saveSelection(): Promise<void> {
  if (!currentFrame || !selectedRect) return;
  const crop = getSelectedCrop();
  if (!crop) return;
  const name = sampleNameInput.value.trim() || `sample_${String(savedSamples.length + 1).padStart(3, "0")}`;
  const stateTag = stateTagInput.value.trim() || "unlabeled";
  const role = (sampleRoleSelect.value || "required") as SavedSample["role"];
  const fileName = `${name}.png`;
  const dataUrl = toPngDataUrl(crop);
  const written = await writePngToSaveFolder(fileName, dataUrl);
  if (!written) {
    downloadFile(fileName, dataUrl);
  }

  savedSamples.push({
    name,
    stateTag,
    role,
    rect: { ...selectedRect },
    frameSize: { width: currentFrame.image.width, height: currentFrame.image.height },
    fileName,
    capturedAtIso: new Date().toISOString(),
  });
  updateSamplesList();
  setStatus(
    `Saved sample '${name}' (${selectedRect.width}x${selectedRect.height}) via ${written ? "auto-write" : "download"}.`,
  );
}

function testNeedle(): void {
  if (!currentFrame || !selectedRect) return;
  const crop = getSelectedCrop();
  if (!crop) return;
  const encoded = a1lib.encodeImageString(crop);
  const t0 = performance.now();
  const result = alt1.bindFindSubImg(
    currentFrame.imgRef.handle,
    encoded,
    crop.width,
    0,
    0,
    currentFrame.image.width,
    currentFrame.image.height,
  );
  const elapsed = Math.round(performance.now() - t0);
  let hits = 0;
  try {
    const parsed = JSON.parse(result ?? "[]") as Array<{ x: number; y: number }>;
    hits = parsed.length;
  } catch {
    hits = 0;
  }
  setTestResult(`Needle test: ${hits} hit(s) in ${elapsed}ms.`);
}

function downloadManifest(): void {
  const manifest = {
    generatedAtIso: new Date().toISOString(),
    sampleCount: savedSamples.length,
    samples: savedSamples,
  };
  const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  downloadFile("needle_manifest.json", url);
  URL.revokeObjectURL(url);
}

async function saveManifestToFolder(): Promise<boolean> {
  if (!saveFolderHandle) return false;
  try {
    const manifest = {
      generatedAtIso: new Date().toISOString(),
      sampleCount: savedSamples.length,
      samples: savedSamples,
    };
    const fileHandle = await saveFolderHandle.getFileHandle("needle_manifest.json", { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(manifest, null, 2));
    await writable.close();
    return true;
  } catch {
    return false;
  }
}

function toCanvasCoords(event: MouseEvent): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  const relX = (event.clientX - rect.left) * (canvas.width / Math.max(1, rect.width));
  const relY = (event.clientY - rect.top) * (canvas.height / Math.max(1, rect.height));
  return {
    x: clamp(Math.round(relX), 0, Math.max(0, canvas.width - 1)),
    y: clamp(Math.round(relY), 0, Math.max(0, canvas.height - 1)),
  };
}

canvas.addEventListener("mousedown", (event) => {
  if (!currentFrame) return;
  const p = toCanvasCoords(event);
  drag.active = true;
  drag.startX = p.x;
  drag.startY = p.y;
  drag.currentX = p.x;
  drag.currentY = p.y;
  redrawCanvas();
});

canvas.addEventListener("mousemove", (event) => {
  if (!drag.active) return;
  const p = toCanvasCoords(event);
  drag.currentX = p.x;
  drag.currentY = p.y;
  redrawCanvas();
});

window.addEventListener("mouseup", () => {
  if (!drag.active) return;
  drag.active = false;
  selectedRect = normalizeRect(drag.startX, drag.startY, drag.currentX, drag.currentY);
  redrawCanvas();
  updateButtons();
  setSelectionInfo(
    `Selection: x=${selectedRect.x}, y=${selectedRect.y}, w=${selectedRect.width}, h=${selectedRect.height}`,
  );
});

captureBtn.addEventListener("click", captureFrame);
setSaveFolderBtn.addEventListener("click", () => {
  void chooseSaveFolder();
});
saveBtn.addEventListener("click", () => {
  void saveSelection();
});
testBtn.addEventListener("click", testNeedle);
downloadManifestBtn.addEventListener("click", () => {
  void (async () => {
    const written = await saveManifestToFolder();
    if (!written) {
      downloadManifest();
    } else {
      setStatus("Saved manifest via auto-write.");
    }
  })();
});

setStatus("Sampler ready. Click 'Capture Frame' to begin.");
setSaveFolderText("Save folder: not set (download fallback active)");
setSelectionInfo("Selection: none");
setTestResult("Needle test: not run");
updateButtons();
