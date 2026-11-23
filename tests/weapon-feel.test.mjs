import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateWeaponPose } from '../src/weapon-feel.mjs';

test('hip-fire pose uses the default weapon position and field of view', () => {
  const pose = calculateWeaponPose();
  assert.equal(pose.x, 0.38);
  assert.equal(pose.y, -0.31);
  assert.equal(pose.z, -0.64);
  assert.equal(pose.fov, 76);
});

test('aiming centers the weapon and narrows the field of view', () => {
  const rifle = calculateWeaponPose({ aiming: true, weaponIndex: 1 });
  const marksman = calculateWeaponPose({ aiming: true, weaponIndex: 2 });
  assert.equal(rifle.x, 0.02);
  assert.equal(rifle.fov, 58);
  assert.equal(marksman.fov, 42);
});

test('movement adds deterministic sway without changing the base field of view', () => {
  const still = calculateWeaponPose({ time: 0.4, moving: false });
  const moving = calculateWeaponPose({ time: 0.4, moving: true });
  assert.notEqual(moving.x, still.x);
  assert.equal(moving.fov, still.fov);
});

test('reload animation reaches its deepest pose halfway through the reload', () => {
  const start = calculateWeaponPose({ reloading: true, reloadProgress: 0, weaponIndex: 1 });
  const middle = calculateWeaponPose({ reloading: true, reloadProgress: 0.5, weaponIndex: 1 });
  const end = calculateWeaponPose({ reloading: true, reloadProgress: 1, weaponIndex: 1 });
  assert.ok(middle.y < start.y);
  assert.ok(middle.rotationX > start.rotationX);
  assert.ok(Math.abs(end.y - start.y) < 1e-12);
});

test('reload motion is weapon-specific and progress is clamped', () => {
  const pistol = calculateWeaponPose({ reloading: true, reloadProgress: 0.5, weaponIndex: 0 });
  const rifle = calculateWeaponPose({ reloading: true, reloadProgress: 0.5, weaponIndex: 1 });
  const invalid = calculateWeaponPose({ reloading: true, reloadProgress: 4, weaponIndex: 99 });
  assert.notEqual(pistol.rotationZ, rifle.rotationZ);
  assert.equal(invalid.fov, 76);
  assert.ok(Number.isFinite(invalid.y));
});
