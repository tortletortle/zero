const finiteNonNegative = (value) => Number.isFinite(value) ? Math.max(0, value) : 0;

export function scoreCoverPosition({
  travelDistance,
  threatDistance,
  blocksLineOfSight,
  nearbyAllies = 0,
  occupied = false,
} = {}) {
  if (occupied) return Infinity;
  const travel = finiteNonNegative(travelDistance);
  const threat = finiteNonNegative(threatDistance);
  const allies = Math.floor(finiteNonNegative(nearbyAllies));
  const exposurePenalty = blocksLineOfSight ? -10 : 16;
  const proximityPenalty = Math.max(0, 5.5 - threat) * 3.5;
  return travel + exposurePenalty + proximityPenalty + allies * 3.5;
}

export function chooseTacticalIntent({
  health = 100,
  distance = 100,
  hasCover = false,
  role = 'assault',
} = {}) {
  const hp = finiteNonNegative(health);
  const range = finiteNonNegative(distance);
  if (hp < 48 && hasCover) return 'retreat';
  if (role === 'support' && range < 18 && range > 4.5) return 'support';
  if (range > 10.5) return 'advance';
  if (range > 4.5) return 'engage';
  return 'hold';
}

export function getFlankApproach(direction, sideSign = 1, strength = 0.4) {
  const dx = Number.isFinite(direction?.x) ? direction.x : 0;
  const dz = Number.isFinite(direction?.z) ? direction.z : -1;
  const length = Math.hypot(dx, dz) || 1;
  const forwardX = dx / length;
  const forwardZ = dz / length;
  const sign = sideSign < 0 ? -1 : 1;
  const flankStrength = Math.min(1, Math.max(0, Number.isFinite(strength) ? strength : 0.4));
  const x = forwardX - forwardZ * sign * flankStrength;
  const z = forwardZ + forwardX * sign * flankStrength;
  const resultLength = Math.hypot(x, z) || 1;
  return { x: x / resultLength, z: z / resultLength };
}
