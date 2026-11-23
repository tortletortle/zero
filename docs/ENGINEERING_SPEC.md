# Engineering Specification — FRONTLINE ZERO

## Product goal

Deliver a browser-playable, first-person single-player tactical shooter prototype with readable combat feedback, responsive controls, and a compact urban encounter. The project must remain independently runnable and testable.

## Platform and technology

- Rendering: Three.js WebGL renderer, pinned CDN version `0.170.0`.
- Runtime: native browser ES modules; no bundler required for V0.1.
- Local server: Python standard-library HTTP server.
- Input: Pointer Lock + keyboard/mouse on desktop; Pointer Events on touch devices, including a weapon-cycle control.
- Assets: procedural geometry/materials and Web Audio synthesis in V0.1.

## Architecture

- `index.html`: application shell, import map, HUD and overlay DOM.
- `src/style.css`: menu, HUD, responsive layout, touch controls.
- `src/main.js`: renderer, world construction, player controller, weapons, enemy actors/AI, combat, UI state, audio, and main loop.
- `src/weapon-feel.mjs`: deterministic first-person weapon pose calculation for aim, movement sway, sprint bob, recoil, and reload motion.
- `src/ai-tactics.mjs`: deterministic enemy tactical intent, cover-position scoring, and flanking-vector helpers.
- `src/combat-feedback.mjs`: normalized hit direction and impact intensity helpers for the damage HUD.
- `docs/`: engineering and validation records.

V0.1 intentionally keeps the prototype in a single gameplay module to reduce setup friction. Before adding multiple maps, save systems, or multiplayer, split systems into dedicated modules with explicit interfaces.

## Gameplay loop

1. Start mission and initialize player/weapon state.
2. Enter the urban block with 8 hostile actors.
3. Move between cover, select weapons, aim, fire, and reload.
4. Enemies advance, strafe, attack when line of sight is available, and retreat toward a cover point when damaged.
5. Win when all hostile actors are eliminated; lose when player health reaches zero.

## Core invariants

- Player and enemies must not pass through registered solid collision boxes.
- Hitscan must respect world occluders; a target behind a solid wall must not receive damage.
- Ammo must never become negative; reload transfers only available reserve ammo.
- Dead enemies cannot shoot or receive additional damage.
- Game state must transition only once from `playing` to `won` or `lost`.
- All user-facing controls must have matching input handling and documentation.

## Acceptance gates

### Static / source checks
- JavaScript syntax parses.
- Required HTML IDs referenced by the gameplay module exist.
- No accidental debug logging or broken local asset paths.

### Automated behavior checks
- Add deterministic tests for ammo, reload, damage, mission transitions, collision, and line-of-sight before V0.2.

### Browser / GPU checks
- Launch over HTTP in Chromium.
- Verify WebGL context, no console errors, pointer lock, rendering, resize, and 10-minute play session.
- Record browser version, OS, viewport, GPU, average FPS, 1% low FPS, and any context loss.

### Real-device checks
- Verify Android touch movement, look, aim, fire, reload, safe-area layout, and thermal/performance behavior.
- Do not mark mobile acceptance complete from desktop emulation alone.

## Known limitations

- V0.1 geometry is a prototype art pass, not final production art.
- Enemy navigation is local steering, not full pathfinding or squad tactics.
- Enemy aim/damage is probabilistic and needs playtest balancing.
- Mobile controls are functional scaffolding but need physical-device validation.
- CDN loading requires an internet connection.
