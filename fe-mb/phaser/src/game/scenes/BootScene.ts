import Phaser from 'phaser'

export class BootScene extends Phaser.Scene {
  constructor() { super('boot') }

  create(): void {
    this.add.text(640, 360, 'FE_MB Foundation — Boot OK', {
      fontFamily: 'monospace', fontSize: '24px', color: '#e0d0a0',
    }).setOrigin(0.5)

    this.time.delayedCall(800, () => {
      this.scene.start('combat')
    })
  }
}
