export function applyDamage(currentHealth, damage) {
  const health = Number.isFinite(currentHealth) ? currentHealth : 0;
  const amount = Number.isFinite(damage) ? Math.max(0, damage) : 0;
  return Math.max(0, health - amount);
}

export function transferReloadAmmo(currentAmmo, reserveAmmo, magazineSize) {
  const current = Math.max(0, Number.isFinite(currentAmmo) ? currentAmmo : 0);
  const reserve = Math.max(0, Number.isFinite(reserveAmmo) ? reserveAmmo : 0);
  const capacity = Math.max(0, Number.isFinite(magazineSize) ? magazineSize : 0);
  const moved = Math.min(Math.max(0, capacity - current), reserve);
  return { ammo: current + moved, reserve: reserve - moved, moved };
}

export function calculateShotDamage(baseDamage, isHeadshot = false) {
  const base = Number.isFinite(baseDamage) ? Math.max(0, baseDamage) : 0;
  return base * (isHeadshot ? 1.55 : 1);
}

export function getMissionOutcome(kills, totalEnemies, health) {
  if (health <= 0) return 'lost';
  if (kills >= totalEnemies) return 'won';
  return 'playing';
}
