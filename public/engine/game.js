// Coupe-Circuit — moteur de règles pur.
// Chaque action reçoit un état et renvoie un NOUVEL état ; rien n'est modifié en place.
// Le hasard est injecté (`rng`) pour que les tests soient reproductibles.

import { HAND_SIZE, ROUNDS, WIRE, TEAM, BADGE, BADGES, roleDeck, wireDeck, validateComposition, handSize } from './rules.js';

export const STATE_VERSION = 1;

export class RuleError extends Error {
  constructor(code, message) {
    super(message || code);
    this.name = 'RuleError';
    this.code = code;
  }
}

const clone = (s) => JSON.parse(JSON.stringify(s));

/** Mélange de Fisher–Yates (renvoie une copie). */
export function shuffle(list, rng = Math.random) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function dealHands(kinds, n, size) {
  if (kinds.length !== n * size) throw new RuleError('bad-deal', `Distribution impossible : ${kinds.length} câbles pour ${n} × ${size}.`);
  const hands = Array.from({ length: n }, () => []);
  kinds.forEach((kind, k) => hands[k % n].push({ kind, cut: false }));
  return hands;
}

/** Joueur qui tient le téléphone pendant une phase « on se passe le téléphone ». */
export const passPlayer = (state) => (state.holder + state.pass) % state.n;

export function createGame({ names, comp, firstPlayer = 0 }, rng = Math.random) {
  const n = Array.isArray(names) ? names.length : 0;
  const check = validateComposition(comp, n);
  if (!check.ok) throw new RuleError('bad-composition', check.errors.join(' '));
  if (!Number.isInteger(firstPlayer) || firstPlayer < 0 || firstPlayer >= n) throw new RuleError('bad-first-player');
  const roles = shuffle(roleDeck(comp), rng);
  return {
    v: STATE_VERSION,
    n,
    players: names.map((name) => ({ name: String(name) })),
    comp: { ...comp },
    roles: roles.slice(0, n),
    undealt: roles.slice(n),
    hands: dealHands(shuffle(wireDeck(n), rng), n, HAND_SIZE),
    round: 1,
    cuts: 0,
    found: 0,
    holder: firstPlayer,
    firstPlayer,
    log: [],
    phase: 'roles', // roles → inspect → play → roundEnd → inspect → … → over
    pass: 0,
    winner: null,
    reason: null,
    endedBy: null,
  };
}

/** L'Électron libre choisit le badge qu'il montrera. */
export function chooseBadge(state, badge) {
  if (state.phase !== 'roles') throw new RuleError('not-roles');
  if (state.comp.badges === BADGES.OFF) throw new RuleError('badges-off');
  if (badge !== BADGE.BLUE && badge !== BADGE.ORANGE) throw new RuleError('bad-badge');
  const p = passPlayer(state);
  if (state.roles[p].team !== TEAM.SOLO) throw new RuleError('not-solo');
  const s = clone(state);
  s.roles[p].badge = badge;
  return s;
}

/** Le joueur courant a vu son rôle et masque l'écran. */
export function ackRole(state) {
  if (state.phase !== 'roles') throw new RuleError('not-roles');
  const role = state.roles[passPlayer(state)];
  if (role.team === TEAM.SOLO && state.comp.badges !== BADGES.OFF && !role.badge) throw new RuleError('badge-required');
  const s = clone(state);
  s.pass += 1;
  if (s.pass === s.n) { s.phase = 'inspect'; s.pass = 0; }
  return s;
}

/** Le joueur courant a vu ses câbles : ils sont mélangés et replacés face cachée. */
export function ackInspect(state, rng = Math.random) {
  if (state.phase !== 'inspect') throw new RuleError('not-inspect');
  const s = clone(state);
  const p = passPlayer(s);
  s.hands[p] = shuffle(s.hands[p], rng);
  s.pass += 1;
  if (s.pass === s.n) { s.phase = 'play'; s.pass = 0; }
  return s;
}

function finish(s, winner, reason, by) {
  s.phase = 'over';
  s.winner = winner;
  s.reason = reason;
  s.endedBy = by;
  return s;
}

/** Le porteur de la pince coupe le câble `slot` du joueur `target`. Irréversible. */
export function cut(state, target, slot) {
  if (state.phase !== 'play') throw new RuleError('not-playing');
  if (!Number.isInteger(target) || target < 0 || target >= state.n) throw new RuleError('bad-target');
  if (target === state.holder) throw new RuleError('own-wire', 'On ne coupe jamais ses propres câbles.');
  const card = state.hands[target][slot];
  if (!card) throw new RuleError('bad-wire');
  if (card.cut) throw new RuleError('already-cut');

  const s = clone(state);
  const by = s.holder;
  s.hands[target][slot].cut = true;
  s.cuts += 1;
  if (card.kind === WIRE.BYPASS) s.found += 1;
  s.log.push({ round: s.round, by, from: target, kind: card.kind });
  s.holder = target; // la pince passe au joueur coupé

  const solo = s.roles[by].team === TEAM.SOLO;
  if (card.kind === WIRE.OVERLOAD) return finish(s, solo ? TEAM.SOLO : TEAM.SAB, 'overload', by);
  if (s.found === s.n) return finish(s, solo ? TEAM.SOLO : TEAM.TECH, 'bypass', by);
  if (s.cuts === s.n) {
    if (s.round === ROUNDS) return finish(s, TEAM.SAB, 'timeout', by);
    s.phase = 'roundEnd';
  }
  return s;
}

/** Ramasse les câbles non coupés, les mélange et en redistribue un de moins à chacun. */
export function nextRound(state, rng = Math.random) {
  if (state.phase !== 'roundEnd') throw new RuleError('not-round-end');
  const s = clone(state);
  const remaining = [];
  for (const hand of s.hands) for (const c of hand) if (!c.cut) remaining.push(c.kind);
  s.round += 1;
  s.cuts = 0;
  s.hands = dealHands(shuffle(remaining, rng), s.n, handSize(s.round));
  s.phase = 'inspect';
  s.pass = 0; // le dernier joueur coupé (holder) consulte en premier et commencera la manche
  return s;
}

/** Nombre de câbles encore cachés sur la table. */
export const hiddenCount = (state) => state.hands.reduce((sum, hand) => sum + hand.filter((c) => !c.cut).length, 0);
