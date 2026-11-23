import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const root = fileURLToPath(new URL('../', import.meta.url));
const html = readFileSync(join(root, 'index.html'), 'utf8');
const js = readFileSync(join(root, 'src/main.js'), 'utf8');
const css = readFileSync(join(root, 'src/style.css'), 'utf8');
const readme = readFileSync(join(root, 'README.md'), 'utf8');
const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
const refs = new Set([...js.matchAll(/querySelector\('#([^']+)'\)/g)].map((m) => m[1]));
const missing = [...refs].filter((id) => !ids.has(id));
assert.deepEqual(missing, [], `Missing HTML IDs: ${missing.join(', ')}`);
assert.match(html, /type="importmap"/, 'Three.js import map must exist');
assert.match(html, /id="game-canvas"/, 'Game canvas must exist');
assert.match(js, /function shoot\(/, 'Shooting loop must exist');
assert.match(js, /function startReload\(/, 'Reload logic must exist');
assert.match(js, /function updateEnemies\(/, 'Enemy AI update must exist');
assert.match(js, /function finishGame\(/, 'Mission result logic must exist');
assert.match(css, /\.touch-controls/, 'Touch controls styling must exist');
assert.match(html, /id="damage-direction"/, 'Directional damage indicator must exist');
assert.match(css, /\.damage-direction/, 'Directional damage indicator styling must exist');
for (const control of ['W / A / S / D', '鼠标左键', '鼠标右键', 'R', '1 / 2 / 3']) {
  assert.ok(readme.includes(control), `README missing control description: ${control}`);
}
const requiredFiles = ['index.html', 'src/main.js', 'src/style.css', 'README.md', 'TASKS.md', 'docs/ENGINEERING_SPEC.md', 'docs/VALIDATION_LOG.md', 'src/combat-rules.mjs', 'src/combat-feedback.mjs'];
for (const file of requiredFiles) assert.ok(statSync(join(root, file)).isFile(), `Missing required file: ${file}`);
console.log(`PASS: ${ids.size} HTML IDs; ${refs.size} JS selector references; all required project files present.`);
