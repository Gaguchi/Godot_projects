import Phaser from 'phaser';
import { loadGameData } from '../../data/load';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  create(): void {
    try {
      const data = loadGameData();
      this.registry.set('gameData', data);
      this.scene.start('CombatScene');
    } catch (err) {
      this.add.text(40, 40, `BOOT FAILED:\n${(err as Error).message}`, {
        color: '#ff6b6b', fontSize: '14px', wordWrap: { width: 1200 },
      });
    }
  }
}
