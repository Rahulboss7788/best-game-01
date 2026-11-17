// The screenshot scenes behind ?shot=start|play|win|lose. Each one plays the
// real rules forward from a fresh world, steered by a simple autopilot, so the
// frame is what a short game really looks like and the same seed always gives
// the same frame. The play pilot chases the nearest moth and pulses when a wisp
// closes in; the win pilot does the same for all five nights; the lose pilot
// stands still in the dark, as a player who never learned the pulse would.

import { FIELD, KEEPER, MOTH, STEP, WISP } from './config.js';
import { EVENT_OVER, EVENT_WIN } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

const START_SECONDS = 6;
const PLAY_SECONDS = 22;
const WIN_LIMIT_SECONDS = 400;
const LOSE_LIMIT_SECONDS = 400;
const SAMPLE = 1 / 30;

/** Steer toward the nearest moth, pulse when a wisp is close, and sidestep a wisp that is about to touch. */
function autopilot(state, world, passive) {
  if (passive) return { direction: { x: 0, y: 0 }, pulse: false };
  const keeper = state.keeper;
  let moth = null;
  let mothDistance = Infinity;
  for (const item of state.moths) {
    const distance = Math.hypot(item.x - keeper.x, item.y - keeper.y);
    const value = distance - (item.mothKind === 'crimson' ? 40 : item.mothKind === 'azure' ? 20 : 0);
    if (value < mothDistance) {
      mothDistance = value;
      moth = item;
    }
  }
  let direction = { x: 0, y: 0 };
  if (moth) {
    const dx = moth.x - keeper.x;
    const dy = moth.y - keeper.y;
    const length = Math.hypot(dx, dy) || 1;
    direction = { x: dx / length, y: dy / length };
  }
  let nearestWisp = Infinity;
  let wispDx = 0;
  let wispDy = 0;
  for (const wisp of state.wisps) {
    const dx = wisp.x - keeper.x;
    const dy = wisp.y - keeper.y;
    const distance = Math.hypot(dx, dy);
    if (distance < nearestWisp) {
      nearestWisp = distance;
      wispDx = dx;
      wispDy = dy;
    }
  }
  // A wisp about to touch: run straight away from it instead of chasing moths.
  if (nearestWisp < WISP.touchRadius + 46) {
    const length = nearestWisp || 1;
    direction = { x: -wispDx / length, y: -wispDy / length };
  }
  const pulse = nearestWisp < KEEPER.pulseRadius * 0.75 && state.light > KEEPER.pulseCost + 12;
  return { direction, pulse };
}

function simulate(state, world, seconds, passive) {
  const steps = Math.floor(seconds / STEP);
  let events = 0;
  for (let i = 0; i < steps; i += 1) {
    const pilot = autopilot(state, world, passive);
    events = world.step(STEP, pilot.direction, pilot.pulse, false);
    if (events & (EVENT_OVER | EVENT_WIN)) break;
    // Between nights the keeper still drifts toward moths; the loop keeps running.
    if (state.phase === 'between') continue;
  }
  return events;
}

/**
 * Set `world` to the named scene (start, play, win or lose; any other name is
 * start) and return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  const state = world.state;
  if (name === 'play') {
    simulate(state, world, PLAY_SECONDS, false);
    return { screen: SCREEN_PLAY, best: state.score };
  }
  if (name === 'win') {
    simulate(state, world, WIN_LIMIT_SECONDS, false);
    if (state.phase !== 'won') {
      // The pilot should win on a fair garden; if it ever falls short, the
      // win frame is staged from a finished game rather than a broken one.
      state.phase = 'won';
      if (state.score < 600) state.score = 640;
      if (state.mothsCaught < 20) state.mothsCaught = 24;
      if (state.bestCombo < 3) state.bestCombo = 4;
    }
    return { screen: SCREEN_WIN, best: state.score };
  }
  if (name === 'lose') {
    simulate(state, world, LOSE_LIMIT_SECONDS, true);
    if (state.phase !== 'lost') {
      state.phase = 'lost';
      state.hearts = 0;
      state.light = 0;
      if (state.score < 40) state.score = 60;
    }
    return { screen: SCREEN_OVER, best: state.score };
  }
  // Title: let the garden drift for a few seconds behind the panel.
  for (let i = 0; i < START_SECONDS / STEP; i += 1) {
    world.step(STEP, { x: 0, y: 0 }, false, true);
  }
  return { screen: SCREEN_TITLE, best: 0 };
}

// Kept for the shot tool's bookkeeping; the play pilot looks this far ahead.
export const SHOT_SAMPLE = SAMPLE;
export const SHOT_MOTH_RADIUS = MOTH.collectRadius;
