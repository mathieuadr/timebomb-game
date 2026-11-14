// Découverte du rôle, puis consultation des câbles : chacun sur son propre téléphone.
//
// Le secret n'est jamais affiché d'office : le joueur le révèle quand personne ne regarde son
// écran, puis le cache. Quand il a terminé, il confirme ; l'écran affiche alors qui est prêt.

import { h, art, plural, dur, sleep } from '../dom.js';
import { ICON, badgeArt } from '../art.js';
import { wireCard, roleCard, roleCardBack, badgeChip, pips } from '../components.js';
import { BADGE_LABEL } from '../texts.js';

/** État d'affichage local (révélé ou non), remis à zéro à chaque nouvelle étape. */
function local(ctx) {
  const { room } = ctx.net;
  const key = `${room.gameId}|${room.game.phase}|${room.game.round}`;
  if (ctx.ui.secret?.key !== key) ctx.ui.secret = { key, shown: false, animated: false, peek: false, busy: false };
  return ctx.ui.secret;
}

export function secretScreen(ctx) {
  const { net } = ctx;
  const g = net.room.game;
  const priv = net.priv;
  const seat = net.seat;
  const roles = g.phase === 'roles';
  const header = h('header', { class: 'topbar' },
    h('span', { class: 'topbar-space' }),
    h('div', { class: 'pass-step' }, roles ? 'Distribution des rôles' : `Manche ${g.round} · tes câbles`),
    h('button', { class: 'icon-btn', 'aria-label': 'Menu', html: ICON.menu, onClick: () => ctx.openMenu() }));

  if (!priv || priv.seat !== seat || (!roles && !g.ready[seat] && !priv.hand)) {
    return h('section', { class: 'screen secret-wait' }, header,
      h('div', { class: 'handoff-main' },
        h('div', { class: 'spinner', 'aria-hidden': 'true' }),
        h('p', { class: 'handoff-note' }, 'Réception de tes informations secrètes…')));
  }
  if (g.ready[seat]) return waitingScreen(ctx, header, roles);
  return roles ? roleStage(ctx, header) : wiresStage(ctx, header);
}

// ───────────────────────────────────────────── Rôle

function roleStage(ctx, header) {
  const { net } = ctx;
  const priv = net.priv;
  const st = local(ctx);
  const solo = priv.role.team === 'solo' && priv.badges !== 'off';
  const card = st.shown ? roleCard(priv.role) : roleCardBack();
  if (st.shown) { if (st.popped) card.classList.add('noanim'); st.popped = true; } else st.popped = false;
  const extra = h('div', { class: 'secret-extra' });
  if (st.shown && solo) {
    const pick = (color) => h('button', {
      class: `badge-pick ${color} ${priv.role.badge === color ? 'sel' : ''}`, 'data-badge': color,
      onClick: () => { ctx.sound.select(); net.send({ t: 'badge', badge: color }); },
    }, art(badgeArt(color)), `Badge ${BADGE_LABEL[color]}`);
    extra.append(
      h('p', { class: 'badge-ask' }, priv.role.badge ? 'Tu peux encore changer d’avis :' : 'Choisis le badge que tu montreras aux autres :'),
      h('div', { class: 'badge-picks' }, pick('blue'), pick('orange')));
  }
  const toggle = h('button', {
    class: `btn big ${st.shown ? 'ghost' : 'primary'}`, id: 'btnReveal',
    onClick: () => { ctx.sound.flip(); st.shown = !st.shown; st.seen = st.seen || st.shown; ctx.render(true); },
  }, st.shown ? 'Cacher ma carte' : (st.seen ? 'Revoir ma carte' : 'Révéler mon rôle'));
  const done = h('button', {
    class: `btn big ${st.shown ? 'primary' : ''}`, id: 'btnDone', disabled: !st.seen || priv.needBadge || st.busy,
    onClick: async () => {
      st.busy = true; st.shown = false; ctx.render(true);
      ctx.sound.tap();
      if (!(await net.send({ t: 'ackRole' }))) { st.busy = false; ctx.render(true); }
    },
  }, priv.needBadge && st.seen ? 'Choisis ton badge' : 'C’est noté, je suis prêt·e');

  return h('section', { class: 'screen secret', 'data-stage': 'role' }, header,
    h('div', { class: 'secret-main' },
      h('p', { class: 'secret-lead' }, st.shown ? 'Garde ton écran pour toi.' : 'Vérifie que personne ne regarde ton écran.'),
      h('div', { class: 'secret-slot' }, card), extra),
    h('div', { class: 'bottom-actions' }, toggle, done));
}

// ───────────────────────────────────────────── Câbles

function wiresStage(ctx, header) {
  const { net } = ctx;
  const priv = net.priv;
  const g = net.room.game;
  const st = local(ctx);
  const count = priv.hand.kinds.length;
  const row = h('div', { class: `wire-row n${count}`, id: 'myWires' });
  const info = h('div', { class: 'secret-extra' });
  if (st.shown) {
    const animate = !st.animated;
    st.animated = true;
    row.append(...priv.hand.kinds.map((kind, i) => {
      const card = wireCard({ kind, flipped: !animate });
      if (animate) setTimeout(() => card.classList.add('flipped'), dur(90) * i + 30);
      return card;
    }));
    const c = priv.hand.counts;
    info.append(h('div', { class: 'tags', id: 'handSummary' },
      c.overload ? h('span', { class: 'tag overload' }, 'La Surcharge !') : null,
      h('span', { class: 'tag bypass' }, plural(c.bypass, 'dérivation')),
      h('span', { class: 'tag inert' }, plural(c.inert, 'câble inerte', 'câbles inertes'))));
    if (priv.neighbor) {
      info.append(h('div', { class: 'neighbor', id: 'neighborBadge' },
        badgeChip(priv.neighbor.badge, `${priv.neighbor.name}, à ta droite, porte un badge ${BADGE_LABEL[priv.neighbor.badge]}`)));
    }
  } else {
    row.append(...Array.from({ length: count }, () => wireCard()));
  }
  const toggle = h('button', {
    class: `btn big ${st.shown ? 'ghost' : 'primary'}`, id: 'btnReveal',
    onClick: () => { ctx.sound.flip(); st.shown = !st.shown; st.seen = st.seen || st.shown; if (!st.shown) st.animated = false; ctx.render(true); },
  }, st.shown ? 'Cacher' : (st.seen ? 'Revoir mes câbles' : 'Révéler mes câbles'));
  const mix = h('button', {
    class: `btn big ${st.shown ? 'primary' : ''}`, id: 'btnMix', disabled: !st.seen || st.busy,
    onClick: async () => {
      st.busy = true; st.shown = false;
      ctx.sound.shuffle();
      row.replaceChildren(...Array.from({ length: count }, () => wireCard()));
      info.replaceChildren();
      row.classList.add('shuffling');
      const sent = net.send({ t: 'ackInspect' });
      await sleep(dur(650));
      if (!(await sent)) st.busy = false;
      ctx.render(true);
    },
  }, 'Mélanger et cacher');

  return h('section', { class: 'screen secret', 'data-stage': 'wires' }, header,
    h('div', { class: 'secret-main' },
      h('p', { class: 'secret-lead' }, `Tes ${count} câbles pour la manche ${g.round}`),
      row, info,
      h('p', { class: 'handoff-note' }, 'Retiens ce que tu as : une fois mélangés, plus personne ne saura où ils sont, pas même toi.')),
    h('div', { class: 'bottom-actions' }, toggle, mix));
}

// ───────────────────────────────────────────── En attente des autres

function waitingScreen(ctx, header, roles) {
  const { net } = ctx;
  const room = net.room;
  const g = room.game;
  const st = local(ctx);
  const readyCount = g.ready.filter(Boolean).length;
  const list = room.members.map((m, i) => {
    const ok = g.ready[i];
    const off = !m.online;
    return h('li', { class: `wait-row ${ok ? 'ok' : ''} ${off ? 'off' : ''}`.trim(), 'data-seat': String(i) },
      h('span', { class: 'wait-ic', html: ok ? ICON.check : '' }, ok ? null : h('span', { class: 'spinner xs' })),
      h('span', { class: 'm-name' }, m.name, m.id === net.id ? h('span', { class: 'tag-mini' }, 'toi') : null, off ? h('span', { class: 'tag-mini warn' }, 'hors ligne') : null),
      !ok && off && net.isHost ? h('button', {
        class: 'btn sm', 'data-force': String(i),
        onClick: () => net.send({ t: 'force', seat: i }),
      }, 'Continuer sans attendre') : null);
  });
  const mine = st.peek ? roleCard(net.priv.role) : null;
  if (mine) { if (st.popped) mine.classList.add('noanim'); st.popped = true; } else st.popped = false;
  return h('section', { class: 'screen waiting' }, header,
    h('div', { class: 'wait-head' },
      h('h1', null, 'En attente des autres…'),
      h('p', { class: 'muted' }, roles ? 'Chacun découvre son rôle sur son téléphone.' : 'Chacun consulte ses câbles sur son téléphone.'),
      pips(readyCount, g.n, 'big')),
    h('ol', { class: 'card glass wait-list', id: 'waitList' }, list),
    net.isHost && room.members.some((m, i) => !g.ready[i] && !m.online)
      ? h('p', { class: 'hint' }, 'Un joueur hors ligne bloque la partie : tu peux continuer sans lui. Il retrouvera la partie en revenant.')
      : null,
    mine ? h('div', { class: 'secret-slot' }, mine) : null,
    h('div', { class: 'bottom-actions' },
      h('button', { class: 'btn big ghost', id: 'btnPeek', onClick: () => { st.peek = !st.peek; ctx.render(true); } }, st.peek ? 'Cacher mon rôle' : 'Revoir mon rôle')));
}
