import type { UnitInstance } from '../entities/Unit';

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i]!, a[j]!] = [a[j]!, a[i]!];
  }
  return a;
}

export function reshuffleIfNeeded(u: UnitInstance): void {
  if (u.draw.length === 0 && u.discard.length > 0) {
    u.draw = shuffle(u.discard);
    u.discard = [];
  }
}

export function drawCards(u: UnitInstance, count: number): void {
  for (let i = 0; i < count; i++) {
    reshuffleIfNeeded(u);
    const card = u.draw.shift();
    if (!card) return;
    u.hand.push(card);
  }
}

export function discardHand(u: UnitInstance): void {
  u.discard.push(...u.hand);
  u.hand = [];
}

export function discardCard(u: UnitInstance, cardId: string): void {
  const idx = u.hand.indexOf(cardId);
  if (idx >= 0) {
    u.hand.splice(idx, 1);
    u.discard.push(cardId);
  }
}
