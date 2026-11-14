// Coupe-Circuit — tables et constantes des règles.
// Aucun accès au DOM ici : ce module est utilisable tel quel sous Node pour les tests.

export const MIN_PLAYERS = 4;
export const MAX_PLAYERS = 8;
export const ROUNDS = 4;
export const HAND_SIZE = 5;
export const MAX_TEAM_CARDS = 8;

export const TEAM = Object.freeze({ TECH: 'tech', SAB: 'sab', SOLO: 'solo' });
export const ROLE = Object.freeze({ TECH: 'tech', SAB: 'sab', MOLE: 'mole', INFILTRATOR: 'infiltrator', SOLO: 'solo' });
export const WIRE = Object.freeze({ INERT: 'inert', BYPASS: 'bypass', OVERLOAD: 'overload' });
export const BADGE = Object.freeze({ BLUE: 'blue', ORANGE: 'orange' });
export const BADGES = Object.freeze({ OFF: 'off', NEIGHBOR: 'neighbor', PUBLIC: 'public' });
export const MODE = Object.freeze({ CLASSIC: 'classic', INFILTRATION: 'infiltration', CUSTOM: 'custom' });

// Équipe réelle et badge (couverture) de chaque rôle. Le badge de l'Électron libre est choisi par le joueur.
export const ROLE_INFO = Object.freeze({
  tech: { team: TEAM.TECH, badge: BADGE.BLUE },
  infiltrator: { team: TEAM.TECH, badge: BADGE.ORANGE },
  sab: { team: TEAM.SAB, badge: BADGE.ORANGE },
  mole: { team: TEAM.SAB, badge: BADGE.BLUE },
  solo: { team: TEAM.SOLO, badge: null },
});

// [Techniciens, Saboteurs] par nombre de joueurs.
const CLASSIC = { 4: [3, 2], 5: [3, 2], 6: [4, 2], 7: [5, 3], 8: [5, 3] };
const INFILTRATION = { 4: [3, 1], 5: [3, 2], 6: [3, 2], 7: [4, 2], 8: [4, 3] };

const inRange = (n) => Number.isInteger(n) && n >= MIN_PLAYERS && n <= MAX_PLAYERS;

/**
 * Composition proposée pour un mode et un nombre de joueurs.
 * `tech` et `sab` comptent toutes les cartes de l'équipe réelle, agents doubles compris.
 */
export function presetComposition(mode, n) {
  if (!inRange(n)) throw new RangeError(`Nombre de joueurs invalide : ${n}`);
  if (mode === MODE.INFILTRATION) {
    const [tech, sab] = INFILTRATION[n];
    return { tech, sab, solo: 1, mole: sab >= 2, infiltrator: tech >= 2, badges: BADGES.NEIGHBOR };
  }
  const [tech, sab] = CLASSIC[n];
  return { tech, sab, solo: 0, mole: false, infiltrator: false, badges: BADGES.OFF };
}

/** Retrouve le mode correspondant à une composition (ou « custom »). */
export function modeOf(comp, n) {
  for (const mode of [MODE.CLASSIC, MODE.INFILTRATION]) {
    const p = presetComposition(mode, n);
    if (Object.keys(p).every((k) => p[k] === comp[k])) return mode;
  }
  return MODE.CUSTOM;
}

export function validateComposition(comp, n) {
  const errors = [];
  if (!inRange(n)) errors.push(`Il faut entre ${MIN_PLAYERS} et ${MAX_PLAYERS} joueurs.`);
  const int = (v) => Number.isInteger(v) && v >= 0;
  if (!comp || !int(comp.tech) || !int(comp.sab) || !int(comp.solo)) {
    return { ok: false, errors: ['Composition illisible.'], total: 0, undealt: 0 };
  }
  if (comp.tech < 1) errors.push('Il faut au moins un Technicien.');
  if (comp.sab < 1) errors.push('Il faut au moins un Saboteur.');
  if (comp.tech > MAX_TEAM_CARDS || comp.sab > MAX_TEAM_CARDS) errors.push(`Pas plus de ${MAX_TEAM_CARDS} cartes par équipe.`);
  if (comp.solo > 1) errors.push('Un seul Électron libre au maximum.');
  if (!Object.values(BADGES).includes(comp.badges)) errors.push('Réglage des badges inconnu.');
  if ((comp.mole || comp.infiltrator) && comp.badges === BADGES.OFF) errors.push('Les agents doubles ont besoin des badges.');
  const total = comp.tech + comp.sab + comp.solo;
  if (inRange(n) && total < n) {
    const miss = n - total;
    errors.push(`Il manque ${miss} carte${miss > 1 ? 's' : ''} Rôle pour ${n} joueurs.`);
  }
  return { ok: errors.length === 0, errors, total, undealt: Math.max(0, total - n) };
}

/** Paquet de cartes Rôle (non mélangé). Chaque carte porte un portrait distinct. */
export function roleDeck(comp) {
  const deck = [];
  const card = (role, char) => ({ role, team: ROLE_INFO[role].team, badge: comp.badges === BADGES.OFF ? null : ROLE_INFO[role].badge, char });
  const plainTech = comp.tech - (comp.infiltrator ? 1 : 0);
  const plainSab = comp.sab - (comp.mole ? 1 : 0);
  for (let i = 0; i < plainTech; i++) deck.push(card(ROLE.TECH, i));
  if (comp.infiltrator) deck.push(card(ROLE.INFILTRATOR, 0));
  for (let i = 0; i < plainSab; i++) deck.push(card(ROLE.SAB, i));
  if (comp.mole) deck.push(card(ROLE.MOLE, 0));
  for (let i = 0; i < comp.solo; i++) deck.push(card(ROLE.SOLO, 0));
  return deck;
}

/** Paquet de câbles pour n joueurs : n dérivations, 1 surcharge, le reste inerte (5 par joueur). */
export function wireDeck(n) {
  if (!inRange(n)) throw new RangeError(`Nombre de joueurs invalide : ${n}`);
  const deck = [WIRE.OVERLOAD];
  for (let i = 0; i < n; i++) deck.push(WIRE.BYPASS);
  while (deck.length < n * HAND_SIZE) deck.push(WIRE.INERT);
  return deck;
}

/** Nombre de câbles par joueur pendant une manche (5, 4, 3, 2). */
export const handSize = (round) => HAND_SIZE - (round - 1);
