# Validation Log

## V0.1 source baseline

Date: 2026-11-23

### Implemented source

- `index.html`
- `src/main.js`
- `src/combat-rules.mjs`
- `src/style.css`
- `tests/combat-rules.test.mjs`
- `tests/static-validation.mjs`
- `README.md`
- `package.json`
- `run.bat`
- `.gitignore`
- `LICENSE`
- `AGENTS.md`
- `CURSOR_PLAYBOOK.md`
- `TASKS.md`
- `docs/ENGINEERING_SPEC.md`

### Executed checks

| Check | Result | Evidence |
|---|---|---|
| JavaScript syntax | Pass | `node --check src/main.js`; `node --check src/combat-rules.mjs` |
| Combat rules unit tests | Pass | `node --test tests/combat-rules.test.mjs` — damage, reload, headshot multiplier, mission outcome |
| HTML ID/reference consistency | Pass | `node tests/static-validation.mjs` — 32 IDs, 29 JS selector references, no missing IDs |
| Local HTTP response | Pass | Python HTTP server returned 200 for `/`, `/src/main.js`, `/src/style.css` |
| Chromium/WebGL render | Not verified | Container Chromium could not initialize its EGL/GL backend; no valid rendered screenshot was produced |
| Android touch controls | Not tested | Requires a physical Android device |
| Full mission playthrough | Not tested | Requires interactive browser playtest |
| Performance baseline | Not tested | Requires target browser/GPU measurements |

### Evidence policy

A source file existing is not evidence that the corresponding runtime behavior works. Record command, exit code, environment, and result for every validation. Screenshots and measured performance must come from the actual browser/device under test.
