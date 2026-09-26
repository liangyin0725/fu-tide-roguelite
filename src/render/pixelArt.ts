import type Phaser from 'phaser';
import {
  GENERATED_ARENA_CELLS,
  GENERATED_EFFECT_CELLS,
  GENERATED_PIXEL_ASSETS,
  GENERATED_SPRITE_CELLS,
  generatedArenaTextureKey,
  type GeneratedAtlasCell,
} from './generatedPixelArt';

export interface PixelPart {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
}

export interface PixelSpriteDefinition {
  width: number;
  height: number;
  frames: PixelPart[][];
}

export type PixelSpriteKey = keyof typeof PIXEL_SPRITES;

const outline = '#080912';
const white = '#f4fbff';
const cyan = '#61f5ff';
const gold = '#f6d365';
const crimson = '#ff3864';
const violet = '#9d67ff';
const magenta = '#ff4fa3';

function daoist(accent: string, weapon: 'sword' | 'claw' | 'bow' | 'seal' | 'lamp'): PixelPart[][] {
  return [0, 1].map((step) => {
    const foot = step * 2;
    const parts: PixelPart[] = [
      { x: 11, y: 3, w: 10, h: 3, color: outline },
      { x: 9, y: 6, w: 14, h: 3, color: accent },
      { x: 11, y: 9, w: 10, h: 8, color: white },
      { x: 13, y: 11, w: 2, h: 2, color: outline },
      { x: 18, y: 11, w: 2, h: 2, color: outline },
      { x: 8, y: 17, w: 16, h: 9, color: accent },
      { x: 12, y: 18, w: 8, h: 6, color: outline },
      { x: 10 - foot, y: 26, w: 5, h: 4, color: white },
      { x: 17 + foot, y: 26, w: 5, h: 4, color: white },
      { x: 14, y: 18, w: 4, h: 8, color: gold },
      { x: 10, y: 7, w: 5, h: 1, color: white },
      { x: 8, y: 17, w: 2, h: 7, color: white },
      { x: 21, y: 18, w: 2, h: 5, color: white },
    ];
    if (weapon === 'sword') parts.push({ x: 24, y: 8, w: 2, h: 18, color: cyan }, { x: 22, y: 23, w: 6, h: 2, color: gold });
    if (weapon === 'claw') parts.push({ x: 4, y: 17, w: 5, h: 3, color: crimson }, { x: 23, y: 17, w: 5, h: 3, color: crimson });
    if (weapon === 'bow') parts.push({ x: 23, y: 10, w: 2, h: 15, color: gold }, { x: 25, y: 12, w: 3, h: 11, color: outline });
    if (weapon === 'seal') parts.push({ x: 23, y: 10, w: 6, h: 12, color: magenta }, { x: 25, y: 12, w: 2, h: 8, color: white });
    if (weapon === 'lamp') parts.push({ x: 23, y: 13, w: 7, h: 9, color: violet }, { x: 25, y: 10, w: 3, h: 4, color: cyan });
    return parts;
  });
}

function boss(accent: string, crown: string): PixelPart[][] {
  return [0, 1].map((step) => [
    { x: 15, y: 3 + step, w: 18, h: 5, color: crown },
    { x: 11, y: 8 + step, w: 26, h: 6, color: outline },
    { x: 14, y: 13 + step, w: 20, h: 13, color: white },
    { x: 17, y: 17 + step, w: 4, h: 3, color: accent },
    { x: 27, y: 17 + step, w: 4, h: 3, color: accent },
    { x: 8, y: 26, w: 32, h: 15, color: accent },
    { x: 14, y: 29, w: 20, h: 9, color: outline },
    { x: 3, y: 28, w: 7, h: 12, color: crown },
    { x: 38, y: 28, w: 7, h: 12, color: crown },
    { x: 11 - step * 2, y: 41, w: 10, h: 6, color: white },
    { x: 27 + step * 2, y: 41, w: 10, h: 6, color: white },
    { x: 21, y: 27, w: 6, h: 14, color: gold },
    { x: 17, y: 4 + step, w: 9, h: 1, color: white },
    { x: 14, y: 14 + step, w: 3, h: 8, color: white },
    { x: 9, y: 27, w: 3, h: 10, color: white },
    { x: 36, y: 27, w: 3, h: 10, color: white },
  ]);
}

export const PIXEL_SPRITES = {
  player: { width: 32, height: 32, frames: daoist(cyan, 'sword') },
  'player-xuan-jian': { width: 32, height: 32, frames: daoist(cyan, 'sword') },
  'player-lei-zhuan': { width: 32, height: 32, frames: daoist(violet, 'seal') },
  'player-shou-yi': { width: 32, height: 32, frames: daoist(gold, 'lamp') },
  'player-jing-po': { width: 32, height: 32, frames: daoist(magenta, 'seal') },
  melee: { width: 32, height: 32, frames: daoist(crimson, 'claw') },
  crossbow: { width: 32, height: 32, frames: daoist(gold, 'bow') },
  talisman: { width: 32, height: 32, frames: daoist(magenta, 'seal') },
  'soul-lamp': { width: 32, height: 32, frames: daoist(violet, 'lamp') },
  'boss-crimson': { width: 48, height: 48, frames: boss(crimson, gold) },
  'boss-thunder': { width: 48, height: 48, frames: boss(cyan, white) },
  'boss-blood-moon': { width: 48, height: 48, frames: boss(magenta, violet) },
} as const satisfies Record<string, PixelSpriteDefinition>;

export function registerPixelTextures(scene: Phaser.Scene): void {
  registerGeneratedPixelTextures(scene);
  for (const [key, definition] of Object.entries(PIXEL_SPRITES) as [PixelSpriteKey, PixelSpriteDefinition][]) {
    if (scene.textures.exists(key)) continue;
    const texture = scene.textures.createCanvas(
      key,
      definition.width * definition.frames.length,
      definition.height,
    );
    if (!texture) continue;
    const context = texture.getContext();
    context.imageSmoothingEnabled = false;
    definition.frames.forEach((frame, frameIndex) => {
      for (const part of frame) {
        context.fillStyle = part.color;
        context.fillRect(frameIndex * definition.width + part.x, part.y, part.w, part.h);
      }
      texture.add(frameIndex, 0, frameIndex * definition.width, 0, definition.width, definition.height);
    });
    texture.refresh();
    texture.setFilter(1);
  }
}

export function createPixelSprite(scene: Phaser.Scene, key: PixelSpriteKey): Phaser.GameObjects.Sprite {
  const generated = scene.textures.exists(key);
  return scene.add.sprite(0, 0, key, 0).setOrigin(0.5).setDepth(5).setScale(generated ? 1 : 2);
}

export function preloadGeneratedPixelAssets(scene: Phaser.Scene): void {
  for (const asset of Object.values(GENERATED_PIXEL_ASSETS)) {
    if (!scene.textures.exists(asset.textureKey)) scene.load.image(asset.textureKey, asset.url);
  }
}

function registerGeneratedPixelTextures(scene: Phaser.Scene): void {
  for (const [key, cell] of Object.entries(GENERATED_SPRITE_CELLS) as [PixelSpriteKey, GeneratedAtlasCell][]) {
    createCellTexture(scene, key, cell, true);
  }
  for (const [tribulation, cell] of Object.entries(GENERATED_ARENA_CELLS)) {
    createCellTexture(scene, generatedArenaTextureKey(tribulation as keyof typeof GENERATED_ARENA_CELLS), cell, false);
  }
  for (const [effect, cell] of Object.entries(GENERATED_EFFECT_CELLS)) {
    createCellTexture(scene, `generated-vfx-${effect}`, cell, false);
  }
}

function createCellTexture(
  scene: Phaser.Scene,
  outputKey: string,
  cell: GeneratedAtlasCell,
  animated: boolean,
): void {
  if (scene.textures.exists(outputKey)) return;
  const asset = GENERATED_PIXEL_ASSETS[cell.atlas];
  if (!scene.textures.exists(asset.textureKey)) return;
  const source = scene.textures.get(asset.textureKey).getSourceImage() as CanvasImageSource & {
    width: number;
    height: number;
  };
  const cellWidth = Math.floor(source.width / asset.columns);
  const cellHeight = Math.floor(source.height / asset.rows);
  const frameCount = animated ? 2 : 1;
  const texture = scene.textures.createCanvas(outputKey, cell.outputSize * frameCount, cell.outputSize);
  if (!texture) return;
  const context = texture.getContext();
  context.imageSmoothingEnabled = false;
  for (let frame = 0; frame < frameCount; frame += 1) {
    const bob = frame === 0 ? 0 : 2;
    context.drawImage(
      source,
      cell.column * cellWidth,
      cell.row * cellHeight,
      cellWidth,
      cellHeight,
      frame * cell.outputSize,
      bob,
      cell.outputSize,
      cell.outputSize - bob,
    );
    texture.add(frame, 0, frame * cell.outputSize, 0, cell.outputSize, cell.outputSize);
  }
  texture.refresh();
  texture.setFilter(1);
}
