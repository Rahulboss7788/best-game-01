// Mothlight — every tuning number and colour in one place.
// The garden is a fixed 1280x720 logical field; the renderer scales it to the
// window, so no rule below depends on the screen size.

export const FIELD = { width: 1280, height: 720 };

/** Fixed simulation step, in seconds: 60 updates a second whatever the display rate. */
export const STEP = 1 / 60;

/** Five nights to survive; finishing night 5 lights the Beacon and wins the game. */
export const NIGHTS = 5;
export const NIGHT_SECONDS = 14;
export const BETWEEN_SECONDS = 2.2;

export const KEEPER = {
  radius: 22,
  speed: 310,
  lanternRadius: 170,
  pulseRadius: 270,
  pulseCost: 8,
  pulseCooldown: 0.9,
  invulnerable: 2.0,
};

export const LIGHT = {
  max: 100,
  start: 80,
  drainPerSecond: 1.1,
  refillOnHeartLost: 60,
};

export const HEARTS = 3;

/** Moth kinds: amber is common and slow, azure is quick and worth more,
 *  crimson is rare, flees the keeper, and is worth the most. */
export const MOTH = {
  amber: { points: 10, light: 7, speed: 46, radius: 11, weight: 62 },
  azure: { points: 25, light: 11, speed: 78, radius: 10, weight: 26 },
  crimson: { points: 50, light: 16, speed: 96, radius: 10, weight: 12 },
  spawnInterval: 0.7,
  attractSpeed: 210,
  collectRadius: 30,
};

/** Shadow wisps hunt the keeper. Their speed and count grow each night. */
export const WISP = {
  baseSpeed: 52,
  speedPerNight: 11,
  radius: 16,
  touchRadius: 34,
  spawnInterval: 2.6,
  spawnIntervalScale: 0.86,
  maxAlive: 9,
};

/** Dewdrops are rare pickups: a heart when hurt, light when full. */
export const DEWDROP = {
  points: 15,
  light: 30,
  spawnEverySeconds: 17,
  radius: 12,
};

/** Combo: collecting moths within this window of each other raises the multiplier. */
export const COMBO = { windowSeconds: 4, max: 5 };

export const PALETTE = {
  backdrop: '#0b0e1a',
  skyTop: '#141a33',
  skyBottom: '#1d2440',
  grass: '#16241c',
  grassDark: '#101c15',
  flower: '#e58fb1',
  flower2: '#8fb7e5',
  keeper: '#ffd97a',
  keeperRobe: '#f2b544',
  lanternGlow: '#ffe9a8',
  amber: '#ffb347',
  azure: '#6fd3ff',
  crimson: '#ff7a9e',
  wisp: '#8a7bd8',
  wispCore: '#c9b8ff',
  dewdrop: '#9fe8ff',
  panel: '#171d33',
  panelEdge: '#3a4470',
  text: '#f4f1e6',
  muted: '#aab0c6',
  gold: '#ffd97a',
  danger: '#ff6b6b',
  lightBar: '#ffd97a',
  lightBarEmpty: '#3a2f1e',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'mothlight.best';
