import type Phaser from 'phaser';
import type { TribulationType } from '../sim/types';

export interface ArenaTheme {
  name: string;
  background: number;
  grid: number;
  detail: number;
  accent: number;
  motif: 'rings' | 'lightning' | 'moon' | 'crystal';
}

const ARENA_THEMES: Record<TribulationType, ArenaTheme> = {
  calm: { name: '常夜道场', background: 0x0d1626, grid: 0x304b68, detail: 0x7ab8d6, accent: 0x61f5ff, motif: 'rings' },
  thunder: { name: '九霄雷域', background: 0x0b2032, grid: 0x23718c, detail: 0x89ddf5, accent: 0x61f5ff, motif: 'lightning' },
  'blood-moon': { name: '血月祭场', background: 0x220b1c, grid: 0x762149, detail: 0xff9fc9, accent: 0xff4fa3, motif: 'moon' },
  frost: { name: '玄霜冰原', background: 0x0c2530, grid: 0x31788b, detail: 0xd5f9ff, accent: 0xc9f5ff, motif: 'crystal' },
};

export function getArenaTheme(tribulation: TribulationType): ArenaTheme {
  return ARENA_THEMES[tribulation];
}

export function drawArenaTheme(
  graphics: Phaser.GameObjects.Graphics,
  width: number,
  height: number,
  tribulation: TribulationType,
): void {
  const theme = getArenaTheme(tribulation);
  graphics.clear();
  graphics.fillStyle(theme.background, 1);
  graphics.fillRect(0, 0, width, height);
  drawBattlefieldTexture(graphics, width, height, theme);
  graphics.lineStyle(1, theme.grid, 0.72);
  for (let x = 0; x <= width; x += 80) graphics.lineBetween(x, 0, x, height);
  for (let y = 0; y <= height; y += 80) graphics.lineBetween(0, y, width, y);
  graphics.lineStyle(4, theme.accent, 0.38);
  graphics.strokeRect(0, 0, width, height);

  if (theme.motif === 'lightning') {
    drawLightningField(graphics, width, height, theme.accent);
  } else if (theme.motif === 'moon') {
    drawBloodMoonField(graphics, width, height, theme.accent);
  } else if (theme.motif === 'crystal') {
    drawFrostField(graphics, width, height, theme.accent);
  } else {
    drawCalmField(graphics, width, height, theme.accent);
  }
}

function drawBattlefieldTexture(
  graphics: Phaser.GameObjects.Graphics,
  width: number,
  height: number,
  theme: ArenaTheme,
): void {
  graphics.lineStyle(1, theme.detail, 0.16);
  for (let x = 40; x <= width; x += 80) graphics.lineBetween(x, 0, x, height);
  for (let y = 40; y <= height; y += 80) graphics.lineBetween(0, y, width, y);

  for (let x = 80; x < width; x += 160) {
    for (let y = 80; y < height; y += 160) {
      graphics.fillStyle(theme.detail, 0.12);
      graphics.fillCircle(x, y, 2);
      graphics.lineStyle(1, theme.detail, 0.28);
      graphics.strokeCircle(x, y, 7);
      graphics.lineBetween(x - 13, y, x + 13, y);
      graphics.lineBetween(x, y - 13, x, y + 13);
    }
  }
}

function drawCalmField(graphics: Phaser.GameObjects.Graphics, width: number, height: number, accent: number): void {
  graphics.lineStyle(2, 0xf6d365, 0.2);
  graphics.lineStyle(2, accent, 0.24);
  for (const [x, y, radius] of motifPoints(width, height, [
    [0.18, 0.24, 0.12], [0.5, 0.68, 0.16], [0.76, 0.32, 0.1], [0.9, 0.78, 0.08],
  ])) {
    graphics.strokeCircle(x, y, radius);
    graphics.strokeCircle(x, y, radius * 0.72);
    graphics.strokeCircle(x, y, radius * 0.36);
  }
}

function drawLightningField(graphics: Phaser.GameObjects.Graphics, width: number, height: number, accent: number): void {
  for (const [x, y] of motifPoints(width, height, [
    [0.12, 0.18, 0], [0.36, 0.34, 0], [0.62, 0.16, 0],
    [0.24, 0.78, 0], [0.7, 0.72, 0], [0.9, 0.46, 0],
  ])) {
    graphics.fillStyle(accent, 0.06);
    graphics.fillCircle(x, y, 74);
    graphics.lineStyle(3, accent, 0.45);
    graphics.strokeCircle(x, y, 28);
    graphics.lineStyle(2, 0xffffff, 0.42);
    const points = [
      { x, y: y - 52 },
      { x: x + 13, y: y - 12 },
      { x: x - 10, y: y + 6 },
      { x: x + 8, y: y + 52 },
    ] as Phaser.Math.Vector2[];
    graphics.strokePoints(points, false);
  }
  graphics.lineStyle(2, accent, 0.16);
  graphics.lineBetween(0, height * 0.25, width, height * 0.6);
  graphics.lineBetween(width * 0.2, 0, width * 0.72, height);
}

function drawBloodMoonField(graphics: Phaser.GameObjects.Graphics, width: number, height: number, accent: number): void {
  for (const [x, y, radius] of motifPoints(width, height, [
    [0.16, 0.22, 0.09], [0.48, 0.62, 0.14], [0.72, 0.28, 0.07], [0.88, 0.76, 0.11],
  ])) {
    graphics.fillStyle(accent, 0.045);
    graphics.fillCircle(x, y, radius);
    graphics.lineStyle(3, accent, 0.34);
    graphics.strokeCircle(x, y, radius);
    graphics.lineStyle(1, 0xffd1e5, 0.36);
    graphics.strokeCircle(x, y, radius * 0.64);
    for (let index = 0; index < 6; index += 1) {
      const angle = index * Math.PI / 3;
      graphics.lineStyle(2, accent, 0.28);
      graphics.lineBetween(x, y, x + Math.cos(angle) * radius * 0.82, y + Math.sin(angle) * radius * 0.82);
    }
  }
  graphics.lineStyle(2, accent, 0.14);
  graphics.lineBetween(0, height * 0.7, width * 0.48, height * 0.56);
  graphics.lineBetween(width * 0.45, height, width * 0.82, 0);
}

function drawFrostField(graphics: Phaser.GameObjects.Graphics, width: number, height: number, accent: number): void {
  for (const [x, y, radius] of motifPoints(width, height, [
    [0.12, 0.2, 0.07], [0.34, 0.74, 0.11], [0.58, 0.38, 0.09],
    [0.76, 0.16, 0.06], [0.9, 0.68, 0.08],
  ])) {
    graphics.fillStyle(accent, 0.04);
    graphics.fillCircle(x, y, radius);
    graphics.lineStyle(2, accent, 0.42);
    graphics.strokeCircle(x, y, radius);
    for (let index = 0; index < 6; index += 1) {
      const angle = index * Math.PI / 3;
      graphics.lineStyle(index % 2 ? 2 : 3, 0xffffff, 0.42);
      graphics.lineBetween(x, y, x + Math.cos(angle) * radius, y + Math.sin(angle) * radius);
    }
  }
  graphics.lineStyle(2, accent, 0.16);
  for (let x = 40; x < width; x += 220) graphics.lineBetween(x, 0, x + 120, height);
}

function motifPoints(
  width: number,
  height: number,
  points: readonly (readonly [number, number, number])[],
): [number, number, number][] {
  const scale = Math.min(width, height);
  return points.map(([x, y, radius]) => [width * x, height * y, scale * radius]);
}
