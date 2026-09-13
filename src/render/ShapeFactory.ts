import Phaser from 'phaser';
import { getBossHazardRadius, getBossHazardTelegraphPattern } from '../sim/bossSkills';
import { getGlyphFormation, getGlyphFormationPosition } from '../sim/glyphFormations';
import type { BossHazard, BossType, EnemyProjectile, UpgradeId, UpgradeLevels } from '../sim/types';
import { getAwakenedSkillGlyphs } from './awakeningVisuals';

export function drawEnemyProjectile(
  graphics: Phaser.GameObjects.Graphics,
  projectile: EnemyProjectile,
): void {
  graphics.clear();
  graphics.setDepth(8);
  if (projectile.kind === 'bolt') {
    const angle = Math.atan2(projectile.vy, projectile.vx);
    graphics.lineStyle(9, 0xffd166, 0.18);
    graphics.lineBetween(
      projectile.x - Math.cos(angle) * 14,
      projectile.y - Math.sin(angle) * 14,
      projectile.x + Math.cos(angle) * 8,
      projectile.y + Math.sin(angle) * 8,
    );
    graphics.lineStyle(3, 0xffffff, 1);
    graphics.lineBetween(
      projectile.x - Math.cos(angle) * 9,
      projectile.y - Math.sin(angle) * 9,
      projectile.x,
      projectile.y,
    );
  } else if (projectile.kind === 'fan-seal') {
    graphics.fillStyle(0xff4fa3, 0.28);
    graphics.fillRect(projectile.x - 8, projectile.y - 12, 16, 24);
    graphics.lineStyle(2, 0xffb4dd, 1);
    graphics.strokeRect(projectile.x - 5, projectile.y - 9, 10, 18);
  } else {
    graphics.fillStyle(0x8f67ff, 0.25);
    graphics.fillCircle(projectile.x, projectile.y, 15);
    graphics.fillStyle(0x8ffcff, 1);
    graphics.fillCircle(projectile.x, projectile.y, 7);
    graphics.fillStyle(0xffffff, 1);
    graphics.fillCircle(projectile.x - 2, projectile.y - 2, 2);
  }
}

export function drawActiveBarrier(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  radius: number,
  timeMs: number,
): void {
  graphics.clear();
  if (radius <= 0) return;
  const pulse = Math.sin(timeMs * 0.008) * 4;
  graphics.fillStyle(0xf6d365, 0.08);
  graphics.fillCircle(x, y, radius + pulse);
  graphics.lineStyle(7, 0xf6d365, 0.24);
  graphics.strokeCircle(x, y, radius + pulse);
  graphics.lineStyle(2, 0xffffff, 0.9);
  graphics.strokeCircle(x, y, radius - 6 + pulse);
}

export function drawPlayerStatus(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  hpRatio: number,
  shieldRatio: number,
  frostIntensity = 0,
): void {
  graphics.clear();
  graphics.setDepth(7);
  if (shieldRatio > 0) {
    graphics.lineStyle(3, 0xf6d365, 0.9);
    graphics.strokeCircle(x, y, 35 + shieldRatio * 4);
    graphics.lineStyle(1, 0xffffff, 0.72);
    graphics.strokeCircle(x, y, 29 + shieldRatio * 4);
  }
  if (frostIntensity > 0) {
    const radius = 30 + frostIntensity * 26;
    graphics.lineStyle(2, 0x8ffcff, 0.7);
    graphics.strokeCircle(x, y, radius);
    for (let index = 0; index < 6; index += 1) {
      const angle = index * Math.PI / 3;
      graphics.lineBetween(x + Math.cos(angle) * (radius - 6), y + Math.sin(angle) * (radius - 6), x + Math.cos(angle) * (radius + 7), y + Math.sin(angle) * (radius + 7));
    }
  }
  graphics.fillStyle(0x080912, 0.85);
  graphics.fillRect(x - 24, y + 35, 48, 5);
  graphics.fillStyle(0x7dff9c, 1);
  graphics.fillRect(x - 23, y + 36, 46 * Math.max(0, hpRatio), 3);
}

export function drawEnemyHealth(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  hpRatio: number,
  boss: boolean,
): void {
  graphics.clear();
  graphics.setDepth(7);
  const width = boss ? 76 : 38;
  const offset = boss ? 54 : 36;
  graphics.fillStyle(0x080912, 0.9);
  graphics.fillRect(x - width / 2, y - offset, width, 5);
  graphics.fillStyle(boss ? 0xff3864 : 0xf6d365, 1);
  graphics.fillRect(x - width / 2 + 1, y - offset + 1, (width - 2) * Math.max(0, hpRatio), 3);
}

export function createEntityGraphic(scene: Phaser.Scene): Phaser.GameObjects.Graphics {
  return scene.add.graphics().setDepth(5);
}

export function drawPlayer(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  hpRatio: number,
  shieldRatio: number,
  timeMs: number,
): void {
  graphics.clear();
  const pulse = Math.sin(timeMs * 0.004) * 2;
  graphics.lineStyle(8, 0x61f5ff, 0.09);
  graphics.strokeCircle(x, y, 36 + pulse);
  graphics.lineStyle(2, 0x61f5ff, 0.7);
  graphics.strokeCircle(x, y, 32 + pulse);
  graphics.lineStyle(2, 0xf6d365, 0.88);
  graphics.strokeCircle(x, y, 39 - pulse * 0.5);

  graphics.fillStyle(0x101b24, 1);
  graphics.beginPath();
  graphics.moveTo(x - 20, y + 25);
  graphics.lineTo(x - 13, y - 8);
  graphics.lineTo(x, y - 16);
  graphics.lineTo(x + 13, y - 8);
  graphics.lineTo(x + 20, y + 25);
  graphics.closePath();
  graphics.fillPath();
  graphics.lineStyle(4, 0x61f5ff, 1);
  graphics.strokePath();

  graphics.lineStyle(5, 0xf4f9f2, 0.95);
  graphics.lineBetween(x - 12, y - 3, x - 29, y + 13);
  graphics.lineBetween(x + 12, y - 3, x + 29, y + 13);
  graphics.fillStyle(0xf2fbf6, 1);
  graphics.fillCircle(x, y - 25, 11);
  graphics.lineStyle(3, 0x61f5ff, 0.9);
  graphics.strokeCircle(x, y - 25, 12);
  graphics.fillStyle(0xf6d365, 1);
  graphics.fillRect(x - 4, y - 10, 8, 26);
  graphics.lineStyle(1, 0x080912, 0.9);
  graphics.strokeRect(x - 4, y - 10, 8, 26);

  if (shieldRatio > 0) {
    graphics.lineStyle(5, 0x8ffcff, 0.16 + shieldRatio * 0.3);
    graphics.strokeCircle(x, y, 46 + pulse);
  }

  graphics.fillStyle(hpRatio > 0.35 ? 0x6efc9c : 0xff5d6c, 1);
  graphics.fillRect(x - 22, y + 35, 44 * hpRatio, 4);
  graphics.lineStyle(1, 0xeafff0, 0.65);
  graphics.strokeRect(x - 22, y + 35, 44, 4);
}

export function drawEnemy(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  hpRatio: number,
  kind: 'normal' | 'boss' = 'normal',
  timeMs = 0,
  bossWave = 0,
  bossType: BossType = 'crimson',
  bossPhase: import('../sim/types').BossPhase = 1,
): void {
  graphics.clear();
  if (kind === 'boss') {
    drawBoss(graphics, x, y, hpRatio, timeMs, bossWave, bossType, bossPhase);
    return;
  }
  graphics.fillStyle(0x080912, 0.9);
  graphics.fillCircle(x, y, 22);
  graphics.fillStyle(0xff3864, 0.92);
  graphics.fillCircle(x, y, 16);
  graphics.lineStyle(2, 0xffb86b, 0.7);
  graphics.strokeCircle(x, y, 20);
  graphics.fillStyle(0x080912, 0.85);
  graphics.fillCircle(x - 5, y - 3, 3);
  graphics.fillCircle(x + 5, y - 3, 3);
  graphics.fillStyle(0xffe66d, 0.9);
  graphics.fillRect(x - 13, y + 20, 26 * hpRatio, 3);
}

function drawBoss(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  hpRatio: number,
  timeMs: number,
  bossWave: number,
  bossType: BossType,
  bossPhase: import('../sim/types').BossPhase,
): void {
  const pulse = Math.sin(timeMs * 0.005) * 3;
  const mainColor = bossType === 'thunder' ? 0x168ca5 : bossType === 'blood-moon' ? 0x8b205d : 0x6e102a;
  const accentColor = bossType === 'thunder' ? 0x61f5ff : bossType === 'blood-moon' ? 0xff70bd : 0xff3864;
  graphics.fillStyle(0x06080d, 0.96);
  graphics.fillCircle(x, y, 52 + pulse);
  graphics.lineStyle(10, accentColor, 0.14);
  graphics.strokeCircle(x, y, 48 + pulse);
  graphics.fillStyle(mainColor, 1);
  graphics.fillCircle(x, y, 38);
  graphics.lineStyle(5, 0xf6d365, 0.92);
  graphics.strokeCircle(x, y, 43);
  graphics.lineStyle(2, accentColor, 0.95);
  graphics.strokeCircle(x, y, 33);

  const rotation = timeMs * 0.0012;
  for (let index = 0; index < 4; index += 1) {
    const angle = rotation + index * (Math.PI / 2);
    const px = x + Math.cos(angle) * 58;
    const py = y + Math.sin(angle) * 58;
    graphics.fillStyle(0xf6d365, 1);
    graphics.fillRect(px - 5, py - 11, 10, 22);
    graphics.lineStyle(1, 0xffffff, 0.75);
    graphics.strokeRect(px - 5, py - 11, 10, 22);
  }

  graphics.fillStyle(0x080912, 0.95);
  graphics.fillCircle(x - 12, y - 7, 6);
  graphics.fillCircle(x + 12, y - 7, 6);
  graphics.fillStyle(0xffffff, 0.9);
  graphics.fillCircle(x - 10, y - 8, 2);
  graphics.fillCircle(x + 14, y - 8, 2);
  graphics.lineStyle(3, 0xf6d365, 0.9);
  graphics.lineBetween(x - 16, y + 16, x + 16, y + 16);

  graphics.fillStyle(0x080912, 0.92);
  graphics.fillRect(x - 48, y + 66, 96, 8);
  graphics.fillStyle(0xff3864, 1);
  graphics.fillRect(x - 46, y + 68, 92 * Math.max(0, hpRatio), 4);
  graphics.lineStyle(1, 0xf6d365, 0.7);
  graphics.strokeRect(x - 48, y + 66, 96, 8);

  const marks = Math.min(6, Math.max(1, bossWave));
  graphics.fillStyle(0xf6d365, 0.8);
  for (let index = 0; index < marks; index += 1) {
    graphics.fillRect(x - (marks * 4) + index * 8, y + 79, 4, 3);
  }
  if (bossPhase === 2) {
    graphics.lineStyle(4, accentColor, 0.75);
    graphics.strokeCircle(x, y, 58 + pulse);
  }
  if (bossPhase === 3) {
    graphics.fillStyle(accentColor, 0.15);
    graphics.fillCircle(x, y, 64 + pulse);
    graphics.lineStyle(8, accentColor, 0.28);
    graphics.strokeCircle(x, y, 66 + pulse);
    graphics.lineStyle(2, 0xffffff, 0.86);
    for (let index = 0; index < 6; index += 1) {
      const angle = timeMs * 0.004 + index * Math.PI / 3;
      graphics.lineBetween(x, y, x + Math.cos(angle) * 74, y + Math.sin(angle) * 74);
    }
  }
}

export function drawBossHazard(
  graphics: Phaser.GameObjects.Graphics,
  hazard: BossHazard,
  timeMs: number,
): void {
  graphics.clear();
  const color = hazard.bossType === 'thunder'
    ? 0x61f5ff
    : hazard.bossType === 'blood-moon'
      ? 0xff4fa3
      : 0xff3864;
  const telegraph = hazard.telegraphRemainingMs > 0;
  const pulse = 0.55 + Math.sin(timeMs * 0.012 + hazard.id) * 0.18;
  const alpha = telegraph ? pulse : 0.88;
  const fillAlpha = telegraph ? 0.08 : 0.22;
  const pattern = getBossHazardTelegraphPattern(hazard);

  if (hazard.kind === 'circle') {
    graphics.fillStyle(color, fillAlpha);
    graphics.fillCircle(hazard.x, hazard.y, hazard.radius);
    graphics.lineStyle(telegraph ? 3 : 7, color, alpha);
    graphics.strokeCircle(hazard.x, hazard.y, hazard.radius);
    if (telegraph) drawBossTelegraphPattern(graphics, hazard, pattern, timeMs, alpha);
    return;
  }

  if (hazard.kind === 'ring') {
    const radius = telegraph ? hazard.startRadius : getBossHazardRadius(hazard);
    graphics.lineStyle(Math.max(3, hazard.bandWidth), color, telegraph ? alpha * 0.45 : alpha);
    graphics.strokeCircle(hazard.x, hazard.y, Math.max(1, radius));
    graphics.lineStyle(2, 0xffffff, telegraph ? alpha : 0.7);
    graphics.strokeCircle(hazard.x, hazard.y, Math.max(1, radius));
    if (telegraph) drawBossTelegraphPattern(graphics, hazard, pattern, timeMs, alpha);
    return;
  }

  graphics.lineStyle(hazard.lineWidth, color, fillAlpha);
  graphics.lineBetween(hazard.x, hazard.y, hazard.endX, hazard.endY);
  graphics.lineStyle(telegraph ? 3 : 8, telegraph ? 0xffffff : color, alpha);
  graphics.lineBetween(hazard.x, hazard.y, hazard.endX, hazard.endY);
  if (telegraph) drawBossTelegraphPattern(graphics, hazard, pattern, timeMs, alpha);
}

function drawBossTelegraphPattern(
  graphics: Phaser.GameObjects.Graphics,
  hazard: BossHazard,
  pattern: import('../sim/bossSkills').BossTelegraphPattern,
  timeMs: number,
  alpha: number,
): void {
  if (pattern === 'thunder-mark') {
    if (hazard.kind === 'circle') {
      const radius = hazard.radius * 0.55;
      graphics.lineStyle(3, 0xffffff, alpha * 0.84);
      graphics.lineBetween(hazard.x - radius, hazard.y - radius, hazard.x + radius, hazard.y + radius);
      graphics.lineBetween(hazard.x + radius, hazard.y - radius, hazard.x - radius, hazard.y + radius);
      graphics.lineStyle(2, 0x61f5ff, alpha * 0.75);
      graphics.strokeCircle(hazard.x, hazard.y, radius * 0.48);
      return;
    }
    const dx = hazard.endX - hazard.x;
    const dy = hazard.endY - hazard.y;
    const length = Math.max(1, Math.hypot(dx, dy));
    const px = -dy / length;
    const py = dx / length;
    for (const ratio of [0.2, 0.5, 0.8]) {
      const x = hazard.x + dx * ratio;
      const y = hazard.y + dy * ratio;
      graphics.lineStyle(3, 0x61f5ff, alpha * 0.86);
      graphics.lineBetween(x - px * 16, y - py * 16, x + px * 16, y + py * 16);
    }
    return;
  }

  const radius = hazard.kind === 'ring'
    ? hazard.startRadius
    : hazard.kind === 'circle'
      ? hazard.radius
      : 0;
  if (pattern === 'blood-seal' && radius > 0) {
    graphics.lineStyle(2, 0xffd1e5, alpha * 0.84);
    graphics.strokeCircle(hazard.x, hazard.y, radius * 0.62);
    graphics.strokeCircle(hazard.x, hazard.y, radius * 0.34);
    for (let index = 0; index < 6; index += 1) {
      const angle = index * Math.PI / 3 + timeMs * 0.001;
      graphics.lineStyle(2, 0xff4fa3, alpha * 0.84);
      graphics.lineBetween(
        hazard.x + Math.cos(angle) * radius * 0.34,
        hazard.y + Math.sin(angle) * radius * 0.34,
        hazard.x + Math.cos(angle) * radius * 0.62,
        hazard.y + Math.sin(angle) * radius * 0.62,
      );
    }
    return;
  }

  const dx = hazard.endX - hazard.x;
  const dy = hazard.endY - hazard.y;
  const length = Math.max(1, Math.hypot(dx, dy));
  const px = -dy / length;
  const py = dx / length;
  for (const ratio of [0.14, 0.36, 0.58, 0.8]) {
    const x = hazard.x + dx * ratio;
    const y = hazard.y + dy * ratio;
    const slash = 16 + Math.sin(timeMs * 0.009 + ratio * 8) * 4;
    graphics.lineStyle(4, 0xff8a3d, alpha * 0.9);
    graphics.lineBetween(x - px * slash, y - py * slash, x + px * slash, y + py * slash);
  }
}

export function drawProjectile(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  vx: number,
  vy: number,
  kind?: import('../sim/types').Projectile['kind'],
): void {
  graphics.clear();
  const length = Math.max(1, Math.hypot(vx, vy));
  const dx = vx / length;
  const dy = vy / length;
  if (kind === 'glyph') {
    graphics.lineStyle(8, 0x61f5ff, 0.12);
    graphics.lineBetween(x - dx * 18, y - dy * 18, x + dx * 7, y + dy * 7);
    graphics.fillStyle(0xf6d365, 0.95);
    graphics.fillTriangle(x + dx * 8, y + dy * 8, x - dy * 6, y + dx * 6, x + dy * 6, y - dx * 6);
    graphics.lineStyle(2, 0xffffff, 0.82);
    graphics.strokeRect(x - 4, y - 4, 8, 8);
    return;
  }
  graphics.lineStyle(12, 0x61f5ff, 0.12);
  graphics.lineBetween(x - dx * 30, y - dy * 30, x + dx * 8, y + dy * 8);
  graphics.lineStyle(5, 0x61f5ff, 0.65);
  graphics.lineBetween(x - dx * 24, y - dy * 24, x + dx * 10, y + dy * 10);
  graphics.lineStyle(2, 0xffffff, 1);
  graphics.lineBetween(x - dx * 12, y - dy * 12, x + dx * 14, y + dy * 14);
  graphics.fillStyle(0xffffff, 1);
  graphics.fillCircle(x + dx * 14, y + dy * 14, 4);
  graphics.fillStyle(0xf6d365, 1);
  graphics.fillCircle(x - dx * 9, y - dy * 9, 3);
}

export function drawShard(graphics: Phaser.GameObjects.Graphics, x: number, y: number, pulse: number): void {
  graphics.clear();
  graphics.fillStyle(0x7dff8c, 0.95);
  graphics.fillCircle(x, y, 6 + pulse);
  graphics.lineStyle(1, 0xd8ffe0, 0.8);
  graphics.strokeCircle(x, y, 11 + pulse);
}

export function drawChest(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  pulse: number,
): void {
  graphics.clear();
  graphics.lineStyle(12, 0xf6d365, 0.12);
  graphics.strokeCircle(x, y, 34 + pulse);
  graphics.fillStyle(0x2a1720, 1);
  graphics.fillRect(x - 24, y - 12, 48, 31);
  graphics.fillStyle(0x6e3929, 1);
  graphics.fillRoundedRect(x - 24, y - 24, 48, 20, 6);
  graphics.lineStyle(3, 0xf6d365, 1);
  graphics.strokeRoundedRect(x - 24, y - 24, 48, 43, 6);
  graphics.fillStyle(0xf6d365, 1);
  graphics.fillRect(x - 5, y - 8, 10, 17);
  graphics.fillStyle(0xffffff, 0.9);
  graphics.fillCircle(x, y - 3, 2);
}

export function drawOrbitingBlades(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  count: number,
  radius: number,
  timeMs: number,
): void {
  graphics.clear();
  if (count <= 0) {
    return;
  }
  graphics.lineStyle(1, 0x61f5ff, 0.16);
  graphics.strokeCircle(x, y, radius);
  if (count >= 8) {
    graphics.lineStyle(6, 0xf6d365, 0.12);
    graphics.strokeCircle(x, y, radius + 13 + Math.sin(timeMs * 0.006) * 5);
    graphics.lineStyle(2, 0xffffff, 0.65);
    graphics.strokeCircle(x, y, radius + 5);
    for (let index = 0; index < 4; index += 1) {
      const angle = -timeMs * 0.0017 + index * Math.PI / 2;
      const px = x + Math.cos(angle) * (radius + 17);
      const py = y + Math.sin(angle) * (radius + 17);
      graphics.fillStyle(0xf6d365, 0.8);
      graphics.fillTriangle(px, py - 7, px + 6, py, px, py + 7);
      graphics.fillTriangle(px, py - 7, px - 6, py, px, py + 7);
    }
  }
  for (let index = 0; index < count; index += 1) {
    const angle = timeMs * 0.0025 + index * (Math.PI * 2 / count);
    const px = x + Math.cos(angle) * radius;
    const py = y + Math.sin(angle) * radius;
    const tx = -Math.sin(angle);
    const ty = Math.cos(angle);
    graphics.lineStyle(9, 0x61f5ff, 0.15);
    graphics.lineBetween(px - tx * 12, py - ty * 12, px + tx * 12, py + ty * 12);
    graphics.lineStyle(3, 0xffffff, 0.95);
    graphics.lineBetween(px - tx * 10, py - ty * 10, px + tx * 14, py + ty * 14);
    graphics.fillStyle(0xf6d365, 1);
    graphics.fillCircle(px - tx * 10, py - ty * 10, 3);
  }
}

export function drawThunderAura(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  radius: number,
  timeMs: number,
  awakened = false,
): void {
  graphics.clear();
  if (radius <= 0) {
    return;
  }

  const points: Phaser.Math.Vector2[] = [];
  const segments = 28;
  for (let index = 0; index <= segments; index += 1) {
    const angle = (index / segments) * Math.PI * 2;
    const jitter = Math.sin(index * 8.7 + timeMs * 0.018) * 6;
    points.push(new Phaser.Math.Vector2(
      x + Math.cos(angle) * (radius + jitter),
      y + Math.sin(angle) * (radius + jitter),
    ));
  }
  graphics.lineStyle(10, 0x61f5ff, 0.08);
  graphics.strokePoints(points, true);
  graphics.lineStyle(3, 0x8ffcff, 0.7);
  graphics.strokePoints(points, true);
  graphics.lineStyle(1, 0xffffff, 0.9);
  graphics.strokePoints(points.filter((_, index) => index % 2 === 0), true);
  if (awakened) {
    const outerRadius = radius + 24 + Math.sin(timeMs * 0.008) * 8;
    const innerRadius = radius * 0.58 + Math.sin(timeMs * 0.012) * 3;
    graphics.fillStyle(0x61f5ff, 0.045);
    graphics.fillCircle(x, y, outerRadius);
    graphics.lineStyle(9, 0x61f5ff, 0.12);
    graphics.strokeCircle(x, y, outerRadius);
    graphics.lineStyle(3, 0xffffff, 0.85);
    graphics.strokeCircle(x, y, outerRadius);
    graphics.lineStyle(2, 0xb9f8ff, 0.56);
    graphics.strokeCircle(x, y, innerRadius);
    for (let index = 0; index < 6; index += 1) {
      const angle = index * Math.PI / 3 + timeMs * 0.002;
      graphics.lineStyle(4, 0xb9f8ff, 0.7);
      graphics.lineBetween(
        x + Math.cos(angle) * radius * 0.55,
        y + Math.sin(angle) * radius * 0.55,
        x + Math.cos(angle) * outerRadius,
        y + Math.sin(angle) * outerRadius,
      );
      graphics.fillStyle(0xffffff, 0.86);
      graphics.fillCircle(x + Math.cos(angle) * outerRadius, y + Math.sin(angle) * outerRadius, 3);
    }
  }
}

export function drawAwakenedSkillGlyphs(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  equippedSkills: UpgradeId[],
  upgradeLevels: UpgradeLevels,
  timeMs: number,
  awakenedSkills?: readonly UpgradeId[],
): void {
  graphics.clear();
  const glyphs = getAwakenedSkillGlyphs(equippedSkills, upgradeLevels, awakenedSkills);
  const formation = getGlyphFormation(glyphs.map((glyph) => glyph.upgrade));
  if (glyphs.length > 0) {
    const formationRadius = 64 + glyphs.length * 13;
    const pulse = Math.sin(timeMs * 0.004) * 7;
    graphics.fillStyle(0x61f5ff, 0.07 + glyphs.length * 0.012);
    graphics.fillCircle(x, y, formationRadius + 32 + pulse);
    graphics.lineStyle(16, 0xffffff, 0.055);
    graphics.strokeCircle(x, y, formationRadius + 28 + pulse);
    graphics.lineStyle(3, 0xf6d365, 0.54);
    graphics.strokeCircle(x, y, formationRadius);
    graphics.lineStyle(1, 0xffffff, 0.38);
    graphics.strokeCircle(x, y, formationRadius * 0.62);
    if (formation === 'stormfire') {
      graphics.lineStyle(3, 0xff754c, 0.58);
      graphics.strokeCircle(x, y, formationRadius + 20 + pulse);
    } else if (formation === 'frostbind') {
      graphics.lineStyle(2, 0x8ffcff, 0.66);
      graphics.strokeEllipse(x, y, formationRadius * 2.3, formationRadius * 1.35);
    } else if (formation === 'mirror-ward') {
      graphics.lineStyle(3, 0xc6abff, 0.62);
      graphics.strokeCircle(x, y, formationRadius + 26 + pulse);
      graphics.strokeCircle(x, y, formationRadius + 9);
    }
    for (let rune = 0; rune < 12; rune += 1) {
      const angle = timeMs * 0.0012 + rune * Math.PI / 6;
      const inner = formationRadius + 4;
      const outer = inner + 12 + (rune % 3) * 3;
      graphics.lineStyle(rune % 2 === 0 ? 4 : 2, 0xf6d365, 0.72);
      graphics.lineBetween(
        x + Math.cos(angle) * inner,
        y + Math.sin(angle) * inner,
        x + Math.cos(angle) * outer,
        y + Math.sin(angle) * outer,
      );
    }
  }
  for (let index = 0; index < glyphs.length; index += 1) {
    const glyph = glyphs[index];
    const { angle, radius } = getGlyphFormationPosition(formation, index, glyphs.length, timeMs);
    const px = x + Math.cos(angle) * radius;
    const py = y + Math.sin(angle) * radius;
    const pulse = 5 + Math.sin(timeMs * 0.006 + index) * 2;
    graphics.lineStyle(2, glyph.color, 0.28);
    graphics.lineBetween(x, y, px, py);
    graphics.lineStyle(7, glyph.color, 0.08);
    graphics.lineBetween(
      px - Math.cos(angle) * 30,
      py - Math.sin(angle) * 30,
      px + Math.cos(angle) * 8,
      py + Math.sin(angle) * 8,
    );
    graphics.fillStyle(glyph.color, 0.18);
    graphics.fillCircle(px, py, 27 + pulse);
    graphics.lineStyle(4, glyph.color, 0.98);
    if (glyph.symbol === 'ring') {
      graphics.strokeCircle(px, py, 7 + pulse * 0.4);
      graphics.lineStyle(2, 0xffffff, 0.72);
      graphics.strokeCircle(px, py, 12 + pulse * 0.45);
      for (let ray = 0; ray < 4; ray += 1) {
        const rayAngle = angle + ray * Math.PI / 2;
        graphics.lineBetween(px, py, px + Math.cos(rayAngle) * 15, py + Math.sin(rayAngle) * 15);
      }
    } else if (glyph.symbol === 'star') {
      for (let ray = 0; ray < 6; ray += 1) {
        const rayAngle = angle * 1.8 + ray * Math.PI / 3;
        graphics.lineBetween(px, py, px + Math.cos(rayAngle) * 13, py + Math.sin(rayAngle) * 13);
      }
    } else if (glyph.symbol === 'flare') {
      graphics.lineStyle(3, glyph.color, 0.9);
      graphics.lineBetween(px - 8, py + 9, px + 10, py - 11);
      graphics.lineStyle(2, 0xffffff, 0.72);
      graphics.lineBetween(px + 8, py + 10, px - 10, py - 12);
    } else {
      graphics.fillStyle(glyph.color, 0.9);
      graphics.fillTriangle(px, py - 8, px + 8, py, px, py + 8);
      graphics.fillTriangle(px, py - 8, px - 8, py, px, py + 8);
      graphics.lineStyle(2, 0xffffff, 0.76);
      graphics.strokeRect(px - 7, py - 7, 14, 14);
    }
  }
}
