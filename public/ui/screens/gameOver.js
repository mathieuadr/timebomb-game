// Écran 7 — fin de partie : trois dénouements distincts.
import { h } from '../dom.js';
import { sceneArt, rolePortrait } from '../art.js';
import { badgeChip } from '../components.js';
import { ROLE_TEXT, TEAM_LABEL, BADGE_LABEL } from '../texts.js';
import { publicView, finalReveal } from '../../state/privacy.js';
import { createGame } from '../../engine/game.js';
import { rng } from '../../state/store.js';

function story(view) {
  const by = view.players[view.endedBy].name;
  const from = view.players[view.log.at(-1).from].name;
  if (view.winner === 'tech') {
    return { mood: 'safe', kicker: 'Réacteur stabilisé', title: 'Victoire des Techniciens', text: `${by} coupe la dernière dérivation chez ${from}. L’aurore revient sur la station.` };
  }
  if (view.winner === 'solo') {
    return {
      mood: 'solo', kicker: 'Coup de maître', title: `${by} gagne en solitaire`,
      text: view.reason === 'overload'
        ? `${by} était l’Électron libre… et a déclenché lui-même la Surcharge chez ${from}.`
        : `${by} était l’Électron libre… et a coupé lui-même la dernière dérivation chez ${from}.`,
    };
  }
  if (view.reason === 'overload') {
    return { mood: 'boom', kicker: 'Surcharge !', title: 'Victoire des Saboteurs', text: `${by} coupe la Surcharge chez ${from}. Le réacteur explose.` };
  }
  return { mood: 'boom', kicker: 'Trop tard…', title: 'Victoire des Saboteurs', text: 'La 4ᵉ manche s’achève sans que toutes les dérivations soient trouvées. Le réacteur lâche.' };
}

export function gameOverScreen(ctx) {
  const { store, ui } = ctx;
  const view = publicView(store.game);
  const s = story(view);

  if (!ui.overPlayed) {
    ui.overPlayed = true;
    setTimeout(() => (view.winner === 'tech' ? ctx.sound.win() : view.winner === 'solo' ? ctx.sound.solo() : view.reason === 'timeout' ? ctx.sound.timeout() : ctx.sound.overload()), 250);
  }

  const revealBox = h('div', { class: 'reveal-roles', id: 'rolesReveal' });
  const revealBtn = h('button', { class: 'btn big', id: 'btnRevealRoles' }, 'Révéler les rôles');
  revealBtn.addEventListener('click', () => {
    ctx.sound.flip();
    const final = finalReveal(store.game);
    const row = (name, r, extra = '') => h('div', { class: `role-row team-${r.team} ${extra}` },
      h('span', { class: 'rr-portrait', html: rolePortrait(r.role, r.char) }),
      h('span', { class: 'rr-text' }, h('b', null, name), h('small', null, ROLE_TEXT[r.role].name)),
      r.badge ? badgeChip(r.badge, BADGE_LABEL[r.badge]) : null);
    revealBox.replaceChildren(
      ...final.players.map((p) => row(p.name, p, p.team === view.winner ? 'won' : '')),
      ...final.undealt.map((r) => row('Carte non distribuée', r, 'undealt')));
    revealBtn.remove();
  });

  function replay() {
    const names = view.players.map((p) => p.name);
    const firstPlayer = Math.floor(rng() * names.length);
    const game = createGame({ names, comp: view.comp, firstPlayer }, rng);
    ctx.startGame(game, `Nouvelle partie : ${names[firstPlayer]} commence avec la pince.`);
  }

  const fx = s.mood === 'boom'
    ? h('div', { class: 'fx fx-boom', 'aria-hidden': 'true' }, h('i', { class: 'flash' }), h('i', { class: 'ring r1' }), h('i', { class: 'ring r2' }), h('i', { class: 'ring r3' }),
      Array.from({ length: 14 }, (_, i) => h('i', { class: 'debris', style: { '--a': `${(i * 360) / 14 + (i % 2) * 9}deg`, '--d': `${90 + (i % 5) * 28}px`, '--t': `${0.9 + (i % 4) * 0.18}s` } })))
    : h('div', { class: `fx fx-sparks ${s.mood}`, 'aria-hidden': 'true' }, s.mood === 'solo' ? h('i', { class: 'flash violet' }) : null,
      Array.from({ length: 16 }, (_, i) => h('i', { class: 'spark', style: { left: `${6 + ((i * 37) % 88)}%`, '--t': `${2.6 + (i % 5) * 0.5}s`, '--w': `${(i % 4) * 0.6}s` } })));

  return h('section', { class: `screen over ${s.mood} win-${view.winner}`, 'data-winner': view.winner, 'data-reason': view.reason },
    h('div', { class: 'over-art', html: sceneArt(s.mood), 'aria-hidden': 'true' }),
    fx,
    h('div', { class: 'over-main' },
      h('p', { class: 'over-kicker' }, s.kicker),
      h('h1', { class: 'over-title', id: 'overTitle' }, s.title),
      h('p', { class: 'over-text' }, s.text)),
    h('div', { class: 'stat-grid' },
      h('div', { class: 'card glass stat-card' }, h('b', null, `${view.round}/${view.rounds}`), h('small', null, 'manches jouées')),
      h('div', { class: 'card glass stat-card' }, h('b', null, String(view.log.length)), h('small', null, 'câbles coupés')),
      h('div', { class: 'card glass stat-card aurora' }, h('b', null, `${view.found}/${view.total}`), h('small', null, 'dérivations'))),
    h('div', { class: 'card glass' },
      h('div', { class: 'lbl' }, 'Qui était qui ?'),
      h('p', { class: 'hint left' }, `Vainqueur : ${view.winner === 'solo' ? 'l’Électron libre' : `les ${TEAM_LABEL[view.winner]}`}.`),
      revealBox, revealBtn),
    h('div', { class: 'bottom-actions static' },
      h('button', { class: 'btn primary big', id: 'btnReplay', onClick: replay }, 'Rejouer avec les mêmes joueurs'),
      h('button', { class: 'btn big', id: 'btnNewSetup', onClick: () => { store.clearGame(); ctx.go('setup'); } }, 'Changer les réglages'),
      h('button', { class: 'btn big ghost', id: 'btnHome', onClick: () => { store.clearGame(); ctx.go('home'); } }, 'Accueil')));
}

