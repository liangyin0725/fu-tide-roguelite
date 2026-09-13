import Phaser from 'phaser';
import './styles.css';
import { GameScene } from './scenes/GameScene';
import { GAME_RENDERER } from './gameConfig';

const config: Phaser.Types.Core.GameConfig = {
  type: GAME_RENDERER,
  parent: 'game-root',
  backgroundColor: '#080912',
  pixelArt: true,
  antialias: false,
  roundPixels: true,
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: window.innerWidth,
    height: window.innerHeight,
  },
  scene: [GameScene],
  fps: {
    target: 60,
    forceSetTimeOut: true,
  },
};

new Phaser.Game(config);
