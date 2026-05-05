import Phaser from 'phaser';
import { drawGrid, worldToTile, tileToWorld } from '../render/gridRenderer';
import { renderHand, attachCardInput, type CardSprite } from '../render/cardHandRenderer';
import { TargetingOverlay } from '../render/targetingRenderer';
import { validTilesForCard, aoeTilesAt } from '../systems/targeting';
import { useCombatStore } from '../../state/combatStore';
import type { GameData } from '../../data/load';

const ROY_TILE = { x: 3, y: 5 };

export class CombatScene extends Phaser.Scene {
  private hand: CardSprite[] = [];
  private overlay!: TargetingOverlay;
  private data!: GameData;
  private royMarker!: Phaser.GameObjects.Graphics;

  constructor() {
    super({ key: 'CombatScene' });
  }

  create(): void {
    drawGrid(this);
    this.add.text(640, 40, 'Combat Sandbox', { color: '#e8d8c0', fontSize: '20px' }).setOrigin(0.5);

    this.data = this.registry.get('gameData') as GameData;
    this.overlay = new TargetingOverlay(this);

    // Placeholder marker for Roy
    const royPos = tileToWorld(ROY_TILE);
    this.royMarker = this.add.graphics();
    this.royMarker.fillStyle(0x4488ff, 1);
    this.royMarker.fillCircle(royPos.x, royPos.y, 16);

    const royDeck = this.data.unitById('roy')!.deck;
    const handCards = royDeck.slice(0, 5).map(id => this.data.cardById(id)!);
    this.hand = renderHand(this, handCards);
    this.hand.forEach(sprite => {
      attachCardInput(this, sprite, (card) => {
        useCombatStore.getState().selectCard(card.id);
        const valid = validTilesForCard(card, ROY_TILE);
        this.overlay.showValidTiles(valid);
      });
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      const { selectedCardId } = useCombatStore.getState();
      if (!selectedCardId) return;
      const tile = worldToTile({ x: pointer.worldX, y: pointer.worldY });
      if (!tile) { this.overlay.showAoe([]); return; }
      const card = this.data.cardById(selectedCardId)!;
      const valid = validTilesForCard(card, ROY_TILE);
      const onValid = valid.some(t => t.x === tile.x && t.y === tile.y);
      this.overlay.showAoe(onValid ? aoeTilesAt(card, tile) : []);
    });

    useCombatStore.getState().setPhase('COMBAT');
  }
}
