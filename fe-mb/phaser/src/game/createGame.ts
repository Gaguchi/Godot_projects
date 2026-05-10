import Phaser from 'phaser'
import { BoardScene } from './scenes/BoardScene'

export function createGame(parent: HTMLElement): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: 1280,
    height: 720,
    backgroundColor: '#0a0a0f',
    // BootScene was a stub that delayed-call'd scene.start('combat'). The
    // delayedCall was unreliable under React StrictMode double-mount and
    // also prevented the tween manager from ticking on combat. Skip it:
    // BoardScene is the only scene we need.
    scene: [BoardScene],
    pixelArt: true,
  })
}
