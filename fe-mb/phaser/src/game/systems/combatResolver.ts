import type { Card } from '../../data/schemas';
import { applyDamage, statValue, type UnitInstance } from '../entities/Unit';
import { applyDamageEnemy, type EnemyInstance } from '../entities/Enemy';

export interface CardResult {
  card: Card;
  source: UnitInstance;
  targets: Array<{
    target: UnitInstance | EnemyInstance;
    damage: number;
    killed: boolean;
  }>;
}

type Combatant = UnitInstance | EnemyInstance;

function defenseFor(target: Combatant, card: Card): number {
  // Magic cards (MAG) hit RES; everything else hits DEF
  const stat = card.stat === 'MAG' ? 'res' : 'def';
  return target.data.stats[stat];
}

export function resolveCard(
  card: Card,
  source: UnitInstance,
  targets: Combatant[],
): CardResult {
  const sourceStatValue = statValue(source, statKey(card.stat));
  const result: CardResult = { card, source, targets: [] };

  for (const target of targets) {
    let damage: number;
    if (card.damage_base < 0) {
      // Healing: damage_base is negative, applied as negative damage
      damage = card.damage_base - sourceStatValue; // e.g., -6 + (-MAG) = bigger heal
    } else {
      const dr = Math.floor(defenseFor(target, card) / 2);
      damage = Math.max(0, card.damage_base + sourceStatValue - dr);
    }

    if ('hand' in target) {
      applyDamage(target, damage);
    } else {
      applyDamageEnemy(target, damage);
    }

    result.targets.push({
      target,
      damage,
      killed: target.currentHp === 0 && damage > 0,
    });
  }

  return result;
}

function statKey(s: Card['stat']): 'str' | 'mag' | 'skl' | 'spd' | 'lck' | 'def' | 'res' {
  return s.toLowerCase() as 'str' | 'mag' | 'skl' | 'spd' | 'lck' | 'def' | 'res';
}
