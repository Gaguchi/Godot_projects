import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  create(): void {
    const { width, height } = this.scale.gameSize;
    this.add.text(width / 2, height / 2, 'Phaser ready', {
      color: '#e8d8c0',
      fontSize: '24px',
    }).setOrigin(0.5);
  }
}
