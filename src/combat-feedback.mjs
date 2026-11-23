const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function getDamageDirection(playerPosition, sourcePosition, yaw = 0) {
  if (!playerPosition || !sourcePosition) return 'front';
  const dx = sourcePosition.x - playerPosition.x;
  const dz = sourcePosition.z - playerPosition.z;
  const forwardX = -Math.sin(yaw);
  const forwardZ = -Math.cos(yaw);
  const rightX = Math.cos(yaw);
  const rightZ = -Math.sin(yaw);
  const forwardDot = dx * forwardX + dz * forwardZ;
  const rightDot = dx * rightX + dz * rightZ;
  if (Math.abs(forwardDot) >= Math.abs(rightDot)) return forwardDot >= 0 ? 'front' : 'back';
  return rightDot >= 0 ? 'right' : 'left';
}

export function getImpactIntensity(damage, referenceHealth = 100) {
  const safeDamage = Number.isFinite(damage) ? Math.max(0, damage) : 0;
  const safeHealth = Number.isFinite(referenceHealth) ? Math.max(1, referenceHealth) : 100;
  return clamp(safeDamage / safeHealth, 0, 1);
}
