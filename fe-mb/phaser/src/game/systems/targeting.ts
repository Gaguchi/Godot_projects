import type { Card } from '../../data/schemas';
import { GRID_WIDTH, GRID_HEIGHT, type GridCoord } from '../render/gridRenderer';

function inBounds(c: GridCoord): boolean {
  return c.x >= 0 && c.x < GRID_WIDTH && c.y >= 0 && c.y < GRID_HEIGHT;
}

function manhattan(a: GridCoord, b: GridCoord): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

export function validTilesForCard(card: Card, source: GridCoord): GridCoord[] {
  const out: GridCoord[] = [];
  for (let y = 0; y < GRID_HEIGHT; y++) {
    for (let x = 0; x < GRID_WIDTH; x++) {
      const tile = { x, y };
      const d = manhattan(source, tile);
      if (d >= card.range.min && d <= card.range.max && d > 0) {
        out.push(tile);
      }
    }
  }
  return out;
}

export function aoeTilesAt(card: Card, target: GridCoord): GridCoord[] {
  if (card.aoe.shape === 'single' || card.aoe.radius === 0) {
    return [target];
  }
  if (card.aoe.shape === 'circle') {
    const out: GridCoord[] = [];
    for (let dy = -card.aoe.radius; dy <= card.aoe.radius; dy++) {
      for (let dx = -card.aoe.radius; dx <= card.aoe.radius; dx++) {
        if (Math.abs(dx) + Math.abs(dy) <= card.aoe.radius) {
          const tile = { x: target.x + dx, y: target.y + dy };
          if (inBounds(tile)) out.push(tile);
        }
      }
    }
    return out;
  }
  // cross, line: stub for sandbox
  return [target];
}
