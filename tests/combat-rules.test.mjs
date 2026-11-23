import test from 'node:test';
import assert from 'node:assert/strict';
import { applyDamage, calculateShotDamage, getMissionOutcome, transferReloadAmmo } from '../src/combat-rules.mjs';

test('damage is clamped at zero and ignores negative damage', () => {
  assert.equal(applyDamage(100, 35), 65);
  assert.equal(applyDamage(10, 35), 0);
  assert.equal(applyDamage(10, -5), 10);
});

test('reload transfers only the amount needed and available', () => {
  assert.deepEqual(transferReloadAmmo(4, 20, 12), { ammo: 12, reserve: 12, moved: 8 });
  assert.deepEqual(transferReloadAmmo(4, 3, 12), { ammo: 7, reserve: 0, moved: 3 });
  assert.deepEqual(transferReloadAmmo(12, 20, 12), { ammo: 12, reserve: 20, moved: 0 });
});

test('headshots apply the configured game damage multiplier', () => {
  assert.equal(calculateShotDamage(40, false), 40);
  assert.equal(calculateShotDamage(40, true), 62);
});

test('mission outcome prioritizes player defeat over kill completion', () => {
  assert.equal(getMissionOutcome(7, 8, 100), 'playing');
  assert.equal(getMissionOutcome(8, 8, 1), 'won');
  assert.equal(getMissionOutcome(8, 8, 0), 'lost');
});
