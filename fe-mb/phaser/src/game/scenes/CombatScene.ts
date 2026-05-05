import Phaser from 'phaser';
import { drawGrid } from '../render/gridRenderer';
import { renderHand, type CardSprite } from '../render/cardHandRenderer';
import type { GameData } from '../../data/load';

export class CombatScene extends Phaser.Scene {
  private hand: CardSprite[] = [];

  constructor() {
    super({ key: 'CombatScene' });
  }

  create(): void {
    drawGrid(this);
    this.add.text(640, 40, 'Combat Sandbox', {
      color: '#e8d8c0', fontSize: '20px',
    }).setOrigin(0.5);

    const data = this.registry.get('gameData') as GameData;
    const royDeck = data.unitById('roy')!.deck;
    const handCards = royDeck.slice(0, 5).map(id => data.cardById(id)!);
    this.hand = renderHand(this, handCards);
  }
}
