import { Howl } from 'howler';

const sounds: Record<string, Howl> = {};

export function loadAudio(name: string, src: string): void {
  sounds[name] = new Howl({ src: [src], volume: 0.6 });
}

export function play(name: string): void {
  sounds[name]?.play();
}

export function initAudio(): void {
  // Sandbox: load placeholder ogg/mp3 files OR use silent stubs.
  // Drop your SFX into phaser/public/audio/ as: hit.mp3, miss.mp3, draw.mp3, victory.mp3, defeat.mp3
  loadAudio('hit', '/audio/hit.mp3');
  loadAudio('miss', '/audio/miss.mp3');
  loadAudio('draw', '/audio/draw.mp3');
  loadAudio('victory', '/audio/victory.mp3');
  loadAudio('defeat', '/audio/defeat.mp3');
}
