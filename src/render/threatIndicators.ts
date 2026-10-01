import { getBossHazardRadius } from '../sim/bossSkills';
import type { BossHazard, GameState } from '../sim/types';

export interface ThreatIndicator {
  id: string;
  kind: 'boss' | 'objective' | 'hazard';
  x: number;
  y: number;
  angle: number;
  distance: number;
}

export function getThreatIndicators(
  state: GameState,
  view: { x: number; y: number; width: number; height: number },
  safeMargin = 28,
): ThreatIndicator[] {
  const centerX = view.x + view.width / 2;
  const centerY = view.y + view.height / 2;
  const marginX = Math.min(Math.max(0, safeMargin), view.width / 2);
  const marginY = Math.min(Math.max(0, safeMargin), view.height / 2);
  const halfWidth = view.width / 2 - marginX;
  const halfHeight = view.height / 2 - marginY;
  const indicators: ThreatIndicator[] = [];

  function add(id: string, kind: ThreatIndicator['kind'], x: number, y: number): void {
    if (x >= view.x && x <= view.x + view.width &&
        y >= view.y && y <= view.y + view.height) return;

    const dx = x - centerX;
    const dy = y - centerY;
    // Intersect the center-to-target ray with the inset rectangle in world space.
    const scale = Math.min(
      dx === 0 ? Infinity : halfWidth / Math.abs(dx),
      dy === 0 ? Infinity : halfHeight / Math.abs(dy),
    );
    indicators.push({
      id, kind,
      x: centerX + dx * scale,
      y: centerY + dy * scale,
      angle: Math.atan2(dy, dx),
      distance: Math.hypot(dx, dy),
    });
  }

  for (const enemy of state.enemies) {
    if (enemy.hp <= 0) continue;
    if (enemy.id === state.activeObjectiveId || enemy.id === state.activeBossObjectiveId) {
      add(`objective:${enemy.id}`, 'objective', enemy.x, enemy.y);
    } else if (enemy.kind === 'boss') {
      add(`boss:${enemy.id}`, 'boss', enemy.x, enemy.y);
    }
  }

  for (const hazard of state.bossHazards) {
    if (hazard.telegraphRemainingMs > 0 || hazard.activeRemainingMs <= 0) continue;
    if (isLargeHazard(hazard)) add(`hazard:${hazard.id}`, 'hazard', hazard.x, hazard.y);
  }

  return indicators;
}

function isLargeHazard(hazard: BossHazard): boolean {
  if (getBossHazardRadius(hazard) >= 100) return true;
  return (hazard.kind === 'line' || hazard.kind === 'charge') &&
    Math.hypot(hazard.endX - hazard.x, hazard.endY - hazard.y) >= 200;
}
