import Phaser from "phaser";
import "./style.css";
import { PangEngine, DEFAULT_RULES, type Animal } from "./engine";
import { bindInputs } from "./input";
import { PangStorage } from "./storage";
import { PangAudio } from "./audio";
import { JungleScene } from "./scene";

const el = <T extends HTMLElement = HTMLElement>(id: string) => {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing element: ${id}`);
  return node as T;
};
const ui = {
  app: el("app"),
  title: el("title-screen"),
  result: el("result-screen"),
  start: el<HTMLButtonElement>("start"),
  time: el("time"),
  score: el("score"),
  best: el("best"),
  titleBest: el("title-best"),
  timer: el("timer-fill"),
  monkey: el<HTMLButtonElement>("monkey"),
  tiger: el<HTMLButtonElement>("tiger"),
  combo: el("combo"),
  comboCount: el("combo-count"),
  feedback: el("feedback"),
  hint: el("target-hint"),
  countdown: el("countdown"),
  lock: el("lock"),
  lockFill: el("lock-fill"),
  settings: el<HTMLDialogElement>("settings-dialog"),
  sound: el<HTMLButtonElement>("sound"),
  volume: el<HTMLInputElement>("volume"),
  volumeValue: el("volume-value"),
  music: el<HTMLInputElement>("music"),
};
const formatter = new Intl.NumberFormat("ja-JP");
let backend: Storage | null = null;
try {
  backend = window.localStorage;
} catch {
  /* Play remains available in privacy-restricted contexts. */
}
const storage = new PangStorage(backend);
const audio = new PangAudio(storage.value);
let engine = new PangEngine(42);
let screen: "loading" | "ready" | "countdown" | "playing" | "finished" =
  "loading";
let countdownStarted = 0;
let countdownStage = -1;
let endingAt = 0;
let resultShown = false;
let savedResult = false;
let warningSecond = 0;
let displayedSeconds = -1;
let displayedScore = -1;
const pressTimers: Partial<Record<Animal, ReturnType<typeof setTimeout>>> = {};
const pixelRatio = Math.min(devicePixelRatio || 1, 2);
const scene = new JungleScene(pixelRatio);

function showStorageStatus(): void {
  el("storage-note").hidden = storage.available;
  el("result-storage-note").hidden = storage.available;
}
function updatePreferences(): void {
  audio.apply(storage.value);
  ui.sound.classList.toggle("muted", storage.value.muted);
  ui.sound.setAttribute("aria-pressed", String(storage.value.muted));
  ui.sound.setAttribute(
    "aria-label",
    storage.value.muted ? "音をオンにする" : "音をミュート",
  );
  ui.volume.value = String(Math.round(storage.value.volume * 100));
  ui.volumeValue.textContent = `${ui.volume.value}%`;
  ui.music.checked = storage.value.music;
  showStorageStatus();
}
function updateBest(): void {
  for (const node of [ui.best, ui.titleBest, el("result-best")])
    node.textContent = formatter.format(storage.value.best);
  showStorageStatus();
}
function setScreen(value: typeof screen): void {
  screen = value;
  ui.app.dataset.screen = value;
  ui.title.hidden = value !== "ready" && value !== "loading";
  ui.result.hidden = value !== "finished" || !resultShown;
  ui.countdown.hidden = value !== "countdown";
  ui.monkey.disabled = value !== "playing";
  ui.tiger.disabled = value !== "playing";
  ui.hint.hidden = value !== "playing";
}
function updateHud(now: number): void {
  const remaining = engine.remaining(now);
  const seconds = Math.ceil(remaining / 1000);
  if (displayedSeconds !== seconds) {
    displayedSeconds = seconds;
    ui.time.innerHTML = `${seconds}<span class="unit">s</span>`;
    ui.timer.parentElement?.setAttribute("aria-valuenow", String(seconds));
  }
  if (displayedScore !== engine.score) {
    displayedScore = engine.score;
    ui.score.textContent = formatter.format(engine.score);
  }
  ui.timer.style.transform = `scaleX(${remaining / engine.rules.durationMs})`;
  ui.app.classList.toggle("urgent", screen === "playing" && seconds <= 10);
  ui.combo.classList.toggle(
    "visible",
    engine.combo >= 3 && screen === "playing",
  );
  ui.comboCount.textContent = String(engine.combo);
  ui.lock.hidden = engine.phase !== "locked";
  if (engine.phase === "locked")
    ui.lockFill.style.transform = `scaleX(${Math.max(0, (engine.lockUntil - now) / engine.rules.missLockMs)})`;
  if (
    screen === "playing" &&
    seconds <= 5 &&
    seconds > 0 &&
    warningSecond !== seconds
  ) {
    warningSecond = seconds;
    audio.warning();
  }
}
function startRound(): void {
  if (screen === "loading") return;
  audio.unlock();
  audio.stopAll();
  const seed = crypto.getRandomValues(new Uint32Array(1))[0];
  engine = new PangEngine(seed);
  scene.resetEffects();
  scene.sync(engine.queue);
  resultShown = false;
  savedResult = false;
  warningSecond = 0;
  countdownStarted = performance.now();
  countdownStage = -1;
  ui.feedback.classList.remove("show");
  ui.countdown.classList.remove("go");
  setScreen("countdown");
  updateHud(countdownStarted);
  ui.start.blur();
  el("retry").blur();
  frame();
}
function showTitle(): void {
  audio.stopAll();
  resultShown = false;
  engine = new PangEngine(42);
  scene.resetEffects();
  scene.sync(engine.queue);
  setScreen("ready");
  updateHud(performance.now());
  updateBest();
}
function endRound(): void {
  if (screen !== "playing" || !engine.result) return;
  audio.stopMusic();
  audio.finish();
  endingAt = performance.now();
  setScreen("finished");
  ui.lock.hidden = true;
  ui.feedback.textContent =
    engine.result.reason === "time" ? "TIME UP!" : "おつかれさま";
  ui.feedback.classList.remove("show");
  void ui.feedback.offsetWidth;
  ui.feedback.classList.add("show");
  updateHud(endingAt);
  const result = engine.result;
  const newBest = result.eligible && result.score > storage.value.best;
  if (!savedResult) {
    if (newBest) storage.update({ best: result.score });
    savedResult = true;
  }
  el("result-score").textContent = formatter.format(result.score);
  el("result-hits").textContent = String(result.hits);
  el("result-combo").textContent = String(result.maxCombo);
  el("result-accuracy").textContent = `${Math.round(result.accuracy * 100)}%`;
  el("new-best").hidden = !newBest;
  el("result-heading").textContent =
    result.reason === "time" ? "おつかれさま！" : "プレイを中断しました";
  el("result-message").textContent = !result.eligible
    ? "中断した記録は自己ベストに保存されません"
    : newBest
      ? "自己ベスト更新！いいリズムでした。"
      : result.hits === 0
        ? "いちばん下の子と同じボタンを押してみよう"
        : result.maxCombo >= 50
          ? "すごい集中力。ジャングルの達人！"
          : "もう一回、いけそう？";
  updateBest();
}
function presentResult(): void {
  resultShown = true;
  ui.result.hidden = false;
  if (!document.hidden) el("retry").focus({ preventScroll: true });
}

function frame(): void {
  const now = performance.now();
  if (screen === "countdown") {
    const elapsed = now - countdownStarted;
    const stage = Math.floor(elapsed / 600);
    if (elapsed >= DEFAULT_RULES.countdownMs) {
      // Start at the scheduled monotonic timestamp, including when a frame is delayed.
      engine.start(countdownStarted + DEFAULT_RULES.countdownMs);
      setScreen("playing");
      audio.start();
      audio.startMusic();
      updateHud(now);
    } else if (stage !== countdownStage) {
      countdownStage = stage;
      ui.countdown.textContent = String(3 - stage);
      audio.countdown();
    }
  }
  if (screen === "playing") {
    engine.advance(now);
    updateHud(now);
    if (engine.phase === "finished") endRound();
  } else if (screen === "finished" && !resultShown && now - endingAt >= 550)
    presentResult();
}

function input(animal: Animal): void {
  audio.unlock();
  const now = performance.now();
  const outcome = engine.input(animal, now);
  if (engine.phase === "finished") {
    endRound();
    return;
  }
  if (outcome === "correct") {
    scene.pop(animal);
    scene.sync(engine.queue, true);
    audio.correct(engine.combo);
    const button = ui[animal];
    clearTimeout(pressTimers[animal]);
    button.classList.add("pressed");
    pressTimers[animal] = setTimeout(
      () => button.classList.remove("pressed"),
      70,
    );
    if (engine.combo % 10 === 0) {
      ui.feedback.textContent = engine.combo >= 50 ? "WILD!" : "NICE!";
      ui.feedback.classList.remove("show");
      void ui.feedback.offsetWidth;
      ui.feedback.classList.add("show");
    }
  } else if (outcome === "wrong") {
    audio.wrong();
    scene.miss();
    ui.feedback.classList.remove("show");
  }
  updateHud(now);
}

bindInputs(
  { monkey: ui.monkey, tiger: ui.tiger },
  () => screen === "playing" && !ui.settings.open,
  input,
);
ui.start.addEventListener("click", startRound);
el("retry").addEventListener("click", startRound);
el("back-to-title").addEventListener("click", showTitle);
el("home").addEventListener("click", () => {
  if (screen === "playing") {
    engine.finish("quit", performance.now());
    endRound();
  } else if (screen !== "loading") showTitle();
});
ui.sound.addEventListener("click", () => {
  audio.unlock();
  storage.update({ muted: !storage.value.muted });
  updatePreferences();
  if (!storage.value.muted) audio.countdown();
});
el("settings").addEventListener("click", () => {
  if (screen === "playing") {
    engine.finish("quit", performance.now());
    endRound();
    presentResult();
  } else if (screen === "countdown") showTitle();
  ui.settings.showModal();
});
ui.volume.addEventListener("input", () => {
  audio.unlock();
  storage.update({ volume: Number(ui.volume.value) / 100 });
  updatePreferences();
});
ui.volume.addEventListener("change", () => audio.countdown());
ui.music.addEventListener("change", () => {
  storage.update({ music: ui.music.checked });
  updatePreferences();
});
function interrupt(): void {
  audio.stopAll();
  if (screen === "countdown") showTitle();
  else if (screen === "playing") {
    engine.finish("background", performance.now());
    endRound();
    audio.stopAll();
    presentResult();
  } else if (screen === "finished") presentResult();
}
document.addEventListener("visibilitychange", () => {
  if (document.hidden) interrupt();
});
window.addEventListener("pagehide", interrupt);
window.addEventListener("blur", () => {
  if (screen === "playing" || screen === "countdown") interrupt();
});

scene.onReady = () => {
  scene.sync(engine.queue);
  ui.start.disabled = false;
  ui.start.querySelector("span")!.textContent = "あそぶ";
  setScreen("ready");
  updateHud(performance.now());
};
scene.onFrame = frame;
scene.onFailure = () => {
  el("fatal-error").hidden = false;
  audio.stopAll();
};
updatePreferences();
updateBest();
const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game-canvas",
  transparent: true,
  scale: {
    mode: Phaser.Scale.NONE,
    width: el("game-canvas").clientWidth * pixelRatio,
    height: el("game-canvas").clientHeight * pixelRatio,
  },
  scene: [scene],
  banner: false,
  audio: { noAudio: true },
  input: { keyboard: false, mouse: false, touch: false },
  render: { antialias: true, pixelArt: false },
});
const resize = new ResizeObserver(([entry]) => {
  game.scale.resize(
    Math.round(entry.contentRect.width * pixelRatio),
    Math.round(entry.contentRect.height * pixelRatio),
  );
});
resize.observe(el("game-canvas"));

// Explicit opt-in diagnostics for automated verification. Absent from normal play.
if (new URLSearchParams(location.search).get("debug") === "1") {
  Object.defineProperty(window, "__pang", {
    value: {
      snapshot: () => ({
        phase: engine.phase,
        screen,
        queue: [...engine.queue],
        score: engine.score,
        combo: engine.combo,
        hits: engine.hits,
        misses: engine.misses,
        result: engine.result,
        remaining: engine.remaining(performance.now()),
        log: [...engine.log],
        gameObjects:
          scene.children.length +
          scene.children.list.reduce(
            (count, object) =>
              count +
              (object instanceof Phaser.GameObjects.Container
                ? object.length
                : 0),
            0,
          ),
        renderTarget: scene.target(),
        tower: scene.tower(),
      }),
      reset: (seed = 1) => {
        audio.stopAll();
        engine = new PangEngine(seed);
        resultShown = false;
        savedResult = false;
        scene.resetEffects();
        scene.sync(engine.queue);
        engine.start(performance.now());
        setScreen("playing");
        updateHud(performance.now());
      },
      expire: () => {
        engine.advance(engine.deadline);
        endRound();
        presentResult();
      },
      background: interrupt,
      audio: () => ({ unavailable: audio.unavailable }),
    },
    configurable: true,
  });
}

if (import.meta.hot)
  import.meta.hot.dispose(() => {
    resize.disconnect();
    audio.stopAll();
    game.destroy(true);
  });
