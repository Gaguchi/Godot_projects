import Phaser from 'phaser';

export const GRID_WIDTH = 14;
export const GRID_HEIGHT = 10;
export const TILE_SIZE = 48;
export const GRID_OFFSET_X = (1280 - GRID_WIDTH * TILE_SIZE) / 2;
export const GRID_OFFSET_Y = 80;

export interface GridCoord {
  readonly x: number;
  readonly y: number;
}

export function tileToWorld(coord: GridCoord): { x: number; y: number } {
  return {
    x: GRID_OFFSET_X + coord.x * TILE_SIZE + TILE_SIZE / 2,
    y: GRID_OFFSET_Y + coord.y * TILE_SIZE + TILE_SIZE / 2,
  };
}

export function worldToTile(world: { x: number; y: number }): GridCoord | null {
  const gx = Math.floor((world.x - GRID_OFFSET_X) / TILE_SIZE);
  const gy = Math.floor((world.y - GRID_OFFSET_Y) / TILE_SIZE);
  if (gx < 0 || gx >= GRID_WIDTH || gy < 0 || gy >= GRID_HEIGHT) return null;
  return { x: gx, y: gy };
}

export function drawGrid(scene: Phaser.Scene): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  g.lineStyle(1, 0x44342a, 0.8);
  for (let x = 0; x <= GRID_WIDTH; x++) {
    const px = GRID_OFFSET_X + x * TILE_SIZE;
    g.lineBetween(px, GRID_OFFSET_Y, px, GRID_OFFSET_Y + GRID_HEIGHT * TILE_SIZE);
  }
  for (let y = 0; y <= GRID_HEIGHT; y++) {
    const py = GRID_OFFSET_Y + y * TILE_SIZE;
    g.lineBetween(GRID_OFFSET_X, py, GRID_OFFSET_X + GRID_WIDTH * TILE_SIZE, py);
  }
  return g;
}
