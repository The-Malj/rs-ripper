/**
 * Alt1-based OCR for achievement titles.
 * Isolated so it can be extended with custom fonts or replaced without affecting Tesseract fallback.
 */
import * as a1lib from "alt1/base";
import * as OCR from "alt1/ocr";
import tooltipFont from "alt1/fonts/aa_10px_mono.js";
import chatboxFont from "alt1/fonts/chatbox/12pt.js";
import allcapsFont from "alt1/fonts/aa_9px_mono_allcaps.js";
import aa8Font from "alt1/fonts/aa_8px_mono.js";
import aa8FontNonMono from "alt1/fonts/aa_8px.js";
import aa8AllcapsFont from "alt1/fonts/aa_8px_mono_allcaps.js";
import aa12Font from "alt1/fonts/aa_12px_mono.js";
import pixel8DigitsFont from "alt1/fonts/pixel_8px_digits.js";
import chatbox10Font from "alt1/fonts/chatbox/10pt.js";
import chatbox14Font from "alt1/fonts/chatbox/14pt.js";
import chatbox16Font from "alt1/fonts/chatbox/16pt.js";
import chatbox18Font from "alt1/fonts/chatbox/18pt.js";
import chatbox20Font from "alt1/fonts/chatbox/20pt.js";
import chatbox22Font from "alt1/fonts/chatbox/22pt.js";

/** When true, try every Alt1 font and report which one worked. Set to false for production. */
const DEV_OCR_FONT_SWEEP = false;

const DEV_ALL_FONTS: Array<{ name: string; font: OCR.FontDefinition }> = [
  { name: "aa_10px_mono", font: tooltipFont },
  { name: "aa_9px_mono_allcaps", font: allcapsFont },
  { name: "aa_8px_mono", font: aa8Font },
  { name: "aa_8px", font: aa8FontNonMono },
  { name: "aa_8px_mono_allcaps", font: aa8AllcapsFont },
  { name: "aa_12px_mono", font: aa12Font },
  { name: "pixel_8px_digits", font: pixel8DigitsFont },
  { name: "chatbox/10pt", font: chatbox10Font },
  { name: "chatbox/12pt", font: chatboxFont },
  { name: "chatbox/14pt", font: chatbox14Font },
  { name: "chatbox/16pt", font: chatbox16Font },
  { name: "chatbox/18pt", font: chatbox18Font },
  { name: "chatbox/20pt", font: chatbox20Font },
  { name: "chatbox/22pt", font: chatbox22Font },
];

const COLOR_CANDIDATES: OCR.ColortTriplet[] = [
  [248, 213, 107],
  [184, 209, 209],
  [255, 255, 255],
  [248, 212, 136],
  [224, 188, 116],
];

export type Alt1ReadResult = {
  text: string;
  source: string;
  debug?: Record<string, unknown>;
};

export function readTitleWithAlt1(
  image: ImageData,
  bindFallback?: { bindId: number; localX: number; localY: number },
): Alt1ReadResult {
  const probeX = Math.floor(image.width * 0.15);
  const debug: Record<string, unknown> = {
    cropSize: { w: image.width, h: image.height },
    probe: { x: probeX },
  };

  const tryFindReadLine = (font: OCR.FontDefinition, x: number, y: number, w: number, h: number) => {
    const result = OCR.findReadLine(image, font, COLOR_CANDIDATES, x, y, w, h);
    return {
      text: result.text.trim(),
      debugArea: (result as { debugArea?: { x: number; y: number; w: number; h: number } }).debugArea,
    };
  };

  if (DEV_OCR_FONT_SWEEP) {
    for (const { name, font } of DEV_ALL_FONTS) {
      const basey = (font as { basey?: number }).basey ?? 11;
      const probeY = Math.max(basey, Math.min(image.height - 2, Math.floor(image.height * 0.6)));
      const searchH = Math.max(2, Math.min(6, image.height - probeY));
      const r1 = tryFindReadLine(font, probeX, probeY, Math.max(4, image.width - probeX - 4), searchH);
      if (r1.text) return { text: r1.text, source: `ocr.${name}` };
      const r2 = tryFindReadLine(font, 2, probeY, Math.max(4, image.width - 4), searchH);
      if (r2.text) return { text: r2.text, source: `ocr.${name}` };
    }
  }

  const probeY = Math.max(11, Math.min(image.height - 2, Math.floor(image.height * 0.6)));
  const searchH = Math.max(4, Math.min(4, image.height - probeY));
  const probeYAllcaps = Math.max(13, probeY);
  const searchHAllcaps = Math.max(2, Math.min(4, image.height - probeYAllcaps));
  debug.probe = { ...(debug.probe as object), y: probeY, searchH };

  let tooltip1 = tryFindReadLine(tooltipFont, probeX, probeY, Math.max(4, image.width - probeX - 4), searchH);
  if (tooltip1.text) return { text: tooltip1.text, source: "ocr.tooltip" };
  const tooltip2 = tryFindReadLine(tooltipFont, 2, probeY, Math.max(4, image.width - 4), searchH);
  debug.findReadLine_tooltip_attempt2 = tooltip2.debugArea;
  debug.findReadLine_tooltip_attempt1 = tooltip1.debugArea;
  if (!tooltip2.text && image.height >= 14) {
    const defaultResult = OCR.findReadLine(image, tooltipFont, COLOR_CANDIDATES, probeX, probeY, -1, -1);
    if (defaultResult.text.trim()) return { text: defaultResult.text.trim(), source: "ocr.tooltip" };
    debug.findReadLine_tooltip_default = (defaultResult as { debugArea?: unknown }).debugArea;
  } else if (tooltip2.text) {
    return { text: tooltip2.text, source: "ocr.tooltip" };
  }

  let chat1 = tryFindReadLine(chatboxFont, probeX, probeY, Math.max(4, image.width - probeX - 4), searchH);
  if (chat1.text) return { text: chat1.text, source: "ocr.chatbox" };
  const chat2 = tryFindReadLine(chatboxFont, 2, probeY, Math.max(4, image.width - 4), searchH);
  debug.findReadLine_chat_attempt2 = chat2.debugArea;
  debug.findReadLine_chat_attempt1 = chat1.debugArea;
  if (!chat2.text && image.height >= 14) {
    const defaultResult = OCR.findReadLine(image, chatboxFont, COLOR_CANDIDATES, probeX, probeY, -1, -1);
    if (defaultResult.text.trim()) return { text: defaultResult.text.trim(), source: "ocr.chatbox" };
    debug.findReadLine_chat_default = (defaultResult as { debugArea?: unknown }).debugArea;
  } else if (chat2.text) {
    return { text: chat2.text, source: "ocr.chatbox" };
  }

  const allcaps1 = tryFindReadLine(allcapsFont, probeX, probeYAllcaps, Math.max(4, image.width - probeX - 4), searchHAllcaps).text;
  const allcaps2 = tryFindReadLine(allcapsFont, 2, probeYAllcaps, Math.max(4, image.width - 4), searchHAllcaps).text;
  if (allcaps1 || allcaps2) return { text: allcaps1 || allcaps2!, source: "ocr.allcaps" };

  const aa81 = tryFindReadLine(aa8Font, probeX, probeY, Math.max(4, image.width - probeX - 4), searchH).text;
  const aa82 = tryFindReadLine(aa8Font, 2, probeY, Math.max(4, image.width - 4), searchH).text;
  if (aa81 || aa82) return { text: aa81 || aa82!, source: "ocr.aa8" };

  if (bindFallback && typeof window.alt1?.bindReadStringEx === "function") {
    const colors = COLOR_CANDIDATES.map(([r, g, b]) => a1lib.mixColor(r, g, b));
    debug.bindReadStringEx_results = [] as string[];
    for (const fontname of ["aa_10px_mono", "aa_9px_mono_allcaps", "aa_8px_mono", "chatbox/12pt", "chatfont"]) {
      const args = JSON.stringify({ fontname, allowgap: true, colors });
      const bindText = window.alt1
        .bindReadStringEx(bindFallback.bindId, bindFallback.localX, bindFallback.localY, args)
        .trim();
      (debug.bindReadStringEx_results as string[]).push(`${fontname}: "${bindText}"`);
      if (bindText) return { text: bindText, source: `bindReadStringEx.${fontname}` };
    }
  }

  return { text: "", source: "none", debug };
}
