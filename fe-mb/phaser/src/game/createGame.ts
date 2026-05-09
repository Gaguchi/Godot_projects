import Phaser from 'phaser'
import { BootScene } from './scenes/BootScene'
import { CombatScene } from './scenes/CombatScene'

export function createGame(parent: HTMLElement): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: 1280,
    height: 720,
    backgroundColor: '#0a0a0f',
    scene: [BootScene, CombatScene],
    pixelArt: true,
  })
}
