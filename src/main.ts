import "./style.css";
import { PangEngine, DEFAULT_RULES, RULES_VERSION, type Animal } from "./engine";
import { bindInputs } from "./input";
import { AUTO_RESET_VERSION, nextAttempt } from './attempt';
import { bindViewport } from './viewport';
import { PangStorage } from "./storage";
import { PangAudio } from "./audio";
import { JungleScene } from "./scene";
import { ANIMALS, roundAnimals, artURL } from './animals';
import { RankingClient, type RankedRound } from './ranking';
import { CATEGORY_LABELS, type RankingCategory } from './platform';
import { AutoInput, AUTO_INPUT_RATES, rateLabel } from './auto-input';

const releaseViewport=bindViewport();
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
  autoReset: el<HTMLInputElement>('auto-reset'),
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
const ranking = new RankingClient(backend);
const debugMode = new URLSearchParams(location.search).get('debug') === '1';
const autoInput = import.meta.env.DEV ? new AutoInput() : null;
let automatedRound = false;
let autoInputRate = storage.value.autoInputRate;
let rankedRound: RankedRound | null = null;
let roundEpoch = 0;
let rankingReason = '';
let rankingCategory: RankingCategory = 'all';
let rankingLoadEpoch = 0;
el<HTMLInputElement>('nickname').value = ranking.name;
let engine = new PangEngine(42);
let roundSeed = 42;
let attemptBaseSeed = 42;
let attemptIndex = 0;
let initialQueue = [...engine.queue];
let currentAnimals = roundAnimals(42);
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
let displayedCombo = -1;
let scheduledFrame = 0;
let lastFrameHud = 0;
const pressTimers: Partial<Record<Animal, ReturnType<typeof setTimeout>>> = {};
const scene = new JungleScene(el('game-canvas'));

function configureAnimals(seed: number): void {
  const animals = roundAnimals(seed, storage.value.randomAnimals ? null : storage.value.animals);
  currentAnimals = animals;
  scene.setAnimals(animals);
  for (const slot of ['monkey','tiger'] as const) {
    const art = animals[slot];
    const button = ui[slot];
    button.querySelector('img')!.src = artURL(art);
    button.querySelector('.animal-name')!.textContent = art.name;
    button.setAttribute('aria-label', `${slot === 'monkey' ? '左' : '右'}の${art.name}を選ぶ`);
    button.style.background = art.light;
    button.style.borderColor = art.color;
    button.dataset.animal = art.id;
  }
  for (const [side,slot] of [['left','monkey'],['right','tiger']] as const) {
    const image = el<HTMLImageElement>(`hero-${side}`);
    image.src = artURL(animals[slot]); image.alt = animals[slot].name;
    image.parentElement!.style.background = animals[slot].light;
  }
  el('animal-selection-summary').textContent = storage.value.randomAnimals ? '毎回ランダム' : `${animals.monkey.name} / ${animals.tiger.name}`;
}
function scheduleFrame(): void {
  if (scheduledFrame) return;
  scheduledFrame = requestAnimationFrame(() => {
    scheduledFrame = 0;
    frame();
    if (screen === 'countdown' || screen === 'playing' || (screen === 'finished' && !resultShown)) scheduleFrame();
  });
}

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
  ui.autoReset.checked = storage.value.autoReset;
  el('play-hint').textContent = storage.value.autoReset ? 'AutoReset ON · ミスで最初から' : '最下段と同じ動物のボタンを押す';
  el('howto-foot').textContent = storage.value.autoReset ? '制限時間40秒 · ミスで即リセット' : '制限時間40秒 · ミスで0.65秒間入力停止';
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
  if (import.meta.env.DEV) {
    ui.hint.querySelector('span')!.textContent = automatedRound ? '自動入力中' : '最下段と同じボタン';
    el('auto-input-controls').hidden = !automatedRound || value !== 'playing';
    el('play-hint').hidden = automatedRound && value === 'playing';
  }
  el('quick-retry').hidden = value !== 'playing' && value !== 'countdown';
  if (value !== 'countdown') delete ui.app.dataset.preparing;
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
  if (displayedCombo !== engine.combo) {
    displayedCombo = engine.combo;
    ui.comboCount.textContent = String(engine.combo);
  }
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
function resetRound(seed: number, animalSeed = seed): void {
  roundSeed = seed;
  engine = new PangEngine(seed);
  initialQueue = [...engine.queue];
  configureAnimals(animalSeed);
  scene.resetEffects();
  scene.sync(engine.queue);
  resultShown = false;
  savedResult = false;
  warningSecond = 0;
  for (const animal of ['monkey','tiger'] as const) {
    clearTimeout(pressTimers[animal]);
    ui[animal].classList.remove('pressed');
  }
  ui.feedback.classList.remove("show");
}
async function startRound(automated = false): Promise<void> {
  if (screen === "loading") return;
  autoInput?.stop();
  automatedRound = import.meta.env.DEV && automated;
  audio.unlock();
  audio.stopAll();
  const epoch = ++roundEpoch;
  rankedRound = null;
  attemptIndex = 0;
  rankingReason = debugMode ? '検証モードの記録は全国に登録できません' : '接続が間に合わなかったため、今回は端末の記録のみです';
  attemptBaseSeed = crypto.getRandomValues(new Uint32Array(1))[0];
  resetRound(attemptBaseSeed);
  ui.app.dataset.preparing = 'true';
  ui.countdown.textContent = '準備中…';
  ui.countdown.classList.remove("go");
  setScreen("countdown");
  updateHud(performance.now());
  ui.start.blur();
  el("retry").blur();
  if (!debugMode && !automatedRound) {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      // Choose the seed before showing the tower. A late response cannot replace it.
      const round = await Promise.race([
        ranking.start(),
        new Promise<null>(resolve=>{ timeout=setTimeout(()=>resolve(null),1200); }),
      ]);
      if (epoch !== roundEpoch) return;
      if (round?.rulesVersion === RULES_VERSION) {
        rankedRound = round;
        attemptBaseSeed = round.seed;
        resetRound(round.seed);
        rankingReason = '';
      } else if (round) rankingReason = 'ページを再読み込みしてからもう一度プレイしてください';
    } catch {
      if (epoch === roundEpoch) rankingReason = '通信できないため、今回は端末の記録のみです';
    } finally { clearTimeout(timeout); }
  }
  if (epoch !== roundEpoch) return;
  delete ui.app.dataset.preparing;
  countdownStarted = performance.now();
  countdownStage = -1;
  frame();
  scheduleFrame();
}
function autoResetRound(now: number): void {
  autoInput?.stop();
  roundEpoch++;
  audio.stopAll();
  const next = nextAttempt(attemptBaseSeed, attemptIndex, initialQueue, engine.queue);
  attemptIndex = next.index;
  if (rankedRound?.autoResetVersion === AUTO_RESET_VERSION) rankedRound = {...rankedRound, attempt: attemptIndex};
  else if (rankedRound) {
    rankedRound = null;
    rankingReason = 'ランキングの更新が必要です。ページを再読み込みしてからもう一度プレイしてください';
  }
  resetRound(next.seed, attemptBaseSeed);
  engine.start(now);
  setScreen('playing');
  audio.wrong();
  audio.startMusic();
  updateHud(now);
  scheduleFrame();
  if (automatedRound) startAutoInput();
}
function showTitle(): void {
  autoInput?.stop();
  automatedRound = false;
  roundEpoch++;
  rankedRound = null;
  audio.stopAll();
  resultShown = false;
  engine = new PangEngine(42);
  roundSeed = 42;
  attemptBaseSeed = 42;
  attemptIndex = 0;
  initialQueue = [...engine.queue];
  configureAnimals(42);
  scene.resetEffects();
  scene.sync(engine.queue);
  setScreen("ready");
  updateHud(performance.now());
  updateBest();
}
function endRound(): void {
  if (screen !== "playing" || !engine.result) return;
  autoInput?.stop();
  audio.stopMusic();
  audio.finish();
  endingAt = performance.now();
  setScreen("finished");
  ui.lock.hidden = true;
  ui.feedback.textContent =
    engine.result.reason === "time" ? "終了" : "中断";
  ui.feedback.classList.remove("show");
  void ui.feedback.offsetWidth;
  ui.feedback.classList.add("show");
  updateHud(endingAt);
  const result = engine.result;
  const newBest = !automatedRound && result.eligible && result.score > storage.value.best;
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
    import.meta.env.DEV && automatedRound ? '自動入力の結果' : result.reason === "time" ? "結果" : "プレイを中断しました";
  if (import.meta.env.DEV) {
    el('result-auto-input').hidden = !automatedRound;
    el('result-auto-input').textContent = automatedRound ? `実測 ${(result.hits / Math.max(.001, result.elapsedMs / 1000)).toFixed(1)}回/秒 · ${(result.elapsedMs / 1000).toFixed(1)}秒` : '';
  }
  el('result-message').hidden = result.eligible;
  el('result-message').textContent = result.eligible ? '' : '中断した記録は自己ベストに保存されません';
  el('ranking-form').hidden = automatedRound || !result.eligible || !rankedRound || result.score === 0;
  el<HTMLButtonElement>('submit-score').disabled = false;
  el('ranking-status').textContent = import.meta.env.DEV && automatedRound ? '自動入力の記録は自己ベスト・全国ランキングに保存されません' : !result.eligible ? '中断した記録はランキングに登録できません' : result.score === 0 ? '1回以上正解すると登録できます' : rankingReason || `全体・${CATEGORY_LABELS[rankedRound?.device ?? 'pc']}ランキングに登録できます`;
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
    if (ui.app.dataset.preparing) return;
    const elapsed = now - countdownStarted;
    const stage = Math.floor(elapsed / 600);
    if (elapsed >= DEFAULT_RULES.countdownMs) {
      // Start at the scheduled monotonic timestamp, including when a frame is delayed.
      engine.start(countdownStarted + DEFAULT_RULES.countdownMs);
      setScreen("playing");
      audio.start();
      audio.startMusic();
      updateHud(now);
      if (automatedRound) startAutoInput();
    } else if (stage !== countdownStage) {
      countdownStage = stage;
      ui.countdown.textContent = String(3 - stage);
      audio.countdown();
    }
  }
  if (screen === "playing") {
    engine.advance(now);
    if (now-lastFrameHud >= 32) { updateHud(now); lastFrameHud = now; }
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
  } else if (outcome === "wrong") {
    if (storage.value.autoReset) {
      autoResetRound(now);
      return;
    }
    audio.wrong();
    scene.miss();
    ui.feedback.classList.remove("show");
  }
  updateHud(now);
}

function startAutoInput(): void {
  if (!import.meta.env.DEV) return;
  autoInput?.start(autoInputRate, () => {
    if (!automatedRound || screen !== 'playing' || document.hidden || ui.settings.open) return false;
    const target = scene.target();
    if (!target) return false;
    // Use the same native button activation and scoring path as manual input.
    ui[target].click();
    return screen === 'playing';
  });
}
if (import.meta.env.DEV) {
const autoInputDialog = el<HTMLDialogElement>('auto-input-dialog');
for (const id of ['auto-input-rate', 'auto-input-live-rate']) {
  const select = el<HTMLSelectElement>(id);
  for (const rate of AUTO_INPUT_RATES) {
    const option = document.createElement('option');
    option.value = String(rate);
    option.textContent = rateLabel(rate);
    select.append(option);
  }
  select.value = String(autoInputRate);
  select.addEventListener('change', () => {
    autoInputRate = AUTO_INPUT_RATES.find(rate => String(rate) === select.value) ?? 60;
    storage.update({autoInputRate});
    for (const other of ['auto-input-rate', 'auto-input-live-rate']) el<HTMLSelectElement>(other).value = String(autoInputRate);
    if (automatedRound && screen === 'playing') startAutoInput();
  });
}
el('open-auto-input').addEventListener('click', () => autoInputDialog.showModal());
el('start-auto-input').addEventListener('click', () => {
  autoInputDialog.close();
  void startRound(true);
});
el('stop-auto-input').addEventListener('click', () => {
  if (automatedRound && screen === 'playing') {
    engine.finish('quit', performance.now());
    endRound();
    presentResult();
  }
});
}

bindInputs(
  { monkey: ui.monkey, tiger: ui.tiger },
  () => screen === "playing" && !ui.settings.open,
  input,
);
ui.start.addEventListener("click", () => void startRound());
el('quick-retry').addEventListener('click', () => void startRound(automatedRound));
el("retry").addEventListener("click", () => void startRound(automatedRound));
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
ui.autoReset.addEventListener('change',()=>{
  storage.update({autoReset:ui.autoReset.checked});
  updatePreferences();
});

async function loadRanking(): Promise<void> {
  const epoch = ++rankingLoadEpoch;
  const category = rankingCategory;
  const status = el('ranking-load-status');
  status.textContent = '読み込み中…';
  el('ranking-list').replaceChildren();
  el('ranking-panel').setAttribute('aria-busy','true');
  el<HTMLButtonElement>('refresh-ranking').disabled = true;
  try {
    const entries = await ranking.list(category);
    if (epoch !== rankingLoadEpoch) return;
    const rows = entries.map(entry => {
      const row = document.createElement('li');
      if (entry.id === ranking.playerId) row.className = 'my-record';
      for (const [className,value] of [['ranking-place',`${entry.rank}`],['ranking-name',entry.nickname],['ranking-score',`${formatter.format(entry.score)} pt`]]) {
        const cell = document.createElement('span'); cell.className = className; cell.textContent = value; row.append(cell);
      }
      return row;
    });
    el('ranking-list').replaceChildren(...rows);
    status.textContent = entries.length ? `${CATEGORY_LABELS[category]}の記録` : '記録がありません';
  } catch { if (epoch === rankingLoadEpoch) status.textContent = '通信できません。「更新」で再試行できます'; }
  finally { if (epoch === rankingLoadEpoch) { el<HTMLButtonElement>('refresh-ranking').disabled = false; el('ranking-panel').setAttribute('aria-busy','false'); } }
}
const rankingTabs = [...document.querySelectorAll<HTMLButtonElement>('.ranking-tabs [role="tab"]')];
for (const [index,tab] of rankingTabs.entries()) {
  tab.addEventListener('click',()=>{
    rankingCategory = tab.dataset.category as RankingCategory;
    for (const button of rankingTabs) { button.setAttribute('aria-selected',String(button === tab)); button.tabIndex = button === tab ? 0 : -1; }
    el('ranking-panel').setAttribute('aria-labelledby',tab.id);
    el('ranking-list').setAttribute('aria-label',`${CATEGORY_LABELS[rankingCategory]}の記録`);
    void loadRanking();
  });
  tab.addEventListener('keydown',event=>{
    let target = index;
    if (event.key === 'ArrowRight') target = (index+1)%rankingTabs.length;
    else if (event.key === 'ArrowLeft') target = (index+rankingTabs.length-1)%rankingTabs.length;
    else if (event.key === 'Home') target = 0;
    else if (event.key === 'End') target = rankingTabs.length-1;
    else return;
    event.preventDefault(); rankingTabs[target].focus(); rankingTabs[target].click();
  });
}
for (const button of document.querySelectorAll('.ranking-open')) button.addEventListener('click',()=>{
  if (screen === 'playing') { engine.finish('quit',performance.now()); endRound(); presentResult(); }
  else if (screen === 'countdown') showTitle();
  el<HTMLDialogElement>('ranking-dialog').showModal();
  void loadRanking();
});
el('refresh-ranking').addEventListener('click',()=>void loadRanking());
el('ranking-form').addEventListener('submit',event=>{
  event.preventDefault();
  if (automatedRound || !rankedRound || !engine.result?.eligible) return;
  const round = rankedRound; const currentEngine = engine;
  const button = el<HTMLButtonElement>('submit-score');
  if (button.disabled) return;
  button.disabled = true;
  el('ranking-status').textContent = '記録を登録しています…';
  const name = el<HTMLInputElement>('nickname').value.trim() || '名無し';
  void ranking.submit(round,name,engine.log).then(result=>{
    if (currentEngine !== engine) return;
    el('ranking-form').hidden = true;
    const deviceRank = result.device && result.deviceRank ? ` · ${CATEGORY_LABELS[result.device]} ${result.deviceRank}位` : '';
    el('ranking-status').textContent = `全体 ${result.rank}位${deviceRank} · 記録を登録しました`;
  }).catch(error=>{
    if (currentEngine !== engine) return;
    el('ranking-status').textContent = error instanceof Error ? error.message : '通信できません。もう一度登録できます';
    button.disabled = false;
  });
});
function updateAnimalPicker(): void {
  el<HTMLInputElement>('random-animals').checked = storage.value.randomAnimals;
  for (const side of ['left','right'] as const) {
    const other = side === 'left' ? 'right' : 'left';
    for (const radio of el(`animal-options-${side}`).querySelectorAll<HTMLInputElement>('input')) {
      radio.checked = radio.value === storage.value.animals[side];
      radio.disabled = radio.value === storage.value.animals[other];
    }
  }
  configureAnimals(roundSeed);
  showStorageStatus();
}
for (const side of ['left','right'] as const) {
  const choices = ANIMALS.map(art=>{
    const label = document.createElement('label'); label.className = 'animal-option';
    label.style.setProperty('--animal-color',art.color); label.style.setProperty('--animal-light',art.light);
    const radio = document.createElement('input'); radio.type = 'radio'; radio.name = `animal-${side}`; radio.value = art.id;
    radio.setAttribute('aria-label',art.name);
    const card = document.createElement('span');
    const image = document.createElement('img'); image.src = artURL(art); image.alt = ''; image.draggable = false;
    const name = document.createElement('span'); name.textContent = art.name; card.append(image,name);
    label.append(radio,card);
    const choose = () => {
      if (!storage.value.randomAnimals && storage.value.animals[side] === art.id) return;
      storage.update({randomAnimals:false,animals:{...storage.value.animals,[side]:art.id}});
      updateAnimalPicker();
    };
    radio.addEventListener('change',choose);
    radio.addEventListener('click',choose);
    return label;
  });
  el(`animal-options-${side}`).replaceChildren(...choices);
}
el('choose-animals').addEventListener('click',()=>{ updateAnimalPicker(); el<HTMLDialogElement>('animals-dialog').showModal(); });
el('random-animals').addEventListener('change',()=>{
  storage.update({randomAnimals:el<HTMLInputElement>('random-animals').checked}); updateAnimalPicker();
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
  if (import.meta.env.DEV) el<HTMLButtonElement>('open-auto-input').disabled = false;
  ui.start.querySelector("span")!.textContent = "スタート";
  setScreen("ready");
  updateHud(performance.now());
  if (import.meta.env.DEV && new URLSearchParams(location.search).get('tool') === 'auto-input') el<HTMLDialogElement>('auto-input-dialog').showModal();
};
scene.onFailure = () => {
  el("fatal-error").hidden = false;
  audio.stopAll();
};
updatePreferences();
updateBest();
configureAnimals(42);
void scene.mount();
const resize = new ResizeObserver(([entry]) => {
  scene.resize(entry.contentRect.width, entry.contentRect.height);
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
        gameObjects: scene.objectCount(),
        animals: currentAnimals,
        renderTarget: scene.target(),
        tower: scene.tower(),
      }),
      reset: (seed = 1) => {
        autoInput?.stop();
        automatedRound = false;
        roundEpoch++;
        rankedRound = null;
        rankingReason = '検証モードの記録は全国に登録できません';
        audio.stopAll();
        engine = new PangEngine(seed);
        roundSeed = seed;
        attemptBaseSeed = seed;
        attemptIndex = 0;
        initialQueue = [...engine.queue];
        configureAnimals(seed);
        resultShown = false;
        savedResult = false;
        scene.resetEffects();
        scene.sync(engine.queue);
        engine.start(performance.now());
        setScreen("playing");
        updateHud(performance.now());
        scheduleFrame();
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
    releaseViewport();
    resize.disconnect();
    audio.stopAll();
    autoInput?.stop();
    cancelAnimationFrame(scheduledFrame);
    scene.destroy();
  });
