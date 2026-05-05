import Phaser from 'phaser';
import { tileToWorld, TILE_SIZE, type GridCoord } from './gridRenderer';

export class TargetingOverlay {
  private validG: Phaser.GameObjects.Graphics;
  private aoeG: Phaser.GameObjects.Graphics;

  constructor(private scene: Phaser.Scene) {
    this.validG = scene.add.graphics();
    this.aoeG = scene.add.graphics();
  }

  showValidTiles(tiles: GridCoord[]): void {
    this.validG.clear();
    this.validG.fillStyle(0xffb366, 0.15);
    this.validG.lineStyle(1, 0xffb366, 0.5);
    for (const t of tiles) {
      const { x, y } = tileToWorld(t);
      this.validG.fillRect(x - TILE_SIZE / 2, y - TILE_SIZE / 2, TILE_SIZE, TILE_SIZE);
      this.validG.strokeRect(x - TILE_SIZE / 2, y - TILE_SIZE / 2, TILE_SIZE, TILE_SIZE);
    }
  }

  showAoe(tiles: GridCoord[]): void {
    this.aoeG.clear();
    this.aoeG.fillStyle(0x9b6bff, 0.3);
    this.aoeG.lineStyle(2, 0x9b6bff, 0.8);
    for (const t of tiles) {
      const { x, y } = tileToWorld(t);
      this.aoeG.fillRect(x - TILE_SIZE / 2, y - TILE_SIZE / 2, TILE_SIZE, TILE_SIZE);
      this.aoeG.strokeRect(x - TILE_SIZE / 2, y - TILE_SIZE / 2, TILE_SIZE, TILE_SIZE);
    }
  }

  clear(): void {
    this.validG.clear();
    this.aoeG.clear();
  }
}
