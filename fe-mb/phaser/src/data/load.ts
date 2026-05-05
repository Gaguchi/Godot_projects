import { z } from 'zod';
import { CardSchema, UnitSchema, EnemySchema, type Card, type Unit, type Enemy } from './schemas';
import cardsJson from './cards.json';
import unitsJson from './units.json';
import enemiesJson from './enemies.json';

const CardsFileSchema = z.object({ cards: z.array(CardSchema) });
const UnitsFileSchema = z.object({ units: z.array(UnitSchema) });
const EnemiesFileSchema = z.object({ enemies: z.array(EnemySchema) });

export interface GameData {
  cards: readonly Card[];
  units: readonly Unit[];
  enemies: readonly Enemy[];
  cardById(id: string): Card | undefined;
  unitById(id: string): Unit | undefined;
  enemyById(id: string): Enemy | undefined;
}

export function loadGameData(): GameData {
  const cards = CardsFileSchema.parse(cardsJson).cards;
  const units = UnitsFileSchema.parse(unitsJson).units;
  const enemies = EnemiesFileSchema.parse(enemiesJson).enemies;

  const cardMap = new Map(cards.map(c => [c.id, c]));
  const unitMap = new Map(units.map(u => [u.id, u]));
  const enemyMap = new Map(enemies.map(e => [e.id, e]));

  // Validate every unit's deck references real cards
  for (const unit of units) {
    for (const cardId of unit.deck) {
      if (!cardMap.has(cardId)) {
        throw new Error(`Unit ${unit.id} references unknown card: ${cardId}`);
      }
    }
  }

  return {
    cards,
    units,
    enemies,
    cardById: id => cardMap.get(id),
    unitById: id => unitMap.get(id),
    enemyById: id => enemyMap.get(id),
  };
}
