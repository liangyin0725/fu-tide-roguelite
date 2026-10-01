import { isUpgradeAwakened } from './awakening';
import type { SkillPathContext } from './skillPathRuntime';
import type { SkillId, SkillPathKey } from './skillPaths';
import type { CombatEvent, DamageSource, Enemy, EnemyProjectile, Player, Projectile, Vector } from './types';

const SKILLS = ['solar-ray', 'void-bell', 'spirit-sword-rain', 'storm-net',
  'mirror-sigil', 'frost-domain', 'rift-return', 'star-pull'] as const;
type AdvancedSkill = typeof SKILLS[number];
type Shape = 'ring' | 'beam' | 'field' | 'orbit';
interface Area extends Vector {
  identityKey: string;
  skill: AdvancedSkill;
  path: SkillPathKey;
  age: number;
  duration: number;
  pulse: number;
  radius: number;
  angle: number;
  targetId: number;
  hits: Set<number>;
  marks: Map<number, number>;
  remaining: number;
  stage: number;
  origin: Vector;
}
interface FrozenBullet {
  bullet: EnemyProjectile;
  remaining: number;
  vx: number;
  vy: number;
  homingMs: number;
}
interface RuntimeState {
  timers: Partial<Record<AdvancedSkill, number>>;
  paths: Partial<Record<AdvancedSkill, SkillPathKey>>;
  areas: Area[];
  frozen: Map<number, FrozenBullet>;
  seenSwords: WeakSet<Projectile>;
  ownedProjectiles: WeakSet<Projectile>;
  previousBullets: EnemyProjectile[];
  seenBlocks: WeakSet<object>;
  mirrorCharge: number;
  mirrorReadyMs: number;
}

const distance = (a: Vector, b: Vector) => Math.hypot(a.x - b.x, a.y - b.y);
const normal = (enemy: Enemy) => enemy.kind === 'normal' && !enemy.eliteAffix;
const direction = (from: Vector, to: Vector) => Math.atan2(to.y - from.y, to.x - from.x);
function lineDistance(point: Vector, from: Vector, to: Vector): number {
  const dx = to.x - from.x; const dy = to.y - from.y;
  const t = Math.max(0, Math.min(1, ((point.x - from.x) * dx + (point.y - from.y) * dy) / (dx * dx + dy * dy || 1)));
  return distance(point, { x: from.x + t * dx, y: from.y + t * dy });
}
function cooldown(player: Player, skill: AdvancedSkill): number {
  switch (skill) {
    case 'solar-ray': return player.solarRayCooldownMs;
    case 'void-bell': return player.voidBellCooldownMs;
    case 'spirit-sword-rain': return player.swordRainCooldownMs;
    case 'storm-net': return player.stormNetCooldownMs;
    case 'mirror-sigil': return Math.max(200, player.mirrorSigilCooldownMs * 0.2);
    case 'frost-domain': return player.frostDomainCooldownMs;
    case 'rift-return': return player.riftReturnCooldownMs;
    case 'star-pull': return player.starPullCooldownMs;
  }
}
function baseDamage(player: Player, skill: AdvancedSkill): number {
  switch (skill) {
    case 'solar-ray': return player.solarRayDamage;
    case 'void-bell': return player.voidBellDamage;
    case 'spirit-sword-rain': return player.swordRainDamage;
    case 'storm-net': return player.stormNetDamage;
    case 'mirror-sigil': return player.mirrorSigilDamage;
    case 'frost-domain': return player.frostDomainDamage;
    case 'rift-return': return player.riftReturnDamage;
    case 'star-pull': return player.starPullDamage;
  }
}
function source(skill: AdvancedSkill): DamageSource {
  switch (skill) {
    case 'solar-ray': return 'solar-ray';
    case 'void-bell': return 'void-bell';
    case 'spirit-sword-rain': case 'rift-return': return 'sword-rain';
    case 'storm-net': case 'frost-domain': return 'chain';
    case 'mirror-sigil': return 'reprisal';
    case 'star-pull': return 'meteor';
  }
}

/** Supplementary mechanics only: no permanent player stats or base casts are changed. */
export class AdvancedSkillPathRuntime {
  private readonly players = new WeakMap<Player, RuntimeState>();
  private nextEffectId = 1;

  public update(context: SkillPathContext): void {
    const { player, state } = context;
    if (!Number.isFinite(context.deltaMs) || context.deltaMs <= 0) return;
    let runtime = this.players.get(player);
    if (!runtime) {
      runtime = { timers: {}, paths: {}, areas: [], frozen: new Map(), seenSwords: new WeakSet(),
        ownedProjectiles: new WeakSet(), previousBullets: [], seenBlocks: new WeakSet(),
        mirrorCharge: 0, mirrorReadyMs: 0 };
      this.players.set(player, runtime);
    }
    for (const skill of SKILLS) {
      const path = player.skillPaths[skill];
      const enabled = player.upgradeLevels[skill] >= 3 && player.equippedSkills.includes(skill)
        && (path === 'a' || path === 'b');
      if (!enabled || runtime.paths[skill] !== path) {
        for (const area of runtime.areas.filter(area => area.skill === skill)) {
          this.effect(context, skill, area.path, 'field', area, area.radius, 0);
          if (skill === 'star-pull' && area.stage === 1) {
            for (let i = 0; i < 6; i++) this.effect(context, skill, area.path, 'orbit', area, 12, 0, undefined, `${area.identityKey}:orbit:${i}`);
          }
        }
        runtime.areas = runtime.areas.filter(area => area.skill !== skill);
        delete runtime.timers[skill];
        if (skill === 'frost-domain') this.releaseFrozen(context, runtime, false);
        if (skill === 'mirror-sigil') { runtime.mirrorCharge = 0; runtime.mirrorReadyMs = 0; }
      }
      if (!enabled) { delete runtime.paths[skill]; continue; }
      runtime.paths[skill] = path;
      const interval = cooldown(player, skill);
      if (interval <= 0) continue;
      // Route clocks are independent of base cast timers, which are already reduced modulo cooldown.
      runtime.timers[skill] = (runtime.timers[skill] ?? 0) - context.deltaMs;
      if (runtime.timers[skill]! <= 0) {
        runtime.timers[skill] = interval;
        this.cast(context, runtime, skill, path);
      } else if (skill === 'mirror-sigil') {
        this.intercept(context, runtime, path, false);
      }
    }
    this.updateFrozen(context, runtime);
    this.copyVolley(context, runtime);
    for (const area of runtime.areas) {
      const dt = Math.min(context.deltaMs, Math.max(0, area.duration - area.age));
      area.age += dt;
      area.pulse -= dt;
      const pulse = area.pulse <= 0;
      if (pulse) area.pulse = 200;
      this.updateArea(context, runtime, area, dt, pulse);
    }
    runtime.areas = runtime.areas.filter(area => area.age < area.duration);
    runtime.previousBullets = state.enemyProjectiles
      .filter(bullet => distance(bullet, player) <= player.mirrorSigilRadius + 160).slice(0, 64);
  }

  private enemies(context: SkillPathContext, center: Vector, radius: number): Enemy[] {
    return context.state.enemies.filter(enemy => enemy.hp > 0 && distance(enemy, center) <= radius);
  }

  private effect(context: SkillPathContext, skill: SkillId, path: SkillPathKey, shape: Shape,
    point: Vector, radius: number, durationMs = 200, to?: Vector, identityKey?: string): void {
    const areaKey = 'identityKey' in point && typeof point.identityKey === 'string' ? point.identityKey : undefined;
    const event: CombatEvent & { identityKey?: string } = {
      type: 'skill-path-effect', skill, path, shape, x: point.x, y: point.y,
      radius, durationMs, ...(to ? { toX: to.x, toY: to.y } : {}),
      ...((identityKey ?? areaKey) ? { identityKey: identityKey ?? areaKey } : {}),
    };
    context.events.push(event);
  }

  private hit(context: SkillPathContext, skill: AdvancedSkill, enemy: Enemy, factor: number): void {
    if (enemy.hp > 0) context.damage(enemy, baseDamage(context.player, skill) * factor
      * (isUpgradeAwakened(context.player, skill) ? 1.4 : 1), source(skill));
  }

  private area(context: SkillPathContext, runtime: RuntimeState, skill: AdvancedSkill,
    path: SkillPathKey, center: Vector, radius: number, duration: number, target?: Enemy): void {
    if (runtime.areas.length >= 24) return;
    const area: Area = { skill, path, x: center.x, y: center.y, radius, duration, age: 0,
      identityKey: `advanced:${context.player === context.state.player ? 'p1' : 'p2'}:${skill}:${path}:${this.nextEffectId++}`,
      pulse: 0, angle: target ? direction(context.player, target) : 0, targetId: target?.id ?? -1,
      hits: new Set(), marks: new Map(), remaining: context.player.swordRainCount,
      stage: 0, origin: { x: context.player.x, y: context.player.y } };
    runtime.areas.push(area);
    this.effect(context, skill, path, 'field', area, radius, duration);
  }

  private cast(context: SkillPathContext, runtime: RuntimeState, skill: AdvancedSkill, path: SkillPathKey): void {
    const { player } = context;
    const level = player.upgradeLevels[skill];
    const awakened = isUpgradeAwakened(player, skill);
    const near = this.enemies(context, player, skill === 'solar-ray' ? player.solarRayRange
      : skill === 'rift-return' ? player.riftReturnRange : 560)
      .sort((a, b) => distance(a, player) - distance(b, player));
    const target = near[0];
    switch (skill) {
      case 'solar-ray':
        if (!target) break;
        if (path === 'a') this.area(context, runtime, skill, path, player, player.solarRayRange, awakened ? 1400 : 900, target);
        else {
          const primary = near.find(enemy => enemy.kind === 'boss' || enemy.eliteAffix);
          if (!primary) break;
          const used = new Set([primary.id]);
          const refract = (from: Enemy, count: number, factor: number): Enemy[] => {
            const targets = this.enemies(context, from, level >= 4 ? 220 : 170)
              .filter(enemy => !used.has(enemy.id)).sort((a, b) => distance(a, from) - distance(b, from)).slice(0, count);
            for (const enemy of targets) {
              used.add(enemy.id); this.hit(context, skill, enemy, factor);
              this.effect(context, skill, path, 'beam', from, 10, 240, enemy);
            }
            return targets;
          };
          const first = refract(primary, awakened ? 5 : level >= 4 ? 3 : 2, 0.55);
          if (level >= 5) for (const enemy of first) refract(enemy, awakened ? 2 : 1, 0.3);
        }
        break;
      case 'void-bell':
        this.area(context, runtime, skill, path, player, player.voidBellRadius, path === 'a' && level >= 4 ? 700 : 1100);
        break;
      case 'spirit-sword-rain': {
        if (!target) break;
        const priority = near.filter(enemy => enemy.kind === 'boss' || enemy.eliteAffix)
          .sort((a, b) => b.hp - a.hp)[0] ?? target;
        this.area(context, runtime, skill, path, path === 'a' ? priority : { x: player.x - 140, y: target.y },
          path === 'a' ? 24 : level >= 4 ? 150 : 100, path === 'a' ? 1400 : level >= 5 ? 2200 : 1100, priority);
        break;
      }
      case 'storm-net':
        if (target) this.area(context, runtime, skill, path, target, awakened ? 160 : 120,
          level >= 4 ? 1800 : 1200, target);
        break;
      case 'mirror-sigil': this.intercept(context, runtime, path); break;
      case 'frost-domain':
        this.area(context, runtime, skill, path, player, player.frostDomainRadius, awakened ? 1800 : 1500);
        break;
      case 'rift-return':
        if (target) this.area(context, runtime, skill, path, target, level >= 4 ? 36 : 24,
          path === 'a' ? 750 : level >= 4 ? 1800 : 1100, target);
        break;
      case 'star-pull':
        if (target) this.area(context, runtime, skill, path, target, player.starPullRadius, 1400, target);
        break;
    }
  }

  private moveNormal(enemy: Enemy, center: Vector, amount: number, inward: boolean): void {
    if (!normal(enemy)) return;
    const d = distance(enemy, center);
    if (d === 0) return;
    const step = inward ? Math.min(d, amount) : -amount;
    enemy.x += (center.x - enemy.x) / d * step;
    enemy.y += (center.y - enemy.y) / d * step;
  }

  private breakBullet(context: SkillPathContext, bullet: EnemyProjectile): void {
    context.state.runStats.bulletsBlocked += 1;
    context.events.push({ type: 'enemy-bullet-broken', x: bullet.x, y: bullet.y, by: 'mirror',
      playerId: context.player === context.state.player ? 'p1' : 'p2', bulletId: bullet.id, vx: bullet.vx, vy: bullet.vy });
  }

  private projectile(context: SkillPathContext, runtime: RuntimeState, point: Vector,
    angle: number, damage: number, damageSource: DamageSource, ttlMs = 1100, pierce = 0): void {
    if (context.state.projectiles.filter(p => runtime.ownedProjectiles.has(p)).length >= 96) return;
    const p: Projectile = { id: context.state.nextId++, targetId: -1, x: point.x, y: point.y,
      playerId: context.player === context.state.player ? 'p1' : 'p2', derived: true,
      vx: Math.cos(angle) * 420, vy: Math.sin(angle) * 420, radius: 7, damage, ttlMs,
      pierceRemaining: pierce, hitEnemyIds: [], kind: damageSource === 'chain' ? 'star' : 'sword', source: damageSource };
    context.state.projectiles.push(p); runtime.ownedProjectiles.add(p); runtime.seenSwords.add(p);
  }

  private intercept(context: SkillPathContext, runtime: RuntimeState, path: SkillPathKey, ready = true): void {
    const { player, state } = context;
    const ownerId = player === state.player ? 'p1' : 'p2';
    const intercepted: Array<Vector & { id?: number; vx: number; vy: number }> = ready
      ? state.enemyProjectiles.filter(b => distance(b, player) <= player.mirrorSigilRadius).slice(0, 16) : [];
    // Rich base events retain same-frame trajectories; the snapshot supports legacy emitters only.
    for (const event of context.events.slice()) {
      if (event.type !== 'enemy-bullet-broken' || runtime.seenBlocks.has(event)) continue;
      runtime.seenBlocks.add(event);
      if (event.playerId !== undefined && event.playerId !== ownerId) continue;
      if (event.by !== 'barrier' || distance(event, player) > player.mirrorSigilRadius) continue;
      if (typeof event.vx === 'number' && Number.isFinite(event.vx)
        && typeof event.vy === 'number' && Number.isFinite(event.vy)) {
        if (event.bulletId === undefined || !intercepted.some(b => b.id === event.bulletId)) {
          intercepted.push({ id: event.bulletId, x: event.x, y: event.y, vx: event.vx, vy: event.vy });
        }
        continue;
      }
      const old = runtime.previousBullets.find(b => distance(b, event) < 1
        && !state.enemyProjectiles.includes(b) && !intercepted.includes(b));
      if (old) intercepted.push(old);
    }
    const ids = new Set(intercepted.map(b => b.id));
    state.enemyProjectiles = state.enemyProjectiles.filter(b => {
      if (!ids.has(b.id)) return true;
      this.breakBullet(context, b); return false;
    });
    const level = player.upgradeLevels['mirror-sigil'];
    for (const bullet of intercepted) {
      if (path === 'a') {
        const angle = Math.atan2(-bullet.vy, -bullet.vx);
        const range = level >= 4 ? 1700 : 1100;
        this.projectile(context, runtime, bullet, angle, player.mirrorSigilDamage * 1.3
          * (isUpgradeAwakened(player, 'mirror-sigil') ? 1.5 : 1), 'reprisal', range, level >= 5 ? 2 : 0);
        this.effect(context, 'mirror-sigil', path, 'beam', bullet, 10, 200,
          { x: bullet.x + Math.cos(angle) * 420 * range / 1000, y: bullet.y + Math.sin(angle) * 420 * range / 1000 });
      } else {
        runtime.mirrorCharge++;
        if (runtime.mirrorCharge >= (level >= 4 ? 2 : 3)) {
          runtime.mirrorCharge = 0; runtime.mirrorReadyMs = 4000;
          this.effect(context, 'mirror-sigil', path, 'orbit', player, 36, 4000);
        }
      }
    }
  }

  private copyVolley(context: SkillPathContext, runtime: RuntimeState): void {
    const { player, state } = context;
    const ownerId = player === state.player ? 'p1' : 'p2';
    const volley = state.projectiles.filter(p => !runtime.seenSwords.has(p)
      && !p.derived
      && (p.kind === undefined || p.kind === 'sword') && (p.source === undefined || p.source === 'flying-sword')
      && (p.playerId === undefined ? distance(p, player) <= player.radius + 80 : p.playerId === ownerId));
    for (const p of state.projectiles) runtime.seenSwords.add(p);
    if (runtime.paths['mirror-sigil'] === 'b' && runtime.mirrorReadyMs > 0 && volley.length > 0) {
      const level = player.upgradeLevels['mirror-sigil'];
      const copies = volley.slice(0, 24);
      if (level >= 5) copies.push(volley[0]);
      if (isUpgradeAwakened(player, 'mirror-sigil')) copies.push(...volley.slice(0, 24));
      for (const original of copies) {
        if (state.projectiles.filter(p => runtime.ownedProjectiles.has(p)).length >= 96) break;
        const copy: Projectile = { ...original, id: state.nextId++, hitEnemyIds: [], playerId: ownerId, derived: true };
        state.projectiles.push(copy); runtime.ownedProjectiles.add(copy); runtime.seenSwords.add(copy);
      }
      runtime.mirrorReadyMs = 0;
      this.effect(context, 'mirror-sigil', 'b', 'beam', player, 24);
    }
    runtime.mirrorReadyMs = Math.max(0, runtime.mirrorReadyMs - context.deltaMs);
    if (runtime.paths['mirror-sigil'] === 'a' && player.upgradeLevels['mirror-sigil'] >= 5) {
      state.enemyProjectiles = state.enemyProjectiles.filter(b => {
        const hit = state.projectiles.some(p => runtime.ownedProjectiles.has(p) && p.source === 'reprisal'
          && lineDistance(b, p, { x: p.x + p.vx * context.deltaMs / 1000, y: p.y + p.vy * context.deltaMs / 1000 }) <= b.radius + p.radius);
        if (hit) this.breakBullet(context, b);
        return !hit;
      });
    }
  }

  private releaseFrozen(context: SkillPathContext, runtime: RuntimeState, convert: boolean): void {
    for (const frozen of runtime.frozen.values()) this.thaw(context, runtime, frozen, convert);
    runtime.frozen.clear();
  }

  private thaw(context: SkillPathContext, runtime: RuntimeState, frozen: FrozenBullet, convert: boolean): void {
    const { bullet } = frozen;
    if (bullet.ttlMs <= 0) return;
    if (convert) {
      this.breakBullet(context, bullet);
      this.projectile(context, runtime, bullet, Math.atan2(-frozen.vy, -frozen.vx),
        context.player.frostDomainDamage * (isUpgradeAwakened(context.player, 'frost-domain') ? 1.4 : 0.6), 'chain', 1000, 1);
      this.effect(context, 'frost-domain', 'b', 'beam', bullet, 8);
    } else {
      bullet.vx = frozen.vx; bullet.vy = frozen.vy; bullet.homingMs = frozen.homingMs;
      context.state.enemyProjectiles.push(bullet);
    }
  }

  private updateFrozen(context: SkillPathContext, runtime: RuntimeState): void {
    for (const [id, frozen] of runtime.frozen) {
      frozen.remaining -= context.deltaMs; frozen.bullet.ttlMs -= context.deltaMs;
      if (frozen.remaining > 0 && frozen.bullet.ttlMs > 0) continue;
      this.thaw(context, runtime, frozen, context.player.upgradeLevels['frost-domain'] >= 5);
      runtime.frozen.delete(id);
    }
  }

  private updateArea(context: SkillPathContext, runtime: RuntimeState, area: Area, dt: number, pulse: boolean): void {
    const { player, state } = context;
    const level = player.upgradeLevels[area.skill];
    const awakened = isUpgradeAwakened(player, area.skill);
    const progress = area.age / area.duration;
    const end = area.age >= area.duration;
    switch (area.skill) {
      case 'solar-ray': {
        if (!pulse) break;
        const span = level >= 4 ? Math.PI * 0.8 : Math.PI * 0.5;
        const angle = area.angle + (progress - 0.5) * span;
        const to = { x: area.x + Math.cos(angle) * area.radius, y: area.y + Math.sin(angle) * area.radius };
        for (const enemy of this.enemies(context, area, area.radius)) {
          const centerHit = level >= 5 && lineDistance(enemy, area,
            { x: area.x + Math.cos(area.angle) * area.radius, y: area.y + Math.sin(area.angle) * area.radius }) <= enemy.radius + 12;
          if (lineDistance(enemy, area, to) <= enemy.radius + 14 || centerHit) this.hit(context, area.skill, enemy, 0.4);
        }
        this.effect(context, area.skill, area.path, 'beam', area, 14, 220, to);
        break;
      }
      case 'void-bell': {
        const radius = area.path === 'a' ? area.radius * progress : area.radius * (1 - Math.max(0, progress - 0.2) / 0.8);
        if (area.path === 'b' && progress > 0.2) {
          for (const enemy of this.enemies(context, area, area.radius)) this.moveNormal(enemy, area,
            (level >= 4 ? 100 : 65) * dt / 1000 * (awakened ? 1.5 : 1), true);
        }
        if (pulse || end) {
          for (const enemy of this.enemies(context, area, area.radius + 20)) {
            if (Math.abs(distance(enemy, area) - radius) > enemy.radius + 25 || area.hits.has(enemy.id)) continue;
            area.hits.add(enemy.id); this.hit(context, area.skill, enemy, 0.45);
            if (area.path === 'a') this.moveNormal(enemy, area, awakened ? 50 : 30, false);
          }
          if (area.path === 'a') {
            let broken = 0;
            state.enemyProjectiles = state.enemyProjectiles.filter(b => {
              if (distance(b, area) > radius) return true;
              this.breakBullet(context, b); broken++; return false;
            });
            if (level >= 5 && broken) for (const enemy of this.enemies(context, area, radius)) this.hit(context, area.skill, enemy, Math.min(1, broken * 0.15));
          }
          if (end && area.path === 'b' && level >= 5) for (const enemy of this.enemies(context, area, 70)) this.hit(context, area.skill, enemy, 0.8);
          this.effect(context, area.skill, area.path, 'ring', area, radius);
        }
        break;
      }
      case 'spirit-sword-rain':
        if (area.path === 'a') {
          if (!pulse || area.remaining <= 0) break;
          let target = state.enemies.find(enemy => enemy.id === area.targetId && enemy.hp > 0);
          if (!target && level >= 5) target = this.enemies(context, player, 560)
            .sort((a, b) => Number(b.kind === 'boss' || !!b.eliteAffix) - Number(a.kind === 'boss' || !!a.eliteAffix) || b.hp - a.hp)[0];
          if (!target) break;
          area.targetId = target.id; area.x = target.x; area.y = target.y;
          this.hit(context, area.skill, target, awakened ? 0.7 : 0.45); area.remaining--;
          if (level >= 4) {
            const beyond = this.enemies(context, target, 130).find(enemy => enemy.id !== target!.id);
            if (beyond) this.hit(context, area.skill, beyond, 0.25);
          }
          this.effect(context, area.skill, area.path, 'beam', { x: target.x, y: target.y - 120 }, 12, 200, target);
        } else {
          const speed = 320 * dt / 1000;
          area.x += level >= 5 && progress > 0.5 ? -speed : speed;
          if (pulse) {
            for (const enemy of state.enemies) if (enemy.hp > 0 && Math.abs(enemy.x - area.x) <= 45 + enemy.radius
              && Math.abs(enemy.y - area.y) <= area.radius) this.hit(context, area.skill, enemy, 0.35);
            this.effect(context, area.skill, area.path, 'beam', { x: area.x, y: area.y - area.radius }, 24, 220,
              { x: area.x, y: area.y + area.radius });
          }
        }
        break;
      case 'storm-net': {
        if (area.path === 'b') {
          const cluster = this.enemies(context, area, 400);
          if (cluster.length) {
            const center = { x: cluster.reduce((sum, enemy) => sum + enemy.x, 0) / cluster.length,
              y: cluster.reduce((sum, enemy) => sum + enemy.y, 0) / cluster.length };
            const d = distance(area, center); const step = Math.min(d, (level >= 4 ? 110 : 65) * dt / 1000);
            if (d) { area.x += (center.x - area.x) / d * step; area.y += (center.y - area.y) / d * step; }
          }
        }
        if (!pulse) break;
        const enemies = this.enemies(context, area, area.radius);
        for (const enemy of enemies) {
          this.hit(context, area.skill, enemy, 0.25);
          if (area.path === 'a' && normal(enemy)) {
            enemy.freezeUntilMs = Math.max(enemy.freezeUntilMs, state.elapsedMs + (awakened ? 500 : 300));
            if (level >= 5) { enemy.rangedTelegraphing = false; enemy.rangedAttackTimerMs = 0; }
          }
          if (area.path === 'b') area.marks.set(enemy.id, area.age + 600);
        }
        for (const [id, expires] of area.marks) if (expires <= area.age || !state.enemies.some(e => e.id === id && e.hp > 0)) area.marks.delete(id);
        if (area.path === 'b' && level >= 5) {
          const marked = state.enemies.filter(e => e.hp > 0 && area.marks.has(e.id)).slice(0, awakened ? 8 : 4);
          for (let i = 1; i < marked.length; i++) {
            if (distance(marked[i - 1], marked[i]) > area.radius * 2) continue;
            this.hit(context, area.skill, marked[i], 0.2);
            this.effect(context, area.skill, area.path, 'beam', marked[i - 1], 8, 180, marked[i]);
          }
        }
        this.effect(context, area.skill, area.path, 'field', area, area.radius);
        break;
      }
      case 'mirror-sigil': break;
      case 'frost-domain':
        if (area.path === 'a') {
          for (const enemy of this.enemies(context, area, area.radius)) {
            if (!normal(enemy)) continue;
            const charge = (area.marks.get(enemy.id) ?? 0) + dt * (distance(enemy, area) <= area.radius * (level >= 4 ? 0.65 : 0.4) ? 2 : 0.65);
            if (charge < (awakened ? 850 : 1200)) { area.marks.set(enemy.id, charge); continue; }
            if (enemy.nextFreezeAllowedMs > state.elapsedMs) continue;
            enemy.freezeUntilMs = Math.max(enemy.freezeUntilMs, state.elapsedMs + (awakened ? 1000 : 650));
            enemy.nextFreezeAllowedMs = state.elapsedMs + 1400; area.marks.set(enemy.id, 0);
            if (level >= 5) for (const nearby of this.enemies(context, enemy, 75)) this.hit(context, area.skill, nearby, 0.35);
            this.effect(context, area.skill, area.path, 'ring', enemy, 36);
          }
          const active = new Set(this.enemies(context, area, area.radius).map(e => e.id));
          for (const id of area.marks.keys()) if (!active.has(id)) area.marks.delete(id);
        } else if (pulse) {
          state.enemyProjectiles = state.enemyProjectiles.filter(bullet => {
            if (distance(bullet, area) > area.radius || runtime.frozen.size >= 64 || area.hits.has(bullet.id)) return true;
            area.hits.add(bullet.id);
            runtime.frozen.set(bullet.id, { bullet, remaining: level >= 4 ? 1000 : 600,
              vx: bullet.vx, vy: bullet.vy, homingMs: bullet.homingMs });
            bullet.vx = 0; bullet.vy = 0; bullet.homingMs = 0;
            this.effect(context, area.skill, area.path, 'ring', bullet, 12, level >= 4 ? 1000 : 600);
            return false;
          });
        }
        if (pulse) this.effect(context, area.skill, area.path, 'field', area, area.radius);
        break;
      case 'rift-return':
        if (area.path === 'a' && ((area.stage === 0 && area.age >= 250) || (level >= 5 && area.stage === 1 && area.age >= 600))) {
          const dx = -Math.sin(area.angle) * area.radius; const dy = Math.cos(area.angle) * area.radius;
          const from = { x: area.x + dx, y: area.y + dy };
          const to = { x: player.x + dx, y: player.y + dy };
          for (const enemy of state.enemies) if (enemy.hp > 0 && lineDistance(enemy, from, to) <= enemy.radius + 10) this.hit(context, area.skill, enemy, 0.6);
          this.effect(context, area.skill, area.path, 'beam', from, 10, 250, to); area.stage++;
          if (awakened) {
            const other = { x: area.x - dx, y: area.y - dy };
            const back = { x: player.x - dx, y: player.y - dy };
            for (const enemy of state.enemies) if (enemy.hp > 0 && lineDistance(enemy, other, back) <= enemy.radius + 10) this.hit(context, area.skill, enemy, 0.6);
            this.effect(context, area.skill, area.path, 'beam', other, 10, 250, back);
          }
        }
        if (area.path === 'b' && area.age >= 300 + area.stage * 450 && area.stage < (awakened ? 3 : level >= 5 ? 2 : 1)) {
          this.projectile(context, runtime, area, direction(area, player), player.riftReturnDamage * (awakened ? 0.9 : 0.6), 'sword-rain', 1400, 2);
          this.effect(context, area.skill, area.path, 'beam', area, 18, 250, player); area.stage++;
        }
        break;
      case 'star-pull':
        if (area.stage === 0) {
          const enemies = this.enemies(context, area, area.radius);
          for (const enemy of enemies) {
            const force = Math.max(20, player.starPullForce) * (level >= 4 && area.path === 'a' ? 1 + progress * 2 : 1);
            this.moveNormal(enemy, area, force * dt / 1000 * (awakened ? 2 : 1), true);
          }
          if (pulse) this.effect(context, area.skill, area.path, 'field', area, area.radius);
          if (!end) break;
          if (area.path === 'a') {
            const count = enemies.filter(enemy => normal(enemy) && distance(enemy, area) <= area.radius * 0.65).length;
            for (const enemy of enemies) {
              this.hit(context, area.skill, enemy, 1 + Math.min(8, count) * 0.2);
              if (level >= 5 && normal(enemy)) enemy.freezeUntilMs = Math.max(enemy.freezeUntilMs, state.elapsedMs + 400);
            }
            this.effect(context, area.skill, area.path, 'ring', area, area.radius, 400);
          } else {
            area.stage = 1; area.age = 0; area.duration = awakened ? 2200 : 1400;
            area.hits.clear(); area.radius = 60;
          }
        } else {
          const count = awakened ? 6 : level >= 4 ? 4 : 2;
          if (!pulse) break;
          for (let i = 0; i < count; i++) {
            const angle = area.age / 200 + i * Math.PI * 2 / count;
            const star = { x: player.x + Math.cos(angle) * area.radius, y: player.y + Math.sin(angle) * area.radius };
            let target = this.enemies(context, star, 30).find(enemy => !area.hits.has(enemy.id));
            if (!target && level >= 5) target = this.enemies(context, star, 110).find(enemy => !area.hits.has(enemy.id));
            if (target) { this.hit(context, area.skill, target, 0.5); area.hits.add(target.id); }
            this.effect(context, area.skill, area.path, 'orbit', star, 12, 220, undefined, `${area.identityKey}:orbit:${i}`);
          }
          if (level >= 5) area.hits.clear();
        }
        break;
    }
  }
}
