// The garden simulation: no drawing, no input — just the rules.
// The keeper walks the twilight garden with a lantern. Glowmoths drift in from
// the edges; inside the lantern's glow they are drawn home, and collecting one
// feeds the lantern's light and scores. Shadow wisps hunt the keeper: a touch
// costs a heart and snuffs light. A lantern pulse (click or Space) shoves wisps
// away and pulls moths in, but burns light. Light drains slowly on its own, so
// the keeper must keep gathering. Survive all five nights and the Beacon lights:
// the game is won. Lose all three hearts, or let the light die with no heart to
// spare, and the garden goes dark.

import {
  BETWEEN_SECONDS,
  COMBO,
  DEWDROP,
  FIELD,
  HEARTS,
  KEEPER,
  LIGHT,
  MOTH,
  NIGHTS,
  NIGHT_SECONDS,
  WISP,
} from './config.js';
import { pickWeighted } from './random.js';

export const KIND_MOTH = 'moth';
export const KIND_WISP = 'wisp';
export const KIND_DEWDROP = 'dewdrop';

export const EVENT_MOTH = 1;
export const EVENT_HURT = 2;
export const EVENT_OVER = 4;
export const EVENT_WIN = 8;
export const EVENT_NIGHT = 16;
export const EVENT_DEWDROP = 32;
export const EVENT_PULSE = 64;
export const EVENT_REPEL = 128;

const MOTH_TABLE = [
  { weight: MOTH.amber.weight, value: 'amber' },
  { weight: MOTH.azure.weight, value: 'azure' },
  { weight: MOTH.crimson.weight, value: 'crimson' },
];

/** The night wind: a slow push that drifts moths (and the keeper, slightly). */
function windForNight(night, random) {
  const angle = random() * Math.PI * 2;
  const strength = 14 + night * 6;
  return { x: Math.cos(angle) * strength, y: Math.sin(angle) * strength * 0.6 };
}

export function createWorld(random) {
  const state = {
    keeper: { x: FIELD.width / 2, y: FIELD.height / 2, vx: 0, vy: 0 },
    mouse: { x: FIELD.width / 2, y: FIELD.height / 2 },
    moths: [],
    wisps: [],
    dewdrops: [],
    flowers: [],
    score: 0,
    bestCombo: 0,
    combo: 0,
    comboTimer: 0,
    mothsCaught: 0,
    wispsRepelled: 0,
    pulses: 0,
    hearts: HEARTS,
    light: LIGHT.start,
    night: 1,
    nightTime: 0,
    phase: 'night', // 'night' | 'between' | 'won' | 'lost'
    betweenTime: 0,
    pulseCooldown: 0,
    pulseFlash: 0,
    invulnerable: 0,
    wind: { x: 0, y: 0 },
    elapsed: 0,
    mothTimer: 0,
    wispTimer: 0,
    dewdropTimer: DEWDROP.spawnEverySeconds,
    banner: '',
    bannerTime: 0,
    shake: 0,
  };

  function scatterFlowers() {
    state.flowers = [];
    for (let i = 0; i < 46; i += 1) {
      state.flowers.push({
        x: 30 + random() * (FIELD.width - 60),
        y: 90 + random() * (FIELD.height - 130),
        kind: i % 3,
        phase: random() * Math.PI * 2,
        size: 3 + random() * 4,
      });
    }
  }

  function spawnMoth() {
    const edge = Math.floor(random() * 4);
    let x = 0;
    let y = 0;
    // Spawn just inside the play area (below the HUD), never on top of it.
    if (edge === 0) { x = random() * FIELD.width; y = 72; }
    else if (edge === 1) { x = FIELD.width - 12; y = 80 + random() * (FIELD.height - 90); }
    else if (edge === 2) { x = random() * FIELD.width; y = FIELD.height - 12; }
    else { x = 12; y = 80 + random() * (FIELD.height - 90); }
    const kind = pickWeighted(random, MOTH_TABLE);
    const def = MOTH[kind];
    const angle = random() * Math.PI * 2;
    state.moths.push({
      kind: KIND_MOTH,
      mothKind: kind,
      x,
      y,
      vx: Math.cos(angle) * def.speed * 0.5,
      vy: Math.sin(angle) * def.speed * 0.5,
      speed: def.speed,
      radius: def.radius,
      points: def.points,
      light: def.light,
      wobble: random() * Math.PI * 2,
      wobbleSpeed: 2 + random() * 2,
      active: true,
    });
  }

  function spawnWisp() {
    const alive = state.wisps.filter((w) => w.active).length;
    if (alive >= Math.min(WISP.maxAlive, 2 + state.night)) return;
    const angle = random() * Math.PI * 2;
    const distance = 420 + random() * 160;
    const x = Math.min(FIELD.width - 20, Math.max(20, state.keeper.x + Math.cos(angle) * distance));
    const y = Math.min(FIELD.height - 20, Math.max(20, state.keeper.y + Math.sin(angle) * distance));
    state.wisps.push({
      kind: KIND_WISP,
      x,
      y,
      vx: 0,
      vy: 0,
      speed: WISP.baseSpeed + WISP.speedPerNight * (state.night - 1) + random() * 14,
      radius: WISP.radius,
      wobble: random() * Math.PI * 2,
      active: true,
    });
  }

  function spawnMothNearKeeper() {
    const angle = random() * Math.PI * 2;
    const distance = 130 + random() * 130;
    const kind = pickWeighted(random, MOTH_TABLE);
    const def = MOTH[kind];
    state.moths.push({
      kind: KIND_MOTH,
      mothKind: kind,
      x: Math.min(FIELD.width - 20, Math.max(20, state.keeper.x + Math.cos(angle) * distance)),
      y: Math.min(FIELD.height - 20, Math.max(90, state.keeper.y + Math.sin(angle) * distance)),
      vx: 0,
      vy: 0,
      speed: def.speed,
      radius: def.radius,
      points: def.points,
      light: def.light,
      wobble: random() * Math.PI * 2,
      wobbleSpeed: 2 + random() * 2,
      active: true,
    });
  }

  function spawnDewdrop() {
    state.dewdrops.push({
      kind: KIND_DEWDROP,
      x: 80 + random() * (FIELD.width - 160),
      y: 110 + random() * (FIELD.height - 190),
      radius: DEWDROP.radius,
      bob: random() * Math.PI * 2,
      active: true,
    });
  }

  function startNight(night) {
    state.night = night;
    state.nightTime = 0;
    state.phase = 'night';
    state.wind = windForNight(night, random);
    state.mothTimer = 0.2;
    state.wispTimer = 1.2;
    state.banner = `Night ${night} of ${NIGHTS}`;
    state.bannerTime = 2.4;
  }

  function loseHeart(events) {
    state.hearts -= 1;
    state.light = LIGHT.refillOnHeartLost;
    state.invulnerable = KEEPER.invulnerable;
    state.combo = 0;
    state.comboTimer = 0;
    state.shake = 0.45;
    events |= EVENT_HURT;
    if (state.hearts <= 0) {
      state.phase = 'lost';
      events |= EVENT_OVER;
    }
    return events;
  }

  function reset() {
    state.keeper.x = FIELD.width / 2;
    state.keeper.y = FIELD.height / 2;
    state.keeper.vx = 0;
    state.keeper.vy = 0;
    state.moths = [];
    state.wisps = [];
    state.dewdrops = [];
    state.score = 0;
    state.bestCombo = 0;
    state.combo = 0;
    state.comboTimer = 0;
    state.mothsCaught = 0;
    state.wispsRepelled = 0;
    state.pulses = 0;
    state.hearts = HEARTS;
    state.light = LIGHT.start;
    state.night = 1;
    state.nightTime = 0;
    state.phase = 'night';
    state.betweenTime = 0;
    state.pulseCooldown = 0;
    state.pulseFlash = 0;
    state.invulnerable = 0;
    state.elapsed = 0;
    state.mothTimer = 0.4;
    state.wispTimer = 1.4;
    state.dewdropTimer = DEWDROP.spawnEverySeconds;
    state.banner = `Night 1 of ${NIGHTS}`;
    state.bannerTime = 2.4;
    state.shake = 0;
    state.wind = windForNight(1, random);
    scatterFlowers();
    for (let i = 0; i < 5; i += 1) spawnMoth();
    // A few moths start near the keeper, so the first seconds already have
    // something to gather instead of an empty garden.
    for (let i = 0; i < 3; i += 1) spawnMothNearKeeper();
  }

  /** A lantern pulse: shoves wisps away, hauls moths toward the keeper, costs light. */
  function pulse() {
    if (state.pulseCooldown > 0 || state.phase !== 'night') return 0;
    if (state.light < KEEPER.pulseCost) return 0;
    state.light -= KEEPER.pulseCost;
    state.pulseCooldown = KEEPER.pulseCooldown;
    state.pulseFlash = 0.35;
    state.pulses += 1;
    let events = EVENT_PULSE;
    const keeper = state.keeper;
    for (const wisp of state.wisps) {
      if (!wisp.active) continue;
      const dx = wisp.x - keeper.x;
      const dy = wisp.y - keeper.y;
      const distance = Math.hypot(dx, dy) || 1;
      if (distance < KEEPER.pulseRadius) {
        const push = 420 * (1 - distance / KEEPER.pulseRadius) + 160;
        wisp.vx += (dx / distance) * push;
        wisp.vy += (dy / distance) * push;
        state.wispsRepelled += 1;
        events |= EVENT_REPEL;
      }
    }
    for (const moth of state.moths) {
      if (!moth.active) continue;
      const dx = keeper.x - moth.x;
      const dy = keeper.y - moth.y;
      const distance = Math.hypot(dx, dy) || 1;
      if (distance < KEEPER.pulseRadius) {
        moth.vx += (dx / distance) * 260;
        moth.vy += (dy / distance) * 260;
      }
    }
    return events;
  }

  function distanceToKeeper(entity) {
    return Math.hypot(entity.x - state.keeper.x, entity.y - state.keeper.y);
  }

  /**
   * One fixed step. `direction` is a normalised steering vector, `wantPulse`
   * requests a lantern pulse, `harmless` runs the garden as a title backdrop
   * (moths drift, nothing scores, nothing can hurt the keeper).
   */
  function step(dt, direction, wantPulse, harmless = false) {
    let events = 0;
    state.elapsed += dt;
    if (state.bannerTime > 0) state.bannerTime -= dt;
    if (state.pulseFlash > 0) state.pulseFlash -= dt;
    if (state.pulseCooldown > 0) state.pulseCooldown -= dt;
    if (state.invulnerable > 0) state.invulnerable -= dt;
    if (state.shake > 0) state.shake -= dt;
    if (state.comboTimer > 0) {
      state.comboTimer -= dt;
      if (state.comboTimer <= 0) state.combo = 0;
    }

    const keeper = state.keeper;
    // Drift with the night wind, then steer. The keeper never leaves the garden.
    keeper.vx = direction.x * KEEPER.speed + state.wind.x * 0.35;
    keeper.vy = direction.y * KEEPER.speed + state.wind.y * 0.35;
    keeper.x = Math.min(FIELD.width - KEEPER.radius, Math.max(KEEPER.radius, keeper.x + keeper.vx * dt));
    keeper.y = Math.min(FIELD.height - KEEPER.radius - 8, Math.max(84, keeper.y + keeper.vy * dt));

    if (wantPulse && !harmless) events |= pulse();

    if (state.phase === 'between') {
      state.betweenTime -= dt;
      if (state.betweenTime <= 0) {
        startNight(state.night + 1);
        events |= EVENT_NIGHT;
      }
    } else if (state.phase === 'night' && !harmless) {
      state.nightTime += dt;
      state.light = Math.max(0, state.light - LIGHT.drainPerSecond * dt);
      if (state.light <= 0) {
        events = loseHeart(events);
      } else {
        state.mothTimer -= dt;
        if (state.mothTimer <= 0) {
          spawnMoth();
          state.mothTimer = MOTH.spawnInterval * (0.75 + random() * 0.5);
        }
        state.wispTimer -= dt;
        if (state.wispTimer <= 0) {
          spawnWisp();
          const interval = WISP.spawnInterval * WISP.spawnIntervalScale ** (state.night - 1);
          state.wispTimer = interval * (0.8 + random() * 0.4);
        }
        state.dewdropTimer -= dt;
        if (state.dewdropTimer <= 0) {
          spawnDewdrop();
          state.dewdropTimer = DEWDROP.spawnEverySeconds;
        }
        if (state.nightTime >= NIGHT_SECONDS) {
          if (state.night >= NIGHTS) {
            state.phase = 'won';
            events |= EVENT_WIN;
          } else {
            state.phase = 'between';
            state.betweenTime = BETWEEN_SECONDS;
            state.banner = `Night ${state.night} survived — dawn is coming`;
            state.bannerTime = BETWEEN_SECONDS;
            events |= EVENT_NIGHT;
          }
        }
      }
    }

    // Moths: wobble, drift with the wind, flee only when crimson and close,
    // and get drawn into the lantern's glow. On the title screen the garden
    // keeps drifting too, so the backdrop stays alive behind the panel.
    if (harmless) {
      state.mothTimer -= dt;
      if (state.mothTimer <= 0) {
        spawnMoth();
        state.mothTimer = 1.1;
      }
    }
    for (const moth of state.moths) {
      if (!moth.active) continue;
      moth.wobble += moth.wobbleSpeed * dt;
      const distance = distanceToKeeper(moth);
      let ax = Math.cos(moth.wobble) * 22 + state.wind.x;
      let ay = Math.sin(moth.wobble) * 22 + state.wind.y;
      if (!harmless && distance < KEEPER.lanternRadius) {
        const pull = MOTH.attractSpeed * (1.15 - distance / KEEPER.lanternRadius);
        ax += ((keeper.x - moth.x) / (distance || 1)) * pull;
        ay += ((keeper.y - moth.y) / (distance || 1)) * pull;
      }
      if (moth.mothKind === 'crimson' && !harmless && distance < 110) {
        ax += ((moth.x - keeper.x) / (distance || 1)) * 130;
        ay += ((moth.y - keeper.y) / (distance || 1)) * 130;
      }
      moth.vx += ax * dt * 3;
      moth.vy += ay * dt * 3;
      const speed = Math.hypot(moth.vx, moth.vy);
      const cap = moth.speed * (distance < KEEPER.lanternRadius ? 2.2 : 1.15);
      if (speed > cap) {
        moth.vx = (moth.vx / speed) * cap;
        moth.vy = (moth.vy / speed) * cap;
      }
      moth.x += moth.vx * dt;
      moth.y += moth.vy * dt;
      if (moth.x < -40 || moth.x > FIELD.width + 40 || moth.y < -40 || moth.y > FIELD.height + 40) {
        moth.active = false;
        continue;
      }
      if (!harmless && state.phase === 'night' && distance < MOTH.collectRadius) {
        moth.active = false;
        state.mothsCaught += 1;
        state.combo = Math.min(COMBO.max, state.combo + 1);
        state.comboTimer = COMBO.windowSeconds;
        state.bestCombo = Math.max(state.bestCombo, state.combo);
        state.score += moth.points * state.combo;
        state.light = Math.min(LIGHT.max, state.light + moth.light);
        events |= EVENT_MOTH;
      }
    }

    // Wisps: hunt the keeper with a slow weave; a touch costs a heart.
    for (const wisp of state.wisps) {
      if (!wisp.active) continue;
      wisp.wobble += dt * 1.6;
      const dx = keeper.x - wisp.x;
      const dy = keeper.y - wisp.y;
      const distance = Math.hypot(dx, dy) || 1;
      const weave = Math.sin(wisp.wobble) * 34;
      const px = -dy / distance;
      const py = dx / distance;
      wisp.vx += (((dx / distance) * wisp.speed + px * weave) - wisp.vx) * dt * 1.8;
      wisp.vy += (((dy / distance) * wisp.speed + py * weave) - wisp.vy) * dt * 1.8;
      wisp.x += wisp.vx * dt;
      wisp.y += wisp.vy * dt;
      if (wisp.x < 10 || wisp.x > FIELD.width - 10) wisp.vx *= -0.6;
      if (wisp.y < 70 || wisp.y > FIELD.height - 10) wisp.vy *= -0.6;
      if (!harmless && state.phase === 'night' && distance < WISP.touchRadius && state.invulnerable <= 0) {
        wisp.active = false;
        events = loseHeart(events);
        if (state.phase === 'lost') break;
      }
    }

    // Dewdrops bob where they fell until the keeper gathers them.
    for (const drop of state.dewdrops) {
      if (!drop.active) continue;
      drop.bob += dt * 2;
      if (!harmless && state.phase === 'night' && distanceToKeeper(drop) < KEEPER.radius + drop.radius + 6) {
        drop.active = false;
        state.score += DEWDROP.points;
        if (state.hearts < HEARTS) state.hearts += 1;
        else state.light = Math.min(LIGHT.max, state.light + DEWDROP.light);
        events |= EVENT_DEWDROP;
      }
    }

    state.moths = state.moths.filter((m) => m.active);
    state.wisps = state.wisps.filter((w) => w.active);
    state.dewdrops = state.dewdrops.filter((d) => d.active);
    return events;
  }

  reset();
  return { state, reset, step, pulse, startNight };
}
