import * as a1lib from "alt1/base";

import { FrameProvider } from "../capture/capture_service.js";
import { primeImageAnchorCache } from "../finders/image_anchor_finder.js";
import { OcrToken, RawFrame, Rect } from "../types.js";

type Alt1TextReadArgs = {
  fontname?: "chat" | "chatmono" | "xpcounter";
  allowgap?: boolean;
};

const MIN_CAPTURE_INTERVAL_MS = 75;
const MIN_TOKEN_TEXT_LEN = 3;

function isLikelyNoiseToken(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return true;
  if (trimmed.length < MIN_TOKEN_TEXT_LEN) return true;
  if (trimmed.length > 40) return true;

  const alphaOnly = trimmed.toLowerCase().replace(/[^a-z]/g, "");
  if (!alphaOnly) return true;

  const unique = new Set(alphaOnly).size;
  if (alphaOnly.length >= 10 && unique <= 3) return true;

  const vowels = alphaOnly.replace(/[^aeiou]/g, "").length;
  if (alphaOnly.length >= 6 && vowels === 0) return true;

  const repeatedRun = /(.)\1{5,}/.test(alphaOnly);
  if (repeatedRun) return true;

  return false;
}

function normalizeTokenText(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/[^\w '&\-]/g, "")
    .trim();
}

function safeReadBoundString(handle: number, x: number, y: number, args: Alt1TextReadArgs): string {
  try {
    const payload = JSON.stringify(args);
    const raw = (alt1.bindReadStringEx(handle, x, y, payload) ?? "").trim();
    if (!raw) return "";
    if (raw.startsWith("{") && raw.includes("\"text\"")) {
      try {
        const parsed = JSON.parse(raw) as { text?: unknown; fragments?: Array<{ text?: unknown }> };
        if (typeof parsed.text === "string") return parsed.text.trim();
        if (Array.isArray(parsed.fragments)) {
          return parsed.fragments
            .map((fragment) => (typeof fragment?.text === "string" ? fragment.text : ""))
            .join("")
            .trim();
        }
      } catch {
        return "";
      }
    }
    return raw;
  } catch {
    return "";
  }
}

function fallbackBoundReadTokens(
  tokens: OcrToken[],
  imgRef: a1lib.ImgRefBind,
  width: number,
  height: number,
): void {
  // Keep OCR path intentionally small and cheap; image anchors are primary.
  const points = [
    { x: 0.16, y: 0.08 },
    { x: 0.5, y: 0.08 },
    { x: 0.84, y: 0.08 },
    { x: 0.22, y: 0.2 },
    { x: 0.5, y: 0.2 },
    { x: 0.78, y: 0.2 },
  ];
  const args: Alt1TextReadArgs = { fontname: "chat", allowgap: true };
  for (const point of points) {
    const x = Math.max(0, Math.min(width - 1, Math.floor(width * point.x)));
    const y = Math.max(0, Math.min(height - 1, Math.floor(height * point.y)));
    const text = safeReadBoundString(imgRef.handle, x, y, args);
    if (!text) continue;
    pushToken(tokens, text, { x, y, width: 180, height: 20 }, 0.62);
  }
}

function pushToken(tokens: OcrToken[], text: string, rect: Rect, confidence = 0.7): void {
  const normalized = normalizeTokenText(text);
  if (!normalized) return;
  if (isLikelyNoiseToken(normalized)) return;
  const exists = tokens.some(
    (token) =>
      token.text.toLowerCase() === normalized.toLowerCase() &&
      token.rect?.x === rect.x &&
      token.rect?.y === rect.y,
  );
  if (exists) return;
  tokens.push({ text: normalized, rect, confidence });

  // Also expose per-word tokens since bound reads often return multi-word lines.
  const words = normalized.split(/\s+/).filter((part) => part.length >= 3);
  if (words.length <= 1) return;
  const segmentWidth = Math.max(12, Math.floor(rect.width / words.length));
  for (let index = 0; index < words.length; index++) {
    const word = words[index];
    const wordRect: Rect = {
      x: rect.x + index * segmentWidth,
      y: rect.y,
      width: segmentWidth,
      height: rect.height,
    };
    const wordExists = tokens.some(
      (token) =>
        token.text.toLowerCase() === word.toLowerCase() &&
        token.rect?.x === wordRect.x &&
        token.rect?.y === wordRect.y,
    );
    if (!wordExists) {
      tokens.push({ text: word, rect: wordRect, confidence: Math.min(confidence, 0.66) });
    }
  }
}

export class Alt1LiveFrameProvider implements FrameProvider {
  private lastFrame: RawFrame | null = null;
  private lastCapturedAtMs = 0;

  constructor() {
    primeImageAnchorCache();
  }

  captureFrame(): RawFrame {
    const timestampMs = Date.now();
    if (this.lastFrame && timestampMs - this.lastCapturedAtMs < MIN_CAPTURE_INTERVAL_MS) {
      return {
        ...this.lastFrame,
        timestampMs,
      };
    }
    if (!a1lib.hasAlt1 || !window.alt1?.rsLinked) {
      return { tokens: [], timestampMs };
    }
    const width = window.alt1.rsWidth || 0;
    const height = window.alt1.rsHeight || 0;
    if (width <= 0 || height <= 0) {
      return { tokens: [], timestampMs };
    }

    const imgRef = a1lib.captureHoldFullRs();
    const tokens: OcrToken[] = [];
    fallbackBoundReadTokens(tokens, imgRef, width, height);

    const frame: RawFrame = {
      tokens,
      bindHandle: imgRef.handle,
      width,
      height,
      timestampMs,
    };
    this.lastFrame = frame;
    this.lastCapturedAtMs = timestampMs;
    return frame;
  }
}

