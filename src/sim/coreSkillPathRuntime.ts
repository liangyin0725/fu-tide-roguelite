import { isUpgradeAwakened } from './awakening';
import type { SkillPathContext } from './skillPathRuntime';
import type { SkillId, SkillPathKey } from './skillPaths';
import type { CombatEvent, DamageSource, Enemy, EnemyProjectile, GameState, Player, Projectile, Vector } from './types';

const SKILLS = ['chain-lightning', 'fire-burst', 'golden-shield', 'frost-seal',
  'orbiting-blades', 'meteor-seal', 'north-star', 'bullet-reprisal', 'soul-pin'] as const;
const LIMIT = 128;
const distance = (a: Vector, b: Vector) => Math.hypot(a.x - b.x, a.y - b.y);
const priority = (enemy: Enemy) => enemy.kind === 'boss' || enemy.eliteAffix ? 0 : enemy.archetype !== 'melee' ? 1 : 2;
const segmentDistance = (start: Vector, end: Vector, point: Vector) => {
  const dx = end.x - start.x; const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1,
    ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
  return distance(point, { x: start.x + dx * t, y: start.y + dy * t });
};

interface Area extends Vector { identityKey: string; radius: number; expires: number; damage: number; nextTick: number }
interface Blast extends Vector { at: number; radius: number; damage: number; generation: number }
interface Mark { stacks: number; expires: number; vulnerableUntil: number }
interface Link { identityKey: string; ids: number[]; expires: number; nextTick: number; maxDistance: number }
interface Flight extends Vector {
  identityKey: string; target: Enemy; origin: Vector; turn?: Vector;
  start: number; hit: boolean; returnHitIds: Set<number>;
}
interface Stars { identityKey: string; start: number; count: number; hitIds: Set<number> }
interface RouteState {
  identityKey: string; path: SkillPathKey; clock: number; charge: number; buffUntil: number;
  blasts: Blast[]; areas: Area[]; marks: Map<number, Mark>; links: Link[];
  flights: Flight[]; stars: Stars[]; shots: Map<number, Projectile>;
}
interface RuntimeState {
  owner: number; state: GameState; time: number; hp: number; shield: number;
  enemies: Map<number, { enemy: Enemy; hp: number }>;
  routes: Map<SkillId, RouteState>;
}

/** Supplementary attacks only; all base stat and timer ownership stays with GameSimulation. */
export class CoreSkillPathRuntime {
  private readonly players = new WeakMap<Player, RuntimeState>();
  private readonly consumedEvents = new WeakSet<CombatEvent>();
  private nextIdentity = 1;

  public update(ctx: SkillPathContext): void {
    const { player, state } = ctx;
    const now = state.elapsedMs;
    let runtime = this.players.get(player);
    const clearRoute = (route: RouteState | undefined, skill: SkillId) => {
      if (!route) return;
      const owned = new Set(route.shots.values());
      state.projectiles = state.projectiles.filter(projectile => !owned.has(projectile));
      const identities = [...route.areas, ...route.flights, ...route.stars].map(value => value.identityKey);
      for (const link of route.links) for (let i = 1; i < link.ids.length; i++) identities.push(`${link.identityKey}:${i}`);
      for (const identityKey of identities) ctx.events.push({ type: 'skill-path-effect', skill, path: route.path,
        shape: 'field', x: player.x, y: player.y, radius: 0, durationMs: 0, identityKey });
    };
    if (!runtime || runtime.state !== state || now < runtime.time) {
      if (runtime) for (const [skill, route] of runtime.routes) clearRoute(route, skill);
      runtime = { owner: this.nextIdentity++, state, time: now, hp: player.hp, shield: player.shield, enemies: new Map(), routes: new Map() };
      this.players.set(player, runtime);
    }
    const playerId = player === state.player ? 'p1' : 'p2';
    const triggers = new Map<SkillId, Array<Extract<CombatEvent, { type: 'skill-path-trigger' }>>>();
    const baseBreaks: Array<Extract<CombatEvent, { type: 'enemy-bullet-broken' }>> = [];
    // Consume only attributed primary facts, never damage caused by route supplements.
    for (const event of ctx.events) {
      if ((event.type !== 'skill-path-trigger' && event.type !== 'enemy-bullet-broken')
        || event.playerId !== playerId || this.consumedEvents.has(event)) continue;
      this.consumedEvents.add(event);
      if (event.type === 'skill-path-trigger') {
        const entries = triggers.get(event.skill) ?? [];
        if (entries.length < LIMIT) entries.push(event);
        triggers.set(event.skill, entries);
      } else baseBreaks.push(event);
    }
    // Base breaks have already been counted. Prevent a stale bullet from also being intercepted.
    const brokenIds = new Set(baseBreaks.flatMap(event => event.bulletId === undefined ? [] : [event.bulletId]));
    state.enemyProjectiles = state.enemyProjectiles.filter(bullet => !brokenIds.has(bullet.id));
    // HP history is exclusively for previously frostmarked deaths, including removed enemies.
    const deaths: Enemy[] = [];
    for (const { enemy, hp } of runtime.enemies.values()) {
      if (hp > 0 && enemy.hp <= 0) deaths.push(enemy);
    }
    const live = state.enemies.filter(enemy => enemy.hp > 0);
    for (const skill of SKILLS) {
      const path = player.skillPaths[skill];
      const level = player.upgradeLevels[skill];
      if (level < 3 || (path !== 'a' && path !== 'b') || !player.equippedSkills.includes(skill)) {
        clearRoute(runtime.routes.get(skill), skill);
        runtime.routes.delete(skill); continue;
      }
      let route = runtime.routes.get(skill);
      if (!route || route.path !== path) {
        clearRoute(route, skill);
        const baseTimer = skill === 'meteor-seal' ? player.meteorTimerMs : skill === 'north-star' ? player.northStarTimerMs : 0;
        route = { identityKey: `core:${runtime.owner}:${skill}:${path}:${this.nextIdentity++}`,
          path, clock: Math.max(0, baseTimer - ctx.deltaMs), charge: 0, buffUntil: 0, blasts: [], areas: [],
          marks: new Map(), links: [], flights: [], stars: [], shots: new Map() };
        runtime.routes.set(skill, route);
      }
      const awakened = isUpgradeAwakened(player, skill);
      const gain = awakened ? 1.5 : 1;
      route.areas = route.areas.filter(field => field.expires > now);
      const localHits = (triggers.get(skill) ?? []).flatMap(event => {
        const target = state.enemies.find(enemy => enemy.id === event.targetId);
        if (skill !== 'fire-burst') return target ? [target] : [];
        // The original explosion can kill/remove its primary before the secondary is scheduled.
        const position: Enemy = { id: event.targetId, x: event.x, y: event.y, hp: 0, maxHp: 0,
          radius: 0, speed: 0, damage: 0, experience: 0, kind: 'normal', archetype: 'melee',
          slowMultiplier: 1, slowUntilMs: 0, freezeUntilMs: 0, nextFreezeAllowedMs: 0 };
        return [position];
      });
      const effect = (shape: 'ring' | 'beam' | 'field' | 'orbit', at: Vector & { identityKey?: string }, radius: number,
        durationMs = 300, to?: Vector, identityKey = at.identityKey) => {
        ctx.events.push({ type: 'skill-path-effect', skill, path, shape, x: at.x, y: at.y,
          radius, durationMs, ...(to ? { toX: to.x, toY: to.y } : {}), ...(identityKey ? { identityKey } : {}) });
      };
      const damage = (enemy: Enemy, amount: number, source: DamageSource) => {
        if (enemy.hp > 0 && amount > 0) ctx.damage(enemy, amount * gain, source);
      };
      const pulse = (at: Vector, radius: number, amount: number, source: DamageSource) => {
        for (const enemy of live) if (distance(at, enemy) <= radius + enemy.radius) damage(enemy, amount, source);
        effect('ring', at, radius);
      };
      const slow = (enemy: Enemy, duration: number, multiplier = 0.55) => {
        if (enemy.slowUntilMs <= now) enemy.slowMultiplier = 1;
        enemy.slowMultiplier = Math.min(enemy.slowMultiplier, enemy.kind === 'boss' ? Math.max(0.7, multiplier) : multiplier);
        enemy.slowUntilMs = Math.max(enemy.slowUntilMs, now + duration);
      };
      const freeze = (enemy: Enemy, duration: number) => {
        if (enemy.kind !== 'boss') enemy.freezeUntilMs = Math.max(enemy.freezeUntilMs, now + duration);
        else slow(enemy, duration, 0.7);
      };
      const breakBullets = (bullets: EnemyProjectile[], by: 'blade' | 'barrier') => {
        const removed = new Set(bullets);
        state.enemyProjectiles = state.enemyProjectiles.filter(bullet => !removed.has(bullet));
        state.runStats.bulletsBlocked += removed.size;
        for (const bullet of removed) {
          const event: CombatEvent = { type: 'enemy-bullet-broken', x: bullet.x, y: bullet.y, by,
            playerId, bulletId: bullet.id, vx: bullet.vx, vy: bullet.vy };
          this.consumedEvents.add(event);
          ctx.events.push(event);
        }
      };
      const ready = (period: number) => {
        if (period <= 0) return false;
        route.clock += Math.max(0, ctx.deltaMs);
        const due = route.clock >= period;
        if (due) route.clock %= period;
        return due;
      };
      const shot = (at: Vector, direction: Vector, amount: number, source: DamageSource,
        pierce = 0, speed = 420, radius = 6, targetId = -1) => {
        if (route.shots.size >= LIMIT) return;
        const length = Math.hypot(direction.x, direction.y) || 1;
        const projectile: Projectile = { id: state.nextId++, playerId, derived: true, x: at.x, y: at.y,
          vx: direction.x / length * speed, vy: direction.y / length * speed, radius,
          damage: amount * gain, source, kind: source === 'north-star' ? 'star' : 'sword',
          targetId, ttlMs: 2400, pierceRemaining: pierce, hitEnemyIds: [] };
        state.projectiles.push(projectile); route.shots.set(projectile.id, projectile);
      };
      const area = (at: Vector, radius: number, duration: number, amount: number) => {
        const overlapping = route.areas.find(value => distance(at, value) < value.radius);
        let field: Area | undefined;
        if (level >= 5 && overlapping) {
          overlapping.expires = now + duration;
          field = overlapping;
          if (skill === 'meteor-seal') pulse(at, radius, player.meteorDamage * 0.6, 'meteor');
        } else if (route.areas.length < LIMIT) {
          field = { identityKey: `${route.identityKey}:field:${this.nextIdentity++}`,
            x: at.x, y: at.y, radius, expires: now + duration, damage: amount, nextTick: now + 200 };
          route.areas.push(field);
        }
        if (field) effect('field', field, field.radius, duration);
      };
      const previousMarks = new Map(route.marks);
      const liveIds = new Set(live.map(e => e.id));
      for (const [id, mark] of route.marks) if (mark.expires <= now || !liveIds.has(id)) route.marks.delete(id);
      const projectileIds = new Set(state.projectiles.map(p => p.id));
      for (const [id, projectile] of route.shots) if (!projectileIds.has(id) || projectile.ttlMs <= 0) route.shots.delete(id);

      switch (skill) {
        case 'chain-lightning':
          for (const primary of localHits.slice(0, 8)) {
            const nearby = live.filter(e => e.id !== primary.id && distance(e, primary) <= 160)
              .sort((a, b) => distance(a, primary) - distance(b, primary));
            if (path === 'a') {
              const visited = new Set(localHits.map(e => e.id));
              let frontier = [primary];
              for (let depth = 0; depth < (level >= 5 ? 2 : 1) + (awakened ? 1 : 0); depth++) {
                const next: Enemy[] = [];
                for (const from of frontier) {
                  const targets = live.filter(e => !visited.has(e.id) && distance(e, from) <= 160)
                    .sort((a, b) => distance(a, from) - distance(b, from)).slice(0, level >= 4 ? 2 : 1);
                  for (const target of targets) {
                    visited.add(target.id); damage(target, player.chainLightningDamage * 0.5, 'chain');
                    effect('beam', from, 8, 250, target); next.push(target);
                  }
                }
                frontier = next;
              }
            } else if (nearby.length > 0 && primary.hp > 0) {
              const first = level >= 4 ? [...nearby].sort((a, b) => priority(a) - priority(b))[0] : nearby[0];
              damage(first, player.chainLightningDamage * 0.25, 'chain');
              effect('beam', primary, 8, 250, first);
              damage(primary, player.chainLightningDamage * (route.buffUntil > now ? 0.9 : 0.55), 'chain');
              effect('beam', first, 10, 250, primary);
              if (level >= 5) route.buffUntil = now + 1200;
            }
          }
          break;
        case 'fire-burst':
          for (const primary of localHits.slice(0, 8)) {
            if (path === 'a' && route.blasts.length < LIMIT) {
              route.blasts.push({ x: primary.x, y: primary.y, at: now + (level >= 4 ? 160 : 320),
                radius: Math.max(35, player.fireBurstRadius * 0.65), damage: player.fireBurstDamage * 0.45, generation: 0 });
            } else if (path === 'b') area(primary, player.fireBurstRadius * 0.7, (level >= 4 ? 2400 : 1400) * gain, player.fireBurstDamage * 0.15);
          }
          {
            const pending = route.blasts; route.blasts = [];
            for (const blast of pending) {
              if (blast.at > now) { route.blasts.push(blast); continue; }
              const victims = live.filter(e => e.hp > 0 && distance(e, blast) <= blast.radius + e.radius);
              pulse(blast, blast.radius, blast.damage, 'fire');
              if (level >= 5 && blast.generation < (awakened ? 3 : 1)) {
                for (const victim of victims.filter(e => e.hp <= 0)) if (route.blasts.length < LIMIT) {
                  route.blasts.push({ ...blast, x: victim.x, y: victim.y, at: now + 160, generation: blast.generation + 1 });
                }
              }
            }
          }
          break;
        case 'golden-shield':
          if (path === 'a') {
            if (ready(level >= 4 ? 650 : 1000) && player.shield > 0) {
              const bullets = state.enemyProjectiles.filter(b => b.ttlMs > 0 && distance(b, player) <= player.radius + 45)
                .sort((a, b) => distance(a, player) - distance(b, player)).slice(0, awakened ? 3 : 1);
              for (const bullet of bullets) {
                breakBullets([bullet], 'barrier');
                shot(player, { x: -bullet.vx, y: -bullet.vy }, Math.max(8, player.attackDamage * 0.5), 'reprisal', level >= 5 ? 2 : 0);
                effect('beam', player, 8, 300, bullet);
              }
            }
          } else {
            route.charge = Math.min(level >= 4 ? 150 : 80, route.charge + Math.max(0, runtime.shield - player.shield) + Math.max(0, runtime.hp - player.hp));
            if (runtime.shield > 0 && player.shield <= 0 && route.charge > 0) {
              const radius = awakened ? 230 : 150;
              pulse(player, radius, route.charge * 0.7 + player.shieldBreakDamage * 0.3, 'reprisal');
              if (level >= 5) for (const enemy of live) if (enemy.kind !== 'boss' && distance(enemy, player) <= radius) {
                const length = distance(enemy, player) || 1;
                enemy.x += (enemy.x - player.x) / length * 45; enemy.y += (enemy.y - player.y) / length * 45;
                if (awakened) freeze(enemy, 450);
              }
              route.charge = 0;
            }
          }
          break;
        case 'frost-seal':
          // Death marks must be inspected before removing expired/dead entries.
          const markedDeaths = [...deaths, ...[...runtime.enemies.values()]
            .filter(snapshot => snapshot.hp > 0 && snapshot.enemy.hp <= 0 && !deaths.includes(snapshot.enemy)).map(snapshot => snapshot.enemy)];
          if (path === 'b') for (const dead of markedDeaths) {
            const mark = previousMarks.get(dead.id);
            if (!mark || mark.expires <= now) continue;
            let frontier = [dead]; const visited = new Set([dead.id]);
            for (let depth = 0; depth < (level >= 5 ? 2 : 1) + (awakened ? 1 : 0); depth++) {
              const next: Enemy[] = [];
              for (const from of frontier) for (const enemy of live) {
                if (visited.has(enemy.id) || distance(enemy, from) > (level >= 4 ? 140 : 90)) continue;
                visited.add(enemy.id); slow(enemy, 1600); damage(enemy, player.attackDamage * 0.35, 'soul');
                if (route.marks.size < LIMIT) route.marks.set(enemy.id, { stacks: 1, expires: now + 3500, vulnerableUntil: 0 });
                effect('beam', from, 10, 300, enemy); next.push(enemy);
              }
              frontier = next;
            }
          }
          for (const enemy of localHits) {
            if (enemy.hp <= 0) continue;
            const mark = route.marks.get(enemy.id) ?? { stacks: 0, expires: now + 3500, vulnerableUntil: 0 };
            mark.stacks++; mark.expires = now + 3500;
            if (path === 'a') {
              if (level >= 5 && mark.vulnerableUntil > now) damage(enemy, player.attackDamage * 0.3, 'soul');
              if (mark.stacks >= (awakened ? 1 : level >= 4 ? 2 : 3)) {
                freeze(enemy, 700 * gain); mark.stacks = 0; mark.vulnerableUntil = now + 1000;
                effect('field', enemy, 25, 700 * gain);
              }
            } else { slow(enemy, 1500); effect('field', enemy, 20, 1500); }
            if (route.marks.size < LIMIT || route.marks.has(enemy.id)) route.marks.set(enemy.id, mark);
          }
          break;
        case 'orbiting-blades':
          if (path === 'a') {
            if (ready(route.buffUntil > now ? 80 : 300)) {
              const radius = player.orbitingBladeRadius + (level >= 4 ? 30 : 0);
              const bullets = state.enemyProjectiles.filter(b => b.ttlMs > 0 && distance(b, player) <= radius);
              const removed = new Set(bullets.slice(0, awakened ? 4 : 1));
              if (removed.size) {
                breakBullets([...removed], 'blade');
                if (level >= 5) route.buffUntil = now + 700;
                effect('orbit', player, radius, 300, undefined, `${route.identityKey}:guard`);
              }
            }
          } else {
            if (ready(Math.max(500, player.attackCooldownMs * 2))) {
              const target = live.filter(e => priority(e) === 0 && distance(e, player) <= (level >= 4 ? 550 : 320))
                .sort((a, b) => distance(a, player) - distance(b, player))[0];
              if (target && route.flights.length < 8) {
                const pursuits = awakened ? [target, ...live.filter(e => e !== target && priority(e) === 0).slice(0, 1)] : [target];
                for (const pursued of pursuits) route.flights.push({ identityKey: `${route.identityKey}:flight:${this.nextIdentity++}`,
                  x: player.x, y: player.y, origin: { x: player.x, y: player.y }, target: pursued,
                  start: now, hit: false, returnHitIds: new Set() });
              }
            }
            for (const flight of route.flights) {
              const age = now - flight.start;
              const previous = { x: flight.x, y: flight.y };
              const destination = age < 350 ? flight.target : player;
              if (age >= 350 && !flight.hit) {
                damage(flight.target, player.orbitingBladeDamagePerSecond * 0.4, 'orbit'); flight.hit = true;
                flight.turn = { x: flight.target.x, y: flight.target.y };
                previous.x = flight.turn.x; previous.y = flight.turn.y;
              }
              const origin = flight.turn ?? flight.origin;
              const fraction = Math.min(1, Math.max(0, age - (flight.turn ? 350 : 0)) / 350);
              flight.x = origin.x + (destination.x - origin.x) * fraction;
              flight.y = origin.y + (destination.y - origin.y) * fraction;
              if (age > 350 && level >= 5) for (const enemy of live) {
                if (enemy.hp > 0 && flight.returnHitIds.size < LIMIT && !flight.returnHitIds.has(enemy.id)
                  && segmentDistance(previous, flight, enemy) <= enemy.radius + 16) {
                  damage(enemy, player.orbitingBladeDamagePerSecond * 0.3, 'orbit'); flight.returnHitIds.add(enemy.id);
                }
              }
              effect('orbit', flight, 16, 100, destination);
            }
            route.flights = route.flights.filter(flight => now - flight.start < 700);
          }
          break;
        case 'meteor-seal':
          if (ready(player.meteorCooldownMs)) {
            const targets = [...live].sort((a, b) => distance(a, player) - distance(b, player));
            const main = targets[0];
            if (main && path === 'a') {
              const count = awakened ? 4 : 2;
              const radius = level >= 4 ? 300 : 160;
              const fresh = targets.filter(e => e !== main && distance(e, main) <= radius);
              for (let i = 0; i < count; i++) {
                const target = level >= 5 ? fresh[i] ?? main : fresh[0] ?? main;
                const angle = i * Math.PI * 2 / count;
                const at = level >= 5 ? target : { x: target.x + Math.cos(angle) * 35, y: target.y + Math.sin(angle) * 35 };
                pulse(at, 42, player.meteorDamage * 0.35, 'meteor');
              }
            } else if (main) area(main, 85 * gain, level >= 4 ? 3000 : 1800, player.meteorDamage * 0.12);
          }
          break;
        case 'north-star':
          if (ready(player.northStarCooldownMs)) {
            const count = Math.min(16, Math.max(1, player.northStarShotCount) + (awakened ? 2 : 0));
            if (path === 'a' && route.stars.length < 8) {
              const stars = { identityKey: `${route.identityKey}:stars:${this.nextIdentity++}`, start: now, count, hitIds: new Set<number>() };
              route.stars.push(stars); effect('orbit', player, 60, 800, undefined, stars.identityKey);
            } else if (path === 'b') {
              const target = [...live].sort((a, b) => priority(a) - priority(b) || distance(a, player) - distance(b, player))[0];
              if (target) for (let i = 0; i < count; i++) {
                shot(player, { x: target.x - player.x, y: target.y - player.y }, player.northStarDamage * 0.35,
                  'north-star', player.northStarPierce, 360, 6, target.id);
                effect('beam', player, 6, 200, target);
              }
            }
          }
          if (path === 'a') {
            for (const stars of route.stars) {
              const age = now - stars.start;
              effect('orbit', player, 60, Math.max(1, 800 - age), undefined, stars.identityKey);
              for (let i = 0; i < stars.count; i++) {
                const angle = age / 800 * Math.PI * 2 + i / stars.count * Math.PI * 2;
                const at = { x: player.x + Math.cos(angle) * 60, y: player.y + Math.sin(angle) * 60 };
                if (level >= 4) for (const enemy of live) {
                  // Swept annulus prevents low frame rates skipping an entire orbit collision.
                  if (!stars.hitIds.has(enemy.id) && stars.hitIds.size < LIMIT && Math.abs(distance(enemy, player) - 60) <= enemy.radius + 10 && age > 0) {
                    damage(enemy, player.northStarDamage * 0.25, 'north-star'); stars.hitIds.add(enemy.id); effect('orbit', at, 10, 100, undefined, `${stars.identityKey}:${i}`);
                  }
                }
                if (age >= 800) shot(at, { x: Math.cos(angle), y: Math.sin(angle) }, player.northStarDamage * 0.35,
                  'north-star', player.northStarPierce, level >= 5 ? 540 : 360);
              }
            }
            route.stars = route.stars.filter(stars => now - stars.start < 800);
          } else for (const projectile of route.shots.values()) {
            let target = live.find(e => e.id === projectile.targetId && e.hp > 0);
            if (!target && level >= 5) {
              target = [...live].filter(e => e.hp > 0 && !projectile.hitEnemyIds.includes(e.id))
                .sort((a, b) => priority(a) - priority(b) || distance(a, projectile) - distance(b, projectile))[0];
              if (target) projectile.targetId = target.id;
            }
            if (!target) continue;
            const speed = Math.hypot(projectile.vx, projectile.vy);
            const angle = Math.atan2(projectile.vy, projectile.vx);
            const desired = Math.atan2(target.y - projectile.y, target.x - projectile.x);
            const difference = Math.atan2(Math.sin(desired - angle), Math.cos(desired - angle));
            const maxTurn = (level >= 4 ? 2.4 : 1.2) * gain * Math.max(0, ctx.deltaMs) / 1000;
            const turned = angle + Math.max(-maxTurn, Math.min(maxTurn, difference));
            projectile.vx = Math.cos(turned) * speed; projectile.vy = Math.sin(turned) * speed;
          }
          break;
        case 'bullet-reprisal': {
          const broken = baseBreaks.map(event => ({ x: event.x, y: event.y,
            vx: event.vx ?? (player.x - event.x || -1), vy: event.vy ?? player.y - event.y }));
          if (ready(250)) {
            const intercepted = state.enemyProjectiles.filter(b => b.ttlMs > 0 && distance(b, player) <= player.bulletReprisalRadius)
              .sort((a, b) => distance(a, player) - distance(b, player)).slice(0, awakened ? 3 : 1);
            breakBullets(intercepted, 'barrier');
            broken.push(...intercepted);
          }
            for (const bullet of broken) {
              if (path === 'a') {
                route.charge = route.buffUntil > now ? Math.min(4, route.charge + 1) : 1; route.buffUntil = now + 900;
                shot(player, { x: -bullet.vx, y: -bullet.vy }, player.bulletReprisalDamage * 0.6,
                  'reprisal', level >= 4 ? 2 : 0, 460, level >= 5 ? 6 + route.charge * 2 : 6);
                effect('beam', player, level >= 5 ? 6 + route.charge * 2 : 6, 250, bullet);
              } else {
                route.charge++; effect('orbit', player, 35, 300, undefined, `${route.identityKey}:qi`);
                if (route.charge >= (level >= 4 ? 2 : 3)) {
                  const radius = player.bulletReprisalRadius + (awakened ? 140 : 90);
                  breakBullets(state.enemyProjectiles.filter(b => b.ttlMs > 0 && distance(b, player) <= radius), 'barrier');
                  pulse(player, radius, level >= 5 ? player.bulletReprisalDamage * 0.7 : 0, 'reprisal'); route.charge = 0;
                }
              }
            }
          break;
        }
        case 'soul-pin':
          for (const primary of localHits.slice(0, 8)) {
            if (primary.hp <= 0) continue;
            if (path === 'a') {
              freeze(primary, Math.max(400, player.soulPinRootMs) * gain);
              const radius = (level >= 4 ? 140 : 90) * (level >= 5 && priority(primary) === 0 ? 1.4 : 1);
              area(primary, radius, 1200 * gain, 0);
              for (const enemy of live) if (distance(enemy, primary) <= radius) {
                slow(enemy, 400, level >= 5 && priority(primary) === 0 ? 0.4 : 0.55);
                if (awakened && enemy !== primary && enemy.kind !== 'boss') freeze(enemy, 300);
              }
            } else {
              const maxDistance = (level >= 4 ? 260 : 170) * gain;
              const partners = live.filter(e => e !== primary && distance(e, primary) <= maxDistance)
                .sort((a, b) => distance(a, primary) - distance(b, primary)).slice(0, awakened ? 3 : level >= 5 ? 2 : 1);
              if (partners.length && route.links.length < LIMIT) {
                const ids = [primary.id, ...partners.map(e => e.id)];
                if (!route.links.some(link => link.ids[0] === primary.id)) {
                  const link = { identityKey: `${route.identityKey}:link:${this.nextIdentity++}`, ids, maxDistance, expires: now + 1800 * gain, nextTick: now + 200 };
                  route.links.push(link);
                  effect('beam', primary, 9, 1800 * gain, partners[0], `${link.identityKey}:1`);
                }
              }
            }
          }
          route.links = route.links.filter(link => {
            const targets = link.ids.map(id => live.find(e => e.id === id && e.hp > 0));
            if (link.expires <= now || targets.some(e => !e)) return false;
            const enemies = targets as Enemy[];
            if (enemies.some((enemy, index) => index > 0 && distance(enemies[index - 1], enemy) > link.maxDistance)) return false;
            if (link.nextTick <= now) {
              const ticks = Math.min(8, Math.floor((now - link.nextTick) / 200) + 1); link.nextTick = now + 200;
              for (const enemy of enemies) damage(enemy, player.attackDamage * 0.15 * ticks, 'soul');
              for (let i = 1; i < enemies.length; i++) effect('beam', enemies[i - 1], 9, 220, enemies[i], `${link.identityKey}:${i}`);
            }
            return true;
          });
          break;
      }
      route.areas = route.areas.filter(field => {
        if (field.expires <= now) return false;
        if (field.nextTick <= now) {
          const ticks = Math.min(12, Math.floor((now - field.nextTick) / 200) + 1); field.nextTick = now + 200;
          for (const enemy of live) if (distance(enemy, field) <= field.radius + enemy.radius) {
            if (skill === 'meteor-seal' || skill === 'soul-pin') slow(enemy, 400);
            damage(enemy, field.damage * ticks, skill === 'meteor-seal' ? 'meteor' : 'fire');
          }
          effect('field', field, field.radius, Math.min(300, field.expires - now));
        }
        return true;
      });
    }
    runtime.enemies.clear();
    for (const enemy of state.enemies.filter(e => e.hp > 0).slice(0, 2048)) runtime.enemies.set(enemy.id, { enemy, hp: enemy.hp });
    runtime.time = now; runtime.hp = player.hp; runtime.shield = player.shield;
  }
}
