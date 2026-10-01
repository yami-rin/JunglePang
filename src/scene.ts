import Phaser from "phaser";
import type { Animal } from "./engine";
import { DEFAULT_RULES } from "./engine";

export class JungleScene extends Phaser.Scene {
  private pieces: Phaser.GameObjects.Image[] = [];
  private platform!: Phaser.GameObjects.Graphics;
  private targetRing!: Phaser.GameObjects.Graphics;
  private particles: Phaser.GameObjects.Arc[] = [];
  private ready = false;
  private current: Animal[] = [];
  private reducedMotion = matchMedia("(prefers-reduced-motion: reduce)")
    .matches;
  private tileWidth = 120;
  private pitch = 60;
  private bottomY = 0;
  private world!: Phaser.GameObjects.Container;
  onReady: (() => void) | null = null;
  onFrame: (() => void) | null = null;
  onFailure: (() => void) | null = null;

  constructor(private readonly pixelRatio = 1) {
    super("Jungle");
  }
  private get worldWidth(): number {
    return this.scale.width / this.pixelRatio;
  }
  private get worldHeight(): number {
    return this.scale.height / this.pixelRatio;
  }
  preload(): void {
    const base = import.meta.env.BASE_URL;
    this.load.svg("monkey", `${base}art/monkey.svg`, {
      width: 400,
      height: 264,
    });
    this.load.svg("tiger", `${base}art/tiger.svg`, { width: 400, height: 264 });
    this.load.on("loaderror", () => this.onFailure?.());
  }
  create(): void {
    if (!this.textures.exists("monkey") || !this.textures.exists("tiger")) {
      this.onFailure?.();
      return;
    }
    this.platform = this.add.graphics();
    this.targetRing = this.add.graphics();
    this.pieces = Array.from({ length: DEFAULT_RULES.visiblePieces }, () =>
      this.add.image(0, 0, "monkey"),
    );
    // Reuse a fixed particle pool. Rapid input cannot accumulate game objects.
    this.particles = Array.from({ length: 18 }, () =>
      this.add.circle(0, 0, 3, 0xfff0b3).setVisible(false).setDepth(8),
    );
    this.world = this.add.container(0, 0, [
      this.platform,
      this.targetRing,
      ...[...this.pieces].reverse(),
      ...this.particles,
    ]);
    this.world.setScale(this.pixelRatio);
    this.ready = true;
    this.scale.on("resize", () => this.layout());
    this.layout();
    this.onReady?.();
  }
  update(): void {
    this.onFrame?.();
  }

  private layout(): void {
    if (!this.ready) return;
    const width = this.worldWidth;
    const height = this.worldHeight;
    const center = width / 2;
    this.pitch = Math.min(77, Math.max(23, (height - 63) / 6));
    this.tileWidth = Math.min(178, this.pitch * 1.95);
    this.bottomY = height - 27 - this.tileWidth * 0.31;
    this.platform.clear();
    this.platform
      .fillStyle(0x295d3e, 0.17)
      .fillEllipse(center, height - 17, this.tileWidth + 53, 24);
    this.platform
      .fillStyle(0x856142)
      .fillRoundedRect(
        center - this.tileWidth * 0.46,
        height - 33,
        this.tileWidth * 0.92,
        25,
        7,
      );
    this.platform
      .fillStyle(0xc49b62)
      .fillEllipse(center, height - 33, this.tileWidth * 0.92, 20);
    this.platform
      .lineStyle(1.5, 0x8a7149, 0.5)
      .strokeEllipse(center, height - 33, this.tileWidth * 0.68, 11);
    this.platform
      .lineStyle(1.5, 0xd5b87d, 0.6)
      .strokeEllipse(center, height - 33, this.tileWidth * 0.44, 5);
    this.targetRing.clear().lineStyle(2.5, 0xfff4c6, 0.85);
    this.targetRing.strokeRoundedRect(
      center - this.tileWidth * 0.55,
      this.bottomY - this.tileWidth * 0.32,
      this.tileWidth * 1.1,
      this.tileWidth * 0.63,
      16,
    );
    this.pieces.forEach((piece, i) => {
      this.tweens.killTweensOf(piece);
      piece
        .setPosition(center, this.bottomY - i * this.pitch)
        .setDisplaySize(this.tileWidth, this.tileWidth * 0.66);
      piece.setDepth(7 - i).setAlpha(i === 5 ? 0.86 : 1);
    });
  }

  sync(queue: Animal[], animate = false): void {
    this.current = [...queue];
    if (!this.ready) return;
    this.pieces.forEach((piece, i) => {
      this.tweens.killTweensOf(piece);
      piece.setTexture(queue[i]);
      const targetY = this.bottomY - i * this.pitch;
      piece
        .setPosition(this.worldWidth / 2, targetY)
        .setDisplaySize(this.tileWidth, this.tileWidth * 0.66);
      // Update the target identity immediately, then drop every row together.
      // Input remains available while the tower settles, including the bottom row.
      if (animate && !this.reducedMotion) {
        piece.y = targetY - this.pitch * 0.48;
        this.tweens.add({
          targets: piece,
          y: targetY,
          duration: 85,
          ease: "Cubic.Out",
        });
      }
    });
  }

  pop(animal: Animal): void {
    if (!this.ready || this.reducedMotion) return;
    const direction = animal === "monkey" ? -1 : 1;
    const available = this.particles
      .filter((particle) => !particle.visible)
      .slice(0, 5);
    available.forEach((particle, i) => {
      particle.setPosition(
        this.worldWidth / 2 + direction * this.tileWidth * 0.3,
        this.bottomY,
      );
      particle
        .setFillStyle(i % 2 ? 0xffe39a : 0xfff5cc)
        .setVisible(true)
        .setAlpha(1)
        .setScale(1);
      this.tweens.add({
        targets: particle,
        x: particle.x + direction * (38 + i * 12),
        y: particle.y - 35 + i * 16,
        alpha: 0,
        scale: 0.3,
        duration: DEFAULT_RULES.popDurationMs,
        onComplete: () => particle.setVisible(false),
      });
    });
  }

  resetEffects(): void {
    for (const particle of this.particles) {
      this.tweens.killTweensOf(particle);
      particle.setVisible(false);
    }
    this.cameras.main.resetFX();
    if (this.current.length) this.sync(this.current);
  }
  miss(): void {
    if (!this.reducedMotion) this.cameras.main.shake(180, 0.008);
  }
  target(): Animal | undefined {
    return this.pieces[0]?.texture.key as Animal | undefined;
  }
  tower(): { animal: Animal; y: number; restY: number }[] {
    return this.pieces.map((piece, i) => ({
      animal: piece.texture.key as Animal,
      y: piece.y,
      restY: this.bottomY - i * this.pitch,
    }));
  }
}
