import Phaser from 'phaser';
import { tileToWorld, TILE_SIZE } from './gridRenderer';
import type { UnitInstance } from '../entities/Unit';
import type { EnemyInstance } from '../entities/Enemy';

const PARTY_COLOR = 0x4488ff;
const ENEMY_COLOR = 0xc04444;

export interface ActorSprite {
  graphics: Phaser.GameObjects.Graphics;
  hpText: Phaser.GameObjects.Text;
  ref: UnitInstance | EnemyInstance;
}

export function renderActor(
  scene: Phaser.Scene,
  actor: UnitInstance | EnemyInstance,
  isParty: boolean,
): ActorSprite {
  const { x, y } = tileToWorld(actor.pos);
  const g = scene.add.graphics();
  g.fillStyle(isParty ? PARTY_COLOR : ENEMY_COLOR, 1);
  g.fillCircle(x, y, TILE_SIZE / 2 - 6);
  g.lineStyle(2, 0x000000, 0.5);
  g.strokeCircle(x, y, TILE_SIZE / 2 - 6);

  const hpText = scene.add.text(x, y + TILE_SIZE / 2 - 10, `${actor.currentHp}`, {
    color: '#fff', fontSize: '11px', fontStyle: 'bold',
  }).setOrigin(0.5);

  return { graphics: g, hpText, ref: actor };
}

export function refreshActor(sprite: ActorSprite): void {
  sprite.hpText.setText(`${sprite.ref.currentHp}`);
  if (!sprite.ref.alive) {
    sprite.graphics.alpha = 0.3;
    sprite.hpText.setText('x');
  }
}
