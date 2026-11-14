// Écran 6 — transition entre deux manches (public).
import { h, art, plural } from '../dom.js';
import { ICON, reactorArt } from '../art.js';
import { WIRE_LABEL } from '../texts.js';
import { publicView } from '../../state/privacy.js';
import { nextRound } from '../../engine/game.js';
import { handSize } from '../../engine/rules.js';
import { rng } from '../../state/store.js';

export function roundEndScreen(ctx) {
  const { store } = ctx;
  const view = publicView(store.game);
  const cuts = view.log.filter((e) => e.round === view.round);
  const foundNow = cuts.filter((e) => e.kind === 'bypass').length;
  const next = view.players[view.holder].name;
  const size = handSize(view.round + 1);

  return h('section', { class: 'screen roundend' },
    h('header', { class: 'topbar' },
      h('span', { class: 'topbar-space' }),
      h('div', { class: 'pass-step' }, 'Fin de manche'),
      h('button', { class: 'icon-btn', 'aria-label': 'Menu', html: ICON.menu, onClick: () => ctx.openMenu() })),
    h('div', { class: 're-head' },
      art(reactorArt(view.found, view.total, 'idle'), 're-reactor'),
      h('div', null,
        h('h1', { id: 'roundEndTitle' }, `Manche ${view.round} terminée`),
        h('p', { class: 'muted' }, foundNow
          ? `${plural(foundNow, 'dérivation')} ${foundNow > 1 ? 'trouvées' : 'trouvée'} pendant cette manche.`
          : 'Aucune dérivation trouvée pendant cette manche.'))),
    h('div', { class: 'stat-grid' },
      h('div', { class: 'card glass stat-card aurora' }, h('b', { id: 'reFound' }, `${view.found}/${view.total}`), h('small', null, 'dérivations trouvées')),
      h('div', { class: 'card glass stat-card' }, h('b', { id: 'reHidden' }, String(view.hidden)), h('small', null, 'câbles encore en jeu')),
      h('div', { class: 'card glass stat-card' }, h('b', null, String(view.rounds - view.round)), h('small', null, view.rounds - view.round > 1 ? 'manches restantes' : 'manche restante'))),
    h('div', { class: 'card glass' },
      h('div', { class: 'lbl' }, 'Coupes de la manche'),
      cuts.map((e) => h('div', { class: 'hist-row' },
        h('span', { class: 'hist-who' }, view.players[e.by].name, h('span', { class: 'hist-ic', html: ICON.pince }), view.players[e.from].name),
        h('span', { class: `tag ${e.kind}` }, WIRE_LABEL[e.kind])))),
    h('div', { class: 'card glass next-card' },
      h('span', { class: 'pince-big', html: ICON.pince }),
      h('div', null,
        h('div', null, h('b', { id: 'nextStarter' }, next), ` commence la manche ${view.round + 1}.`),
        h('small', { class: 'muted' }, `Les câbles restants sont ramassés, mélangés, puis redistribués : ${size} par joueur.`))),
    h('div', { class: 'bottom-actions' },
      h('button', {
        class: 'btn primary big', id: 'btnDeal',
        onClick: () => {
          ctx.sound.shuffle();
          store.setGame(nextRound(store.game, rng));
          ctx.ui.pass = { stage: 'handoff' };
          ctx.render();
        },
      }, 'Ramasser et redistribuer')));
}
