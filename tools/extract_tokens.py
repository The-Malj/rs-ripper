from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import pytesseract
from PIL import Image


def configure_tesseract_cmd() -> None:
    env_path = os.environ.get("TESSERACT_CMD", "").strip()
    candidates = [
        env_path,
        "C:/Program Files/Tesseract-OCR/tesseract.exe",
        "C:/Program Files (x86)/Tesseract-OCR/tesseract.exe",
    ]
    for candidate in candidates:
        if candidate and Path(candidate).exists():
            pytesseract.pytesseract.tesseract_cmd = candidate
            return


def extract_tokens(image_path: Path) -> list[dict]:
    img = Image.open(image_path)
    data = pytesseract.image_to_data(img, output_type=pytesseract.Output.DICT)
    tokens: list[dict] = []
    total = len(data.get("text", []))
    for i in range(total):
        text = (data["text"][i] or "").strip()
        if not text:
            continue
        try:
            conf = float(data["conf"][i])
        except (TypeError, ValueError):
            conf = -1.0
        left = int(data["left"][i])
        top = int(data["top"][i])
        width = int(data["width"][i])
        height = int(data["height"][i])
        tokens.append(
            {
                "text": text,
                "confidence": conf if conf >= 0 else None,
                "rect": {
                    "x": left,
                    "y": top,
                    "width": width,
                    "height": height,
                },
            }
        )
    return tokens


def main() -> int:
    if len(sys.argv) != 2:
        print("Usage: python extract_tokens.py <image_path>", file=sys.stderr)
        return 2
    image_path = Path(sys.argv[1])
    if not image_path.exists():
        print(f"Image not found: {image_path}", file=sys.stderr)
        return 1

    configure_tesseract_cmd()
    tokens = extract_tokens(image_path)
    payload = {"tokens": tokens}
    print(json.dumps(payload))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

