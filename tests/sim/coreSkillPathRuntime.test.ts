import { describe, expect, it } from 'vitest';
import { CoreSkillPathRuntime } from '../../src/sim/coreSkillPathRuntime';
import type { SkillPathContext } from '../../src/sim/skillPathRuntime';
import { createDefaultState } from '../../src/sim/state';
import type { CombatEvent, Enemy, EnemyProjectile, Player } from '../../src/sim/types';
import type { SkillId, SkillPathKey } from '../../src/sim/skillPaths';

function fixture(skill: SkillId, path: SkillPathKey, level = 3) {
  const state = createDefaultState();
  const player = state.player;
  player.x = 300; player.y = 300;
  player.equippedSkills = [skill];
  player.upgradeLevels[skill] = level;
  player.skillPaths[skill] = path;
  Object.assign(player, { attackCooldownMs: 500, chainLightningDamage: 20, fireBurstDamage: 30, fireBurstRadius: 90,
    meteorDamage: 40, meteorCooldownMs: 1000, northStarCooldownMs: 1000,
    northStarDamage: 20, northStarShotCount: 3, orbitingBladeRadius: 70,
    orbitingBladeDamagePerSecond: 30, bulletReprisalRadius: 90, bulletReprisalDamage: 20,
    shield: 50, maxShield: 50, shieldBreakDamage: 20, soulPinRootMs: 500 });
  const runtime = new CoreSkillPathRuntime();
  const ctx: SkillPathContext = { state, player, deltaMs: 0, events: [], damage: (enemy, amount, source) => {
    enemy.hp -= amount;
    ctx.events.push({ type: 'damage-dealt', x: enemy.x, y: enemy.y, amount, source, targetId: enemy.id });
  } };
  function enemy(x = 340, y = 300, extra: Partial<Enemy> = {}): Enemy {
    const value: Enemy = { id: state.nextId++, x, y, hp: 1000, maxHp: 1000, radius: 10,
      speed: 20, damage: 1, experience: 1, kind: 'normal', archetype: 'melee',
      slowMultiplier: 1, slowUntilMs: 0, freezeUntilMs: 0, nextFreezeAllowedMs: 0, ...extra };
    state.enemies.push(value); return value;
  }
  function bullet(x = 320, y = 300): EnemyProjectile {
    const value: EnemyProjectile = { id: state.nextId++, ownerId: 999, x, y, vx: -100, vy: 0,
      radius: 5, damage: 1, ttlMs: 5000, kind: 'bolt', homingMs: 0, turnRate: 0 };
    state.enemyProjectiles.push(value); return value;
  }
  function step(ms = 16, as: Player = player, events: CombatEvent[] = []) {
    state.elapsedMs += ms; ctx.deltaMs = ms; ctx.player = as; ctx.events = events;
    runtime.update(ctx); return ctx.events;
  }
  function trigger(target: Enemy, as: Player = player, selectedSkill = skill): CombatEvent {
    return { type: 'skill-path-trigger', skill: selectedSkill, playerId: as === state.player ? 'p1' : 'p2',
      targetId: target.id, x: target.x, y: target.y };
  }
  function hit(target: Enemy) { target.hp -= 1; return step(16, player, [trigger(target)]); }
  function effect() { expect(ctx.events).toContainEqual(expect.objectContaining({ type: 'skill-path-effect', skill, path })); }
  return { state, player, runtime, ctx, enemy, bullet, step, hit, trigger, effect };
}

describe('core skill route behavior', () => {
  const skills: SkillId[] = ['chain-lightning', 'fire-burst', 'golden-shield', 'frost-seal',
    'orbiting-blades', 'meteor-seal', 'north-star', 'bullet-reprisal', 'soul-pin'];
  it.each(skills.flatMap(skill => (['a', 'b'] as const).map(path => [skill, path] as const)))
   ('%s %s has an actual simulation mechanism already at Lv3', (skill, path) => {
      const f = fixture(skill, path); const e = f.enemy(360, 300, { eliteAffix: 'haste' }); const second = f.enemy(410);
      f.step(0);
      switch (skill) {
        case 'chain-lightning': f.hit(e); expect(e.hp < 999 || second.hp < 1000).toBe(true); break;
        case 'fire-burst': f.hit(e); f.step(350); expect(second.hp).toBeLessThan(1000); break;
        case 'golden-shield':
          if (path === 'a') { f.bullet(); f.step(1000); expect(f.state.projectiles).toHaveLength(1); }
          else { f.player.shield = 0; f.step(); expect(second.hp).toBeLessThan(1000); }
          break;
        case 'frost-seal':
          if (path === 'a') { f.hit(e); f.hit(e); f.hit(e); expect(e.freezeUntilMs).toBeGreaterThan(f.state.elapsedMs); }
          else { f.hit(e); e.hp = 0; f.step(); expect(second.hp).toBeLessThan(1000); }
          break;
        case 'orbiting-blades':
          if (path === 'a') { f.bullet(); f.step(400); expect(f.state.enemyProjectiles).toHaveLength(0); }
          else { f.step(1000); f.step(350); expect(e.hp).toBeLessThan(1000); }
          break;
        case 'meteor-seal': f.step(1000); if (path === 'b') f.step(250); expect(e.hp + second.hp).toBeLessThan(2000); break;
        case 'north-star': f.step(1000); if (path === 'a') f.step(800); expect(f.state.projectiles.length).toBeGreaterThan(0); break;
        case 'bullet-reprisal':
          for (let i = 0; i < (path === 'a' ? 1 : 3); i++) { f.bullet(); f.step(300); }
          expect(f.state.enemyProjectiles).toHaveLength(0);
          if (path === 'a') expect(f.state.projectiles).toHaveLength(1);
          break;
        case 'soul-pin': f.hit(e);
          if (path === 'a') expect(e.freezeUntilMs).toBeGreaterThan(f.state.elapsedMs);
          else { f.step(250); expect(second.hp).toBeLessThan(1000); }
          break;
      }
      f.effect();
    });
  it('chain A forks only to fresh targets and Lv5 conducts beyond the first branch', () => {
    const f = fixture('chain-lightning', 'a', 5);
    const primary = f.enemy(); const next = f.enemy(470); const far = f.enemy(610);
    f.step(); f.hit(primary);
    expect(next.hp).toBeLessThan(1000); expect(far.hp).toBeLessThan(1000); f.effect();
  });
  it('chain B closes on the original elite and stores charge for the next hit', () => {
    const f = fixture('chain-lightning', 'b', 5); const e = f.enemy(340, 300, { eliteAffix: 'haste' });
    f.enemy(400); f.step(); f.hit(e); const first = 999 - e.hp; f.effect();
    const before = e.hp; f.hit(e); expect(before - e.hp - 1).toBeGreaterThan(first);
  });
  it('fire A delays a smaller secondary blast and Lv5 ignites its kills', () => {
    const f = fixture('fire-burst', 'a', 5); const e = f.enemy(); const victim = f.enemy(350, 300, { hp: 5 });
    f.step(); f.hit(e); expect(victim.hp).toBe(5);
    f.step(200); expect(victim.hp).toBeLessThanOrEqual(0); f.effect();
    const newcomer = f.enemy(355); f.step(200); expect(newcomer.hp).toBeLessThan(1000);
  });
  it('fire B burns over time and Lv5 refreshes overlapping fields', () => {
    const f = fixture('fire-burst', 'b', 5); const e = f.enemy(); f.step(); f.hit(e); f.effect();
    f.step(1500); f.hit(e); const before = e.hp; f.step(900);
    expect(e.hp).toBeLessThan(before);
  });
  it('shield A intercepts only near its player and fires a piercing golden shard at Lv5', () => {
    const f = fixture('golden-shield', 'a', 5); f.enemy(); const close = f.bullet(); const far = f.bullet(900);
    f.step(1000); expect(f.state.enemyProjectiles).not.toContain(close);
    expect(f.state.enemyProjectiles).toContain(far); expect(f.state.projectiles[0].pierceRemaining).toBeGreaterThan(0); f.effect();
  });
  it('shield B accumulates absorbed damage and releases it with Lv5 nonboss knockback on break', () => {
    const f = fixture('golden-shield', 'b', 5); const e = f.enemy(); const boss = f.enemy(350, 300, { kind: 'boss' });
    f.step(); f.player.shield = 25; f.step(); expect(e.hp).toBe(1000);
    f.player.shield = 0; f.step(); expect(e.hp).toBeLessThan(1000); expect(e.x).toBeGreaterThan(340);
    expect(boss.x).toBe(350); f.effect();
  });
  it('frost A requires repeated actual hits, freezes normals, and never freezes bosses', () => {
    const f = fixture('frost-seal', 'a', 4); const e = f.enemy(); const boss = f.enemy(350, 300, { kind: 'boss' });
    f.step(); f.hit(e); expect(e.freezeUntilMs).toBe(0); f.hit(e);
    expect(e.freezeUntilMs).toBeGreaterThan(f.state.elapsedMs); f.effect();
    f.hit(boss); f.hit(boss); expect(boss.freezeUntilMs).toBe(0);
    f.step(2000); expect(e.freezeUntilMs).toBeLessThan(f.state.elapsedMs);
  });
  it('frost B spreads damage and slow from a marked death even after removal', () => {
    const f = fixture('frost-seal', 'b', 5); const e = f.enemy(); const next = f.enemy(400); const last = f.enemy(530);
    f.step(); f.hit(e); e.hp = 0; f.state.enemies = f.state.enemies.filter(v => v !== e); f.step();
    expect(next.hp).toBeLessThan(1000); expect(last.hp).toBeLessThan(1000);
    expect(next.slowUntilMs).toBeGreaterThan(f.state.elapsedMs); f.effect();
  });
  it('orbit A cuts nearby bullets and Lv5 block acceleration cuts the next bullet sooner', () => {
    const f = fixture('orbiting-blades', 'a', 5); f.bullet(); f.step(400); f.effect();
    expect(f.state.enemyProjectiles).toHaveLength(0); f.bullet(); f.step(100);
    expect(f.state.enemyProjectiles).toHaveLength(0);
  });
  it('orbit B flies to an elite and Lv5 cuts again while returning', () => {
    const f = fixture('orbiting-blades', 'b', 5); const e = f.enemy(400, 300, { eliteAffix: 'haste' });
    f.step(1000); f.effect(); f.step(350); expect(e.hp).toBeLessThan(1000);
    const before = e.hp; f.step(350); expect(e.hp).toBeLessThan(before);
  });
  it('meteor A supplements a cooldown-bound cast with two minor impacts at fresh targets', () => {
    const f = fixture('meteor-seal', 'a', 5); f.enemy(); const a = f.enemy(450); const b = f.enemy(550);
    f.step(1000); expect(a.hp).toBeLessThan(1000); expect(b.hp).toBeLessThan(1000); f.effect();
  });
  it('meteor B leaves a slowing crater and Lv5 overlapping casts erupt', () => {
    const f = fixture('meteor-seal', 'b', 5); const e = f.enemy(); f.step(1000); f.effect();
    f.step(250); expect(e.hp).toBeLessThan(1000); expect(e.slowUntilMs).toBeGreaterThan(f.state.elapsedMs);
    const before = e.hp; f.step(750); expect(before - e.hp).toBeGreaterThan(20);
  });
  it('star A orbits for a complete turn, collides at Lv4 and launches a faster Lv5 volley', () => {
    const f = fixture('north-star', 'a', 5); const e = f.enemy(360); f.step(1000); f.effect();
    expect(f.state.projectiles).toHaveLength(0); f.step(200); expect(e.hp).toBeLessThan(1000);
    f.step(600); expect(f.state.projectiles.length).toBeGreaterThan(0);
    expect(Math.hypot(f.state.projectiles[0].vx, f.state.projectiles[0].vy)).toBeGreaterThan(400);
  });
  it('star B homes toward ranged enemies and Lv5 retargets after a kill', () => {
    const f = fixture('north-star', 'b', 5); f.enemy(350); const ranged = f.enemy(400, 400, { archetype: 'crossbow' });
    f.step(1000); f.effect(); const star = f.state.projectiles[0]; expect(star.targetId).toBe(ranged.id);
    ranged.hp = 0; f.step(50); expect(star.targetId).not.toBe(ranged.id);
  });
  it('reprisal A breaks an incoming bullet and reflects along its incoming direction', () => {
    const f = fixture('bullet-reprisal', 'a', 5); f.bullet(); f.step(500); f.effect();
    expect(f.state.enemyProjectiles).toHaveLength(0); const shot = f.state.projectiles[0];
    expect(shot.vx).toBeGreaterThan(0); expect(shot.pierceRemaining).toBeGreaterThan(0);
  });
  it('reprisal B stores qi, then clears an outer ring and adds Lv5 damage', () => {
    const f = fixture('bullet-reprisal', 'b', 5); const e = f.enemy(430); f.bullet(); f.step(300);
    expect(e.hp).toBe(1000); f.bullet(); const outer = f.bullet(450); f.step(300);
    expect(f.state.enemyProjectiles).not.toContain(outer); expect(e.hp).toBeLessThan(1000); f.effect();
  });
  it('soul A pins hit targets and Lv5 empowers the slow field around elites without boss hard CC', () => {
    const f = fixture('soul-pin', 'a', 5); const elite = f.enemy(340, 300, { eliteAffix: 'haste' }); const near = f.enemy(460);
    const boss = f.enemy(350, 300, { kind: 'boss' }); f.step(); f.hit(elite); f.effect();
    expect(elite.freezeUntilMs).toBeGreaterThan(f.state.elapsedMs); expect(near.slowUntilMs).toBeGreaterThan(f.state.elapsedMs);
    f.hit(boss); expect(boss.freezeUntilMs).toBe(0);
  });
  it('soul B links two enemies, Lv5 adds a third, and distance breaks links', () => {
    const f = fixture('soul-pin', 'b', 5); const a = f.enemy(); const b = f.enemy(400); const c = f.enemy(450);
    f.step(); f.hit(a); f.step(250); f.effect(); expect(b.hp).toBeLessThan(1000); expect(c.hp).toBeLessThan(1000);
    b.x = 2000; const before = a.hp; f.step(250); expect(a.hp).toBe(before);
  });
  it('cleans pending damage on route removal and never replays it after re-equipping', () => {
    const f = fixture('fire-burst', 'a'); const e = f.enemy(); f.step(); f.hit(e);
    delete f.player.skillPaths['fire-burst']; const before = e.hp; f.step(500);
    f.player.skillPaths['fire-burst'] = 'a'; f.step(500); expect(e.hp).toBe(before);
  });
  it('expires links and frost marks instead of retaining dead targets', () => {
    const f = fixture('soul-pin', 'b'); const a = f.enemy(); const b = f.enemy(400);
    f.step(); f.hit(a); f.step(3000); const before = b.hp; f.step(250); expect(b.hp).toBe(before);
    const frost = fixture('frost-seal', 'b'); const marked = frost.enemy(); const next = frost.enemy(400);
    frost.step(); frost.hit(marked); frost.step(5000); marked.hp = 0; frost.step(); expect(next.hp).toBe(1000);
  });
  it('keeps P2 projectile origin and shield charge separate from P1', () => {
    const f = fixture('golden-shield', 'a'); const p2 = createDefaultState().player;
    Object.assign(p2, { x: 800, y: 300, shield: 50, maxShield: 50 });
    p2.equippedSkills = ['golden-shield']; p2.upgradeLevels['golden-shield'] = 3; p2.skillPaths['golden-shield'] = 'a';
    const bullet = f.bullet(810); f.step(1000); expect(f.state.enemyProjectiles).toContain(bullet);
    f.step(1000, p2); expect(f.state.enemyProjectiles).not.toContain(bullet);
    expect(f.state.projectiles[0].x).toBe(p2.x); expect(f.player.shield).toBe(50);
  });
  it('preserves base damage, cooldowns and player shape', () => {
    const f = fixture('meteor-seal', 'b', 5); f.enemy(); const before = { ...f.player };
    f.step(1000); f.step(300); expect(f.player).toEqual(before);
  });
  it('gates Lv6 meteor extras on the matching equipped enhancement, including delayed awakening', () => {
    const f = fixture('meteor-seal', 'a', 6); for (let i = 0; i < 6; i++) f.enemy(340 + i * 30);
    f.step(1000); const ordinary = f.ctx.events.filter(e => e.type === 'skill-path-effect').length;
    f.player.upgradeLevels['boss-slayer'] = 1; f.step(1000);
    expect(f.ctx.events.filter(e => e.type === 'skill-path-effect')).toHaveLength(ordinary);
    f.player.equippedEnhancements.push('boss-slayer'); f.step(1000);
    expect(f.ctx.events.filter(e => e.type === 'skill-path-effect').length).toBeGreaterThan(ordinary);
  });
  it('does not run unselected, unequipped, low-level or invalid routes', () => {
    const f = fixture('fire-burst', 'a', 2); const e = f.enemy(); f.step(); f.hit(e); f.step(1000);
    expect(e.hp).toBe(999); f.player.upgradeLevels['fire-burst'] = 3; f.player.equippedSkills = [];
    f.hit(e); f.step(1000); expect(e.hp).toBe(998);
  });

  it('Lv4 chain forks add a fresh branch and return arcs prioritize elites', () => {
    const counts = [3, 4].map(level => {
      const f = fixture('chain-lightning', 'a', level); const e = f.enemy(); f.enemy(400); f.enemy(430);
      f.step(); f.hit(e); return f.state.enemies.filter(enemy => enemy.hp < 1000).length;
    });
    expect(counts).toEqual([2, 3]);
    for (const level of [3, 4]) {
      const f = fixture('chain-lightning', 'b', level); const e = f.enemy(); const close = f.enemy(370);
      const elite = f.enemy(450, 300, { eliteAffix: 'haste' }); f.step(); f.hit(e);
      expect(level === 3 ? close.hp : elite.hp).toBeLessThan(1000);
      expect(level === 3 ? elite.hp : close.hp).toBe(1000);
    }
  });
  it('Lv4 secondary blasts detonate sooner and ember fields last longer', () => {
    for (const level of [3, 4]) {
      const a = fixture('fire-burst', 'a', level); const e = a.enemy(); a.step(); a.hit(e);
      const before = e.hp; a.step(170); expect(e.hp < before).toBe(level === 4);
      const b = fixture('fire-burst', 'b', level); const target = b.enemy(); b.step(); b.hit(target); b.step(1300);
      const hp = target.hp; b.step(300); expect(target.hp < hp).toBe(level === 4);
    }
  });
  it('Lv4 shields intercept faster and hold more retaliation charge', () => {
    const retaliation: number[] = [];
    for (const level of [3, 4]) {
      const a = fixture('golden-shield', 'a', level); a.bullet(); a.step(700);
      expect(a.state.enemyProjectiles.length).toBe(level === 4 ? 0 : 1);
      const b = fixture('golden-shield', 'b', level); const e = b.enemy(); b.player.shield = 200;
      b.step(); b.player.shield = 0; b.step(); retaliation.push(1000 - e.hp);
    }
    expect(retaliation[1]).toBeGreaterThan(retaliation[0]);
  });
  it('Lv5 frost vulnerability supplements subsequent real hits and Lv4 frostmarks spread farther', () => {
    const bonus: number[] = [];
    for (const level of [4, 5]) {
      const f = fixture('frost-seal', 'a', level); const e = f.enemy(); f.step(); f.hit(e); f.hit(e);
      const hp = e.hp; f.hit(e); bonus.push(hp - e.hp);
    }
    expect(bonus[1]).toBeGreaterThan(bonus[0]);
    for (const level of [3, 4]) {
      const f = fixture('frost-seal', 'b', level); const e = f.enemy(); const far = f.enemy(460);
      f.step(); f.hit(e); e.hp = 0; f.step(); expect(far.hp < 1000).toBe(level === 4);
    }
  });
  it('Lv4 guardian blades cut farther and pursuing blades reach distant elites', () => {
    for (const level of [3, 4]) {
      const a = fixture('orbiting-blades', 'a', level); a.bullet(395); a.step(400);
      expect(a.state.enemyProjectiles.length).toBe(level === 4 ? 0 : 1);
      const b = fixture('orbiting-blades', 'b', level); const e = b.enemy(750, 300, { eliteAffix: 'haste' });
      b.step(1000); b.step(350); expect(e.hp < 1000).toBe(level === 4);
    }
  });
  it('Lv4 minor meteors reach farther and molten craters persist longer', () => {
    for (const level of [3, 4]) {
      const a = fixture('meteor-seal', 'a', level); a.enemy(); const far = a.enemy(570);
      a.step(1000); expect(far.hp < 1000).toBe(level === 4);
      const b = fixture('meteor-seal', 'b', level); const e = b.enemy(); b.step(1000);
      // Disable new casts without removing the route, so only the original crater is measured.
      b.player.meteorCooldownMs = 100_000; b.step(1700); const hp = e.hp; b.step(300);
      expect(e.hp < hp).toBe(level === 4);
    }
  });
  it('Lv4 orbiting stars collide and homing stars turn more strongly', () => {
    const turns: number[] = [];
    for (const level of [3, 4]) {
      const a = fixture('north-star', 'a', level); const e = a.enemy(360); a.step(1000); a.step(200);
      expect(e.hp < 1000).toBe(level === 4);
      const b = fixture('north-star', 'b', level); const target = b.enemy(400, 300, { archetype: 'crossbow' });
      b.step(1000); target.y = 500; b.step(100); turns.push(b.state.projectiles[0].vy);
    }
    expect(turns[1]).toBeGreaterThan(turns[0]);
  });
  it('Lv4 reflected rays pierce, Lv5 streaks widen them, and Lv4 qi needs fewer blocks', () => {
    for (const level of [3, 4, 5]) {
      const a = fixture('bullet-reprisal', 'a', level); a.bullet(); a.step(300); a.bullet(); a.step(300);
      expect(a.state.projectiles[0].pierceRemaining > 0).toBe(level >= 4);
      expect(a.state.projectiles[1].radius > a.state.projectiles[0].radius).toBe(level >= 5);
      const b = fixture('bullet-reprisal', 'b', level); b.bullet(); b.step(300); b.bullet(); b.bullet(450); b.step(300);
      expect(b.state.enemyProjectiles.some(bullet => bullet.x === 450)).toBe(level === 3);
    }
  });
  it('Lv4 soul pins extend slow fields and links, while Lv5 connects a third target', () => {
    for (const level of [3, 4, 5]) {
      const a = fixture('soul-pin', 'a', level); const target = a.enemy(); const far = a.enemy(460);
      a.step(); a.hit(target); expect(far.slowUntilMs > 0).toBe(level >= 4);
      const b = fixture('soul-pin', 'b', level); const e = b.enemy(); const farLink = b.enemy(540); const third = b.enemy(550);
      b.step(); b.hit(e); b.step(250); expect(farLink.hp < 1000).toBe(level >= 4);
      expect(third.hp < 1000).toBe(level >= 5);
    }
  });
  it('reuses a field identity on refresh/ticks and creates a new identity after route replacement', () => {
    const f = fixture('fire-burst', 'b', 5); const e = f.enemy(); f.step(); f.hit(e);
    const field = () => f.ctx.events.find(event => event.type === 'skill-path-effect' && event.shape === 'field');
    const initial = field(); expect(initial?.type).toBe('skill-path-effect');
    if (initial?.type !== 'skill-path-effect') throw new Error('Missing field');
    expect(initial.identityKey).toBeTruthy();
    f.step(250); expect(field()).toEqual(expect.objectContaining({ identityKey: initial.identityKey }));
    f.hit(e); expect(field()).toEqual(expect.objectContaining({ identityKey: initial.identityKey }));
    f.player.skillPaths['fire-burst'] = 'a'; f.step(250);
    expect(f.ctx.events.some(event => event.type === 'skill-path-effect' && event.identityKey === initial.identityKey && event.durationMs > 0)).toBe(false);
    expect(f.ctx.events).toContainEqual(expect.objectContaining({ type: 'skill-path-effect', identityKey: initial.identityKey, durationMs: 0 }));
    f.player.skillPaths['fire-burst'] = 'b'; f.hit(e);
    expect(field()).not.toEqual(expect.objectContaining({ identityKey: initial.identityKey }));
  });
  it('uses distinct field identities for P1/P2 even at the same coordinates', () => {
    const f = fixture('meteor-seal', 'b', 5); f.enemy(); f.step(1000);
    const keys = () => f.ctx.events.flatMap(event => event.type === 'skill-path-effect' && event.identityKey ? [event.identityKey] : []);
    const first = keys(); const p2 = createDefaultState().player;
    Object.assign(p2, { x: 300, y: 300, meteorDamage: 40, meteorCooldownMs: 1000 });
    p2.equippedSkills = ['meteor-seal']; p2.upgradeLevels['meteor-seal'] = 5; p2.skillPaths['meteor-seal'] = 'b';
    f.step(1000, p2); const second = keys(); expect(first.length).toBeGreaterThan(0); expect(second.length).toBeGreaterThan(0);
    expect(second.some(key => first.includes(key))).toBe(false);
  });
  it.each(['orbiting-blades', 'north-star', 'soul-pin'] as const)('reuses ongoing %s identities', skill => {
    const f = fixture(skill, skill === 'north-star' ? 'a' : 'b', 5); const e = f.enemy(360, 300, { eliteAffix: 'haste' }); f.enemy(400);
    if (skill === 'soul-pin') { f.step(); f.hit(e); } else f.step(1000);
    const keys = f.ctx.events.flatMap(event => event.type === 'skill-path-effect' && event.identityKey ? [event.identityKey] : []);
    expect(keys.length).toBeGreaterThan(0); f.step(250);
    expect(f.ctx.events.some(event => event.type === 'skill-path-effect' && keys.includes(event.identityKey ?? ''))).toBe(true);
  });
  it('cleans expired fields and removed routes without replaying old identities', () => {
    const f = fixture('meteor-seal', 'b', 3); const e = f.enemy(); f.step(1000);
    f.player.meteorCooldownMs = 100_000; f.step(2000); const before = e.hp; f.step(300);
    expect(f.ctx.events).toHaveLength(0); expect(e.hp).toBe(before);
    const orbit = fixture('north-star', 'a'); orbit.enemy(); orbit.step(1000);
    delete orbit.player.skillPaths['north-star']; orbit.step(1000);
    expect(orbit.state.projectiles).toHaveLength(0);
    expect(orbit.ctx.events.every(event => event.type === 'skill-path-effect' && event.durationMs === 0)).toBe(true);
  });
  it('does not turn its own supplementary damage into new hit-trigger chains', () => {
    const f = fixture('fire-burst', 'a'); const e = f.enemy(); f.step(); f.hit(e); f.step(350);
    const before = e.hp; f.step(500); f.step(500); expect(e.hp).toBe(before);
  });
  it('resets private state if a player is reused in a new game state', () => {
    const f = fixture('fire-burst', 'a'); const e = f.enemy(); f.step(); f.hit(e);
    const state = createDefaultState(); state.player = f.player; state.enemies = [e]; state.elapsedMs = 1000;
    const before = e.hp; f.runtime.update({ ...f.ctx, state, deltaMs: 1000 }); expect(e.hp).toBe(before);
  });
  it('cleans only its owned supplemental projectiles on removal, preserving base projectiles', () => {
    const f = fixture('north-star', 'b'); f.enemy(); f.step(1000);
    const base = { ...f.state.projectiles[0], id: f.state.nextId++, source: 'flying-sword' as const };
    f.state.projectiles.push(base); delete f.player.skillPaths['north-star']; f.step(16);
    expect(f.state.projectiles).toEqual([base]);
  });
  it('bounds active fields, tracked projectiles, HP history and cleans route maps', () => {
    const inspect = (f: ReturnType<typeof fixture>) => (f.runtime as unknown as {
      players: WeakMap<Player, { enemies: Map<number, unknown>; routes: Map<SkillId, {
        areas: unknown[]; shots: Map<number, unknown>;
      }> }>;
    }).players.get(f.player)!;
    const field = fixture('fire-burst', 'b'); const e = field.enemy(); field.step(0);
    for (let i = 0; i < 300; i++) field.step(0, field.player, [field.trigger(e)]);
    expect(inspect(field).routes.get('fire-burst')!.areas).toHaveLength(128);
    const stars = fixture('north-star', 'b'); stars.enemy(); stars.player.northStarCooldownMs = 1;
    for (let i = 0; i < 300; i++) stars.step(1);
    expect(inspect(stars).routes.get('north-star')!.shots.size).toBe(128);
    expect(stars.state.projectiles).toHaveLength(128);
    for (let i = 0; i < 2100; i++) field.enemy(); field.step(0);
    expect(inspect(field).enemies.size).toBe(2048);
    field.player.equippedSkills = []; field.step(0); expect(inspect(field).routes.size).toBe(0);
  });
  it('does not freeze a new target after the frost stack window has expired', () => {
    const f = fixture('frost-seal', 'a', 4); const e = f.enemy(); f.step(); f.hit(e);
    f.step(3600); f.hit(e); expect(e.freezeUntilMs).toBe(0);
    f.hit(e); expect(e.freezeUntilMs).toBeGreaterThan(f.state.elapsedMs);
  });
  it('does not return-cut targets that moved away from the actual flight path', () => {
    const f = fixture('orbiting-blades', 'b', 5); const e = f.enemy(400, 300, { eliteAffix: 'haste' });
    f.step(1000); f.step(350); const hp = e.hp; e.y = 600; f.step(350); expect(e.hp).toBe(hp);
  });
  it('supplementary projectile blocks update real accounting', () => {
    const f = fixture('golden-shield', 'a'); f.bullet(); f.step(1000);
    expect(f.state.runStats.bulletsBlocked).toBe(1);
    expect(f.ctx.events).toContainEqual(expect.objectContaining({ type: 'enemy-bullet-broken', by: 'barrier' }));
  });

  it.each((['chain-lightning', 'fire-burst', 'frost-seal', 'soul-pin'] as const)
    .flatMap(skill => (['a', 'b'] as const).map(path => [skill, path] as const)))
    ('unrelated HP decreases never trigger %s %s', (skill, path) => {
      const f = fixture(skill, path, 5); const e = f.enemy(); const next = f.enemy(400);
      f.step(); e.hp -= 10; f.step(); f.step(350);
      expect(e.hp).toBe(990); expect(next.hp).toBe(1000);
      expect(e.freezeUntilMs).toBe(0); expect(e.slowUntilMs).toBe(0);
      expect(f.ctx.events).toHaveLength(0);
    });
  it('consumes each primary trigger once, only for its named skill', () => {
    const f = fixture('fire-burst', 'b'); const e = f.enemy(); f.step();
    f.step(0, f.player, [f.trigger(e, f.player, 'chain-lightning')]);
    expect(f.ctx.events.filter(event => event.type === 'skill-path-effect')).toHaveLength(0);
    const trigger = f.trigger(e); f.step(0, f.player, [trigger, trigger]);
    expect(f.ctx.events.filter(event => event.type === 'skill-path-effect')).toHaveLength(1);
    f.step(0, f.player, [trigger]);
    expect(f.ctx.events.filter(event => event.type === 'skill-path-effect')).toHaveLength(0);
    delete f.player.skillPaths['fire-burst']; f.step(0, f.player, [trigger]);
    f.player.skillPaths['fire-burst'] = 'b'; f.step(0, f.player, [trigger]);
    expect(f.ctx.events.filter(event => event.type === 'skill-path-effect')).toHaveLength(0);
  });
  it('schedules a secondary explosion at a removed primary event position', () => {
    const f = fixture('fire-burst', 'a'); const primary = f.enemy(400); const nearby = f.enemy(420);
    const trigger = f.trigger(primary); primary.hp = 0;
    f.state.enemies = f.state.enemies.filter(enemy => enemy !== primary);
    f.step(0, f.player, [trigger]); f.step(350);
    expect(nearby.hp).toBeLessThan(1000);
    expect(f.ctx.events).toContainEqual(expect.objectContaining({ type: 'skill-path-effect', x: 400, y: 300 }));
  });
  it('keeps P1/P2 primary triggers separate and cannot feed route damage back between players', () => {
    const f = fixture('fire-burst', 'a'); const e = f.enemy(); const p2 = createDefaultState().player;
    Object.assign(p2, { x: 300, y: 300, fireBurstDamage: 30, fireBurstRadius: 90 });
    p2.equippedSkills = ['fire-burst']; p2.upgradeLevels['fire-burst'] = 3; p2.skillPaths['fire-burst'] = 'a';
    f.step(0); f.step(0, p2);
    const trigger = f.trigger(e);
    f.step(0, p2, [trigger]); expect(f.ctx.events.filter(event => event.type === 'skill-path-effect')).toHaveLength(0);
    f.step(0, f.player, [trigger]); f.step(350);
    const hp = e.hp; expect(hp).toBeLessThan(1000);
    f.step(0, p2, [...f.ctx.events]);
    for (let i = 0; i < 6; i++) { f.step(350); f.step(0, p2, [...f.ctx.events]); }
    expect(e.hp).toBe(hp);
    const partnerTrigger = f.trigger(e, p2); f.step(0, f.player, [partnerTrigger]);
    f.step(0, p2, [partnerTrigger]); f.step(350, p2);
    expect(e.hp).toBeLessThan(hp);
  });
  it('does not turn chain supplements into another equipped route primary proc', () => {
    const f = fixture('chain-lightning', 'a'); const e = f.enemy(); const neighbor = f.enemy(400);
    f.player.equippedSkills.push('fire-burst'); f.player.upgradeLevels['fire-burst'] = 5;
    f.player.skillPaths['fire-burst'] = 'a'; f.step(); f.hit(e);
    const hp = neighbor.hp; expect(hp).toBeLessThan(1000); f.step(1000); f.step(1000);
    expect(neighbor.hp).toBe(hp);
    expect(f.ctx.events.some(event => event.type === 'skill-path-effect' && event.skill === 'fire-burst')).toBe(false);
  });
  it('reflects an attributed real base break once without recounting its stats or intercepting it twice', () => {
    const f = fixture('bullet-reprisal', 'a', 5); const bullet = f.bullet();
    const event: CombatEvent = { type: 'enemy-bullet-broken', by: 'blade', playerId: 'p1',
      bulletId: bullet.id, x: bullet.x, y: bullet.y, vx: -50, vy: 50 };
    f.state.runStats.bulletsBlocked = 1; f.step(300, f.player, [event, event]);
    expect(f.state.projectiles).toHaveLength(1); expect(f.state.projectiles[0].vx).toBeGreaterThan(0);
    expect(f.state.projectiles[0].vy).toBeLessThan(0); expect(f.state.runStats.bulletsBlocked).toBe(1);
    f.step(0, f.player, [event]); expect(f.state.projectiles).toHaveLength(1);
  });
  it('accumulates real base breaks into qi once and ignores other-player or unattributed breaks', () => {
    const f = fixture('bullet-reprisal', 'b', 5); const e = f.enemy(430); const outer = f.bullet(450);
    const base = (playerId?: 'p1' | 'p2'): CombatEvent => ({ type: 'enemy-bullet-broken', by: 'blade',
      playerId, x: 320, y: 300, vx: -100, vy: 0 });
    f.step(0, f.player, [base('p2'), base()]); expect(e.hp).toBe(1000);
    const first = base('p1'); f.step(0, f.player, [first]); f.step(0, f.player, [first]);
    expect(f.state.enemyProjectiles).toContain(outer); expect(e.hp).toBe(1000);
    f.step(0, f.player, [base('p1')]); expect(f.state.enemyProjectiles).not.toContain(outer);
    expect(e.hp).toBeLessThan(1000); expect(f.state.runStats.bulletsBlocked).toBe(1);
    const hp = e.hp; f.step(0, f.player, [...f.ctx.events]); expect(e.hp).toBe(hp);
  });
  it('attributes its own break metadata and never reflects it again on event-array reuse', () => {
    const f = fixture('bullet-reprisal', 'a'); const bullet = f.bullet(); f.step(300);
    expect(f.ctx.events).toContainEqual(expect.objectContaining({ type: 'enemy-bullet-broken',
      playerId: 'p1', bulletId: bullet.id, vx: -100, vy: 0 }));
    f.step(0, f.player, [...f.ctx.events]); expect(f.state.projectiles).toHaveLength(1);
    expect(f.state.runStats.bulletsBlocked).toBe(1);
  });
  const projectileRoutes: Array<[SkillId, SkillPathKey]> = [
    ['golden-shield', 'a'], ['north-star', 'a'], ['north-star', 'b'], ['bullet-reprisal', 'a'],
  ];
  it.each(projectileRoutes.flatMap(([skill, path]) => (['p1', 'p2'] as const).map(owner => [skill, path, owner] as const)))
    ('tags every %s %s projectile as derived with owner %s', (skill, path, owner) => {
      const f = fixture(skill, path); f.enemy();
      const player = owner === 'p1' ? f.player : Object.assign(createDefaultState().player, f.player);
      if (skill === 'golden-shield' || skill === 'bullet-reprisal') f.bullet();
      f.step(1000, player); if (skill === 'north-star' && path === 'a') f.step(800, player);
      expect(f.state.projectiles.length).toBeGreaterThan(0);
      for (const projectile of f.state.projectiles) {
        expect(projectile.playerId).toBe(owner); expect(projectile.derived).toBe(true);
      }
    });
  it.each(['a', 'b'] as const)('P2 reprisal %s consumes only P2 base breaks at overlapping player positions', path => {
    const f = fixture('bullet-reprisal', path, 5); f.enemy();
    const p2 = Object.assign(createDefaultState().player, f.player);
    const event = (playerId: 'p1' | 'p2', bulletId: number): CombatEvent => ({ type: 'enemy-bullet-broken',
      by: 'blade', playerId, bulletId, x: 320, y: 300, vx: -100, vy: 0 });
    const p1Break = event('p1', 200); const p2Break = event('p2', 201);
    f.step(0, p2, [p1Break]); expect(f.ctx.events.filter(e => e.type === 'skill-path-effect')).toHaveLength(0);
    f.step(0, f.player, [p2Break]); expect(f.ctx.events.filter(e => e.type === 'skill-path-effect')).toHaveLength(0);
    f.step(0, p2, [p2Break]);
    expect(f.ctx.events).toContainEqual(expect.objectContaining({ type: 'skill-path-effect', skill: 'bullet-reprisal' }));
    const count = f.ctx.events.length; f.step(0, p2, [p2Break]); expect(f.ctx.events).toHaveLength(1);
    expect(count).toBeGreaterThan(1);
  });
});
