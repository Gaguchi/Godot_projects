import Phaser from 'phaser';
import { drawGrid, worldToTile } from '../render/gridRenderer';
import { renderHand, attachCardInput, type CardSprite } from '../render/cardHandRenderer';
import { TargetingOverlay } from '../render/targetingRenderer';
import { validTilesForCard, aoeTilesAt } from '../systems/targeting';
import { useCombatStore } from '../../state/combatStore';
import type { GameData } from '../../data/load';
import { createUnit } from '../entities/Unit';
import { createEnemy } from '../entities/Enemy';
import { renderActor, refreshActor, type ActorSprite } from '../render/unitSprites';
import { resolveCard } from '../systems/combatResolver';
import { drawCards } from '../systems/deckManager';
import { spawnDamageNumber } from '../render/damageNumber';

export class CombatScene extends Phaser.Scene {
  private hand: CardSprite[] = [];
  private overlay!: TargetingOverlay;
  private gameData!: GameData;
  private actors: ActorSprite[] = [];

  constructor() {
    super({ key: 'CombatScene' });
  }

  create(): void {
    drawGrid(this);
    this.add.text(640, 40, 'Combat Sandbox', { color: '#e8d8c0', fontSize: '20px' }).setOrigin(0.5);

    this.gameData = this.registry.get('gameData') as GameData;
    this.overlay = new TargetingOverlay(this);

    // Build party and enemies
    const royData = this.gameData.unitById('roy')!;
    const marcusData = this.gameData.unitById('marcus')!;
    const lilinaData = this.gameData.unitById('lilina')!;
    const banditData = this.gameData.enemyById('bandit')!;
    const mageData = this.gameData.enemyById('mage_bandit')!;
    const captainData = this.gameData.enemyById('bandit_captain')!;

    const party = [
      createUnit(royData, { x: 3, y: 5 }),
      createUnit(marcusData, { x: 3, y: 4 }),
      createUnit(lilinaData, { x: 3, y: 6 }),
    ];
    const enemies = [
      createEnemy(banditData, { x: 10, y: 5 }),
      createEnemy(mageData, { x: 10, y: 4 }),
      createEnemy(captainData, { x: 10, y: 6 }),
    ];

    useCombatStore.getState().setBattle(party, enemies);
    party.forEach(p => drawCards(p, 5));

    party.forEach(p => this.actors.push(renderActor(this, p, true)));
    enemies.forEach(e => this.actors.push(renderActor(this, e, false)));

    // Render Roy's hand (first party member)
    const roy = party[0]!;
    const handCards = roy.hand.map(id => this.gameData.cardById(id)!);
    this.hand = renderHand(this, handCards);
    this.hand.forEach((sprite) => {
      attachCardInput(this, sprite, (card) => {
        useCombatStore.getState().selectCard(card.id);
        const valid = validTilesForCard(card, roy.pos);
        this.overlay.showValidTiles(valid);
      });
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      const { selectedCardId } = useCombatStore.getState();
      if (!selectedCardId) return;
      const tile = worldToTile({ x: pointer.worldX, y: pointer.worldY });
      if (!tile) { this.overlay.showAoe([]); return; }
      const card = this.gameData.cardById(selectedCardId)!;
      const valid = validTilesForCard(card, roy.pos);
      const onValid = valid.some(t => t.x === tile.x && t.y === tile.y);
      this.overlay.showAoe(onValid ? aoeTilesAt(card, tile) : []);
    });

    this.input.keyboard?.on('keydown-ESC', () => {
      useCombatStore.getState().cancelSelection();
      this.overlay.clear();
    });

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      // Right-click cancels selection
      if (pointer.rightButtonDown()) {
        useCombatStore.getState().cancelSelection();
        this.overlay.clear();
        return;
      }

      const { selectedCardId } = useCombatStore.getState();
      if (!selectedCardId) return;

      const tile = worldToTile({ x: pointer.worldX, y: pointer.worldY });
      if (!tile) return;

      const card = this.gameData.cardById(selectedCardId)!;
      const valid = validTilesForCard(card, roy.pos);
      if (!valid.some(t => t.x === tile.x && t.y === tile.y)) return;

      const aoeTiles = aoeTilesAt(card, tile);
      const targets = enemies.filter(e =>
        e.alive && aoeTiles.some(t => t.x === e.pos.x && t.y === e.pos.y),
      );

      if (targets.length === 0 && card.target !== 'GROUND') return;

      const result = resolveCard(card, roy, targets);
      result.targets.forEach(t => spawnDamageNumber(this, t.target.pos, t.damage));
      this.actors.forEach(refreshActor);
      useCombatStore.getState().cancelSelection();
      this.overlay.clear();
    });

    useCombatStore.getState().setPhase('COMBAT');
  }
}
