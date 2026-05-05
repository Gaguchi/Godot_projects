import Phaser from 'phaser';
import { drawGrid } from '../render/gridRenderer';

export class CombatScene extends Phaser.Scene {
  constructor() {
    super({ key: 'CombatScene' });
  }

  create(): void {
    drawGrid(this);
    this.add.text(640, 40, 'Combat Sandbox', {
      color: '#e8d8c0',
      fontSize: '20px',
    }).setOrigin(0.5);
  }
}
