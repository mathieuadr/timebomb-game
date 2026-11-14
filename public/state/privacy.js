// Coupe-Circuit — cloisonnement des informations.
// L'interface ne lit JAMAIS `state.roles`, `state.hands` ou `state.undealt` directement :
//   • les écrans publics passent par publicView() ;
//   • un écran privé passe par roleSecret() / handSecret(), qui refusent tout autre joueur
//     que celui qui tient le téléphone à cet instant ;
//   • finalReveal() ne répond qu'une fois la partie terminée.

import { ROUNDS, WIRE, BADGES } from '../engine/rules.js';
import { passPlayer, hiddenCount } from '../engine/game.js';

export class PrivacyError extends Error {
  constructor(message) { super(message); this.name = 'PrivacyError'; }
}

/** Tout ce qu'un écran visible de toute la table a le droit de connaître. */
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
    pass: state.pass,
    passPlayer: state.phase === 'roles' || state.phase === 'inspect' ? passPlayer(state) : null,
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

function assertHolder(state, player, phases) {
  if (!phases.includes(state.phase) || passPlayer(state) !== player) {
    throw new PrivacyError('Information privée demandée hors du tour du joueur.');
  }
}

/** Carte Rôle du joueur qui tient le téléphone (distribution des rôles, ou rappel pendant sa consultation). */
export function roleSecret(state, player) {
  assertHolder(state, player, ['roles', 'inspect']);
  const r = state.roles[player];
  return { role: r.role, team: r.team, badge: r.badge, char: r.char, badges: state.comp.badges };
}

/** Câbles du joueur qui tient le téléphone, triés (leur ordre réel n'a aucune importance : il sera mélangé). */
export function handSecret(state, player) {
  assertHolder(state, player, ['inspect']);
  const order = [WIRE.OVERLOAD, WIRE.BYPASS, WIRE.INERT];
  const kinds = state.hands[player].map((c) => c.kind).sort((a, b) => order.indexOf(a) - order.indexOf(b));
  const count = (k) => kinds.filter((x) => x === k).length;
  // « Chacun montre son badge à son voisin de gauche » : je vois donc celui de mon voisin de droite.
  const right = (player - 1 + state.n) % state.n;
  const neighbor = state.comp.badges === BADGES.NEIGHBOR ? { player: right, name: state.players[right].name, badge: state.roles[right].badge } : null;
  return { kinds, counts: { overload: count(WIRE.OVERLOAD), bypass: count(WIRE.BYPASS), inert: count(WIRE.INERT) }, neighbor };
}

/** Révélation finale : uniquement quand la partie est terminée. */
export function finalReveal(state) {
  if (state.phase !== 'over') throw new PrivacyError('Les rôles ne sont révélés qu\'en fin de partie.');
  return {
    players: state.players.map((p, i) => ({ name: p.name, ...state.roles[i] })),
    undealt: state.undealt.map((r) => ({ ...r })),
  };
}
