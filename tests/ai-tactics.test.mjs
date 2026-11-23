import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseTacticalIntent, getFlankApproach, scoreCoverPosition } from '../src/ai-tactics.mjs';

test('cover scoring prefers blocked sight lines over exposed positions', () => {
  const protectedScore = scoreCoverPosition({ travelDistance: 4, threatDistance: 8, blocksLineOfSight: true });
  const exposedScore = scoreCoverPosition({ travelDistance: 4, threatDistance: 8, blocksLineOfSight: false });
  assert.ok(protectedScore < exposedScore);
});

test('occupied cover positions are rejected', () => {
  assert.equal(scoreCoverPosition({ travelDistance: 1, threatDistance: 10, blocksLineOfSight: true, occupied: true }), Infinity);
});

test('low-health actors retreat only when a cover target exists', () => {
  assert.equal(chooseTacticalIntent({ health: 30, distance: 12, hasCover: true }), 'retreat');
  assert.equal(chooseTacticalIntent({ health: 30, distance: 12, hasCover: false }), 'advance');
});

test('support actors hold a useful firing distance', () => {
  assert.equal(chooseTacticalIntent({ health: 100, distance: 14, role: 'support' }), 'support');
  assert.equal(chooseTacticalIntent({ health: 100, distance: 22, role: 'support' }), 'advance');
});

test('assault intent transitions across approach, engagement, and hold ranges', () => {
  assert.equal(chooseTacticalIntent({ distance: 16 }), 'advance');
  assert.equal(chooseTacticalIntent({ distance: 8 }), 'engage');
  assert.equal(chooseTacticalIntent({ distance: 3 }), 'hold');
});

test('flank approach vectors remain normalized and reverse sides', () => {
  const left = getFlankApproach({ x: 0, z: -1 }, -1, 0.5);
  const right = getFlankApproach({ x: 0, z: -1 }, 1, 0.5);
  assert.ok(Math.abs(Math.hypot(left.x, left.z) - 1) < 1e-12);
  assert.ok(Math.abs(Math.hypot(right.x, right.z) - 1) < 1e-12);
  assert.notEqual(left.x, right.x);
});
