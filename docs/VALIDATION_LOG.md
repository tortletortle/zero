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


## V0.2 weapon-feel feature branch

Date: 2026-11-23
Branch: `feature/v0.2-weapon-feel`

### Implemented

- Added `src/weapon-feel.mjs` with deterministic weapon-pose calculation.
- Integrated movement sway, sprint bob, recoil response, ADS positioning/FOV, and weapon-specific reload dip/tilt into the first-person weapon viewmodel.
- Added five unit tests covering default pose, ADS, movement sway, reload animation endpoints/midpoint, weapon-specific reload motion, and input clamping.
- Added a GitHub Actions workflow for Node syntax checks and automated tests.

### Local validation

Environment: Node.js v22.16.0; npm 10.9.0.

| Check | Result | Evidence |
|---|---|---|
| `npm run check` | Pass | Exit code 0; main gameplay module and both pure logic modules parse |
| `npm test` | Pass | 9 tests passed, 0 failed; combat rules + weapon pose + static HTML/JS checks |
| Remote feature-branch source syntax | Pass | Main module and weapon-pose module parsed in the connector runtime after stripping module import/export declarations |
| Chromium/WebGL render | Not verified | No valid rendered screenshot or browser console capture |
| Android touch/performance | Not tested | Requires physical Android device |

### Scope boundary

The new weapon animation is a deterministic viewmodel transform, not a skeletal reload animation or production weapon model. No claim is made that the visual quality is final. The feature is isolated on a feature branch and is not yet merged into `develop` or `main`.
