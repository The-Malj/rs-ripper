import { FrameSnapshot } from "../types.js";

export function normalizedTokenTexts(snapshot: FrameSnapshot): string[] {
  return snapshot.tokens
    .map((token) => normalizeToken(token.text))
    .filter((value) => value.length > 0);
}

export function normalizeToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function hasTokenContaining(tokens: string[], needle: string): boolean {
  const normalizedNeedle = normalizeToken(needle);
  return tokens.some((token) => token.includes(normalizedNeedle));
}

export function countTokensContaining(tokens: string[], needle: string): number {
  const normalizedNeedle = normalizeToken(needle);
  return tokens.filter((token) => token.includes(normalizedNeedle)).length;
}

