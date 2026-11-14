// Écrans 3 et 4 — on se passe le téléphone : distribution des rôles, puis consultation des câbles.
//
// Règles de confidentialité appliquées ici :
//   • l'écran « neutre » ne montre qu'un prénom ;
//   • le contenu secret n'est créé dans la page qu'au moment où le joueur le demande,
//     et il est détruit dès qu'il le masque ;
//   • l'étape (neutre / secret) n'est jamais sauvegardée : après une actualisation ou un passage
//     en arrière-plan, on revient toujours à l'écran neutre.

import { h, art, sleep, dur, plural } from '../dom.js';
import { ICON, badgeArt } from '../art.js';
import { wireCard, roleCard, roleCardBack, badgeChip, pips } from '../components.js';
import { ROLE_TEXT, BADGE_LABEL } from '../texts.js';
import { publicView, roleSecret, handSecret } from '../../state/privacy.js';
import { ackRole, ackInspect, chooseBadge } from '../../engine/game.js';
import { TEAM, BADGES } from '../../engine/rules.js';
import { rng } from '../../state/store.js';

export function passScreen(ctx) {
  const { store, ui } = ctx;
  const view = publicView(store.game);
  const stage = ui.pass.stage;
  if (stage === 'done') return doneStage(ctx, view);
  const player = view.passPlayer;
  const name = view.players[player].name;
  const roles = view.phase === 'roles';
  if (stage === 'secret') return roles ? roleStage(ctx, view, player, name) : wiresStage(ctx, view, player, name);
  return handoffStage(ctx, view, name, roles);
}

// ───────────────────────────────────────────── Écran neutre

function handoffStage(ctx, view, name, roles) {
  const step = roles ? 'Distribution des rôles' : `Manche ${view.round} · consultation des câbles`;
  return h('section', { class: 'screen pass handoff', 'data-stage': 'handoff' },
    h('header', { class: 'topbar' },
      h('span', { class: 'topbar-space' }),
      h('div', { class: 'pass-step' }, step),
      h('button', { class: 'icon-btn', 'aria-label': 'Menu', html: ICON.menu, onClick: () => ctx.openMenu() })),
    h('div', { class: 'handoff-main' },
      h('div', { class: 'phone-ic', html: ICON.phone }),
      h('p', { class: 'handoff-lead' }, 'Passe le téléphone à'),
      h('h1', { class: 'handoff-name', id: 'handoffName' }, name),
      h('p', { class: 'handoff-note' }, 'Les autres joueurs ne regardent pas l’écran.'),
      pips(view.pass + 1, view.n, 'big'),
      h('p', { class: 'handoff-count' }, `Joueur ${view.pass + 1} sur ${view.n}`)),
    h('div', { class: 'bottom-actions' },
      h('button', {
        class: 'btn primary big', id: 'btnIam',
        onClick: () => { ctx.sound.tap(); ctx.ui.pass = { stage: 'secret' }; ctx.render(); },
      }, `Je suis ${name}`)));
}

// ───────────────────────────────────────────── Rôle

function roleStage(ctx, view, player, name) {
  const { store } = ctx;
  let seen = false;
  let shown = false;
  const slot = h('div', { class: 'secret-slot' }, roleCardBack());
  const extra = h('div', { class: 'secret-extra' });
  const reveal = h('button', { class: 'btn primary big', id: 'btnReveal' }, 'Révéler mon rôle');
  const hide = h('button', { class: 'btn big', id: 'btnHide', disabled: true }, 'Masquer et passer le téléphone');

  const needsBadge = () => {
    const s = roleSecret(store.game, player);
    return s.team === TEAM.SOLO && s.badges !== BADGES.OFF && !s.badge;
  };

  function show() {
    const secret = roleSecret(store.game, player);
    slot.replaceChildren(roleCard(secret));
    extra.replaceChildren();
    if (secret.team === TEAM.SOLO && secret.badges !== BADGES.OFF) {
      const pick = (color) => h('button', {
        class: `badge-pick ${color} ${secret.badge === color ? 'sel' : ''}`, 'data-badge': color,
        onClick: () => { ctx.sound.select(); store.setGame(chooseBadge(store.game, color)); show(); },
      }, art(badgeArt(color)), `Badge ${BADGE_LABEL[color]}`);
      extra.append(
        h('p', { class: 'badge-ask' }, secret.badge ? 'Tu peux encore changer d’avis :' : 'Choisis le badge que tu montreras aux autres :'),
        h('div', { class: 'badge-picks' }, pick('blue'), pick('orange')));
    }
    shown = true;
    seen = true;
    reveal.textContent = 'Cacher ma carte';
    reveal.className = 'btn big ghost';
    hide.className = 'btn primary big';
    hide.disabled = needsBadge();
  }
  function conceal() {
    slot.replaceChildren(roleCardBack());
    extra.replaceChildren();
    shown = false;
    reveal.textContent = 'Revoir ma carte';
  }

  reveal.addEventListener('click', () => { ctx.sound.flip(); if (shown) conceal(); else show(); });
  hide.addEventListener('click', () => {
    if (!seen || needsBadge()) return;
    conceal(); // la carte quitte la page avant tout changement d'écran
    ctx.sound.tap();
    store.setGame(ackRole(store.game));
    ctx.ui.pass = { stage: 'handoff' };
    ctx.render();
  });

  return h('section', { class: 'screen pass secret', 'data-stage': 'secret' },
    h('header', { class: 'topbar' },
      h('span', { class: 'topbar-space' }),
      h('div', { class: 'pass-step' }, h('span', { class: 'lock', html: ICON.eye }), `Pour ${name} seulement`),
      h('span', { class: 'topbar-space' })),
    h('div', { class: 'secret-main' }, slot, extra),
    h('div', { class: 'bottom-actions' }, reveal, hide));
}

// ───────────────────────────────────────────── Câbles

function wiresStage(ctx, view, player, name) {
  const { store } = ctx;
  const count = view.players[player].wires.length;
  const row = h('div', { class: `wire-row n${count}` }, Array.from({ length: count }, () => wireCard()));
  const info = h('div', { class: 'secret-extra' });
  const reveal = h('button', { class: 'btn primary big', id: 'btnReveal' }, 'Révéler mes câbles');
  const mix = h('button', { class: 'btn big', id: 'btnMix', disabled: true }, 'Mélanger et cacher');
  let shown = false;

  function show() {
    const secret = handSecret(store.game, player);
    row.replaceChildren(...secret.kinds.map((kind, i) => {
      const card = wireCard({ kind });
      setTimeout(() => card.classList.add('flipped'), dur(90) * i + 30);
      return card;
    }));
    const parts = [];
    if (secret.counts.overload) parts.push(h('span', { class: 'tag overload' }, 'La Surcharge !'));
    parts.push(h('span', { class: 'tag bypass' }, plural(secret.counts.bypass, 'dérivation')));
    parts.push(h('span', { class: 'tag inert' }, plural(secret.counts.inert, 'câble inerte', 'câbles inertes')));
    info.replaceChildren(h('div', { class: 'tags', id: 'handSummary' }, parts));
    if (secret.neighbor) {
      info.append(h('div', { class: 'neighbor', id: 'neighborBadge' },
        badgeChip(secret.neighbor.badge, `${secret.neighbor.name}, à ta droite, porte un badge ${BADGE_LABEL[secret.neighbor.badge]}`)));
    }
    info.append(roleReminder());
    shown = true;
    reveal.textContent = 'Cacher';
    reveal.className = 'btn big ghost';
    mix.className = 'btn primary big';
    mix.disabled = false;
  }
  function conceal() {
    row.replaceChildren(...Array.from({ length: count }, () => wireCard()));
    info.replaceChildren();
    shown = false;
    reveal.textContent = 'Revoir mes câbles';
  }
  function roleReminder() {
    const box = h('div', { class: 'reminder' });
    const btn = h('button', { class: 'btn sm ghost', id: 'btnRemind' }, 'Rappel de mon rôle');
    let open = false;
    btn.addEventListener('click', () => {
      open = !open;
      btn.textContent = open ? 'Cacher mon rôle' : 'Rappel de mon rôle';
      if (!open) { box.replaceChildren(btn); return; }
      const s = roleSecret(store.game, player);
      const t = ROLE_TEXT[s.role];
      box.replaceChildren(btn, h('div', { class: `reminder-card team-${s.team}`, id: 'reminderCard' },
        h('b', null, t.name), h('span', null, ` — ${t.team}`),
        s.badge ? h('div', null, badgeChip(s.badge)) : null,
        h('p', null, t.goal)));
    });
    box.append(btn);
    return box;
  }

  reveal.addEventListener('click', () => { ctx.sound.flip(); if (shown) conceal(); else show(); });
  mix.addEventListener('click', async () => {
    if (mix.disabled) return;
    mix.disabled = true;
    reveal.disabled = true;
    conceal(); // les faces quittent la page avant le mélange
    store.setGame(ackInspect(store.game, rng)); // le mélange est enregistré tout de suite : aucun retour possible
    ctx.sound.shuffle();
    row.classList.add('shuffling');
    await sleep(dur(650));
    ctx.ui.pass = { stage: 'done', name, count };
    ctx.render();
  });

  return h('section', { class: 'screen pass secret', 'data-stage': 'secret' },
    h('header', { class: 'topbar' },
      h('span', { class: 'topbar-space' }),
      h('div', { class: 'pass-step' }, h('span', { class: 'lock', html: ICON.eye }), `Pour ${name} seulement`),
      h('span', { class: 'topbar-space' })),
    h('div', { class: 'secret-main' },
      h('p', { class: 'secret-lead' }, `Tes ${count} câbles pour la manche ${view.round}`),
      row, info),
    h('div', { class: 'bottom-actions' }, reveal, mix));
}

// ───────────────────────────────────────────── Câbles mélangés et cachés

function doneStage(ctx, view) {
  const { name, count } = ctx.ui.pass;
  const playing = view.phase === 'play';
  const nextName = playing ? view.players[view.holder].name : view.players[view.passPlayer].name;
  return h('section', { class: 'screen pass done', 'data-stage': 'done' },
    h('header', { class: 'topbar' },
      h('span', { class: 'topbar-space' }),
      h('div', { class: 'pass-step' }, `Manche ${view.round}`),
      h('span', { class: 'topbar-space' })),
    h('div', { class: 'handoff-main' },
      h('div', { class: `wire-row n${count} small` }, Array.from({ length: count }, () => wireCard())),
      h('h1', { class: 'done-title' }, `C’est noté, ${name}.`),
      h('p', { class: 'handoff-note' }, 'Tes câbles sont mélangés et posés face cachée : plus personne ne sait où ils sont, pas même toi.'),
      h('p', { class: 'handoff-lead' }, playing ? 'Tout le monde est prêt. La pince est pour' : 'Passe ensuite le téléphone à'),
      h('div', { class: 'next-name' }, nextName)),
    h('div', { class: 'bottom-actions' },
      h('button', {
        class: 'btn primary big', id: 'btnReady',
        onClick: () => { ctx.sound.tap(); ctx.ui.pass = { stage: 'handoff' }; ctx.render(); },
      }, playing ? 'Prêt — commencer la manche' : 'Prêt — passer le téléphone')));
}
