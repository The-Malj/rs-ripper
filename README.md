# RS Ripper V2

An [Alt1](https://alt1.eu/) plugin for RuneScape that detects achievement state and guides you through scanning the Achievements interface. It captures the in-game UI, parses visible achievement rows, and tracks completion status across multiple profiles with CSV export.

## Features

- **Guided workflow** — Step-by-step instructions to navigate to the Achievements tab and configure display preferences (Show locked, Show completed, List mode)
- **Live capture** — Uses Alt1 APIs for real-time screen capture; no Tesseract in the active runtime path
- **Achievement parsing** — OCR-based recognition of visible achievement titles with fuzzy matching and manual verification for unknowns
- **Profile management** — Multiple named profiles, CSV import/export, completion tracking
- **All nine categories** — Skills, Exploration, Area Tasks, Combat, Lore, Activities, Completionist, Feats
- **Dev sampler** — Built-in tool for capturing and validating anchor images during development

## Prerequisites

- **Node.js** 20+ (see [.nvmrc](.nvmrc))
- **Alt1** — [Install Alt1](https://alt1.eu/) to run the plugin in RuneScape
- **RuneScape** — Client must be capturable by Alt1 (typically via the Alt1 overlay)

## Getting started

```bash
git clone https://github.com/The-Malj/rs-ripper.git
cd rs-ripper
npm install
npm run build
```

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

Build output is written to `dist/` and includes `appconfig.json` from `public/`.

## Installing the plugin (Alt1)

### Local development

1. Run `npm run serve:alt1`.
2. Open this URL on the same machine:
   ```
   alt1://addapp/http://127.0.0.1:4173/appconfig.json
   ```

### Hosted / public

Host the `dist/` folder at your URL root, then install with:

```
alt1://addapp/https://YOUR_HOST/appconfig.json
```

## Validation

```bash
npm run typecheck
npm run validate:fixtures
npm run validate:perf
npm run release:check
```

## Project structure

| Path | Description |
|------|-------------|
| `src/` | TypeScript source — live plugin UI, detection, OCR, profile logic |
| `src/live/` | Main plugin app, category cards, parse verification UI |
| `src/detect/` | UI element detection (options menu, hero window, achievements tab) |
| `src/finders/` | Image anchor finders for bootstrap and category detection |
| `src/profile/` | Profile storage, CSV export/import, validation |
| `data/` | Achievement data, category schema, anchor images |
| `public/` | Alt1 appconfig, icon |
| `tests/` | Fixtures, perf budget, reference UI validation |

## Tech stack

- **Vite** — Build and dev server
- **TypeScript** — Type-safe source
- **Alt1** — Game capture and overlay APIs
- **Tesseract.js** — Fallback OCR (dev/sampler only; not in live runtime)

## License

Private. See repository for details.
