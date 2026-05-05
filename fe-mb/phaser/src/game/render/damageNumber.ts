import Phaser from 'phaser';
import { tileToWorld, type GridCoord } from './gridRenderer';

export function spawnDamageNumber(
  scene: Phaser.Scene,
  pos: GridCoord,
  amount: number,
): void {
  const { x, y } = tileToWorld(pos);
  const isHeal = amount < 0;
  const text = isHeal ? `+${-amount}` : `${amount}`;
  const color = isHeal ? '#7fffaa' : amount === 0 ? '#aaaaaa' : '#ff6b6b';

  const t = scene.add.text(x, y - 10, text, {
    color, fontSize: '20px', fontStyle: 'bold',
    stroke: '#000', strokeThickness: 3,
  }).setOrigin(0.5).setDepth(200);

  scene.tweens.add({
    targets: t,
    y: y - 50,
    alpha: 0,
    duration: 700,
    ease: 'Quad.easeOut',
    onComplete: () => t.destroy(),
  });
}
