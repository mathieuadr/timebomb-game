// Composants d'interface réutilisables : cartes, feuilles modales, interrupteurs, messages.

import { h, art, dur, sleep } from './dom.js';
import { ICON, wireBack, wireFace, rolePortrait, badgeArt } from './art.js';
import { ROLE_TEXT, CHARACTERS, BADGE_LABEL, ROLE_DOCS, RULES, rich } from './texts.js';
import { sound } from './sound.js';

// ───────────────────────────────────────────── Cartes Câble

/**
 * Carte Câble. Sans `kind`, seul le dos existe dans le DOM : une carte cachée ne contient
 * aucune trace de son identité.
 */
export function wireCard({ kind = null, flipped = false, cls = '' } = {}) {
  return h('div', { class: `wcard ${flipped ? 'flipped' : ''} ${cls}`.trim() },
    h('div', { class: 'wcard-in' },
      h('div', { class: 'wface wback', html: wireBack() }),
      kind ? h('div', { class: 'wface wfront', html: wireFace(kind) }) : null));
}

/** Ajoute la face d'une carte au moment de la révélation, puis la retourne. */
export function flipToFace(card, kind) {
  const inner = card.firstElementChild;
  if (!inner.querySelector('.wfront')) inner.append(h('div', { class: 'wface wfront', html: wireFace(kind) }));
  void card.offsetWidth; // force le navigateur à prendre en compte l'état de départ
  card.classList.add('flipped');
  sound.flip();
}

// ───────────────────────────────────────────── Carte Rôle

export const badgeChip = (color, label) => h('span', { class: `badge-chip ${color}` }, art(badgeArt(color)), label || `Badge ${BADGE_LABEL[color]}`);

export function roleCard(secret) {
  const text = ROLE_TEXT[secret.role];
  const chars = CHARACTERS[secret.role];
  return h('div', { class: `rolecard team-${secret.team}` },
    h('div', { class: 'rc-art', html: rolePortrait(secret.role, secret.char) }),
    h('div', { class: 'rc-body' },
      h('div', { class: 'rc-team' }, text.team),
      h('div', { class: 'rc-name' }, text.name),
      h('div', { class: 'rc-char' }, chars[secret.char % chars.length]),
      h('p', { class: 'rc-goal' }, text.goal),
      secret.badge ? h('div', { class: 'rc-badge' }, badgeChip(secret.badge, `Ton badge est ${BADGE_LABEL[secret.badge]}`)) : null));
}

export const roleCardBack = () => h('div', { class: 'rolecard back' },
  h('div', { class: 'rc-backart', html: wireBack() }),
  h('div', { class: 'rc-backlabel' }, 'Carte Rôle'));

// ───────────────────────────────────────────── Feuilles modales et superpositions

const layer = () => document.getElementById('layer');
const stack = [];

/** Feuille qui monte du bas de l'écran. Renvoie { el, close }. */
export function openSheet(content, { title = '', dismissible = true, onClose, cls = '' } = {}) {
  let closed = false;
  const handle = { el: null, close, dismissible };
  function close() {
    if (closed) return;
    closed = true;
    const i = stack.indexOf(handle);
    if (i >= 0) stack.splice(i, 1);
    handle.el.classList.remove('open');
    setTimeout(() => handle.el.remove(), dur(240));
    if (onClose) onClose();
  }
  handle.el = h('div', { class: `sheet ${cls}`.trim() },
    h('div', { class: 'sheet-backdrop', onClick: () => dismissible && close() }),
    h('div', { class: 'sheet-body', role: 'dialog', 'aria-modal': 'true', 'aria-label': title || 'Fenêtre' },
      h('div', { class: 'sheet-head' },
        h('h2', null, title),
        dismissible ? h('button', { class: 'icon-btn', 'aria-label': 'Fermer', onClick: close, html: ICON.close }) : null),
      h('div', { class: 'sheet-content' }, content)));
  layer().append(handle.el);
  stack.push(handle);
  requestAnimationFrame(() => requestAnimationFrame(() => handle.el.classList.add('open')));
  return handle;
}

/** Ferme la feuille du dessus si elle peut l'être (bouton retour d'Android). */
export function closeTopSheet() {
  const top = stack.at(-1);
  if (top && top.dismissible) { top.close(); return true; }
  return false;
}

export function closeAllSheets() {
  stack.length = 0;
  layer().replaceChildren();
}

/** Demande de confirmation avant une action irréversible. Résout true ou false. */
export function confirmSheet({ title, text, yes = 'Confirmer', no = 'Annuler', danger = false }) {
  return new Promise((resolve) => {
    let answer = false;
    const sheet = openSheet(
      h('div', { class: 'confirm' },
        h('p', null, text),
        h('div', { class: 'btn-col' },
          h('button', { class: `btn big ${danger ? 'danger' : 'primary'}`, onClick: () => { answer = true; sheet.close(); } }, yes),
          h('button', { class: 'btn big ghost', onClick: () => sheet.close() }, no))),
      { title, onClose: () => resolve(answer) });
  });
}

// ───────────────────────────────────────────── Messages brefs

export function toast(message, { tone = '' } = {}) {
  const box = document.getElementById('toasts');
  const el = h('div', { class: `toast ${tone}`.trim(), role: 'status' }, message);
  box.replaceChildren(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 300); }, 2600);
}

// ───────────────────────────────────────────── Réglages (sons, animations)

export function settingToggles(ctx) {
  const { prefs } = ctx;
  const mk = (key, on, off, label) => {
    const active = prefs[key];
    return h('button', {
      class: `icon-btn toggle ${active ? 'on' : ''}`,
      'aria-pressed': String(active),
      'aria-label': `${label} : ${active ? 'activés' : 'désactivés'}`,
      title: label,
      html: active ? on : off,
      onClick: () => { ctx.setSetting(key, !active); },
    });
  };
  return h('div', { class: 'toggles' },
    mk('sound', ICON.soundOn, ICON.soundOff, 'Sons'),
    mk('motion', ICON.motionOn, ICON.motionOff, 'Animations'));
}

export function settingRows(ctx) {
  const { prefs } = ctx;
  const row = (key, label, hint) => h('label', { class: 'row-switch' },
    h('span', { class: 'rs-text' }, h('b', null, label), h('small', null, hint)),
    h('input', { type: 'checkbox', class: 'switch', checked: prefs[key], onChange: (e) => ctx.setSetting(key, e.target.checked, { silent: true }) }));
  return h('div', { class: 'rows' },
    row('sound', 'Sons', 'Coupes, révélations, fin de partie'),
    row('motion', 'Animations', 'Désactive pour un affichage plus sobre'));
}

// ───────────────────────────────────────────── Aides : fiches de rôle et règles

export function roleDocBody(doc) {
  const portraitRole = ['tech', 'sab', 'solo', 'mole', 'infiltrator'].includes(doc.id) ? doc.id : null;
  return h('div', { class: `doc doc-${doc.color}` },
    h('div', { class: 'doc-head' },
      portraitRole ? h('div', { class: 'doc-portrait', html: rolePortrait(portraitRole, 0) }) : null,
      h('div', null,
        h('div', { class: 'doc-tag' }, doc.tag),
        doc.badge ? h('div', { class: 'doc-badge' }, doc.badge) : null)),
    doc.body.map((p) => h('p', null, rich(p))));
}

export function openRoleDoc(id) {
  const doc = ROLE_DOCS.find((d) => d.id === id);
  if (doc) openSheet(roleDocBody(doc), { title: doc.title });
}

export function rulesContent() {
  return h('div', { class: 'rules' },
    RULES.map((section) => h('section', { class: 'rule' },
      h('h3', null, section.title),
      section.body.map((p) => h('p', null, rich(p))))),
    h('h3', { class: 'rules-roles' }, 'Les rôles'),
    ROLE_DOCS.map((doc) => h('details', { class: `acc acc-${doc.color}` },
      h('summary', null, h('span', { class: 'acc-title' }, doc.title), h('span', { class: 'acc-tag' }, doc.tag)),
      roleDocBody(doc))));
}

export const pips = (done, total, cls = '') => h('span', { class: `pips ${cls}`.trim(), 'aria-hidden': 'true' },
  Array.from({ length: total }, (_, i) => h('i', { class: i < done ? 'on' : '' })));

export { sleep };
