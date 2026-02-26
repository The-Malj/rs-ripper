import { Rect } from "../types.js";

export type AnchorFallback = {
  name: string;
  terms: string[];
};

export type FinderResult = {
  rect: Rect;
  confidence: number;
  anchorName: string;
};

