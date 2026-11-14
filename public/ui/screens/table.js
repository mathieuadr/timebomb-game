// Écran 5 — la table : joueurs autour du réacteur, pince, coupe d'un câble.
// Cet écran est public : il ne reçoit que publicView().

import { h, art, sleep, dur } from '../dom.js';
import { ICON, reactorArt } from '../art.js';
import { wireCard, flipToFace, openSheet, pips, toast } from '../components.js';
import { WIRE_LABEL } from '../texts.js';
import { publicView } from '../../state/privacy.js';
import { cut } from '../../engine/game.js';

/** Places autour de la table, dans le sens des aiguilles d'une montre en partant du haut. */
function seatLayout(n) {
  switch (n) {
    case 4: return { top: null, right: [0, 1], left: [3, 2] };
    case 5: return { top: 0, right: [1, 2], left: [4, 3] };
    case 6: return { top: null, right: [0, 1, 2], left: [5, 4, 3] };
    case 7: return { top: 0, right: [1, 2, 3], left: [6, 5, 4] };
    default: return { top: null, right: [0, 1, 2, 3], left: [7, 6, 5, 4] };
  }
}

export function tableScreen(ctx) {
  const { store } = ctx;
  const view = publicView(store.game);
  const holder = view.players[view.holder];
  const layout = seatLayout(view.n);

  function pick(i) {
    const p = view.players[i];
    if (i === view.holder) { ctx.sound.error(); toast(`${p.name} tient la pince : on ne coupe jamais ses propres câbles.`, { tone: 'warn' }); return; }
    if (!p.hidden) { ctx.sound.error(); toast(`${p.name} n’a plus de câble caché.`, { tone: 'warn' }); return; }
    ctx.sound.tap();
    openTarget(ctx, view, i);
  }

  const seat = (i) => {
    const p = view.players[i];
    const isHolder = i === view.holder;
    const cls = ['seat', isHolder ? 'holder' : '', !isHolder && p.hidden ? 'pickable' : '', !p.hidden ? 'empty' : ''].filter(Boolean).join(' ');
    return h('button', {
      class: cls, 'data-seat': String(i),
      'aria-label': `${p.name}, ${p.hidden} câble${p.hidden > 1 ? 's' : ''} caché${p.hidden > 1 ? 's' : ''}${isHolder ? ', tient la pince' : ''}`,
      onClick: () => pick(i),
    },
      h('span', { class: 'seat-head' },
        p.badge ? h('span', { class: `bdot ${p.badge}`, title: `Badge ${p.badge === 'blue' ? 'bleu' : 'orange'}` }) : null,
        h('span', { class: 'nm' }, p.name)),
      h('span', { class: 'minis' }, p.wires.map((w) => h('i', { class: w.cut ? `mini cut ${w.kind}` : 'mini' }))),
      isHolder ? h('span', { class: 'pince-tag', html: ICON.pince }) : null);
  };

  return h('section', { class: `screen table n${view.n}` },
    h('header', { class: 'hud' },
      h('div', { class: 'stat', id: 'hudRound' }, h('small', null, 'Manche'), h('b', null, String(view.round), h('span', null, `/${view.rounds}`)), pips(view.round, view.rounds)),
      h('div', { class: 'stat', id: 'hudCuts' }, h('small', null, 'Coupes'), h('b', null, String(view.cuts), h('span', null, `/${view.n}`)), pips(view.cuts, view.n)),
      h('div', { class: 'stat found', id: 'hudFound' }, h('small', null, 'Dérivations'), h('b', null, String(view.found), h('span', null, `/${view.total}`)), pips(view.found, view.total, 'aurora')),
      h('button', { class: 'icon-btn', id: 'btnMenu', 'aria-label': 'Menu', html: ICON.menu, onClick: () => ctx.openMenu() })),

    h('div', { class: 'arena' },
      layout.top != null ? h('div', { class: 'seat-top' }, seat(layout.top)) : null,
      h('div', { class: 'col col-left' }, layout.left.map(seat)),
      h('div', { class: 'center', 'aria-label': `Réacteur : ${view.found} dérivations trouvées sur ${view.total}` },
        art(reactorArt(view.found, view.total, 'idle'), 'reactor-art')),
      h('div', { class: 'col col-right' }, layout.right.map(seat))),

    h('footer', { class: 'turnbar' },
      h('div', { class: 'turn-who' },
        h('span', { class: 'pince-big', html: ICON.pince }),
        h('div', null,
          h('div', { class: 'turn-name' }, h('b', { id: 'holderName' }, holder.name), ' tient la pince'),
          h('div', { class: 'turn-hint' }, 'Touche un autre joueur pour couper un de ses câbles'))),
      h('button', { class: 'btn sm', id: 'btnHistory', onClick: () => openHistory(view) },
        h('span', { class: 'btn-ic', html: ICON.history }), `Coupés · ${view.log.length}`)));
}

// ───────────────────────────────────────────── Choix du câble

function openTarget(ctx, view, target) {
  const { store } = ctx;
  const p = view.players[target];
  const holder = view.players[view.holder];
  let selected = null;
  const cutBtn = h('button', { class: 'btn primary big', id: 'btnCut', disabled: true },
    h('span', { class: 'btn-ic', html: ICON.pince }), 'Couper ce câble');
  const cards = p.wires.map((w, slot) => {
    if (w.cut) return h('div', { class: 'slot done', 'data-slot': String(slot) }, wireCard({ kind: w.kind, flipped: true }));
    const btn = h('button', { class: 'slot', 'data-slot': String(slot), 'aria-label': `Câble caché numéro ${slot + 1}`, 'aria-pressed': 'false' }, wireCard());
    btn.addEventListener('click', () => {
      ctx.sound.select();
      selected = selected === slot ? null : slot;
      cards.forEach((c) => { const on = Number(c.dataset.slot) === selected; c.classList.toggle('sel', on); if (c.tagName === 'BUTTON') c.setAttribute('aria-pressed', String(on)); });
      cutBtn.disabled = selected === null;
    });
    return btn;
  });

  const sheet = openSheet(
    h('div', { class: 'target' },
      h('p', { class: 'target-lead' }, h('b', null, holder.name), ', choisis le câble à couper. Tu peux encore changer d’avis.'),
      h('div', { class: `wire-row n${p.wires.length}`, id: 'targetWires' }, cards),
      h('div', { class: 'btn-col' },
        cutBtn,
        h('button', { class: 'btn big ghost', id: 'btnOther', onClick: () => sheet.close() }, 'Choisir un autre joueur'))),
    { title: `Câbles de ${p.name}`, cls: 'target-sheet' });

  cutBtn.addEventListener('click', () => {
    if (selected === null || cutBtn.disabled) return;
    cutBtn.disabled = true;
    const next = cut(store.game, target, selected);
    store.setGame(next); // enregistré avant toute animation : une coupe confirmée ne s'annule pas
    sheet.close();
    reveal(ctx, view, next);
  });
}

// ───────────────────────────────────────────── Révélation

async function reveal(ctx, before, next) {
  const event = next.log.at(-1);
  const after = publicView(next);
  const byName = before.players[event.by].name;
  const fromName = before.players[event.from].name;
  const kind = event.kind;

  const card = wireCard({ cls: 'big' });
  const title = h('h2', { class: 'rv-title', id: 'revealTitle' });
  const sub = h('p', { class: 'rv-sub' });
  const then = h('p', { class: 'rv-then' });
  const btn = h('button', { class: 'btn primary big', id: 'btnContinue' });
  const overlay = h('div', { class: 'reveal', id: 'reveal', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Câble coupé' },
    h('div', { class: 'rv-fx' }),
    h('p', { class: 'rv-lead' }, h('b', null, byName), ' coupe un câble de ', h('b', null, fromName), '…'),
    h('div', { class: 'rv-stage' }, card, h('div', { class: 'snip', html: ICON.pince })),
    h('div', { class: 'rv-result' }, title, sub, then, btn));
  document.getElementById('layer').append(overlay);

  await sleep(dur(320));
  overlay.classList.add('cutting');
  ctx.sound.snip();
  await sleep(dur(430));
  flipToFace(card, kind);
  await sleep(dur(520));

  title.textContent = kind === 'overload' ? 'Surcharge !' : kind === 'bypass' ? 'Dérivation !' : WIRE_LABEL.inert;
  if (kind === 'overload') { sub.textContent = 'Le réacteur s’emballe…'; ctx.sound.overload(); }
  else if (kind === 'bypass') { sub.textContent = `${after.found} sur ${after.total} trouvées.`; ctx.sound.bypass(); }
  else { sub.textContent = 'Il ne se passe rien.'; ctx.sound.inert(); }

  if (after.phase === 'over') {
    then.textContent = kind === 'inert' ? 'C’était la dernière coupe de la partie.' : '';
    btn.textContent = 'Voir le résultat';
  } else if (after.phase === 'roundEnd') {
    then.textContent = `La manche ${after.round} est terminée.`;
    btn.textContent = 'Continuer';
  } else {
    then.append('La pince passe à ', h('b', null, fromName), '.');
    btn.textContent = `Donner le téléphone à ${fromName}`;
  }
  overlay.classList.add('shown', kind);
  btn.addEventListener('click', () => {
    ctx.sound.tap();
    overlay.remove();
    ctx.render();
  });
}

// ───────────────────────────────────────────── Historique des câbles coupés (public)

function openHistory(view) {
  const rounds = [];
  for (const e of view.log) (rounds[e.round] ||= []).push(e);
  const body = view.log.length
    ? rounds.map((list, round) => (list ? h('div', { class: 'hist-round' },
      h('div', { class: 'lbl' }, `Manche ${round}`),
      list.map((e) => h('div', { class: 'hist-row' },
        h('span', { class: 'hist-who' }, view.players[e.by].name, h('span', { class: 'hist-ic', html: ICON.pince }), view.players[e.from].name),
        h('span', { class: `tag ${e.kind}` }, WIRE_LABEL[e.kind])))) : null))
    : h('p', { class: 'hint' }, 'Aucun câble n’a encore été coupé.');
  openSheet(h('div', { class: 'history' }, body), { title: 'Câbles coupés' });
}
