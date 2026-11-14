// Écran 1 — Accueil.
import { h } from '../dom.js';
import { ICON, sceneArt } from '../art.js';
import { settingToggles, confirmSheet } from '../components.js';

export function homeScreen(ctx) {
  const { store } = ctx;
  const resumable = !!store.game && store.game.phase !== 'over';

  async function newGame() {
    if (resumable) {
      const ok = await confirmSheet({
        title: 'Nouvelle partie ?',
        text: 'Une partie est en cours sur ce téléphone. Elle sera abandonnée.',
        yes: 'Abandonner et recommencer',
        danger: true,
      });
      if (!ok) return;
      store.clearGame();
    }
    ctx.go('setup');
  }

  return h('section', { class: 'screen home' },
    h('div', { class: 'home-art', html: sceneArt('home'), 'aria-hidden': 'true' }),
    h('div', { class: 'home-top' }, settingToggles(ctx)),
    h('div', { class: 'home-title' },
      h('h1', { class: 'logo', 'aria-label': 'Coupe-Circuit' },
        h('span', { class: 'l1' }, 'COUPE'),
        h('span', { class: 'cutmark', html: ICON.pince }),
        h('span', { class: 'l2' }, 'CIRCUIT')),
      h('p', { class: 'tagline' }, 'Rôles secrets à la station polaire.', h('br'), 'Un seul téléphone pour toute la tablée.')),
    h('div', { class: 'home-actions' },
      resumable ? h('button', { class: 'btn primary big', id: 'btnResume', onClick: () => ctx.go('game') }, 'Reprendre la partie') : null,
      h('button', { class: `btn big ${resumable ? '' : 'primary'}`, id: 'btnNew', onClick: newGame }, 'Nouvelle partie'),
      h('button', { class: 'btn big ghost', id: 'btnRules', onClick: () => ctx.go('rules') }, 'Règles'),
      h('p', { class: 'hint' }, '4 à 8 joueurs · hors ligne · sans compte')));
}
