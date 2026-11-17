// Drawing only: the world's state and the current screen in, pixels out.
// The 1280x720 garden is scaled to fit the window and centred, the margin filled
// with the backdrop colour. Everything is drawn with canvas paths — the keeper,
// the moths with fluttering wings, the wisps, the flowers and the lantern glow
// are all original shapes painted here, no image files. The HUD sits across the
// top: score, night and its progress, hearts, the lantern light meter, combo.

import { FIELD, FONT, HEARTS, KEEPER, LIGHT, NIGHTS, NIGHT_SECONDS, PALETTE } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_WIN = 'win';
export const SCREEN_OVER = 'over';

const MOTH_COLOURS = { amber: PALETTE.amber, azure: PALETTE.azure, crimson: PALETTE.crimson };

function cachedLabel(prefix) {
  let value = -1;
  let text = '';
  return function label(next) {
    if (next !== value) {
      value = next;
      text = prefix + next;
    }
    return text;
  };
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0, width: 0, height: 0 };
  const scoreLabel = cachedLabel('Score ');
  const nightLabel = cachedLabel('Night ');
  const finalLabel = cachedLabel('Score ');
  const bestLabel = cachedLabel('Best ');
  const mothsLabel = cachedLabel('Moths guided home: ');
  const comboLabel = cachedLabel('Best combo: x');
  const repelLabel = cachedLabel('Wisps repelled: ');
  const pulsesLabel = cachedLabel('Lantern pulses: ');

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.width = width;
    view.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  /** Convert a client (mouse) point into logical field coordinates. */
  function toField(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    const px = (clientX - rect.left) * ratio;
    const py = (clientY - rect.top) * ratio;
    return {
      x: (px - view.x) / view.scale,
      y: (py - view.y) / view.scale,
    };
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align, weight = '600') {
    const key = `${weight}:${size}`;
    if (!fonts.has(key)) fonts.set(key, `${weight} ${size}px ${FONT}`);
    context.font = fonts.get(key);
    context.fillStyle = color;
    context.textAlign = align;
    context.textBaseline = 'alphabetic';
    context.fillText(value, x, y);
  }

  function roundRect(x, y, width, height, radius) {
    context.beginPath();
    context.moveTo(x + radius, y);
    context.arcTo(x + width, y, x + width, y + height, radius);
    context.arcTo(x + width, y + height, x, y + height, radius);
    context.arcTo(x, y + height, x, y, radius);
    context.arcTo(x, y, x + width, y, radius);
    context.closePath();
  }

  function drawGarden(state, time) {
    const sky = context.createLinearGradient(0, 0, 0, FIELD.height);
    sky.addColorStop(0, PALETTE.skyTop);
    sky.addColorStop(1, PALETTE.skyBottom);
    context.fillStyle = sky;
    context.fillRect(0, 0, FIELD.width, FIELD.height);

    // Stars.
    context.fillStyle = 'rgba(244, 241, 230, 0.7)';
    for (let i = 0; i < 70; i += 1) {
      const sx = (i * 173.3) % FIELD.width;
      const sy = (i * 97.7) % 210;
      const twinkle = 0.35 + 0.35 * Math.sin(time * 1.7 + i * 1.3);
      context.globalAlpha = twinkle;
      context.fillRect(sx, sy, 2, 2);
    }
    context.globalAlpha = 1;

    // The moon, high on the right, clear of the HUD.
    context.fillStyle = '#f6f0d8';
    context.beginPath();
    context.arc(1140, 168, 30, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#ddd3ae';
    context.beginPath();
    context.arc(1130, 160, 6, 0, Math.PI * 2);
    context.arc(1150, 176, 4, 0, Math.PI * 2);
    context.fill();

    // Grass.
    context.fillStyle = PALETTE.grass;
    context.fillRect(0, 78, FIELD.width, FIELD.height - 78);
    context.fillStyle = PALETTE.grassDark;
    for (let i = 0; i < 26; i += 1) {
      const gx = (i * 211.7) % FIELD.width;
      context.beginPath();
      context.ellipse(gx, 700 - (i % 5) * 14, 130, 26, 0, 0, Math.PI * 2);
      context.fill();
    }

    // Flowers, swaying gently.
    for (const flower of state.flowers) {
      const sway = Math.sin(time * 1.2 + flower.phase) * 2;
      context.strokeStyle = '#3f7a4e';
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(flower.x, flower.y + 8);
      context.quadraticCurveTo(flower.x + sway, flower.y, flower.x + sway, flower.y - 4);
      context.stroke();
      context.fillStyle = flower.kind === 0 ? PALETTE.flower : flower.kind === 1 ? PALETTE.flower2 : PALETTE.gold;
      for (let petal = 0; petal < 5; petal += 1) {
        const angle = (petal / 5) * Math.PI * 2 + flower.phase;
        context.beginPath();
        context.arc(flower.x + sway + Math.cos(angle) * flower.size * 0.7, flower.y - 4 + Math.sin(angle) * flower.size * 0.7, flower.size * 0.55, 0, Math.PI * 2);
        context.fill();
      }
      context.fillStyle = '#fff3c4';
      context.beginPath();
      context.arc(flower.x + sway, flower.y - 4, flower.size * 0.45, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawLanternGlow(state, time) {
    const keeper = state.keeper;
    const flicker = 1 + Math.sin(time * 6.3) * 0.03 + Math.sin(time * 11.7) * 0.02;
    const radius = KEEPER.lanternRadius * flicker * (0.55 + (state.light / LIGHT.max) * 0.45);
    const glow = context.createRadialGradient(keeper.x, keeper.y, 10, keeper.x, keeper.y, radius);
    glow.addColorStop(0, 'rgba(255, 233, 168, 0.34)');
    glow.addColorStop(0.6, 'rgba(255, 214, 120, 0.14)');
    glow.addColorStop(1, 'rgba(255, 214, 120, 0)');
    context.fillStyle = glow;
    context.beginPath();
    context.arc(keeper.x, keeper.y, radius, 0, Math.PI * 2);
    context.fill();

    if (state.pulseFlash > 0) {
      const progress = 1 - state.pulseFlash / 0.35;
      const ringRadius = KEEPER.pulseRadius * (0.25 + progress * 0.75);
      context.strokeStyle = `rgba(255, 233, 168, ${0.85 * (1 - progress)})`;
      context.lineWidth = 10 * (1 - progress) + 2;
      context.beginPath();
      context.arc(keeper.x, keeper.y, ringRadius, 0, Math.PI * 2);
      context.stroke();
    }
  }

  function drawMoth(moth, time) {
    const colour = MOTH_COLOURS[moth.mothKind];
    const flap = Math.sin(time * 14 + moth.wobble * 3) * 0.55;
    const wingSpread = 15 + flap * 7;
    context.save();
    context.translate(moth.x, moth.y);
    context.rotate(Math.atan2(moth.vy, moth.vx) * 0.25);
    context.fillStyle = colour;
    context.globalAlpha = 0.95;
    context.beginPath();
    context.ellipse(-2, -wingSpread * 0.45, 11, wingSpread * 0.55, -0.5, 0, Math.PI * 2);
    context.ellipse(-2, wingSpread * 0.45, 11, wingSpread * 0.55, 0.5, 0, Math.PI * 2);
    context.fill();
    context.globalAlpha = 1;
    context.fillStyle = '#fff8e0';
    context.beginPath();
    context.ellipse(0, 0, 7, 11, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = colour;
    context.beginPath();
    context.arc(0, -8, 3.6, 0, Math.PI * 2);
    context.fill();
    context.restore();
    // A soft halo so moths read at a glance.
    context.fillStyle = colour;
    context.globalAlpha = 0.32;
    context.beginPath();
    context.arc(moth.x, moth.y, moth.radius + 16, 0, Math.PI * 2);
    context.fill();
    context.globalAlpha = 1;
  }

  function drawWisp(wisp, time) {
    const wobble = Math.sin(time * 5 + wisp.wobble) * 3;
    context.save();
    context.translate(wisp.x + wobble, wisp.y);
    const aura = context.createRadialGradient(0, 0, 2, 0, 0, wisp.radius + 14);
    aura.addColorStop(0, 'rgba(138, 123, 216, 0.5)');
    aura.addColorStop(1, 'rgba(138, 123, 216, 0)');
    context.fillStyle = aura;
    context.beginPath();
    context.arc(0, 0, wisp.radius + 14, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = PALETTE.wisp;
    context.beginPath();
    context.arc(0, -4, wisp.radius * 0.8, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.moveTo(-wisp.radius * 0.8, -2);
    context.quadraticCurveTo(-wisp.radius * 0.5, wisp.radius + 8 + wobble, -wisp.radius * 0.2, wisp.radius * 0.7);
    context.quadraticCurveTo(0, wisp.radius + 10 - wobble, wisp.radius * 0.25, wisp.radius * 0.7);
    context.quadraticCurveTo(wisp.radius * 0.6, wisp.radius + 6, wisp.radius * 0.8, -2);
    context.closePath();
    context.fill();
    // Two pale eyes.
    context.fillStyle = PALETTE.wispCore;
    context.beginPath();
    context.arc(-5, -6, 2.6, 0, Math.PI * 2);
    context.arc(5, -6, 2.6, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  function drawDewdrop(drop, time) {
    const bob = Math.sin(drop.bob) * 3;
    context.fillStyle = PALETTE.dewdrop;
    context.globalAlpha = 0.25;
    context.beginPath();
    context.arc(drop.x, drop.y + bob, drop.radius + 8, 0, Math.PI * 2);
    context.fill();
    context.globalAlpha = 1;
    context.beginPath();
    context.moveTo(drop.x, drop.y + bob - drop.radius);
    context.quadraticCurveTo(drop.x + drop.radius, drop.y + bob + 2, drop.x, drop.y + bob + drop.radius);
    context.quadraticCurveTo(drop.x - drop.radius, drop.y + bob + 2, drop.x, drop.y + bob - drop.radius);
    context.fill();
    context.fillStyle = 'rgba(255,255,255,0.85)';
    context.beginPath();
    context.arc(drop.x - 3, drop.y + bob - 4, 2.5, 0, Math.PI * 2);
    context.fill();
  }

  function drawKeeper(state, time) {
    const keeper = state.keeper;
    const blink = state.invulnerable > 0 && Math.floor(time * 8) % 2 === 0;
    context.save();
    context.translate(keeper.x, keeper.y);
    if (blink) context.globalAlpha = 0.35;
    // Cloak.
    context.fillStyle = '#7a5fd0';
    context.beginPath();
    context.moveTo(0, -18);
    context.quadraticCurveTo(16, -4, 14, 16);
    context.quadraticCurveTo(0, 21, -14, 16);
    context.quadraticCurveTo(-16, -4, 0, -18);
    context.fill();
    context.fillStyle = PALETTE.keeperRobe;
    context.beginPath();
    context.moveTo(0, -18);
    context.quadraticCurveTo(8, -6, 7, 16);
    context.quadraticCurveTo(0, 19, -7, 16);
    context.quadraticCurveTo(-8, -6, 0, -18);
    context.fill();
    // Head and hood.
    context.fillStyle = '#f2c9a0';
    context.beginPath();
    context.arc(0, -14, 8, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#7a5fd0';
    context.beginPath();
    context.arc(0, -16, 9.5, Math.PI, Math.PI * 2);
    context.fill();
    // The lantern, held out toward the mouse.
    const aim = Math.atan2(state.mouse.y - keeper.y, state.mouse.x - keeper.x);
    const lx = Math.cos(aim) * 20;
    const ly = Math.sin(aim) * 20;
    context.strokeStyle = '#8a6d2f';
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(6, -2);
    context.lineTo(lx, ly);
    context.stroke();
    context.fillStyle = '#3a2f1e';
    context.beginPath();
    context.arc(lx, ly, 8, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = PALETTE.lanternGlow;
    context.beginPath();
    context.arc(lx, ly, 5.5, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  function drawHeart(x, y, filled, size) {
    context.save();
    context.translate(x, y);
    context.scale(size / 20, size / 20);
    context.beginPath();
    context.moveTo(0, 6);
    context.bezierCurveTo(-11, -4, -6, -12, 0, -6);
    context.bezierCurveTo(6, -12, 11, -4, 0, 6);
    context.closePath();
    context.fillStyle = filled ? '#ff7a9e' : 'rgba(255,122,158,0.22)';
    context.fill();
    context.restore();
  }

  function drawHud(state, best) {
    // Top bar.
    context.fillStyle = 'rgba(11, 14, 26, 0.72)';
    context.fillRect(0, 0, FIELD.width, 64);
    context.fillStyle = PALETTE.panelEdge;
    context.fillRect(0, 64, FIELD.width, 2);

    text(scoreLabel(state.score), 24, 42, 30, PALETTE.text, 'left', '700');
    if (state.combo > 1) {
      text(`COMBO x${state.combo}`, 232, 42, 24, PALETTE.gold, 'left', '700');
    }

    const nightText = state.phase === 'won' ? 'Beacon lit!' : nightLabel(state.night) + ` of ${NIGHTS}`;
    text(nightText, FIELD.width / 2, 30, 24, PALETTE.text, 'center', '700');
    // Night progress bar.
    const barWidth = 220;
    const barX = FIELD.width / 2 - barWidth / 2;
    const progress = state.phase === 'won' ? 1 : Math.min(1, state.nightTime / NIGHT_SECONDS);
    context.fillStyle = 'rgba(255,255,255,0.14)';
    roundRect(barX, 40, barWidth, 10, 5);
    context.fill();
    context.fillStyle = PALETTE.gold;
    roundRect(barX, 40, barWidth * progress, 10, 5);
    context.fill();

    // Hearts.
    for (let i = 0; i < HEARTS; i += 1) {
      drawHeart(FIELD.width - 290 + i * 30, 32, i < state.hearts, 22);
    }
    // Lantern light meter.
    text('LIGHT', FIELD.width - 276, 58, 13, PALETTE.muted, 'left', '700');
    const meterX = FIELD.width - 216;
    const meterWidth = 140;
    context.fillStyle = PALETTE.lightBarEmpty;
    roundRect(meterX, 48, meterWidth, 12, 6);
    context.fill();
    const lightFraction = state.light / LIGHT.max;
    context.fillStyle = lightFraction < 0.25 ? PALETTE.danger : PALETTE.lightBar;
    roundRect(meterX, 48, meterWidth * lightFraction, 12, 6);
    context.fill();
    text(`${Math.ceil(state.light)}`, meterX + meterWidth + 8, 60, 14, PALETTE.text, 'left', '700');

    text(`Best ${best}`, 24, 60, 14, PALETTE.muted, 'left');
  }

  function drawBanner(state) {
    if (state.bannerTime <= 0 || !state.banner) return;
    const alpha = Math.min(1, state.bannerTime / 0.6);
    context.globalAlpha = alpha;
    text(state.banner, FIELD.width / 2, 150, 40, PALETTE.gold, 'center', '700');
    context.globalAlpha = 1;
  }

  function drawHint(state) {
    if (state.phase !== 'night') return;
    context.fillStyle = 'rgba(11, 14, 26, 0.55)';
    roundRect(FIELD.width / 2 - 330, FIELD.height - 40, 660, 28, 14);
    context.fill();
    const pulseReady = state.pulseCooldown <= 0;
    text(
      'WASD / arrows to walk   •   Click or Space to pulse the lantern   •   P pause   •   M mute' + (pulseReady ? '' : '   •   pulse recharging…'),
      FIELD.width / 2,
      FIELD.height - 21,
      15,
      PALETTE.muted,
      'center',
    );
  }

  function drawPanel(title, lines, prompt, accent) {
    const width = 640;
    const height = 150 + lines.length * 36 + 74;
    const x = (FIELD.width - width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = 'rgba(11, 14, 26, 0.55)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    context.fillStyle = PALETTE.panel;
    roundRect(x, y, width, height, 18);
    context.fill();
    context.strokeStyle = accent || PALETTE.panelEdge;
    context.lineWidth = 3;
    roundRect(x, y, width, height, 18);
    context.stroke();
    text(title, FIELD.width / 2, y + 72, 52, PALETTE.text, 'center', '800');
    for (let i = 0; i < lines.length; i += 1) {
      text(lines[i], FIELD.width / 2, y + 128 + i * 36, 22, PALETTE.muted, 'center');
    }
    text(prompt, FIELD.width / 2, y + height - 34, 24, PALETTE.gold, 'center', '700');
  }

  /** Paint one frame: the garden, its creatures, the HUD or a panel for the screen. */
  function draw(state, screen, best, time) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, view.width, view.height);
    const shakeX = state.shake > 0 ? (Math.random() - 0.5) * 10 * state.shake : 0;
    const shakeY = state.shake > 0 ? (Math.random() - 0.5) * 10 * state.shake : 0;
    context.setTransform(view.scale, 0, 0, view.scale, view.x + shakeX * view.scale, view.y + shakeY * view.scale);

    drawGarden(state, time);
    drawLanternGlow(state, time);
    for (const drop of state.dewdrops) drawDewdrop(drop, time);
    for (const moth of state.moths) drawMoth(moth, time);
    for (const wisp of state.wisps) drawWisp(wisp, time);
    drawKeeper(state, time);

    if (screen === SCREEN_TITLE) {
      const titleLines = [
        'Guide the glowmoths home. Keep the lantern lit.',
        'Walk with WASD or arrows. Click or press Space to pulse the lantern —',
        'the pulse shoves shadow wisps away and pulls moths in, but burns light.',
        'Gather moths to feed the light. Survive all 5 nights to light the Beacon.',
        'Amber +10   •   Azure +25   •   Crimson +50   •   Dewdrops mend a heart.',
      ];
      const panelHeight = 150 + titleLines.length * 36 + 74;
      const x = (FIELD.width - 760) / 2;
      const y = (FIELD.height - panelHeight) / 2;
      context.fillStyle = 'rgba(11, 14, 26, 0.6)';
      context.fillRect(0, 0, FIELD.width, FIELD.height);
      context.fillStyle = PALETTE.panel;
      roundRect(x, y, 760, panelHeight, 18);
      context.fill();
      context.strokeStyle = PALETTE.gold;
      context.lineWidth = 3;
      roundRect(x, y, 760, panelHeight, 18);
      context.stroke();
      text('✦  MOTHLIGHT  ✦', FIELD.width / 2, y + 66, 54, PALETTE.gold, 'center', '800');
      text('Keeper of the Last Lantern', FIELD.width / 2, y + 104, 24, PALETTE.text, 'center', '600');
      for (let i = 0; i < titleLines.length; i += 1) {
        text(titleLines[i], FIELD.width / 2, y + 152 + i * 34, 20, PALETTE.muted, 'center');
      }
      text(best > 0 ? `Best score ${best}   •   Press Space or click to begin` : 'Press Space or click to begin', FIELD.width / 2, y + panelHeight - 30, 24, PALETTE.gold, 'center', '700');
      return;
    }

    drawHud(state, best);
    drawBanner(state);
    if (screen === SCREEN_PLAY) {
      drawHint(state);
    } else if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', ['The moths will wait for you.', 'The lantern stays lit while you rest.'], 'Press P or Space to keep playing', PALETTE.panelEdge);
    } else if (screen === SCREEN_WIN) {
      drawPanel(
        '✦ The Beacon is Lit! ✦',
        [
          finalLabel(state.score),
          bestLabel(best),
          mothsLabel(state.mothsCaught),
          comboLabel(state.bestCombo),
          repelLabel(state.wispsRepelled),
          `All ${NIGHTS} nights survived — the garden glows again.`,
        ],
        'Press Space or click to play again',
        PALETTE.gold,
      );
    } else if (screen === SCREEN_OVER) {
      drawPanel(
        'The Lantern Went Dark',
        [
          finalLabel(state.score),
          bestLabel(best),
          mothsLabel(state.mothsCaught),
          comboLabel(state.bestCombo),
          'The wisps close in… but the moths will return tonight.',
        ],
        'Press Space or click to try again',
        PALETTE.danger,
      );
    }
  }

  return { draw, resize, toField };
}
