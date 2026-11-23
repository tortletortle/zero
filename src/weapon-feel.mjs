const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/**
 * Calculate a deterministic first-person weapon pose.
 * Inputs are normalized gameplay state; output is suitable for frame interpolation.
 */
export function calculateWeaponPose({
  time = 0,
  aiming = false,
  sprinting = false,
  moving = false,
  reloading = false,
  reloadProgress = 0,
  recoil = 0,
  weaponIndex = 1,
} = {}) {
  const weapon = clamp(Math.trunc(weaponIndex), 0, 2);
  const progress = clamp(Number.isFinite(reloadProgress) ? reloadProgress : 0, 0, 1);
  const reloadArc = reloading ? Math.sin(progress * Math.PI) : 0;
  const cadence = sprinting ? 13.5 : 8.5;
  const swayWave = moving ? Math.sin(time * cadence) : 0;
  const bobWave = moving ? Math.abs(Math.cos(time * cadence)) : 0;
  const sway = swayWave * (sprinting ? 0.024 : 0.011);
  const bob = bobWave * (sprinting ? 0.034 : 0.012);
  const recoilKick = clamp(Number.isFinite(recoil) ? recoil : 0, 0, 0.2);
  const reloadDrop = [0.13, 0.17, 0.2][weapon] * reloadArc;
  const reloadTilt = [0.48, 0.38, 0.3][weapon] * reloadArc;
  const reloadRoll = [0.22, 0.14, 0.1][weapon] * reloadArc;

  return {
    x: (aiming ? 0.02 : 0.38) + sway * 0.72,
    y: (aiming ? -0.22 : -0.31) - bob - reloadDrop,
    z: (aiming ? -0.54 : -0.64) + reloadArc * 0.075,
    rotationX: -0.04 + recoilKick * 1.5 + reloadTilt,
    rotationY: (moving ? Math.sin(time * 3.7) * 0.008 : 0) + reloadRoll * 0.18,
    rotationZ: (aiming ? 0 : -0.02) + sway * 0.5 + reloadRoll,
    fov: aiming ? (weapon === 2 ? 42 : 58) : 76,
  };
}
