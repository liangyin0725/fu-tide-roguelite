import { describe, expect, it } from 'vitest';
import { AdvancedSkillPathRuntime } from '../../src/sim/advancedSkillPathRuntime';
import type { SkillPathContext } from '../../src/sim/skillPathRuntime';
import { createDefaultState } from '../../src/sim/state';
import { AWAKENING_REQUIREMENTS } from '../../src/sim/awakening';
import { GameSimulation } from '../../src/sim/GameSimulation';
import type { SkillId, SkillPathKey } from '../../src/sim/skillPaths';
import type { Enemy, EnemyProjectile, Projectile } from '../../src/sim/types';

function setup(skill: SkillId, path: SkillPathKey, level = 3) {
  const state = createDefaultState();
  const player = state.player;
  player.skillPaths[skill] = path;
  player.upgradeLevels[skill] = level;
  player.equippedSkills = [skill];
  Object.assign(player, {
    solarRayCooldownMs: 2000, solarRayDamage: 40, solarRayRange: 300,
    voidBellCooldownMs: 2000, voidBellDamage: 40, voidBellRadius: 160,
    swordRainCooldownMs: 2000, swordRainDamage: 40, swordRainCount: 3,
    stormNetCooldownMs: 2000, stormNetDamage: 40,
    mirrorSigilCooldownMs: 2000, mirrorSigilRadius: 100, mirrorSigilDamage: 40,
    frostDomainCooldownMs: 2000, frostDomainRadius: 160, frostDomainDamage: 40,
    riftReturnCooldownMs: 2000, riftReturnRange: 300, riftReturnDamage: 40,
    starPullCooldownMs: 2000, starPullRadius: 160, starPullDamage: 40, starPullForce: 30,
  });
  const runtime = new AdvancedSkillPathRuntime();
  const context: SkillPathContext = { state, player, deltaMs: 50, events: [],
    damage: (enemy, amount) => { enemy.hp -= amount; } };
  const step = (ms = 50) => {
    context.deltaMs = ms;
    state.elapsedMs += ms;
    runtime.update(context);
  };
  const advance = (ms: number) => { for (let t = 0; t < ms; t += 50) step(); };
  const enemy = (dx = 80, dy = 0, options: Partial<Enemy> = {}): Enemy => {
    const result: Enemy = { id: state.nextId++, x: player.x + dx, y: player.y + dy,
      radius: 10, hp: 10000, maxHp: 10000, kind: 'normal', archetype: 'melee',
      speed: 80, damage: 10, experience: 1, slowMultiplier: 1, slowUntilMs: 0,
      freezeUntilMs: 0, nextFreezeAllowedMs: 0, ...options };
    state.enemies.push(result);
    return result;
  };
  const bullet = (dx = 40): EnemyProjectile => {
    const result: EnemyProjectile = { id: state.nextId++, x: player.x + dx, y: player.y,
      ownerId: -1, kind: 'bolt', vx: -100, vy: 0, radius: 5, damage: 10,
      ttlMs: 5000, homingMs: 1000, turnRate: 2 };
    state.enemyProjectiles.push(result);
    return result;
  };
  const effect = () => expect(context.events).toEqual(expect.arrayContaining([
    expect.objectContaining({ type: 'skill-path-effect', skill, path }),
  ]));
  return { state, player, runtime, context, step, advance, enemy, bullet, effect };
}

describe('advanced skill routes', () => {
  it('solar A sweeps over time rather than only damaging the first target', () => {
    const f = setup('solar-ray', 'a');
    const target = f.enemy();
    f.step(); const before = target.hp;
    f.advance(650);
    expect(target.hp).toBeLessThan(before); f.effect();
  });
  it('solar B refracts from an elite to two neighbors', () => {
    const f = setup('solar-ray', 'b');
    f.enemy(80, 0, { eliteAffix: 'haste' });
    const neighbors = [f.enemy(120, 30), f.enemy(120, -30)];
    f.step();
    expect(neighbors.every(e => e.hp < 10000)).toBe(true); f.effect();
  });
  it('bell A expands, pushes normals and removes bullets', () => {
    const f = setup('void-bell', 'a'); const e = f.enemy(); const x = e.x;
    f.bullet(); f.advance(1000);
    expect(e.x).toBeGreaterThan(x); expect(f.state.enemyProjectiles).toHaveLength(0); f.effect();
  });
  it('bell B marks the outside then collapses inward without moving bosses', () => {
    const f = setup('void-bell', 'b'); const e = f.enemy(); const boss = f.enemy(100, 0, { kind: 'boss' });
    const x = e.x; const bx = boss.x; f.advance(1000);
    expect(e.x).toBeLessThan(x); expect(boss.x).toBe(bx); expect(boss.freezeUntilMs).toBe(0); f.effect();
  });
  it('rain A focuses the highest HP elite and retargets remaining swords at Lv5', () => {
    const f = setup('spirit-sword-rain', 'a', 5);
    const high = f.enemy(180, 0, { kind: 'boss', hp: 20, maxHp: 20000 });
    const low = f.enemy(80, 0, { eliteAffix: 'haste', hp: 15 });
    const normal = f.enemy(40); f.advance(1000);
    expect(high.hp).toBeLessThan(20); expect(low.hp).toBeLessThan(15);
    expect(normal.hp).toBeLessThan(10000); f.effect();
  });
  it('rain B moves its cutting wall through enemy groups', () => {
    const f = setup('spirit-sword-rain', 'b'); const e = f.enemy(); f.advance(1000);
    expect(e.hp).toBeLessThan(10000);
    const effects = f.context.events.filter(e => e.type === 'skill-path-effect');
    expect(new Set(effects.map(e => e.x)).size).toBeGreaterThan(1); f.effect();
  });
  it('net A binds entrants into its fixed field and interrupts windups at Lv5', () => {
    const f = setup('storm-net', 'a', 5); f.enemy(); f.step();
    const e = f.enemy(100, 10, { archetype: 'crossbow', rangedTelegraphing: true });
    f.advance(300);
    expect(e.freezeUntilMs).toBeGreaterThan(f.state.elapsedMs);
    expect(e.rangedTelegraphing).toBe(false); f.effect();
  });
  it('net B follows enemies and conducts between marked enemies at Lv5', () => {
    const f = setup('storm-net', 'b', 5); const e = f.enemy(); const other = f.enemy(110);
    f.step(); e.x += 80; other.x += 80; f.advance(800);
    expect(other.hp).toBeLessThan(10000);
    const effects = f.context.events.filter(e => e.type === 'skill-path-effect');
    expect(new Set(effects.map(e => e.x)).size).toBeGreaterThan(1); f.effect();
  });
  it('mirror A removes a hostile bullet and counters along its incoming line', () => {
    const f = setup('mirror-sigil', 'a'); f.enemy(); f.bullet(); f.step();
    expect(f.state.enemyProjectiles).toHaveLength(0);
    expect(f.state.projectiles[0]).toMatchObject({ source: 'reprisal', vx: 420 });
    expect(f.state.projectiles[0].damage).toBeGreaterThan(f.player.mirrorSigilDamage); f.effect();
  });
  it('mirror B copies the next real base volley, not synthetic aim or its own copies', () => {
    const f = setup('mirror-sigil', 'b'); f.bullet(20); f.bullet(30); f.bullet(40); f.step();
    const volley: Projectile[] = [-30, 30].map(vy => ({ id: f.state.nextId++, targetId: 9,
      x: f.player.x, y: f.player.y, vx: 400, vy, radius: 6, damage: 17,
      ttlMs: 1000, pierceRemaining: 2, hitEnemyIds: [7] }));
    f.state.projectiles.push(...volley); f.step();
    expect(f.state.projectiles).toHaveLength(4);
    expect(f.state.projectiles.slice(2).map(p => p.vy)).toEqual([-30, 30]);
    expect(f.state.projectiles[2].hitEnemyIds).toEqual([]);
    expect(f.state.projectiles[2].hitEnemyIds).not.toBe(volley[0].hitEnemyIds);
    f.step(); expect(f.state.projectiles).toHaveLength(4); f.effect();
  });
  it('P2 consumes a fresh rich base block once without a previous-frame bullet snapshot', () => {
    const f = setup('mirror-sigil', 'a');
    const p2 = { ...f.player, x: f.player.x + 20 };
    f.context.player = p2;
    f.context.events.push({ type: 'enemy-bullet-broken', by: 'barrier', x: p2.x, y: p2.y,
      playerId: 'p1', bulletId: 88, vx: -100, vy: 0 });
    f.context.events.push({ type: 'enemy-bullet-broken', by: 'barrier', x: p2.x, y: p2.y,
      playerId: 'p2', bulletId: 89, vx: 0, vy: -100 });
    f.step();
    expect(f.state.projectiles).toHaveLength(1);
    expect(f.state.projectiles[0]).toMatchObject({ playerId: 'p2', derived: true, source: 'reprisal', vy: 420 });
    expect(Math.abs(f.state.projectiles[0].vx)).toBeLessThan(0.001);
    f.advance(800); expect(f.state.projectiles).toHaveLength(1);
  });
  it('P2 mirror copies only its owned base swords and excludes another player and derived volleys', () => {
    const f = setup('mirror-sigil', 'b', 4); const p2 = { ...f.player, x: f.player.x + 20 };
    f.context.player = p2;
    for (const bulletId of [80, 81]) f.context.events.push({ type: 'enemy-bullet-broken', by: 'barrier',
      x: p2.x, y: p2.y, playerId: 'p2', bulletId, vx: -100, vy: 0 });
    f.step();
    const sword = (playerId: 'p1' | 'p2', derived = false): Projectile => ({
      id: f.state.nextId++, targetId: 1, x: p2.x, y: p2.y, vx: 400, vy: 13,
      radius: 5, damage: 12, ttlMs: 1000, pierceRemaining: 1, hitEnemyIds: [], playerId, derived,
    });
    f.state.projectiles.push(sword('p1'), sword('p2', true)); f.step();
    expect(f.state.projectiles).toHaveLength(2);
    const own = sword('p2'); own.x += 200; f.state.projectiles.push(own); f.step();
    expect(f.state.projectiles).toHaveLength(4);
    expect(f.state.projectiles[3]).toMatchObject({ playerId: 'p2', derived: true, vx: 400, vy: 13, damage: 12 });
    f.step(); expect(f.state.projectiles).toHaveLength(4);
  });
  it('frost A accumulates faster at the core and never freezes bosses', () => {
    const f = setup('frost-domain', 'a'); const core = f.enemy(10); const edge = f.enemy(145);
    const boss = f.enemy(20, 0, { kind: 'boss' }); f.advance(900);
    expect(core.freezeUntilMs).toBeGreaterThan(f.state.elapsedMs);
    expect(edge.freezeUntilMs).toBe(0); expect(boss.freezeUntilMs).toBe(0); f.effect();
  });
  it('frost B stops a homing bullet finitely and converts it at Lv5', () => {
    const f = setup('frost-domain', 'b', 5); f.enemy(); f.bullet(); f.step();
    expect(f.state.enemyProjectiles).toHaveLength(0);
    f.advance(1400);
    expect(f.state.projectiles.some(p => p.kind === 'star' && p.source === 'chain')).toBe(true); f.effect();
  });
  it('rift A cuts the parallel return track', () => {
    const f = setup('rift-return', 'a'); f.enemy(160); const parallel = f.enemy(160, 24);
    f.advance(500); expect(parallel.hp).toBeLessThan(10000); f.effect();
  });
  it('rift B leaves a gate at the outbound endpoint that fires back later', () => {
    const f = setup('rift-return', 'b'); const target = f.enemy(160); f.step();
    expect(f.state.projectiles).toHaveLength(0); f.advance(500);
    expect(f.state.projectiles[0]).toMatchObject({ x: target.x, y: target.y, source: 'sword-rain' });
    expect(f.state.projectiles[0].vx).toBeLessThan(0); f.effect();
  });
  it('star A continuously gathers normals and scales its final burst', () => {
    const f = setup('star-pull', 'a'); const center = f.enemy(80); const gathered = f.enemy(180);
    const boss = f.enemy(120, 0, { kind: 'boss' }); const bx = boss.x; f.step();
    const hp = center.hp; f.advance(1600);
    expect(gathered.x).toBeLessThan(f.player.x + 180); expect(center.hp).toBeLessThan(hp - 40);
    expect(boss.x).toBe(bx); expect(boss.freezeUntilMs).toBe(0); f.effect();
  });
  it('star B creates orbiting stars after the field expires and they hit enemies', () => {
    const f = setup('star-pull', 'b'); const e = f.enemy(60); f.step(); f.advance(1250);
    const hp = e.hp; f.advance(600);
    expect(e.hp).toBeLessThan(hp);
    expect(f.context.events.some(e => e.type === 'skill-path-effect' && e.shape === 'orbit')).toBe(true); f.effect();
  });
  it('Lv6 solar growth waits for the matching equipped awakening enhancement', () => {
    const plain = setup('solar-ray', 'a', 6); const awakened = setup('solar-ray', 'a', 6);
    const a = plain.enemy(); const b = awakened.enemy();
    awakened.player.upgradeLevels['faster-swords'] = 1;
    awakened.player.equippedEnhancements = ['faster-swords'];
    plain.advance(1400); awakened.advance(1400);
    expect(b.hp).toBeLessThan(a.hp);
    plain.player.upgradeLevels['faster-swords'] = 1;
    plain.advance(2000); expect(plain.player.equippedEnhancements).toEqual([]);
  });
  it.each(['a', 'b'] as const)('P2 %s effects originate at its own position', path => {
    const f = setup('void-bell', path); const p1 = f.player;
    f.context.player = { ...p1, x: p1.x + 600, skillPaths: { 'void-bell': path } };
    f.step();
    expect(f.context.events).toContainEqual(expect.objectContaining({ type: 'skill-path-effect', x: p1.x + 600, y: p1.y }));
  });
  it('removed skills clean up areas and release frozen bullets without leaving stale hits', () => {
    const f = setup('frost-domain', 'b'); const bullet = f.bullet(); f.step();
    f.player.equippedSkills = []; delete f.player.skillPaths['frost-domain']; f.step();
    expect(f.state.enemyProjectiles).toContain(bullet); expect(bullet.vx).toBe(-100);
    const count = f.context.events.length; f.advance(6000);
    expect(f.context.events).toHaveLength(count);
  });
  it('all 16 routes remain bounded in long runs and expire when removed', () => {
    for (const skill of ['solar-ray', 'void-bell', 'spirit-sword-rain', 'storm-net',
      'mirror-sigil', 'frost-domain', 'rift-return', 'star-pull'] as const) {
      for (const path of ['a', 'b'] as const) {
        const f = setup(skill, path, 6); f.enemy();
        const required = AWAKENING_REQUIREMENTS[skill];
        if (required) { f.player.upgradeLevels[required] = 1; f.player.equippedEnhancements.push(required); }
        f.advance(20000); f.player.equippedSkills = []; f.step();
        const hp = f.state.enemies[0].hp; const count = f.context.events.length;
        f.advance(10000);
        expect(f.state.enemies[0].hp).toBe(hp); expect(f.context.events).toHaveLength(count);
      }
    }
  });
  it('ongoing fields reuse an owner-specific identity and switching routes ends the old field', () => {
    const f = setup('storm-net', 'a'); f.enemy(); f.advance(600);
    const fields = f.context.events.filter(e => e.type === 'skill-path-effect' && e.shape === 'field');
    const keys = fields.map(e => (e as typeof e & { identityKey?: string }).identityKey);
    expect(keys.length).toBeGreaterThan(2); expect(new Set(keys).size).toBe(1);
    expect(keys[0]).toContain('advanced:p1:storm-net:a:');
    f.player.skillPaths['storm-net'] = 'b'; f.step();
    expect(f.context.events).toContainEqual(expect.objectContaining({
      type: 'skill-path-effect', identityKey: keys[0], durationMs: 0,
    }));
    const p2 = { ...f.player, x: f.player.x + 20, skillPaths: { 'storm-net': 'b' as const } };
    f.runtime.update({ ...f.context, player: p2 });
    expect(f.context.events.some(e => e.type === 'skill-path-effect'
      && (e as typeof e & { identityKey?: string }).identityKey?.startsWith('advanced:p2:storm-net:b:'))).toBe(true);
  });
  it('orbit identities stay stable across pulses and remain distinct per star', () => {
    const f = setup('star-pull', 'b'); f.enemy(); f.advance(1800);
    const orbits = f.context.events.filter(e => e.type === 'skill-path-effect' && e.shape === 'orbit');
    const keys = orbits.map(e => (e as typeof e & { identityKey?: string }).identityKey);
    expect(keys.length).toBeGreaterThan(2); expect(new Set(keys).size).toBe(2);
    f.player.skillPaths['star-pull'] = 'a'; f.step();
    for (const key of new Set(keys)) expect(f.context.events).toContainEqual(expect.objectContaining({ identityKey: key, durationMs: 0 }));
  });
  it('Lv4 refraction adds a target and Lv5 permits a second refraction', () => {
    const counts = [3, 4, 5].map(level => {
      const f = setup('solar-ray', 'b', level); f.enemy(40, 0, { kind: 'boss' });
      const targets = [f.enemy(80), f.enemy(100), f.enemy(120), f.enemy(140)]; f.step();
      return targets.filter(e => e.hp < 10000).length;
    });
    expect(counts).toEqual([2, 3, 4]);
  });
  it('Lv4 mirror needs fewer blocks; Lv5 copies an extra sword without changing base stats', () => {
    const counts = [3, 4, 5].map(level => {
      const f = setup('mirror-sigil', 'b', level); f.bullet(20); f.bullet(30); f.step();
      const original: Projectile = { id: f.state.nextId++, targetId: 1, x: f.player.x, y: f.player.y,
        vx: 420, vy: 0, radius: 5, damage: 10, ttlMs: 1000, pierceRemaining: 0, hitEnemyIds: [] };
      f.state.projectiles.push(original); const damage = f.player.attackDamage; f.step();
      expect(f.player.attackDamage).toBe(damage); return f.state.projectiles.length;
    });
    expect(counts).toEqual([1, 2, 3]);
  });
  it('Lv4 keeps frozen bullets stopped longer, while Lv3 restores their original homing state', () => {
    const a = setup('frost-domain', 'b', 3); const b = setup('frost-domain', 'b', 4);
    const bullet = a.bullet(); b.bullet(); a.step(); b.step(); a.advance(700); b.advance(700);
    expect(a.state.enemyProjectiles).toContain(bullet);
    expect(bullet).toMatchObject({ vx: -100, vy: 0, homingMs: 1000 });
    expect(b.state.enemyProjectiles).toHaveLength(0); b.advance(400);
    expect(b.state.enemyProjectiles).toHaveLength(1);
  });
  it('the real simulation loop adds route damage without removing the original solar cast', () => {
    const f = setup('solar-ray', 'a', 5);
    f.player.solarRayTimerMs = f.player.solarRayCooldownMs;
    f.player.attackCooldownMs = 999999; f.state.spawnTimerMs = -100000;
    f.state.nextBossAtMs = f.state.nextEliteSquadAtMs = f.state.nextObjectiveAtMs = 999999;
    const sim = new GameSimulation(f.state);
    const target = sim.spawnEnemy({ x: f.player.x + 80, y: f.player.y, hp: 10000, speed: 0 });
    sim.update(50, { x: 0, y: 0 });
    expect(target.hp).toBeLessThan(9960);
    expect(sim.consumeEvents()).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'chain-lightning', style: 'solar-ray' }),
      expect.objectContaining({ type: 'skill-path-effect', skill: 'solar-ray', path: 'a' }),
    ]));
  });
  it('the real base mirror emits enough metadata for a first-frame derived counter', () => {
    const f = setup('mirror-sigil', 'a');
    f.player.mirrorSigilTimerMs = f.player.mirrorSigilCooldownMs;
    f.player.attackCooldownMs = 999999; f.state.spawnTimerMs = -100000;
    f.state.nextBossAtMs = f.state.nextEliteSquadAtMs = f.state.nextObjectiveAtMs = 999999;
    const bullet = f.bullet(70); bullet.homingMs = 0;
    const sim = new GameSimulation(f.state);
    sim.update(50, { x: 0, y: 0 });
    expect(f.state.enemyProjectiles).toHaveLength(0);
    expect(f.state.projectiles).toHaveLength(1);
    expect(f.state.projectiles[0]).toMatchObject({ playerId: 'p1', derived: true, source: 'reprisal', vx: 420 });
    expect(sim.consumeEvents()).toContainEqual(expect.objectContaining({
      type: 'enemy-bullet-broken', by: 'barrier', playerId: 'p1', bulletId: bullet.id, vx: -100, vy: 0,
    }));
    sim.update(50, { x: 0, y: 0 }); expect(f.state.projectiles).toHaveLength(1);
  });
});
