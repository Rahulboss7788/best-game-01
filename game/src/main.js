// Boot and the one loop: input is read once per frame, the world advances in
// fixed 1/60 s steps (several in a slow frame, none in a fast one), and the
// renderer paints what is there. The game moves between five screens: title,
// play, paused, win and game over.
//
// ?seed=N fixes the garden's pattern. ?shot=start|play|win|lose (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot. window.__mothlight exposes the live
// screen and score for smoke tests.

import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createAudio } from './audio.js';
import { createWorld, EVENT_HURT, EVENT_MOTH, EVENT_NIGHT, EVENT_OVER, EVENT_WIN } from './world.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, ACTION_PULSE, createInput } from './input.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  renderer.resize();
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best, performance.now() / 1000);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else {
      window.__shotReady = true;
      window.__mothlight = { screen: scene.screen, score: world.state.score, phase: world.state.phase };
    }
  }
  requestAnimationFrame(paint);
}

function runGame() {
  renderer.resize();
  window.addEventListener('resize', () => renderer.resize());
  const input = createInput(canvas, (x, y) => renderer.toField(x, y));
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();

  window.__mothlight = { screen, score: 0, phase: world.state.phase };

  // Screen readers (and anyone watching the page's text) hear the screen changes and each hit.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    audio.unlock();
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    window.__mothlight.screen = screen;
    announce('Playing. Guide the glowmoths home and keep the lantern lit.');
  }

  function endGame(won) {
    screen = won ? SCREEN_WIN : SCREEN_OVER;
    window.__mothlight.screen = screen;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    if (won) {
      audio.win();
      announce(`The Beacon is lit! Score ${world.state.score}. Best ${best}.`);
    } else {
      audio.lose();
      announce(`The lantern went dark. Score ${world.state.score}. Best ${best}.`);
    }
  }

  // One frame's actions, read once and shared: confirm/pause/mute belong to the
  // screens, the pulse belongs to the first simulation step of the frame.
  function handleActions(actions) {
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Sound muted.' : 'Sound on.');
    }
    if (actions & ACTION_CONFIRM) {
      audio.unlock();
      if (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_WIN) startGame();
      else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    }
    if (actions & ACTION_PAUSE) {
      if (screen === SCREEN_PLAY) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    }
  }

  function step(wantPulse) {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, { x: 0, y: 0 }, false, true);
      return;
    }
    const direction = input.direction();
    world.state.mouse = input.mouse;
    if (wantPulse) audio.unlock();
    const events = world.step(STEP, direction, wantPulse, false);
    if (events & EVENT_MOTH) audio.moth(world.state.combo);
    if (events & EVENT_HURT) audio.hurt();
    if (events & EVENT_NIGHT) audio.night();
    if (events & EVENT_WIN) endGame(true);
    else if (events & EVENT_OVER) endGame(false);
    else if (events & EVENT_HURT) {
      announce(world.state.hearts === 1 ? 'A wisp struck. 1 heart left.' : `A wisp struck. ${world.state.hearts} hearts left.`);
    }
    window.__mothlight.score = world.state.score;
    window.__mothlight.phase = world.state.phase;
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = input.takeActions();
    const wasPlaying = screen === SCREEN_PLAY;
    handleActions(actions);
    window.__mothlight.screen = screen;
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      let firstStep = true;
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        // The pulse fires on the frame's first step only, never twice, and
        // never on the very frame a press started the game.
        step(firstStep && wasPlaying && Boolean(actions & ACTION_PULSE));
        firstStep = false;
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best, now / 1000);
    window.__mothlight.keeper = { x: Math.round(world.state.keeper.x), y: Math.round(world.state.keeper.y) };
    window.__mothlight.moths = world.state.moths.length;
    window.__mothlight.wisps = world.state.wisps.length;
    window.__mothlight.hearts = world.state.hearts;
    window.__mothlight.light = Math.round(world.state.light);
    let nearest = null;
    let nearestDistance = Infinity;
    for (const moth of world.state.moths) {
      const distance = Math.hypot(moth.x - world.state.keeper.x, moth.y - world.state.keeper.y);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = { x: Math.round(moth.x), y: Math.round(moth.y) };
      }
    }
    window.__mothlight.nearestMoth = nearest;
  }

  // Leaving the tab pauses a running game rather than letting wisps hunt unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Mothlight. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
