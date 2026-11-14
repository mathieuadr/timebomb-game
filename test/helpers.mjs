// Outils communs aux tests du moteur.
import { createGame, chooseBadge, ackRole, ackInspect, cut, nextRound, passPlayer } from '../public/engine/game.js';
import { presetComposition, handSize, WIRE, TEAM, BADGES, HAND_SIZE } from '../public/engine/rules.js';

/** Générateur pseudo-aléatoire reproductible (mulberry32). */
export function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const NAMES = ['Ada', 'Bo', 'Cléo', 'Dan', 'Eve', 'Flo', 'Gus', 'Hal'];
export const names = (n) => NAMES.slice(0, n);

/** Fait défiler la distribution des rôles (l'Électron libre prend un badge si besoin). */
export function passRoles(state) {
  let s = state;
  while (s.phase === 'roles') {
    const r = s.roles[passPlayer(s)];
    if (r.team === TEAM.SOLO && s.comp.badges !== BADGES.OFF && !r.badge) s = chooseBadge(s, 'blue');
    s = ackRole(s);
  }
  return s;
}

export function passInspect(state, rng) {
  let s = state;
  while (s.phase === 'inspect') s = ackInspect(s, rng);
  return s;
}

/** Partie prête à jouer (rôles vus, câbles consultés). */
export function ready(n, { mode = 'classic', comp, firstPlayer = 0, seed = 1 } = {}) {
  const rng = seeded(seed);
  const game = createGame({ names: names(n), comp: comp || presetComposition(mode, n), firstPlayer }, rng);
  return { state: passInspect(passRoles(game), rng), rng };
}

/** Toutes les coupes légales : [joueur visé, emplacement]. */
export function legalCuts(state) {
  const out = [];
  state.hands.forEach((hand, p) => {
    if (p === state.holder) return;
    hand.forEach((c, slot) => { if (!c.cut) out.push([p, slot]); });
  });
  return out;
}

/** Première coupe légale d'un câble du type voulu (ou null). */
export function findCut(state, kind) {
  return legalCuts(state).find(([p, slot]) => state.hands[p][slot].kind === kind) || null;
}

/** Joue une coupe du type voulu ; échoue si c'est impossible depuis cette position. */
export function cutKind(state, kind) {
  const c = findCut(state, kind);
  if (!c) throw new Error(`Aucun câble « ${kind} » à couper pour le joueur ${state.holder}`);
  return cut(state, c[0], c[1]);
}

export class Stuck extends Error {}

/** Coupe qui ne termine pas la partie : un câble inerte si possible, sinon une dérivation qui n'est pas la dernière. */
export function quietCut(state) {
  let c = findCut(state, WIRE.INERT);
  if (!c && state.found < state.n - 1) c = findCut(state, WIRE.BYPASS);
  if (!c) throw new Stuck('aucune coupe neutre possible');
  return cut(state, c[0], c[1]);
}

/** Termine la manche en cours sans finir la partie, puis redistribue et fait consulter les câbles. */
export function burnRound(state, rng) {
  let s = state;
  while (s.phase === 'play' && s.cuts < s.n - 1) s = quietCut(s);
  if (s.phase === 'play') s = s.round === 4 ? cutKind(s, WIRE.INERT) : quietCut(s);
  if (s.phase === 'roundEnd') s = passInspect(nextRound(s, rng), rng);
  return s;
}

/** Essaie des graines successives jusqu'à trouver un déroulement qui ne se bloque pas (reste déterministe). */
export function firstSeed(fn, from = 1) {
  for (let seed = from; seed < from + 200; seed++) {
    try { return fn(seed); } catch (e) { if (!(e instanceof Stuck)) throw e; }
  }
  throw new Error('aucune graine ne convient');
}

/** Décompte des câbles d'un état, coupés ou non. */
export function tally(state) {
  const t = { inert: 0, bypass: 0, overload: 0 };
  for (const hand of state.hands) for (const c of hand) if (!c.cut) t[c.kind] += 1;
  return t;
}

/** Vérifie tous les invariants d'un état ; renvoie la liste des anomalies (vide si tout va bien). */
export function invariants(state) {
  const bad = [];
  const n = state.n;
  const size = handSize(state.round);
  if (state.hands.length !== n) bad.push('nombre de mains');
  state.hands.forEach((hand, p) => { if (hand.length !== size) bad.push(`main du joueur ${p} : ${hand.length} au lieu de ${size}`); });
  const t = tally(state);
  const cutNow = state.hands.flat().filter((c) => c.cut).length;
  if (cutNow !== state.cuts) bad.push(`coupes de la manche : ${cutNow} ≠ ${state.cuts}`);
  if (state.cuts > n) bad.push('trop de coupes dans la manche');
  if (t.bypass + state.found !== n) bad.push(`dérivations : ${t.bypass} cachées + ${state.found} trouvées ≠ ${n}`);
  const overloadCut = state.log.filter((e) => e.kind === WIRE.OVERLOAD).length;
  if (t.overload + overloadCut !== 1) bad.push('surcharge perdue ou dupliquée');
  if (state.log.length + t.inert + t.bypass + t.overload !== n * HAND_SIZE) bad.push('câbles perdus ou dupliqués');
  if (state.log.length && state.log.at(-1).from !== state.holder) bad.push('la pince n\'est pas chez le dernier joueur coupé');
  if (state.log.some((e) => e.by === e.from)) bad.push('un joueur a coupé son propre câble');
  if (state.roles.length !== n) bad.push('nombre de rôles');
  if (state.roles.length + state.undealt.length !== state.comp.tech + state.comp.sab + state.comp.solo) bad.push('cartes Rôle perdues');
  if (state.phase === 'over' && !['tech', 'sab', 'solo'].includes(state.winner)) bad.push('vainqueur invalide');
  if (state.phase !== 'over' && state.winner) bad.push('vainqueur avant la fin');
  return bad;
}
