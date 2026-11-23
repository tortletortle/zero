import test from 'node:test';
import assert from 'node:assert/strict';
import { getDamageDirection, getImpactIntensity } from '../src/combat-feedback.mjs';

test('damage direction identifies front, rear, left, and right at zero yaw', () => {
  const player = { x: 0, z: 0 };
  assert.equal(getDamageDirection(player, { x: 0, z: -5 }, 0), 'front');
  assert.equal(getDamageDirection(player, { x: 0, z: 5 }, 0), 'back');
  assert.equal(getDamageDirection(player, { x: -5, z: 0 }, 0), 'left');
  assert.equal(getDamageDirection(player, { x: 5, z: 0 }, 0), 'right');
});

test('damage direction rotates with the player view', () => {
  const player = { x: 0, z: 0 };
  assert.equal(getDamageDirection(player, { x: -5, z: 0 }, Math.PI / 2), 'front');
  assert.equal(getDamageDirection(player, { x: 0, z: -5 }, Math.PI / 2), 'right');
});

test('impact intensity is normalized and clamped', () => {
  assert.equal(getImpactIntensity(25, 100), 0.25);
  assert.equal(getImpactIntensity(150, 100), 1);
  assert.equal(getImpactIntensity(-10, 100), 0);
});

test('invalid damage values cannot create NaN feedback', () => {
  assert.equal(getImpactIntensity(Number.NaN, 100), 0);
  assert.equal(getImpactIntensity(10, 0), 1);
});
