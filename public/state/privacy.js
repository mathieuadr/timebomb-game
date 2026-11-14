// Coupe-Circuit — cloisonnement des informations.
//
// Trois niveaux, jamais mélangés :
//   • publicView(state)          → ce que tous les téléphones reçoivent (en clair sur le relais) ;
//   • privateView(state, player) → ce que reçoit UN joueur, chiffré pour son seul téléphone ;
//   • finalReveal(state)         → les rôles de tous, uniquement une fois la partie terminée.
// L'état complet (state) ne quitte jamais le téléphone de l'hôte.

import { ROUNDS, WIRE, BADGES, TEAM } from '../engine/rules.js';
import { hiddenCount } from '../engine/game.js';

export class PrivacyError extends Error {
  constructor(message) { super(message); this.name = 'PrivacyError'; }
}

/** Tout ce que la table entière a le droit de connaître. */
export function publicView(state) {
  const badgesPublic = state.comp.badges === BADGES.PUBLIC && state.phase !== 'roles';
  return {
    phase: state.phase,
    n: state.n,
    round: state.round,
    rounds: ROUNDS,
    cuts: state.cuts,
    found: state.found,
    total: state.n,
    holder: state.holder,
    ready: state.ready.slice(), // qui a fini de consulter son rôle / ses câbles
    hidden: hiddenCount(state),
    comp: { ...state.comp },
    undealtCount: state.undealt.length,
    players: state.players.map((p, i) => ({
      name: p.name,
      badge: badgesPublic ? state.roles[i].badge : null,
      hidden: state.hands[i].filter((c) => !c.cut).length,
      // l'identité d'un câble n'apparaît que s'il a été coupé
      wires: state.hands[i].map((c) => (c.cut ? { cut: true, kind: c.kind } : { cut: false })),
    })),
    log: state.log.map((e) => ({ ...e })),
    winner: state.winner,
    reason: state.reason,
    endedBy: state.endedBy,
  };
}

/**
 * Ce qu'un joueur a le droit de savoir, et lui seul :
 *   • son rôle (à tout moment : c'est sa carte, il peut la revoir) ;
 *   • ses câbles, uniquement pendant la consultation et tant qu'il ne les a pas mélangés ;
 *   • le badge de son voisin de droite si le réglage « voisin de gauche » est actif.
 */
export function privateView(state, player) {
  if (!Number.isInteger(player) || player < 0 || player >= state.n) throw new PrivacyError('Joueur inconnu.');
  const r = state.roles[player];
  const inspecting = state.phase === 'inspect' && !state.ready[player];
  let hand = null;
  if (inspecting) {
    // triés : l'ordre affiché ne dit rien de la position réelle, qui sera de toute façon remélangée
    const order = [WIRE.OVERLOAD, WIRE.BYPASS, WIRE.INERT];
    const kinds = state.hands[player].map((c) => c.kind).sort((a, b) => order.indexOf(a) - order.indexOf(b));
    const count = (k) => kinds.filter((x) => x === k).length;
    hand = { kinds, counts: { overload: count(WIRE.OVERLOAD), bypass: count(WIRE.BYPASS), inert: count(WIRE.INERT) } };
  }
  // « Chacun montre son badge à son voisin de gauche » : je vois donc celui de mon voisin de droite.
  const right = (player - 1 + state.n) % state.n;
  const neighbor = state.comp.badges === BADGES.NEIGHBOR && state.phase !== 'roles'
    ? { player: right, name: state.players[right].name, badge: state.roles[right].badge }
    : null;
  return {
    seat: player,
    role: { role: r.role, team: r.team, badge: r.badge, char: r.char },
    badges: state.comp.badges,
    needBadge: state.phase === 'roles' && r.team === TEAM.SOLO && state.comp.badges !== BADGES.OFF && !r.badge,
    hand,
    neighbor,
  };
}

/** Révélation finale : uniquement quand la partie est terminée. */
export function finalReveal(state) {
  if (state.phase !== 'over') throw new PrivacyError('Les rôles ne sont révélés qu\'en fin de partie.');
  return {
    players: state.players.map((p, i) => ({ name: p.name, ...state.roles[i] })),
    undealt: state.undealt.map((r) => ({ ...r })),
  };
}
