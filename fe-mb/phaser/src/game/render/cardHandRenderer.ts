import Phaser from 'phaser';
import type { Card } from '../../data/schemas';

export const CARD_WIDTH = 100;
export const CARD_HEIGHT = 140;
const HAND_Y = 720 - CARD_HEIGHT / 2 - 20;
const HAND_CENTER_X = 640;
const FAN_SPREAD = 100;
const FAN_ANGLE = 0.06;

export interface CardSprite {
  container: Phaser.GameObjects.Container;
  card: Card;
  baseX: number;
  baseY: number;
  baseAngle: number;
}

export function renderHand(scene: Phaser.Scene, cards: Card[]): CardSprite[] {
  const sprites: CardSprite[] = [];
  const count = cards.length;
  const totalWidth = (count - 1) * FAN_SPREAD;
  const startX = HAND_CENTER_X - totalWidth / 2;

  cards.forEach((card, i) => {
    const baseX = startX + i * FAN_SPREAD;
    const baseY = HAND_Y;
    const baseAngle = (i - (count - 1) / 2) * FAN_ANGLE;
    sprites.push({ container: createCardContainer(scene, card, baseX, baseY, baseAngle), card, baseX, baseY, baseAngle });
  });

  return sprites;
}

function createCardContainer(
  scene: Phaser.Scene,
  card: Card,
  x: number,
  y: number,
  angle: number,
): Phaser.GameObjects.Container {
  const container = scene.add.container(x, y);
  container.setRotation(angle);
  container.setSize(CARD_WIDTH, CARD_HEIGHT);

  const bg = scene.add.graphics();
  drawCardBackground(bg, false);
  container.add(bg);
  container.setData('bg', bg);

  const name = scene.add.text(0, -CARD_HEIGHT / 2 + 14, card.name, {
    color: '#e8d8c0',
    fontSize: '12px',
    fontStyle: 'bold',
  }).setOrigin(0.5, 0);
  container.add(name);

  const cost = scene.add.text(-CARD_WIDTH / 2 + 12, -CARD_HEIGHT / 2 + 12, String(card.cost), {
    color: '#ffb366',
    fontSize: '14px',
    fontStyle: 'bold',
  }).setOrigin(0.5);
  container.add(cost);

  const dmg = card.damage_base >= 0 ? `${card.damage_base}+${card.stat}` : `+${-card.damage_base}HP`;
  const dmgText = scene.add.text(0, 0, dmg, {
    color: '#e8d8c0',
    fontSize: '14px',
  }).setOrigin(0.5);
  container.add(dmgText);

  const desc = scene.add.text(0, CARD_HEIGHT / 2 - 24, card.description, {
    color: '#a89878',
    fontSize: '9px',
    wordWrap: { width: CARD_WIDTH - 12 },
    align: 'center',
  }).setOrigin(0.5, 0);
  container.add(desc);

  container.setInteractive(
    new Phaser.Geom.Rectangle(-CARD_WIDTH / 2, -CARD_HEIGHT / 2, CARD_WIDTH, CARD_HEIGHT),
    Phaser.Geom.Rectangle.Contains,
  );

  return container;
}

function drawCardBackground(g: Phaser.GameObjects.Graphics, hovered: boolean): void {
  g.clear();
  g.fillStyle(hovered ? 0x3a2a20 : 0x2a1c14, 1);
  g.fillRoundedRect(-CARD_WIDTH / 2, -CARD_HEIGHT / 2, CARD_WIDTH, CARD_HEIGHT, 6);
  g.lineStyle(2, hovered ? 0xffb366 : 0x6a4a30, 1);
  g.strokeRoundedRect(-CARD_WIDTH / 2, -CARD_HEIGHT / 2, CARD_WIDTH, CARD_HEIGHT, 6);
}

export function setCardHovered(sprite: CardSprite, hovered: boolean): void {
  const bg = sprite.container.getData('bg') as Phaser.GameObjects.Graphics;
  drawCardBackground(bg, hovered);
}
