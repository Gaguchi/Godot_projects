import Phaser from 'phaser'

const UNIT_SPRITES = ['roy', 'marcus', 'lilina', 'garrik', 'lyra', 'kael', 'bandit', 'bandit_archer', 'brigand_chief', 'wolf', 'daren']

export class BootScene extends Phaser.Scene {
  constructor() { super('boot') }

  preload(): void {
    for (const u of UNIT_SPRITES) this.load.image(`unit_${u}`, `/sprites/units/${u}.png`)
  }

  create(): void {
    this.add.text(640, 360, 'FE_MB Foundation — Boot OK', {
      fontFamily: 'monospace', fontSize: '24px', color: '#e0d0a0',
    }).setOrigin(0.5)

    this.time.delayedCall(800, () => {
      this.scene.start('combat')
    })
  }
}
