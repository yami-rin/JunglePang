import type { Animal } from './engine';
import { DEFAULT_RULES } from './engine';
import { ANIMALS, artURL, roundAnimals, type AnimalArt } from './animals';

/** Six SVG images; compositor animations run only when something changes. */
export class JungleScene {
  private pieces: HTMLImageElement[] = [];
  private particles: HTMLSpanElement[] = [];
  private platform = document.createElement('div');
  private ring = document.createElement('div');
  private stack = document.createElement('div');
  private dropAnimation: Animation | null = null;
  private sources: string[] = [];
  private current: Animal[] = [];
  private art = roundAnimals(42);
  private artSources = { monkey: artURL(this.art.monkey), tiger: artURL(this.art.tiger) };
  private pitch = 60;
  private tileWidth = 120;
  private bottomY = 0;
  private width = 0;
  private height = 0;
  private ready = false;
  private reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  onReady: (() => void) | null = null;
  onFailure: (() => void) | null = null;

  constructor(private readonly host: HTMLElement) {}
  async mount(): Promise<void> {
    try {
      await Promise.all(ANIMALS.map(async art => {
        const image = new Image();
        image.src = artURL(art);
        await image.decode();
      }));
      this.platform.className = 'tower-platform';
      this.ring.className = 'tower-ring';
      this.stack.className = 'tower-stack';
      this.pieces = Array.from({ length: DEFAULT_RULES.visiblePieces }, (_, i) => {
        const image = document.createElement('img');
        image.className = 'tower-piece'; image.alt = ''; image.draggable = false;
        image.style.zIndex = String(7-i);
        if (i === 5) image.style.opacity = '.86';
        return image;
      });
      this.particles = Array.from({ length: 8 }, () => {
        const particle = document.createElement('span');
        particle.className = 'tower-particle'; particle.hidden = true;
        return particle;
      });
      this.stack.replaceChildren(...this.pieces);
      this.host.replaceChildren(this.platform, this.ring, this.stack, ...this.particles);
      this.ready = true;
      this.resize(this.host.clientWidth, this.host.clientHeight);
      this.onReady?.();
    } catch { this.onFailure?.(); }
  }
  setAnimals(animals: Record<Animal, AnimalArt>): void {
    this.art = animals;
    this.artSources = { monkey: artURL(this.art.monkey), tiger: artURL(this.art.tiger) };
    if (this.current.length) this.sync(this.current);
  }
  resize(width: number, height: number): void {
    if (!this.ready || (this.width === width && this.height === height)) return;
    this.width = width; this.height = height;
    this.pitch = Math.min(77, Math.max(23, (height - 63) / 6));
    this.tileWidth = Math.min(178, this.pitch * 1.95);
    this.bottomY = height - 27 - this.tileWidth * .31;
    this.dropAnimation?.cancel();
    this.dropAnimation = null;
    Object.assign(this.platform.style, { width: `${this.tileWidth * .92}px`, left: `${width/2}px`, top: `${height-33}px` });
    Object.assign(this.ring.style, { width: `${this.tileWidth*1.1}px`, height: `${this.tileWidth*.63}px`, left: `${width/2}px`, top: `${this.bottomY}px` });
    for (let i=0; i<this.pieces.length; i++) {
      const piece = this.pieces[i];
      Object.assign(piece.style, { width: `${this.tileWidth}px`, height: `${this.tileWidth*.66}px`, left: `${width/2}px`, top: `${this.bottomY-i*this.pitch}px` });
    }
  }
  sync(queue: Animal[], animate = false): void {
    this.current = [...queue];
    if (!this.ready) return;
    this.dropAnimation?.cancel();
    this.dropAnimation = null;
    for (let i=0; i<this.pieces.length; i++) {
      const piece = this.pieces[i];
      const url = this.artSources[queue[i]];
      if (this.sources[i] !== url) { this.sources[i] = url; piece.src = url; }
    }
    if (animate && !this.reducedMotion) this.dropAnimation = this.stack.animate([
      { transform: `translateY(-${this.pitch*.48}px)` },
      { transform: 'translateY(0)' },
    ], { duration: 85, easing: 'cubic-bezier(0.215, 0.61, 0.355, 1)' });
  }
  pop(animal: Animal): void {
    if (!this.ready || this.reducedMotion) return;
    const direction = animal === 'monkey' ? -1 : 1;
    for (const particle of this.particles) {
      if (!particle.hidden) continue;
      particle.hidden = false;
      particle.style.left = `${this.width/2+direction*this.tileWidth*.3}px`;
      particle.style.top = `${this.bottomY}px`;
      const animation = particle.animate([
        { transform: `translate(0,0) scaleX(${direction})`, opacity: 1 },
        { transform: `translate(${direction*54}px, -28px) scale(.3) scaleX(${direction})`, opacity: 0 },
      ], { duration: 180 });
      animation.onfinish = () => { particle.hidden = true; };
      break;
    }
  }
  resetEffects(): void {
    this.host.getAnimations().forEach(animation => animation.cancel());
    for (const particle of this.particles) {
      particle.getAnimations().forEach(animation => animation.cancel()); particle.hidden = true;
    }
    if (this.current.length) this.sync(this.current);
  }
  miss(): void {
    if (!this.reducedMotion) this.host.animate([
      {transform:'translateX(0)'},{transform:'translateX(-3px)'},{transform:'translateX(3px)'},{transform:'translateX(0)'},
    ], {duration:180});
  }
  target(): Animal | undefined { return this.current[0]; }
  objectCount(): number { return this.pieces.length + this.particles.length + 3; }
  tower(): { animal: Animal; art: string; y: number; restY: number }[] {
    const hostTop = this.host.getBoundingClientRect().top;
    const moving = this.dropAnimation?.playState === 'running';
    return this.pieces.map((piece,i) => {
      const rect = piece.getBoundingClientRect();
      const restY = this.bottomY-i*this.pitch;
      return { animal: this.current[i], art: this.art[this.current[i]].id, y: moving ? rect.top-hostTop+rect.height/2 : restY, restY };
    });
  }
  destroy(): void { this.resetEffects(); this.host.replaceChildren(); }
}
