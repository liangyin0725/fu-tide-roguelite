import Phaser from 'phaser';
import type { CombatEvent, UpgradeId } from '../sim/types';
import {
  createEffectSpecs,
  EFFECT_BUDGETS,
  isCriticalEffect,
  type EffectSpec,
} from './effectSpecs';
import type { GameSettings } from '../settings/gameSettings';

interface ActiveEffect {
  graphics: Phaser.GameObjects.Graphics;
  label?: Phaser.GameObjects.Text;
  spec: EffectSpec;
  ageMs: number;
}

export class EffectRenderer {
  private readonly scene: Phaser.Scene;
  private readonly getSettings: () => GameSettings;
  private readonly effects: ActiveEffect[] = [];

  public constructor(scene: Phaser.Scene, getSettings: () => GameSettings) {
    this.scene = scene;
    this.getSettings = getSettings;
  }

  public render(events: CombatEvent[]): void {
    for (const spec of createEffectSpecs(events)) {
      const settings = this.getSettings();
      if (spec.kind === 'damage-number' && !settings.damageNumbers) continue;
      const budget = EFFECT_BUDGETS[settings.effectLevel];
      if (this.effects.length >= budget) {
        if (!isCriticalEffect(spec.kind)) continue;
        const removable = this.effects.findIndex((effect) => !isCriticalEffect(effect.spec.kind));
        if (removable >= 0) {
          this.effects[removable].graphics.destroy();
          this.effects[removable].label?.destroy();
          this.effects.splice(removable, 1);
        }
      }
      const graphics = this.scene.add.graphics().setDepth(12);
      graphics.setBlendMode(Phaser.BlendModes.ADD);
      const label = spec.kind === 'damage-number'
        ? createDamageLabel(this.scene, spec.event)
        : undefined;
      this.effects.push({ graphics, label, spec, ageMs: 0 });

      if (!settings.screenShake) {
        continue;
      }
      if (spec.kind === 'impact') {
        this.scene.cameras.main.shake(56, 0.0022);
      } else if (spec.kind === 'kill') {
        this.scene.cameras.main.shake(108, 0.0036);
      } else if (spec.kind === 'damage') {
        this.scene.cameras.main.shake(90, 0.006);
      } else if (spec.kind === 'siege') {
        this.scene.cameras.main.shake(150, 0.008);
      } else if (spec.kind === 'fire') {
        this.scene.cameras.main.shake(120, 0.004);
      } else if (spec.kind === 'level') {
        this.scene.cameras.main.shake(180, 0.003);
      } else if (spec.kind === 'boss') {
        this.scene.cameras.main.flash(180, 255, 56, 100, false);
        this.scene.cameras.main.shake(520, 0.014);
      } else if (spec.kind === 'awakening') {
        this.scene.cameras.main.flash(260, 246, 211, 101, false);
        this.scene.cameras.main.shake(420, 0.012);
      } else if (spec.kind === 'meteor' || spec.kind === 'shield-break') {
        this.scene.cameras.main.shake(140, 0.006);
      } else if (spec.kind === 'reward') {
        this.scene.cameras.main.flash(180, 246, 211, 101, false);
      } else if (spec.kind === 'character-unlock') {
        this.scene.cameras.main.flash(360, 255, 79, 163, false);
        this.scene.cameras.main.shake(420, 0.01);
      } else if (spec.kind === 'boss-phase') {
        this.scene.cameras.main.flash(320, 255, 70, 90, false);
        this.scene.cameras.main.shake(480, 0.016);
      } else if (spec.kind === 'boss-cast') {
        this.scene.cameras.main.shake(180, 0.006);
      } else if (spec.kind === 'boss-skill') {
        this.scene.cameras.main.shake(240, 0.011);
      } else if (spec.kind === 'boss-objective') {
        this.scene.cameras.main.shake(220, 0.009);
      } else if (spec.kind === 'synergy') {
        this.scene.cameras.main.shake(100, 0.003);
      } else if (spec.kind === 'glyph' && spec.event.type === 'glyph-volley' && spec.event.ritual !== 'bolt') {
        this.scene.cameras.main.shake(96, 0.003);
      } else if (spec.kind === 'tribulation') {
        this.scene.cameras.main.flash(260, 97, 245, 255, false);
        this.scene.cameras.main.shake(260, 0.006);
      } else if (spec.kind === 'tribulation-choice') {
        this.scene.cameras.main.shake(150, 0.004);
      } else if (spec.kind === 'tribulation-seal') {
        this.scene.cameras.main.shake(spec.event.type === 'tribulation-seal-gained' ? 200 : 110, 0.004);
      } else if (spec.kind === 'objective') {
        this.scene.cameras.main.shake(140, 0.004);
      } else if (spec.kind === 'objective-field') {
        this.scene.cameras.main.flash(180, 156, 239, 255, false);
        this.scene.cameras.main.shake(180, 0.005);
      }
    }
  }

  public update(deltaMs: number): void {
    for (let index = this.effects.length - 1; index >= 0; index -= 1) {
      const effect = this.effects[index];
      effect.ageMs += deltaMs;
      const progress = Math.min(1, effect.ageMs / effect.spec.durationMs);
      this.drawEffect(effect, progress);
      if (progress >= 1) {
        effect.graphics.destroy();
        effect.label?.destroy();
        this.effects.splice(index, 1);
      }
    }
  }

  public clear(): void {
    for (const effect of this.effects) {
      effect.graphics.destroy();
      effect.label?.destroy();
    }
    this.effects.length = 0;
  }

  private drawEffect(effect: ActiveEffect, progress: number): void {
    const { graphics, spec } = effect;
    const event = spec.event;
    const fade = 1 - progress;
    graphics.clear();

    if (event.type === 'damage-dealt') {
      effect.label?.setPosition(event.x, event.y - 18 - progress * 36);
      effect.label?.setAlpha(fade);
      effect.label?.setScale(1.08 + Math.sin(progress * Math.PI) * 0.24);
      drawDamageSpark(graphics, event.x, event.y, damageNumberColor(event.source), progress, fade);
      return;
    }

    switch (event.type) {
      case 'projectile-fired':
        drawSwordWake(graphics, event.x, event.y, event.angle, progress, fade);
        break;
      case 'projectile-hit':
        drawImpact(graphics, event.x, event.y, progress, fade);
        break;
      case 'enemy-killed':
        drawKillBurst(graphics, event.x, event.y, progress, fade);
        break;
      case 'player-damaged':
        drawRing(graphics, event.x, event.y, 20 + progress * 46, 0xff365f, fade, 7);
        drawRing(graphics, event.x, event.y, 44 + progress * 66, 0xff8a3d, fade * 0.36, 3);
        for (let index = 0; index < 8; index += 1) {
          const angle = index * Math.PI / 4 + progress * 0.5;
          const inner = 30 + progress * 18;
          const outer = inner + 20 + progress * 14;
          graphics.lineStyle(3, index % 2 === 0 ? 0xff365f : 0xff8a3d, fade * 0.8);
          graphics.lineBetween(
            event.x + Math.cos(angle) * inner,
            event.y + Math.sin(angle) * inner,
            event.x + Math.cos(angle) * outer,
            event.y + Math.sin(angle) * outer,
          );
        }
        break;
      case 'player-healed':
        drawRing(graphics, event.x, event.y, 42 - progress * 22, 0x7dff9c, fade, 6);
        drawRing(graphics, event.x, event.y, 18 + progress * 34, 0xd8ffe2, fade * 0.8, 3);
        for (let index = 0; index < 5; index += 1) {
          const angle = index * Math.PI * 0.4 - Math.PI / 2;
          const radius = 18 + progress * 28;
          graphics.fillStyle(0x7dff9c, fade * 0.85);
          graphics.fillCircle(event.x + Math.cos(angle) * radius, event.y + Math.sin(angle) * radius, 3);
        }
        break;
      case 'siege-pressure':
        for (let index = 0; index < 3; index += 1) {
          const delayed = Math.max(0, Math.min(1, progress * 1.35 - index * 0.16));
          drawRing(graphics, event.x, event.y, 210 - delayed * 145, index === 1 ? 0xff8a3d : 0xff365f, fade * (0.72 - index * 0.12), 8 - index * 2);
        }
        for (let index = 0; index < Math.min(12, event.enemyCount); index += 1) {
          const angle = index * Math.PI * 2 / Math.min(12, event.enemyCount) + progress * 0.35;
          graphics.lineStyle(3, 0xff365f, fade * 0.8);
          graphics.lineBetween(
            event.x + Math.cos(angle) * (185 - progress * 70),
            event.y + Math.sin(angle) * (185 - progress * 70),
            event.x + Math.cos(angle) * (150 - progress * 72),
            event.y + Math.sin(angle) * (150 - progress * 72),
          );
        }
        break;
      case 'glyph-volley':
        {
          const formationColor = event.formation === 'stormfire'
            ? 0xff754c
            : event.formation === 'frostbind'
              ? 0x8ffcff
              : event.formation === 'mirror-ward'
                ? 0xc6abff
                : 0xf6d365;
          drawRing(graphics, event.x, event.y, 42 + progress * 50, formationColor, fade * 0.64, 3);
        for (let index = 0; index < event.count; index += 1) {
          const angle = index * Math.PI * 2 / event.count + progress * 1.2;
          const inner = 50 + progress * 12;
          const outer = event.ritual === 'bolt' ? 74 + progress * 22 : 104 + progress * 48;
          graphics.lineStyle(event.ritual === 'control' ? 3 : 2, formationColor, fade * 0.86);
          graphics.lineBetween(
            event.x + Math.cos(angle) * inner,
            event.y + Math.sin(angle) * inner,
            event.x + Math.cos(angle) * outer,
            event.y + Math.sin(angle) * outer,
          );
        }
        }
        break;
      case 'shield-blocked':
        drawRing(graphics, event.x, event.y, 28 + progress * 42, 0x61f5ff, fade, 6);
        drawRing(graphics, event.x, event.y, 38 + progress * 28, 0xf6d365, fade * 0.7, 2);
        break;
      case 'chain-lightning':
        drawLightning(graphics, event, progress, fade);
        break;
      case 'fire-burst':
        drawFireBurst(graphics, event.x, event.y, event.radius, event.awakened, progress, fade);
        break;
      case 'level-up':
        drawLevelSigil(graphics, event.x, event.y, progress, fade);
        break;
      case 'boss-spawned':
        drawBossArrival(graphics, event.x, event.y, progress, fade);
        break;
      case 'boss-objective-spawned':
        drawBossObjective(graphics, event.x, event.y, bossColor(event.bossType), true, progress, fade);
        break;
      case 'boss-objective-resolved':
        drawBossObjective(graphics, event.x, event.y, bossColor(event.bossType), event.success, progress, fade);
        break;
      case 'skill-awakened':
        drawAwakening(graphics, event.x, event.y, event.upgrade, progress, fade);
        break;
      case 'meteor-strike':
        drawMeteor(graphics, event.x, event.y, event.awakened, progress, fade, event.style);
        break;
      case 'dodge':
        drawDodge(graphics, event.x, event.y, progress, fade);
        break;
      case 'frost-hit':
        drawFrost(graphics, event.x, event.y, event.frozen, progress, fade, event.style);
        break;
      case 'tribulation-seal-gained':
      case 'tribulation-seal-triggered': {
        const color = sealColor(event.seal);
        const radius = event.type === 'tribulation-seal-gained' ? 32 + progress * 94 : 20 + progress * 58;
        drawRing(graphics, event.x, event.y, radius, color, fade, event.type === 'tribulation-seal-gained' ? 7 : 4);
        drawRing(graphics, event.x, event.y, radius * 0.58, 0xffffff, fade * 0.72, 2);
        break;
      }
      case 'shield-broken':
        drawShieldBreak(graphics, event.x, event.y, event.radius, progress, fade);
        break;
      case 'chest-dropped':
        drawChestArrival(graphics, event.x, event.y, progress, fade);
        break;
      case 'boss-reward-burst':
        drawRewardBurst(graphics, event.x, event.y, progress, fade);
        break;
      case 'hidden-character-unlocked':
        drawCharacterUnlock(graphics, event.x, event.y, progress, fade);
        break;
      case 'boss-cast-started':
        drawBossCast(graphics, event.x, event.y, bossColor(event.bossType), progress, fade);
        break;
      case 'boss-skill-activated':
        drawBossDetonation(graphics, event.x, event.y, bossColor(event.bossType), progress, fade);
        break;
      case 'boss-phase-changed':
        drawBossPhase(graphics, event.x, event.y, bossColor(event.bossType), progress, fade);
        break;
      case 'boss-healed':
        drawRing(graphics, event.x, event.y, 52 - progress * 28, 0x7dff9c, fade, 7);
        break;
      case 'star-volley':
        drawRing(graphics, event.x, event.y, 24 + progress * 80, 0xf6d365, fade, 4);
        if (event.awakened) {
          drawRing(graphics, event.x, event.y, 38 + progress * 126, 0xffffff, fade * 0.8, 3);
          for (let index = 0; index < 16; index += 1) {
            const angle = index * Math.PI / 8 + progress * 3;
            graphics.lineStyle(3, index % 2 ? 0x61f5ff : 0xf6d365, fade);
            graphics.lineBetween(
              event.x + Math.cos(angle) * 28,
              event.y + Math.sin(angle) * 28,
              event.x + Math.cos(angle) * (62 + progress * 100),
              event.y + Math.sin(angle) * (62 + progress * 100),
            );
          }
        }
        break;
      case 'bullet-reprisal':
        drawRing(graphics, event.x, event.y, event.radius * progress, event.style === 'mirror-sigil' ? 0xd4c8ff : event.style === 'void-bell' ? 0x8d7cff : 0x8ffcff, fade, 7);
        if (event.style === 'mirror-sigil') {
          const radius = event.radius * progress * 0.78;
          graphics.lineStyle(4, 0xffffff, fade * 0.9);
          for (let index = 0; index < 6; index += 1) {
            const angle = index * Math.PI / 3 + Math.PI / 6;
            const next = angle + Math.PI / 3;
            graphics.lineBetween(event.x + Math.cos(angle) * radius, event.y + Math.sin(angle) * radius, event.x + Math.cos(next) * radius, event.y + Math.sin(next) * radius);
            graphics.lineStyle(2, 0xd4c8ff, fade * 0.72);
            graphics.lineBetween(event.x, event.y, event.x + Math.cos(angle) * radius, event.y + Math.sin(angle) * radius);
          }
        }
        if (event.awakened) {
          drawRing(graphics, event.x, event.y, event.radius * progress * 1.18, 0x8d7cff, fade * 0.85, 12);
          drawRing(graphics, event.x, event.y, event.radius * progress * 0.58, 0xffffff, fade * 0.75, 3);
        }
        break;
      case 'soul-pinned': {
        const radius = 16 + progress * 26;
        drawRing(graphics, event.x, event.y, radius, 0xff4fa3, fade, event.awakened ? 7 : 4);
        for (let index = 0; index < 4; index += 1) {
          const nailAngle = progress * 1.1 + index * Math.PI / 2;
          const outer = radius + 12;
          const inner = radius * 0.32;
          const outerX = event.x + Math.cos(nailAngle) * outer;
          const outerY = event.y + Math.sin(nailAngle) * outer;
          const innerX = event.x + Math.cos(nailAngle) * inner;
          const innerY = event.y + Math.sin(nailAngle) * inner;
          graphics.lineStyle(event.awakened ? 5 : 3, 0xb89cff, fade * 0.8);
          graphics.lineBetween(outerX, outerY, innerX, innerY);
          graphics.fillStyle(0xff4fa3, fade * 0.9);
          graphics.fillCircle(innerX, innerY, event.awakened ? 5 : 3);
        }
        if (event.awakened) {
          drawRing(graphics, event.x, event.y, radius * 0.58, 0xffffff, fade * 0.7, 2);
        }
        break;
      }
      case 'frost-domain':
        {
          const outerRadius = event.radius * (0.46 + progress * 0.54);
          drawRing(graphics, event.x, event.y, outerRadius, 0x69d9ff, fade * 0.9, event.awakened ? 10 : 6);
          drawRing(graphics, event.x, event.y, outerRadius * 0.7, 0xdff9ff, fade * 0.65, 2);
          for (let index = 0; index < 8; index += 1) {
            const angle = index * Math.PI / 4 - progress * 0.8;
            const shardX = event.x + Math.cos(angle) * outerRadius;
            const shardY = event.y + Math.sin(angle) * outerRadius;
            graphics.lineStyle(index % 2 === 0 ? 4 : 2, index % 2 === 0 ? 0xc9f5ff : 0xffffff, fade * 0.86);
            graphics.lineBetween(shardX - Math.cos(angle) * 12, shardY - Math.sin(angle) * 12, shardX + Math.cos(angle + Math.PI / 2) * 10, shardY + Math.sin(angle + Math.PI / 2) * 10);
            graphics.lineBetween(shardX - Math.cos(angle) * 12, shardY - Math.sin(angle) * 12, shardX + Math.cos(angle - Math.PI / 2) * 10, shardY + Math.sin(angle - Math.PI / 2) * 10);
          }
          if (event.awakened) {
            drawRing(graphics, event.x, event.y, outerRadius * 1.14, 0x8d7cff, fade * 0.58, 3);
            for (let index = 0; index < 6; index += 1) {
              const angle = index * Math.PI / 3 + progress * 1.4;
              const runeRadius = outerRadius * 0.88;
              graphics.lineStyle(3, 0xb9f8ff, fade * 0.8);
              graphics.strokeRect(event.x + Math.cos(angle) * runeRadius - 7, event.y + Math.sin(angle) * runeRadius - 7, 14, 14);
            }
          }
        }
        break;
      case 'rift-return':
        {
          const dx = event.toX - event.fromX;
          const dy = event.toY - event.fromY;
          const length = Math.max(1, Math.hypot(dx, dy));
          const nx = dx / length;
          const ny = dy / length;
          const px = -ny;
          const py = nx;
          const color = event.awakened ? 0xf6d365 : 0xc68cff;
          graphics.lineStyle(event.awakened ? 18 : 12, color, fade * 0.18);
          graphics.lineBetween(event.fromX, event.fromY, event.toX, event.toY);
          graphics.lineStyle(event.awakened ? 7 : 4, color, fade);
          graphics.lineBetween(event.fromX, event.fromY, event.toX, event.toY);
          graphics.lineStyle(2, 0xffffff, fade * 0.92);
          graphics.lineBetween(event.fromX, event.fromY, event.toX, event.toY);
          for (const ratio of [0.24, 0.5, 0.76]) {
            const x = event.fromX + dx * ratio;
            const y = event.fromY + dy * ratio;
            const size = 8 + progress * 6;
            graphics.lineStyle(3, 0xffffff, fade * 0.84);
            graphics.lineBetween(x - nx * size - px * size, y - ny * size - py * size, x + nx * size, y + ny * size);
            graphics.lineBetween(x - nx * size + px * size, y - ny * size + py * size, x + nx * size, y + ny * size);
          }
          drawRing(graphics, event.fromX, event.fromY, 8 + progress * 16, 0xc68cff, fade * 0.72, 2);
          drawRing(graphics, event.toX, event.toY, 14 + progress * 28, 0xffffff, fade, 3);
          if (event.awakened) {
            graphics.lineStyle(3, 0x61f5ff, fade * 0.7);
            graphics.lineBetween(event.fromX + px * 11, event.fromY + py * 11, event.toX + px * 11, event.toY + py * 11);
            for (let index = 0; index < 6; index += 1) {
              const angle = index * Math.PI / 3 + progress * 4;
              graphics.lineStyle(3, index % 2 === 0 ? 0xf6d365 : 0x61f5ff, fade * 0.82);
              graphics.lineBetween(event.toX, event.toY, event.toX + Math.cos(angle) * 32, event.toY + Math.sin(angle) * 32);
            }
          }
        }
        break;
      case 'star-pull':
        {
          const outerRadius = event.radius * (1 - progress * 0.48);
          drawRing(graphics, event.x, event.y, outerRadius, 0xf6d365, fade, event.awakened ? 10 : 6);
          drawRing(graphics, event.x, event.y, outerRadius * 0.62, 0x61f5ff, fade * 0.64, 3);
          drawRing(graphics, event.x, event.y, outerRadius * 0.25, 0xffffff, fade * 0.75, 2);
          for (let index = 0; index < 6; index += 1) {
            const angle = index * Math.PI / 3 + progress * 2;
            graphics.lineStyle(3, 0xffd166, fade * 0.8);
            graphics.lineBetween(event.x + Math.cos(angle) * outerRadius, event.y + Math.sin(angle) * outerRadius, event.x, event.y);
            const particleRadius = outerRadius * (0.86 - (progress * 0.42 + index * 0.06) % 0.58);
            graphics.fillStyle(index % 2 === 0 ? 0xf6d365 : 0xffffff, fade * 0.9);
            graphics.fillCircle(event.x + Math.cos(angle) * particleRadius, event.y + Math.sin(angle) * particleRadius, event.awakened ? 5 : 3);
          }
          if (event.awakened) {
            for (let index = 0; index < 8; index += 1) {
              const angle = index * Math.PI / 4 - progress * 3.2;
              graphics.lineStyle(index % 2 === 0 ? 5 : 2, index % 2 === 0 ? 0xf6d365 : 0x8d7cff, fade * 0.86);
              graphics.lineBetween(event.x, event.y, event.x + Math.cos(angle) * outerRadius * 0.42, event.y + Math.sin(angle) * outerRadius * 0.42);
            }
            drawRing(graphics, event.x, event.y, outerRadius * 1.12, 0x8d7cff, fade * 0.52, 3);
          }
        }
        break;
      case 'ranged-windup':
        drawRing(graphics, event.x, event.y, 12 + progress * 24, 0xffd166, fade, 3);
        break;
      case 'enemy-bullet-fired':
        drawRing(graphics, event.x, event.y, 8 + progress * 18, 0xff4fa3, fade, 3);
        break;
      case 'enemy-bullet-broken':
        const breakColor = event.by === 'barrier' ? 0xf6d365 : 0x8ffcff;
        drawRing(
          graphics,
          event.x,
          event.y,
          8 + progress * 34,
          breakColor,
          fade,
          5,
        );
        for (let index = 0; index < 6; index += 1) {
          const angle = index * Math.PI / 3 + progress * 2.4;
          const inner = 6 + progress * 15;
          const outer = inner + 10 + progress * 12;
          graphics.lineStyle(index % 2 === 0 ? 3 : 2, breakColor, fade * 0.86);
          graphics.lineBetween(event.x + Math.cos(angle) * inner, event.y + Math.sin(angle) * inner, event.x + Math.cos(angle) * outer, event.y + Math.sin(angle) * outer);
        }
        break;
      case 'active-skill-cast':
        drawActiveCast(graphics, event, progress, fade);
        break;
      case 'active-skill-leveled':
        drawLevelSigil(graphics, event.x, event.y, progress, fade);
        drawRing(graphics, event.x, event.y, 30 + progress * 125, 0x8ffcff, fade, 6);
        break;
      case 'elite-squad-spawned':
        drawRing(graphics, event.x, event.y, 30 + progress * 95, eliteColor(event.affix), fade, 8);
        drawRing(graphics, event.x, event.y, 20 + progress * 62, 0xffffff, fade * 0.65, 2);
        break;
      case 'elite-effect':
        drawRing(graphics, event.x, event.y, 24 + progress * 72, eliteColor(event.affix), fade, 6);
        break;
      case 'tribulation-changed':
        drawTribulation(graphics, event.x, event.y, tribulationColor(event.tribulation), progress, fade);
        break;
      case 'tribulation-choice-offered':
        drawTribulationChoice(graphics, event.x, event.y, tribulationColor(event.tribulation), false, progress, fade);
        break;
      case 'tribulation-choice-selected':
        drawTribulationChoice(graphics, event.x, event.y, choiceColor(event.choice), true, progress, fade);
        break;
      case 'objective-spawned':
        drawRing(graphics, event.x, event.y, 24 + progress * 150, objectiveColor(event.objective), fade, 8);
        drawRing(graphics, event.x, event.y, 80 - progress * 42, 0xffffff, fade * 0.7, 3);
        break;
      case 'objective-resolved':
        drawRing(graphics, event.x, event.y, 30 + progress * 130, event.success ? 0x7dff9c : 0xff3864, fade, 10);
        break;
      case 'objective-field-activated':
        drawObjectiveField(graphics, event.x, event.y, event.objective, progress, fade);
        break;
      case 'synergy-triggered':
        drawSynergy(graphics, event.x, event.y, synergyColor(event.synergy), progress, fade);
        break;
    }
  }
}

function objectiveColor(objective: import('../sim/types').ObjectiveKind): number {
  if (objective === 'blood-well') return 0xff4fa3;
  if (objective === 'frost-core') return 0xc9f5ff;
  return 0x61f5ff;
}

function drawObjectiveField(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  objective: import('../sim/types').ObjectiveKind,
  progress: number,
  fade: number,
): void {
  const color = objectiveColor(objective);
  const radius = 42 + progress * 145;
  drawRing(graphics, x, y, radius, color, fade, 7);
  drawRing(graphics, x, y, radius * 0.58, 0xffffff, fade * 0.65, 2);
  for (let index = 0; index < 8; index += 1) {
    const angle = index * Math.PI / 4 + progress * 2.2;
    graphics.lineStyle(index % 2 === 0 ? 4 : 2, color, fade * 0.82);
    graphics.lineBetween(
      x + Math.cos(angle) * radius * 0.38,
      y + Math.sin(angle) * radius * 0.38,
      x + Math.cos(angle) * radius * 1.08,
      y + Math.sin(angle) * radius * 1.08,
    );
  }
}

function drawCharacterUnlock(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  progress: number,
  fade: number,
): void {
  const radius = 26 + progress * 190;
  drawRing(graphics, x, y, radius, 0xff4fa3, fade, 10);
  drawRing(graphics, x, y, radius * 0.7, 0x61f5ff, fade * 0.86, 4);
  graphics.lineStyle(5, 0xffffff, fade);
  for (let index = 0; index < 8; index += 1) {
    const angle = index * Math.PI / 4 - progress * Math.PI;
    graphics.lineBetween(
      x + Math.cos(angle) * radius * 0.28,
      y + Math.sin(angle) * radius * 0.28,
      x + Math.cos(angle) * radius * 0.92,
      y + Math.sin(angle) * radius * 0.92,
    );
  }
}

function drawSynergy(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  color: number,
  progress: number,
  fade: number,
): void {
  const radius = 20 + progress * 82;
  drawRing(graphics, x, y, radius, color, fade, 7);
  drawRing(graphics, x, y, radius * 0.66, 0xffffff, fade * 0.7, 2);
  graphics.lineStyle(3, color, fade);
  for (let index = 0; index < 6; index += 1) {
    const angle = index * Math.PI / 3 + progress * 1.8;
    const inner = radius * 0.48;
    const outer = radius * 0.82;
    graphics.lineBetween(
      x + Math.cos(angle) * inner,
      y + Math.sin(angle) * inner,
      x + Math.cos(angle) * outer,
      y + Math.sin(angle) * outer,
    );
  }
}

function synergyColor(synergy: import('../sim/types').SynergyId): number {
  if (synergy === 'thunder-resonance') return 0x8ffcff;
  if (synergy === 'frostfire-calamity') return 0xff7a5c;
  if (synergy === 'sword-ward') return 0xb9f6ff;
  if (synergy === 'starfall-convergence') return 0xf6d365;
  if (synergy === 'immortal-echo') return 0x7dff9c;
  if (synergy === 'eclipse-sanctum') return 0xffd166;
  if (synergy === 'sunblade-cascade') return 0xfff0a3;
  if (synergy === 'frozen-knell') return 0x9defff;
  if (synergy === 'gilded-sword-rain') return 0xf6d365;
  return 0xff4fa3;
}

function eliteColor(affix: import('../sim/types').EliteAffix): number {
  if (affix === 'iron-wall') return 0xb8c4d6;
  if (affix === 'haste') return 0xffd166;
  if (affix === 'mender') return 0x7dff9c;
  return 0xc68cff;
}

function tribulationColor(tribulation: import('../sim/types').TribulationType): number {
  if (tribulation === 'thunder') return 0x61f5ff;
  if (tribulation === 'blood-moon') return 0xff4f79;
  if (tribulation === 'frost') return 0x9defff;
  return 0xf6d365;
}

function sealColor(seal: import('../sim/types').TribulationSealId): number {
  if (seal === 'blood') return 0xff4f79;
  if (seal === 'frost') return 0x9defff;
  return 0x61f5ff;
}

function choiceColor(choice: import('../sim/types').TribulationChoiceId): number {
  if (choice.startsWith('blood-')) return 0xff4f79;
  if (choice.startsWith('frost-')) return 0x9defff;
  return 0x61f5ff;
}

function drawTribulationChoice(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  color: number,
  selected: boolean,
  progress: number,
  fade: number,
): void {
  const radius = selected ? 32 + progress * 118 : 150 - progress * 94;
  drawRing(graphics, x, y, radius, color, fade, selected ? 8 : 5);
  drawRing(graphics, x, y, selected ? radius * 0.58 : radius * 0.72, 0xffffff, fade * 0.7, 2);
}

function drawTribulation(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  color: number,
  progress: number,
  fade: number,
): void {
  const radius = 50 + progress * 210;
  drawRing(graphics, x, y, radius, color, fade, 12);
  drawRing(graphics, x, y, radius * 0.72, 0xffffff, fade * 0.55, 4);
  graphics.lineStyle(4, color, fade);
  for (let index = 0; index < 12; index += 1) {
    const angle = index * Math.PI / 6 - progress * 0.8;
    graphics.lineBetween(
      x + Math.cos(angle) * radius * 0.48,
      y + Math.sin(angle) * radius * 0.48,
      x + Math.cos(angle) * radius,
      y + Math.sin(angle) * radius,
    );
  }
}

function drawBossPhase(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  color: number,
  progress: number,
  fade: number,
): void {
  const radius = 48 + Phaser.Math.Easing.Cubic.Out(progress) * 128;
  drawRing(graphics, x, y, radius, color, fade, 12);
  drawRing(graphics, x, y, radius * 0.72, 0xffffff, fade * 0.8, 3);
  for (let index = 0; index < 8; index += 1) {
    const angle = index * Math.PI / 4 + progress;
    graphics.lineStyle(4, color, fade);
    graphics.lineBetween(
      x + Math.cos(angle) * radius * 0.45,
      y + Math.sin(angle) * radius * 0.45,
      x + Math.cos(angle) * radius,
      y + Math.sin(angle) * radius,
    );
  }
}

function bossColor(type: 'crimson' | 'thunder' | 'blood-moon'): number {
  if (type === 'thunder') return 0x61f5ff;
  if (type === 'blood-moon') return 0xff4fa3;
  return 0xff3864;
}

function drawAwakening(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  upgrade: UpgradeId,
  progress: number,
  fade: number,
): void {
  const palette = awakeningPalette(upgrade);
  const radius = 52 + Phaser.Math.Easing.Cubic.Out(progress) * 250;
  drawRing(graphics, x, y, radius, palette.primary, fade, 14);
  drawRing(graphics, x, y, radius * 0.72, 0xffffff, fade, 3);
  drawRing(graphics, x, y, radius * 0.42, palette.secondary, fade * 0.85, 6);
  for (let index = 0; index < palette.rays; index += 1) {
    const angle = index * (Math.PI * 2 / palette.rays) - progress * palette.spin;
    graphics.lineStyle(palette.lineWidth, index % 2 === 0 ? palette.primary : palette.secondary, fade);
    graphics.lineBetween(
      x + Math.cos(angle) * radius * palette.inner,
      y + Math.sin(angle) * radius * palette.inner,
      x + Math.cos(angle) * radius,
      y + Math.sin(angle) * radius,
    );
  }
  if (palette.shape === 'blade') {
    for (let index = 0; index < 6; index += 1) {
      const angle = index * Math.PI / 3 + progress * 4;
      graphics.fillStyle(palette.primary, fade * 0.72);
      graphics.fillTriangle(
        x + Math.cos(angle) * radius * 0.3, y + Math.sin(angle) * radius * 0.3,
        x + Math.cos(angle + 0.18) * radius * 0.9, y + Math.sin(angle + 0.18) * radius * 0.9,
        x + Math.cos(angle - 0.18) * radius * 0.9, y + Math.sin(angle - 0.18) * radius * 0.9,
      );
    }
  } else if (palette.shape === 'storm') {
    for (let index = 0; index < 4; index += 1) {
      const angle = index * Math.PI / 2 + progress * 3;
      graphics.lineStyle(8, palette.secondary, fade * 0.65);
      graphics.lineBetween(x, y, x + Math.cos(angle) * radius, y + Math.sin(angle) * radius);
    }
  } else if (palette.shape === 'void') {
    graphics.fillStyle(palette.primary, fade * 0.22);
    graphics.fillCircle(x, y, radius * 0.64);
    drawRing(graphics, x, y, radius * 0.9, palette.secondary, fade, 3);
  }
}

function awakeningPalette(upgrade: UpgradeId): {
  primary: number;
  secondary: number;
  rays: number;
  lineWidth: number;
  inner: number;
  spin: number;
  shape: 'blade' | 'storm' | 'void' | 'burst';
} {
  if (upgrade === 'thunder-ring' || upgrade === 'chain-lightning') {
    return { primary: 0x61f5ff, secondary: 0xb9f8ff, rays: 12, lineWidth: 5, inner: 0.2, spin: 4, shape: 'storm' };
  }
  if (upgrade === 'fire-burst' || upgrade === 'meteor-seal' || upgrade === 'solar-ray') {
    return { primary: 0xff5a42, secondary: 0xf6d365, rays: 18, lineWidth: 6, inner: 0.16, spin: 2.4, shape: 'burst' };
  }
  if (upgrade === 'frost-seal' || upgrade === 'soul-pin') {
    return { primary: 0x8ffcff, secondary: 0xffffff, rays: 10, lineWidth: 5, inner: 0.26, spin: 1.4, shape: 'storm' };
  }
  if (upgrade === 'void-bell' || upgrade === 'bullet-reprisal') {
    return { primary: 0x8d7cff, secondary: 0xd4c8ff, rays: 9, lineWidth: 6, inner: 0.18, spin: 2.2, shape: 'void' };
  }
  if (upgrade === 'orbiting-blades' || upgrade === 'spirit-sword-rain' || upgrade === 'north-star') {
    return { primary: 0xf6d365, secondary: 0xffffff, rays: 16, lineWidth: 4, inner: 0.3, spin: 3.6, shape: 'blade' };
  }
  return { primary: 0xf6d365, secondary: 0x61f5ff, rays: 14, lineWidth: 5, inner: 0.25, spin: 2, shape: 'burst' };
}

function drawMeteor(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  awakened: boolean | undefined,
  progress: number,
  fade: number,
  style?: 'sword-rain',
): void {
  if (style === 'sword-rain') {
    const length = 70 + progress * 64;
    graphics.lineStyle(12, 0x61f5ff, fade * 0.18);
    graphics.lineBetween(x, y - length, x, y + 8);
    graphics.lineStyle(4, 0xf6d365, fade);
    graphics.lineBetween(x, y - length, x, y + 18);
    drawRing(graphics, x, y, 14 + progress * 42, 0x61f5ff, fade, 4);
    return;
  }
  const fall = Math.max(0, 1 - progress * 2);
  graphics.lineStyle(18, 0xff5a42, fade * 0.22);
  graphics.lineBetween(x - 95 * fall, y - 170 * fall, x, y);
  graphics.lineStyle(6, 0xf6d365, fade);
  graphics.lineBetween(x - 95 * fall, y - 170 * fall, x, y);
  drawRing(graphics, x, y, 12 + progress * 72, 0xff5a42, fade, 8);
  drawRing(graphics, x, y, 8 + progress * 48, 0xf6d365, fade, 3);
  if (awakened) {
    graphics.fillStyle(0xffffff, fade * 0.22);
    graphics.fillCircle(x, y, 18 + progress * 18);
    drawRing(graphics, x, y, 18 + progress * 110, 0xffffff, fade * 0.7, 3);
    drawRing(graphics, x, y, 26 + progress * 138, 0xff5a42, fade * 0.34, 8);
    for (let index = 0; index < 6; index += 1) {
      const angle = index * Math.PI / 3 + progress * 3;
      graphics.lineStyle(4, index % 2 === 0 ? 0xf6d365 : 0xffffff, fade * 0.66);
      graphics.lineBetween(
        x + Math.cos(angle) * 26,
        y + Math.sin(angle) * 26,
        x + Math.cos(angle) * (74 + progress * 72),
        y + Math.sin(angle) * (74 + progress * 72),
      );
    }
    for (let index = 0; index < 8; index += 1) {
      const angle = index * Math.PI / 4 - progress * 2.6;
      const distance = 38 + progress * 112;
      const shard = 6 + (1 - progress) * 8;
      graphics.fillStyle(index % 2 === 0 ? 0xf6d365 : 0xffffff, fade * 0.82);
      graphics.fillTriangle(
        x + Math.cos(angle) * distance,
        y + Math.sin(angle) * distance,
        x + Math.cos(angle + 0.1) * (distance + shard * 2.3),
        y + Math.sin(angle + 0.1) * (distance + shard * 2.3),
        x + Math.cos(angle - 0.1) * (distance + shard * 2.3),
        y + Math.sin(angle - 0.1) * (distance + shard * 2.3),
      );
    }
  }
}

function drawDodge(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  progress: number,
  fade: number,
): void {
  for (let index = 0; index < 3; index += 1) {
    const offset = (index + progress * 4) * 16;
    graphics.lineStyle(4, 0x7dff9c, fade * (1 - index * 0.2));
    graphics.lineBetween(x - offset, y - 24, x - offset + 18, y + 24);
  }
}

function drawFrost(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  frozen: boolean,
  progress: number,
  fade: number,
  style?: 'soul-pin',
): void {
  if (style === 'soul-pin') {
    const radius = 14 + progress * 38;
    drawRing(graphics, x, y, radius, 0xb89cff, fade, 5);
    graphics.lineStyle(3, 0xff4fa3, fade * 0.88);
    graphics.lineBetween(x, y - radius, x, y + radius);
    graphics.lineBetween(x - radius * 0.72, y - radius * 0.55, x + radius * 0.72, y + radius * 0.55);
    return;
  }
  const radius = 12 + progress * (frozen ? 46 : 30);
  drawRing(graphics, x, y, radius, 0x8ffcff, fade, frozen ? 7 : 4);
  if (frozen) {
    graphics.fillStyle(0xb9f8ff, fade * 0.2);
    graphics.fillCircle(x, y, radius * 0.56);
    drawRing(graphics, x, y, radius * 1.32, 0xffffff, fade * 0.38, 2);
  }
  graphics.lineStyle(3, 0xffffff, fade);
  for (let index = 0; index < 6; index += 1) {
    const angle = index * (Math.PI / 3);
    graphics.lineBetween(x, y, x + Math.cos(angle) * radius, y + Math.sin(angle) * radius);
  }
}

function drawShieldBreak(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  radius: number,
  progress: number,
  fade: number,
): void {
  const current = radius * Phaser.Math.Easing.Cubic.Out(progress);
  drawRing(graphics, x, y, current, 0xf6d365, fade, 10);
  drawRing(graphics, x, y, current * 0.8, 0x61f5ff, fade, 4);
}

function drawChestArrival(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  progress: number,
  fade: number,
): void {
  drawRing(graphics, x, y, 18 + progress * 72, 0xf6d365, fade, 6);
  drawRing(graphics, x, y, 10 + progress * 48, 0xffffff, fade * 0.8, 2);
}

function drawRewardBurst(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  progress: number,
  fade: number,
): void {
  for (let index = 0; index < 12; index += 1) {
    const angle = index * (Math.PI / 6);
    const radius = 18 + progress * 130;
    graphics.fillStyle(index % 2 === 0 ? 0xf6d365 : 0x7dff9c, fade);
    graphics.fillCircle(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius, 5);
  }
}

function drawSwordWake(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  angle: number,
  progress: number,
  fade: number,
): void {
  const length = 34 + progress * 42;
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  graphics.lineStyle(12, 0x61f5ff, fade * 0.16);
  graphics.lineBetween(x - dx * length, y - dy * length, x + dx * 12, y + dy * 12);
  graphics.lineStyle(4, 0x8ffcff, fade * 0.68);
  graphics.lineBetween(x - dx * length, y - dy * length, x + dx * 16, y + dy * 16);
  graphics.lineStyle(2, 0xffffff, fade);
  graphics.lineBetween(x - dx * 12, y - dy * 12, x + dx * 22, y + dy * 22);
}

function drawImpact(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  progress: number,
  fade: number,
): void {
  const burst = Phaser.Math.Easing.Cubic.Out(progress);
  graphics.fillStyle(0xffffff, fade * 0.52);
  graphics.fillCircle(x, y, 8 + burst * 7);
  graphics.fillStyle(0xf6d365, fade * 0.22);
  graphics.fillCircle(x, y, 17 + burst * 12);
  drawRing(graphics, x, y, 8 + burst * 38, 0x61f5ff, fade, 4);
  drawRing(graphics, x, y, 5 + burst * 24, 0xf6d365, fade * 0.82, 3);
  drawRing(graphics, x, y, 18 + burst * 54, 0xffffff, fade * 0.26, 2);
  for (let index = 0; index < 12; index += 1) {
    const angle = index * (Math.PI / 4) + 0.2;
    const inner = 8 + burst * 22;
    const outer = 21 + burst * 48;
    graphics.lineStyle(index % 2 === 0 ? 4 : 2, index % 2 === 0 ? 0xf6d365 : 0xffffff, fade);
    graphics.lineBetween(
      x + Math.cos(angle) * inner,
      y + Math.sin(angle) * inner,
      x + Math.cos(angle) * outer,
      y + Math.sin(angle) * outer,
    );
  }
}

function drawKillBurst(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  progress: number,
  fade: number,
): void {
  drawRing(graphics, x, y, 8 + progress * 46, 0xff3864, fade * 0.72, 4);
  drawRing(graphics, x, y, 16 + progress * 64, 0xf6d365, fade * 0.28, 2);
  graphics.fillStyle(0xffffff, fade * 0.28);
  graphics.fillCircle(x, y, 14 + progress * 12);
  for (let index = 0; index < 12; index += 1) {
    const angle = index * (Math.PI / 6) + index * 0.13;
    const radius = 12 + progress * (34 + (index % 3) * 8);
    const size = 5 - progress * 2;
    graphics.fillStyle(index % 3 === 0 ? 0xf6d365 : 0xff3864, fade);
    graphics.fillTriangle(
      x + Math.cos(angle) * radius,
      y + Math.sin(angle) * radius,
      x + Math.cos(angle + 0.12) * (radius + size * 2),
      y + Math.sin(angle + 0.12) * (radius + size * 2),
      x + Math.cos(angle - 0.12) * (radius + size * 2),
      y + Math.sin(angle - 0.12) * (radius + size * 2),
    );
  }
  for (let index = 0; index < 6; index += 1) {
    const angle = index * Math.PI / 3 - progress * 2.6;
    const radius = 20 + progress * 58;
    graphics.lineStyle(2, 0xffffff, fade * 0.6);
    graphics.lineBetween(x + Math.cos(angle) * radius * 0.4, y + Math.sin(angle) * radius * 0.4, x + Math.cos(angle) * radius, y + Math.sin(angle) * radius);
  }
}

function drawDamageSpark(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  color: number,
  progress: number,
  fade: number,
): void {
  const burst = Phaser.Math.Easing.Cubic.Out(progress);
  graphics.fillStyle(color, fade * 0.18);
  graphics.fillCircle(x, y, 8 + burst * 16);
  for (let index = 0; index < 6; index += 1) {
    const angle = index * Math.PI / 3 + progress * 0.7;
    const inner = 7 + burst * 12;
    const outer = inner + 12 + burst * 18;
    graphics.lineStyle(index % 2 === 0 ? 3 : 2, color, fade * 0.72);
    graphics.lineBetween(
      x + Math.cos(angle) * inner,
      y + Math.sin(angle) * inner,
      x + Math.cos(angle) * outer,
      y + Math.sin(angle) * outer,
    );
  }
}

function drawActiveCast(
  graphics: Phaser.GameObjects.Graphics,
  event: Extract<CombatEvent, { type: 'active-skill-cast' }>,
  progress: number,
  fade: number,
): void {
  const { x, y, angle } = event;
  if (event.skill === 'talisman-ruin') {
    const forwardX = Math.cos(angle);
    const forwardY = Math.sin(angle);
    graphics.fillStyle(0xff4e44, fade * 0.14);
    graphics.fillCircle(x + forwardX * (32 + progress * 54), y + forwardY * (32 + progress * 54), 30 + progress * 42);
    drawRing(graphics, x, y, 20 + progress * 112, 0xff4e44, fade, 10);
    drawRing(graphics, x, y, 12 + progress * 78, 0xf6d365, fade * 0.9, 3);
    for (let index = 0; index < 6; index += 1) {
      const talismanAngle = angle + (index - 2.5) * 0.28;
      const distance = 26 + progress * (54 + index * 6);
      const talismanX = x + Math.cos(talismanAngle) * distance;
      const talismanY = y + Math.sin(talismanAngle) * distance;
      const size = 7 + progress * 8;
      graphics.fillStyle(index % 2 === 0 ? 0xff4e44 : 0xf6d365, fade * 0.9);
      graphics.fillRect(talismanX - size / 2, talismanY - size, size, size * 2);
      graphics.lineStyle(2, 0xffffff, fade * 0.82);
      graphics.strokeRect(talismanX - size / 2, talismanY - size, size, size * 2);
    }
    for (let index = 0; index < 3; index += 1) {
      const distance = 54 + progress * 112 + index * 18;
      const sealX = x + forwardX * distance;
      const sealY = y + forwardY * distance;
      const sealSize = 9 + progress * 13;
      graphics.lineStyle(3, index === 1 ? 0xffffff : 0xf6d365, fade * (0.82 - index * 0.16));
      graphics.strokeRect(sealX - sealSize, sealY - sealSize, sealSize * 2, sealSize * 2);
    }
    return;
  }

  if (event.skill === 'dimension-step') {
    const forwardX = Math.cos(angle);
    const forwardY = Math.sin(angle);
    const sideX = -forwardY;
    const sideY = forwardX;
    const reach = 28 + progress * 136;
    const width = 20 + progress * 34;
    graphics.lineStyle(12, 0x8d7cff, fade * 0.36);
    graphics.lineBetween(x, y, x + forwardX * reach, y + forwardY * reach);
    graphics.lineStyle(4, 0xf1d8ff, fade * 0.9);
    graphics.lineBetween(x + sideX * width, y + sideY * width, x + forwardX * reach + sideX * width, y + forwardY * reach + sideY * width);
    graphics.lineBetween(x - sideX * width, y - sideY * width, x + forwardX * reach - sideX * width, y + forwardY * reach - sideY * width);
    for (let index = 0; index < 3; index += 1) {
      const ghost = reach * (0.28 + index * 0.24);
      graphics.fillStyle(index === 1 ? 0xffffff : 0xa96dff, fade * (0.46 - index * 0.08));
      graphics.fillCircle(x + forwardX * ghost, y + forwardY * ghost, 10 - index * 2);
    }
    drawRing(graphics, x + forwardX * reach, y + forwardY * reach, width * 0.9, 0xf1d8ff, fade * 0.76, 3);
    graphics.lineStyle(2, 0xffffff, fade * 0.72);
    graphics.lineBetween(x + forwardX * reach - sideX * width, y + forwardY * reach - sideY * width, x + forwardX * reach + sideX * width, y + forwardY * reach + sideY * width);
    return;
  }

  const radius = 26 + progress * 112;
  drawRing(graphics, x, y, radius, 0xdff9ff, fade, 8);
  drawRing(graphics, x, y, radius * 0.68, 0xf6d365, fade * 0.86, 3);
  for (let index = 0; index < 2; index += 1) {
    const orbitAngle = angle + progress * Math.PI * 2 + index * Math.PI;
    const orbX = x + Math.cos(orbitAngle) * radius * 0.42;
    const orbY = y + Math.sin(orbitAngle) * radius * 0.42;
    graphics.fillStyle(index === 0 ? 0x8ffcff : 0xf6d365, fade * 0.95);
    graphics.fillCircle(orbX, orbY, 10 + progress * 5);
  }
  graphics.lineStyle(3, 0xffffff, fade * 0.8);
  graphics.lineBetween(x - radius * 0.7, y, x + radius * 0.7, y);
  graphics.lineBetween(x, y - radius * 0.7, x, y + radius * 0.7);
  for (let index = 0; index < 4; index += 1) {
    const markAngle = angle - progress * Math.PI * 2 + index * Math.PI / 2;
    const markRadius = radius * 0.82;
    const markX = x + Math.cos(markAngle) * markRadius;
    const markY = y + Math.sin(markAngle) * markRadius;
    graphics.lineStyle(2, index % 2 === 0 ? 0x8ffcff : 0xf6d365, fade * 0.86);
    graphics.strokeRect(markX - 4, markY - 8, 8, 16);
  }
}

function createDamageLabel(scene: Phaser.Scene, event: CombatEvent): Phaser.GameObjects.Text | undefined {
  if (event.type !== 'damage-dealt') return undefined;
  return scene.add.text(event.x, event.y - 18, Math.round(event.amount).toLocaleString(), {
    color: `#${damageNumberColor(event.source).toString(16).padStart(6, '0')}`,
    fontFamily: 'monospace',
    fontSize: '18px',
    fontStyle: 'bold',
    stroke: '#080912',
    strokeThickness: 4,
  }).setOrigin(0.5).setDepth(13);
}

function damageNumberColor(source: import('../sim/types').DamageSource): number {
  if (source === 'meteor' || source === 'solar-ray') return 0xf6d365;
  if (source === 'thunder' || source === 'chain') return 0x61f5ff;
  if (source === 'fire') return 0xff7a5c;
  if (source === 'active' || source === 'void-bell') return 0xc9f5ff;
  if (source === 'soul') return 0xff4fa3;
  return 0xffffff;
}

function drawLightning(
  graphics: Phaser.GameObjects.Graphics,
  event: Extract<CombatEvent, { type: 'chain-lightning' }>,
  progress: number,
  fade: number,
): void {
  const stormNet = event.style === 'storm-net';
  const solarRay = event.style === 'solar-ray';
  const points: Phaser.Math.Vector2[] = [];
  const segments = 7;
  for (let index = 0; index <= segments; index += 1) {
    const t = index / segments;
    const wobble = index === 0 || index === segments ? 0 : Math.sin(index * 12.9 + progress * 18) * 10;
    const dx = event.toX - event.fromX;
    const dy = event.toY - event.fromY;
    const length = Math.max(1, Math.hypot(dx, dy));
    points.push(new Phaser.Math.Vector2(
      event.fromX + dx * t - (dy / length) * wobble,
      event.fromY + dy * t + (dx / length) * wobble,
    ));
  }
  const width = event.awakened ? 18 : 10;
  const primary = stormNet ? 0x4edfff : solarRay ? 0xf6d365 : 0x61f5ff;
  const secondary = stormNet ? 0xb9f8ff : solarRay ? 0xffffff : 0x8ffcff;
  graphics.lineStyle(width, primary, fade * 0.2);
  graphics.strokePoints(points);
  graphics.lineStyle(event.awakened ? 7 : 4, secondary, fade * 0.9);
  graphics.strokePoints(points);
  graphics.lineStyle(1, 0xffffff, fade);
  graphics.strokePoints(points);
  if (event.awakened) {
    graphics.lineStyle(4, 0xb9f8ff, fade * 0.24);
    graphics.strokePoints(points.map((point, index) => new Phaser.Math.Vector2(
      point.x + Math.sin(index * 2.1 + progress * 8) * 12,
      point.y + Math.cos(index * 2.1 + progress * 8) * 12,
    )));
    for (let index = 2; index < points.length - 1; index += 2) {
      const point = points[index];
      graphics.lineStyle(3, 0xb9f8ff, fade * 0.75);
      graphics.lineBetween(point.x, point.y, point.x + (index % 4 ? 22 : -22), point.y - 30);
    }
    drawRing(graphics, event.toX, event.toY, 12 + progress * 28, 0x61f5ff, fade * 0.74, 3);
    graphics.fillStyle(0xffffff, fade * 0.56);
    graphics.fillCircle(event.toX, event.toY, 7 + (1 - progress) * 8);
    for (let index = 0; index < 4; index += 1) {
      const angle = progress * 5 + index * Math.PI / 2;
      graphics.lineStyle(3, primary, fade * 0.82);
      graphics.lineBetween(
        event.toX + Math.cos(angle) * 12,
        event.toY + Math.sin(angle) * 12,
        event.toX + Math.cos(angle) * (34 + progress * 20),
        event.toY + Math.sin(angle) * (34 + progress * 20),
      );
    }
  }
  if (!stormNet && !solarRay) {
    for (const index of [2, 4]) {
      const point = points[index];
      const branchDirection = index === 2 ? 1 : -1;
      graphics.lineStyle(3, 0xb9f8ff, fade * 0.78);
      graphics.lineBetween(point.x, point.y, point.x + branchDirection * 22, point.y - 25);
    }
    drawRing(graphics, event.toX, event.toY, 8 + progress * 18, 0x61f5ff, fade * 0.6, 2);
  }
  if (stormNet) {
    for (let index = 1; index < points.length - 1; index += 2) {
      const point = points[index];
      const size = 8 + Math.sin(progress * Math.PI) * 8;
      graphics.lineStyle(2, 0xffffff, fade * 0.8);
      graphics.strokeRect(point.x - size, point.y - size, size * 2, size * 2);
      graphics.lineStyle(2, primary, fade * 0.78);
      graphics.lineBetween(point.x - size, point.y + size, point.x + size, point.y - size);
    }
  }
  if (solarRay) {
    graphics.lineStyle(3, 0xff8a4c, fade * 0.72);
    graphics.lineBetween(event.fromX, event.fromY, event.toX, event.toY);
    drawRing(graphics, event.toX, event.toY, 10 + progress * 22, 0xf6d365, fade * 0.8, 3);
  }
}

function drawFireBurst(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  radius: number,
  awakened: boolean | undefined,
  progress: number,
  fade: number,
): void {
  const currentRadius = radius * Phaser.Math.Easing.Quadratic.Out(progress) * (awakened ? 1.22 : 1);
  drawRing(graphics, x, y, currentRadius, 0xff5a42, fade, 10);
  drawRing(graphics, x, y, currentRadius * 0.72, 0xf6d365, fade * 0.9, 3);
  if (awakened) {
    graphics.fillStyle(0xff5a42, fade * 0.18);
    graphics.fillCircle(x, y, currentRadius * 0.72);
    drawRing(graphics, x, y, currentRadius * 0.42, 0xffffff, fade * 0.75, 5);
    drawRing(graphics, x, y, currentRadius * 1.08, 0xff5a42, fade * 0.48, 4);
    for (let index = 0; index < 12; index += 1) {
      const angle = index * Math.PI / 6 - progress * 1.8;
      const inner = currentRadius * 0.5;
      const outer = currentRadius * 1.14;
      graphics.lineStyle(index % 2 === 0 ? 5 : 2, index % 2 === 0 ? 0xf6d365 : 0xffffff, fade * 0.78);
      graphics.lineBetween(
        x + Math.cos(angle) * inner,
        y + Math.sin(angle) * inner,
        x + Math.cos(angle) * outer,
        y + Math.sin(angle) * outer,
      );
    }
    for (let index = 0; index < 8; index += 1) {
      const angle = index * Math.PI / 4 + progress * 2.2;
      const distance = currentRadius * (0.58 + progress * 0.48);
      const ember = 6 + (1 - progress) * 8;
      graphics.fillStyle(index % 2 === 0 ? 0xffffff : 0xf6d365, fade * 0.9);
      graphics.fillTriangle(
        x + Math.cos(angle) * distance,
        y + Math.sin(angle) * distance,
        x + Math.cos(angle + 0.14) * (distance + ember * 2),
        y + Math.sin(angle + 0.14) * (distance + ember * 2),
        x + Math.cos(angle - 0.14) * (distance + ember * 2),
        y + Math.sin(angle - 0.14) * (distance + ember * 2),
      );
    }
  }
  graphics.lineStyle(2, 0xf6d365, fade);
  for (let index = 0; index < 8; index += 1) {
    const angle = index * (Math.PI / 4) + progress * 0.4;
    const px = x + Math.cos(angle) * currentRadius * 0.68;
    const py = y + Math.sin(angle) * currentRadius * 0.68;
    graphics.strokeRect(px - 5, py - 9, 10, 18);
  }
}

function drawLevelSigil(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  progress: number,
  fade: number,
): void {
  const eased = Phaser.Math.Easing.Back.Out(Math.min(1, progress * 1.7));
  const radius = 42 + eased * 100;
  drawRing(graphics, x, y, radius, 0xf6d365, Math.min(1, fade * 1.8), 4);
  drawRing(graphics, x, y, radius * 0.72, 0x61f5ff, fade, 3);
  graphics.lineStyle(3, 0xf6d365, fade);
  for (let index = 0; index < 12; index += 1) {
    const angle = index * (Math.PI / 6) - progress * 1.2;
    const px = x + Math.cos(angle) * radius;
    const py = y + Math.sin(angle) * radius;
    graphics.save();
    graphics.translateCanvas(px, py);
    graphics.rotateCanvas(angle);
    graphics.strokeRect(-4, -13, 8, 26);
    graphics.restore();
  }
}

function drawBossArrival(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  progress: number,
  fade: number,
): void {
  const eased = Phaser.Math.Easing.Cubic.Out(progress);
  const radius = 58 + eased * 168;
  drawRing(graphics, x, y, radius, 0xff3864, fade, 18);
  drawRing(graphics, x, y, radius * 0.8, 0xf6d365, Math.min(1, fade * 1.4), 6);
  drawRing(graphics, x, y, radius * 0.5, 0xffffff, fade * 0.55, 3);
  drawRing(graphics, x, y, radius * 0.28, 0xff4fa3, fade * 0.8, 8);
  graphics.lineStyle(4, 0xf6d365, fade);
  for (let index = 0; index < 12; index += 1) {
    const angle = index * (Math.PI / 6) + progress * 1.9;
    const px = x + Math.cos(angle) * radius * 0.78;
    const py = y + Math.sin(angle) * radius * 0.78;
    graphics.save();
    graphics.translateCanvas(px, py);
    graphics.rotateCanvas(angle);
    graphics.strokeRect(-6, -15, 12, 30);
    graphics.restore();
  }
}

function drawBossCast(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  color: number,
  progress: number,
  fade: number,
): void {
  const pulse = 0.82 + Math.sin(progress * Math.PI * 6) * 0.12;
  const radius = (44 + progress * 82) * pulse;
  drawRing(graphics, x, y, radius, color, fade, 8);
  drawRing(graphics, x, y, radius * 0.62, 0xffffff, fade * 0.72, 2);
  for (let index = 0; index < 8; index += 1) {
    const angle = index * Math.PI / 4 - progress * 2.2;
    graphics.lineStyle(4, color, fade * 0.86);
    graphics.lineBetween(
      x + Math.cos(angle) * radius * 0.34,
      y + Math.sin(angle) * radius * 0.34,
      x + Math.cos(angle) * radius,
      y + Math.sin(angle) * radius,
    );
  }
}

function drawBossObjective(graphics: Phaser.GameObjects.Graphics, x: number, y: number, color: number, success: boolean, progress: number, fade: number): void {
  const radius = 28 + Phaser.Math.Easing.Cubic.Out(progress) * 104;
  const accent = success ? 0xf6d365 : color;
  drawRing(graphics, x, y, radius, accent, fade, 10);
  drawRing(graphics, x, y, radius * 0.62, success ? 0x8ffcff : 0xffffff, fade * 0.75, 3);
  for (let index = 0; index < 8; index += 1) {
    const angle = index * Math.PI / 4 + progress * 1.8;
    graphics.lineStyle(4, accent, fade);
    graphics.lineBetween(x + Math.cos(angle) * radius * 0.4, y + Math.sin(angle) * radius * 0.4, x + Math.cos(angle) * radius, y + Math.sin(angle) * radius);
  }
}

function drawBossDetonation(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  color: number,
  progress: number,
  fade: number,
): void {
  const eased = Phaser.Math.Easing.Cubic.Out(progress);
  const radius = 20 + eased * 112;
  graphics.fillStyle(color, fade * 0.16);
  graphics.fillCircle(x, y, radius * 0.72);
  drawRing(graphics, x, y, radius, color, fade, 12);
  drawRing(graphics, x, y, radius * 0.58, 0xffffff, fade * 0.72, 3);
  for (let index = 0; index < 10; index += 1) {
    const angle = index * Math.PI / 5 + progress * 1.6;
    graphics.lineStyle(5, color, fade);
    graphics.lineBetween(
      x + Math.cos(angle) * radius * 0.35,
      y + Math.sin(angle) * radius * 0.35,
      x + Math.cos(angle) * radius * 1.15,
      y + Math.sin(angle) * radius * 1.15,
    );
  }
}

function drawRing(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  radius: number,
  color: number,
  alpha: number,
  width: number,
): void {
  graphics.lineStyle(width, color, Math.max(0, alpha));
  graphics.strokeCircle(x, y, Math.max(1, radius));
}
