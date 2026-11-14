// La table : joueurs autour du réacteur, pince, coupe d'un câble.
// Tous les téléphones affichent la même table ; seul celui qui tient la pince peut couper.

import { h, art, sleep, dur } from '../dom.js';
import { ICON, reactorArt } from '../art.js';
import { wireCard, flipToFace, openSheet, pips, toast, roleCard, badgeChip } from '../components.js';
import { WIRE_LABEL, BADGE_LABEL } from '../texts.js';

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

/** Peut-on couper depuis ce téléphone ? (porteur de la pince, ou hôte qui remplace un absent) */
export function canCut(net) {
  const g = net.room.game;
  if (g.phase !== 'play') return false;
  if (net.seat === g.holder) return true;
  const holder = net.room.members[g.holder];
  return net.isHost && !holder.online;
}

export function tableScreen(ctx) {
  const { net } = ctx;
  const room = net.room;
  const view = room.game;
  const me = net.seat;
  const holder = view.players[view.holder];
  const holderMember = room.members[view.holder];
  const mine = me === view.holder;
  const standIn = !mine && canCut(net); // l'hôte joue pour un joueur hors ligne
  const layout = seatLayout(view.n);
  const aim = room.aim;

  function pick(i) {
    const p = view.players[i];
    if (!canCut(net)) {
      ctx.sound.error();
      toast(`C’est ${holder.name} qui tient la pince.`);
      return;
    }
    if (i === view.holder) { ctx.sound.error(); toast(mine ? 'On ne coupe jamais ses propres câbles.' : `${holder.name} ne peut pas couper ses propres câbles.`, { tone: 'warn' }); return; }
    if (!p.hidden) { ctx.sound.error(); toast(`${p.name} n’a plus de câble caché.`, { tone: 'warn' }); return; }
    ctx.sound.tap();
    openTarget(ctx, i);
  }

  const seat = (i) => {
    const p = view.players[i];
    const m = room.members[i];
    const isHolder = i === view.holder;
    const aimed = aim && aim.target === i;
    const cls = ['seat', isHolder ? 'holder' : '', canCut(net) && !isHolder && p.hidden ? 'pickable' : '', !p.hidden ? 'empty' : '',
      i === me ? 'me' : '', aimed ? 'aimed' : '', m.online ? '' : 'off'].filter(Boolean).join(' ');
    return h('button', {
      class: cls, 'data-seat': String(i),
      'aria-label': `${p.name}${i === me ? ' (toi)' : ''}, ${p.hidden} câble${p.hidden > 1 ? 's' : ''} caché${p.hidden > 1 ? 's' : ''}${isHolder ? ', tient la pince' : ''}${m.online ? '' : ', hors ligne'}`,
      onClick: () => pick(i),
    },
      h('span', { class: 'seat-head' },
        p.badge ? h('span', { class: `bdot ${p.badge}`, title: `Badge ${BADGE_LABEL[p.badge]}` }) : null,
        h('span', { class: 'nm' }, p.name),
        i === me ? h('span', { class: 'you' }, 'toi') : null,
        m.online ? null : h('span', { class: 'offdot', title: 'Hors ligne' })),
      h('span', { class: 'minis' }, p.wires.map((w, slot) => h('i', { class: w.cut ? `mini cut ${w.kind}` : `mini${aimed && aim.slot === slot ? ' aim' : ''}` }))),
      isHolder ? h('span', { class: 'pince-tag', html: ICON.pince }) : null);
  };

  let who;
  if (mine) {
    who = [h('div', { class: 'turn-name' }, h('b', { id: 'holderName' }, 'À toi'), ' de couper !'),
      h('div', { class: 'turn-hint' }, 'Touche un autre joueur pour choisir un de ses câbles')];
  } else if (standIn) {
    who = [h('div', { class: 'turn-name' }, h('b', { id: 'holderName' }, holder.name), ' est hors ligne'),
      h('div', { class: 'turn-hint' }, 'Tu es l’hôte : coupe à sa place pour débloquer la table')];
  } else {
    who = [h('div', { class: 'turn-name' }, h('b', { id: 'holderName' }, holder.name), ' tient la pince'),
      h('div', { class: 'turn-hint' }, holderMember.online
        ? (aim ? `${holder.name} vise un câble de ${view.players[aim.target].name}…` : 'Discutez : c’est lui ou elle qui choisit.')
        : 'Hors ligne : l’hôte peut couper à sa place')];
  }

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

    h('footer', { class: `turnbar ${mine ? 'mine' : ''} ${standIn ? 'standin' : ''}`.trim() },
      h('div', { class: 'turn-who' }, h('span', { class: 'pince-big', html: ICON.pince }), h('div', null, who)),
      h('div', { class: 'turn-tools' },
        h('button', { class: 'icon-btn', id: 'btnHistory', 'aria-label': `Câbles coupés : ${view.log.length}`, html: ICON.history, onClick: () => openHistory(view) }),
        h('button', { class: 'btn sm', id: 'btnMyRole', onClick: () => openMyRole(ctx) }, 'Mon rôle'))));
}

// ───────────────────────────────────────────── Choix du câble

function openTarget(ctx, target) {
  const { net } = ctx;
  const view = net.room.game;
  const p = view.players[target];
  const cutter = view.players[view.holder].name;
  const mine = net.seat === view.holder;
  let selected = null;
  let done = false;
  net.send({ t: 'aim', target, slot: null });
  const cutBtn = h('button', { class: 'btn primary big', id: 'btnCut', disabled: true }, h('span', { class: 'btn-ic', html: ICON.pince }), 'Couper ce câble');
  const cards = p.wires.map((w, slot) => {
    if (w.cut) return h('div', { class: 'slot done', 'data-slot': String(slot) }, wireCard({ kind: w.kind, flipped: true }));
    const btn = h('button', { class: 'slot', 'data-slot': String(slot), 'aria-label': `Câble caché numéro ${slot + 1}`, 'aria-pressed': 'false' }, wireCard());
    btn.addEventListener('click', () => {
      ctx.sound.select();
      selected = selected === slot ? null : slot;
      cards.forEach((c) => { const on = Number(c.dataset.slot) === selected; c.classList.toggle('sel', on); if (c.tagName === 'BUTTON') c.setAttribute('aria-pressed', String(on)); });
      cutBtn.disabled = selected === null;
      net.send({ t: 'aim', target, slot: selected });
    });
    return btn;
  });

  const sheet = openSheet(
    h('div', { class: 'target' },
      h('p', { class: 'target-lead' }, mine ? 'Choisis le câble à couper. Tout le monde voit ce que tu vises ; tu peux encore changer d’avis.' : `Tu coupes à la place de ${cutter}, hors ligne.`),
      h('div', { class: `wire-row n${p.wires.length}`, id: 'targetWires' }, cards),
      h('div', { class: 'btn-col' },
        cutBtn,
        h('button', { class: 'btn big ghost', id: 'btnOther', onClick: () => sheet.close() }, 'Choisir un autre joueur'))),
    {
      title: `Câbles de ${p.name}`, cls: 'target-sheet',
      onClose: () => { if (!done) net.send({ t: 'aim', target: null }); },
    });

  cutBtn.addEventListener('click', async () => {
    if (selected === null || cutBtn.disabled) return;
    cutBtn.disabled = true;
    done = true;
    cutBtn.lastChild.textContent = 'Coupe en cours…';
    const ok = await net.send({ t: 'cut', target, slot: selected });
    if (ok) sheet.close();
    else { done = false; cutBtn.disabled = false; cutBtn.lastChild.textContent = 'Couper ce câble'; }
  });
}

// ───────────────────────────────────────────── Révélation (sur tous les téléphones)

let current = null;

/** Joue l'animation d'un câble coupé. `room` est l'état public juste après la coupe. */
export async function showReveal(ctx, room) {
  const { net } = ctx;
  const view = room.game;
  const event = view.log.at(-1);
  if (current) current.remove();
  const byName = view.players[event.by].name;
  const fromName = view.players[event.from].name;
  const meCut = net.seat === event.by;
  const meNext = net.seat === event.from;
  const kind = event.kind;

  const card = wireCard({ cls: 'big' });
  const title = h('h2', { class: 'rv-title', id: 'revealTitle' });
  const sub = h('p', { class: 'rv-sub' });
  const then = h('p', { class: 'rv-then' });
  const btn = h('button', { class: 'btn primary big', id: 'btnContinue' }, 'Continuer');
  const overlay = h('div', { class: 'reveal', id: 'reveal', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Câble coupé' },
    h('div', { class: 'rv-fx' }),
    h('p', { class: 'rv-lead' }, ...(meNext
      ? [h('b', null, byName), ' coupe un de tes câbles…']
      : [h('b', null, meCut ? 'Tu' : byName), meCut ? ' coupes un câble de ' : ' coupe un câble de ', h('b', null, fromName), '…'])),
    h('div', { class: 'rv-stage' }, card, h('div', { class: 'snip', html: ICON.pince })),
    h('div', { class: 'rv-result' }, title, sub, then, btn));
  current = overlay;
  const close = () => { if (overlay.isConnected) overlay.remove(); if (current === overlay) current = null; };
  btn.addEventListener('click', () => { ctx.sound.tap(); close(); });
  document.getElementById('fx').append(overlay);

  await sleep(dur(260));
  overlay.classList.add('cutting');
  ctx.sound.snip();
  await sleep(dur(430));
  flipToFace(card, kind);
  await sleep(dur(520));
  if (!overlay.isConnected) return;

  title.textContent = kind === 'overload' ? 'Surcharge !' : kind === 'bypass' ? 'Dérivation !' : WIRE_LABEL.inert;
  if (kind === 'overload') { sub.textContent = 'Le réacteur s’emballe…'; ctx.sound.overload(); }
  else if (kind === 'bypass') { sub.textContent = `${view.found} sur ${view.total} trouvées.`; ctx.sound.bypass(); }
  else { sub.textContent = 'Il ne se passe rien.'; ctx.sound.inert(); }

  if (view.phase === 'over') then.textContent = kind === 'inert' ? 'C’était la dernière coupe de la partie.' : '';
  else if (view.phase === 'roundEnd') then.textContent = `La manche ${view.round} est terminée.`;
  else if (meNext) { then.replaceChildren(h('b', null, 'La pince est pour toi !')); btn.textContent = 'À moi de jouer'; try { navigator.vibrate?.([60, 40, 120]); } catch { /* sans vibreur */ } }
  else then.replaceChildren('La pince passe à ', h('b', null, fromName), '.');
  overlay.classList.add('shown', kind);
  // se ferme tout seul : personne n'a besoin de toucher l'écran pour que la partie continue
  setTimeout(close, kind === 'inert' ? dur(2600) : dur(3600));
}

// ───────────────────────────────────────────── Mon rôle, historique

export function openMyRole(ctx) {
  const priv = ctx.net.priv;
  if (!priv) return;
  openSheet(h('div', { class: 'myrole' },
    roleCard(priv.role),
    priv.neighbor ? h('div', { class: 'neighbor' }, badgeChip(priv.neighbor.badge, `${priv.neighbor.name}, à ta droite, porte un badge ${BADGE_LABEL[priv.neighbor.badge]}`)) : null,
    h('p', { class: 'hint' }, 'Garde ton écran pour toi.')), { title: 'Mon rôle', cls: 'tall' });
}

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
