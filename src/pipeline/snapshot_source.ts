import { CategorySchema, FrameSnapshot, RawFrame } from "../types.js";

export interface SnapshotSource {
  buildSnapshot(frame: RawFrame, schema: CategorySchema): FrameSnapshot;
}

