// Tests du moteur de règles — `node --test test/engine.test.mjs`
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createGame, chooseBadge, ackRole, ackInspect, cut, nextRound, hiddenCount, RuleError } from '../public/engine/game.js';
import { presetComposition, validateComposition, modeOf, roleDeck, wireDeck, handSize, WIRE, ROUNDS } from '../public/engine/rules.js';
import { publicView, privateView, finalReveal, PrivacyError } from '../public/state/privacy.js';
import { seeded, names, ready, passRoles, passInspect, legalCuts, findCut, cutKind, quietCut, burnRound, firstSeed, tally, invariants } from './helpers.mjs';

const count = (list, pred) => list.filter(pred).length;
const code = (c) => (err) => err instanceof RuleError && err.code === c;
const custom = (over) => ({ tech: 3, sab: 2, solo: 0, mole: false, infiltrator: false, badges: 'off', ...over });

// ───────────────────────────────────────────── Composition

test('mode Classique : répartition des rôles de 4 à 8 joueurs', () => {
  const expected = { 4: [3, 2, 1], 5: [3, 2, 0], 6: [4, 2, 0], 7: [5, 3, 1], 8: [5, 3, 0] };
  for (const [n, [tech, sab, undealt]] of Object.entries(expected)) {
    const comp = presetComposition('classic', +n);
    assert.deepEqual([comp.tech, comp.sab, comp.solo], [tech, sab, 0], `${n} joueurs`);
    const v = validateComposition(comp, +n);
    assert.ok(v.ok);
    assert.equal(v.undealt, undealt, `carte non distribuée à ${n}`);
    const game = createGame({ names: names(+n), comp }, seeded(+n));
    assert.equal(game.roles.length, +n);
    assert.equal(game.undealt.length, undealt);
    assert.ok(game.roles.every((r) => r.badge === null), 'pas de badge en mode Classique');
  }
});

test('mode Infiltration : répartition avec Électron libre et agents doubles', () => {
  const expected = { 4: [3, 1, 1], 5: [3, 2, 1], 6: [3, 2, 0], 7: [4, 2, 0], 8: [4, 3, 0] };
  for (const [n, [tech, sab, undealt]] of Object.entries(expected)) {
    const comp = presetComposition('infiltration', +n);
    assert.deepEqual([comp.tech, comp.sab, comp.solo], [tech, sab, 1], `${n} joueurs`);
    assert.equal(validateComposition(comp, +n).undealt, undealt);
    assert.equal(modeOf(comp, +n), 'infiltration');
    const deck = roleDeck(comp);
    assert.equal(count(deck, (c) => c.team === 'tech'), tech);
    assert.equal(count(deck, (c) => c.team === 'sab'), sab);
    assert.equal(count(deck, (c) => c.role === 'solo'), 1);
    assert.equal(count(deck, (c) => c.role === 'infiltrator'), 1);
    assert.equal(count(deck, (c) => c.role === 'mole'), sab >= 2 ? 1 : 0);
  }
});

test('agents doubles : équipe réelle et badge ne correspondent pas', () => {
  const deck = roleDeck(custom({ tech: 3, sab: 3, solo: 1, mole: true, infiltrator: true, badges: 'neighbor' }));
  const by = (role) => deck.find((c) => c.role === role);
  assert.deepEqual([by('mole').team, by('mole').badge], ['sab', 'blue']);
  assert.deepEqual([by('infiltrator').team, by('infiltrator').badge], ['tech', 'orange']);
  assert.deepEqual([by('tech').team, by('tech').badge], ['tech', 'blue']);
  assert.deepEqual([by('sab').team, by('sab').badge], ['sab', 'orange']);
  assert.deepEqual([by('solo').team, by('solo').badge], ['solo', null]);
  assert.equal(count(deck, (c) => c.team === 'tech'), 3, 'l\'Infiltré compte parmi les Techniciens');
  assert.equal(count(deck, (c) => c.team === 'sab'), 3, 'la Taupe compte parmi les Saboteurs');
});

test('composition personnalisée : validation', () => {
  assert.ok(validateComposition(custom({ tech: 4, sab: 4 }), 6).ok);
  assert.equal(validateComposition(custom({ tech: 4, sab: 4 }), 6).undealt, 2);
  assert.ok(!validateComposition(custom({ tech: 2, sab: 1 }), 5).ok, 'pas assez de cartes');
  assert.ok(!validateComposition(custom({ tech: 0, sab: 5 }), 5).ok, 'aucun Technicien');
  assert.ok(!validateComposition(custom({ tech: 5, sab: 0 }), 5).ok, 'aucun Saboteur');
  assert.ok(!validateComposition(custom({ solo: 2 }), 5).ok, 'deux Électrons libres');
  assert.ok(!validateComposition(custom({ mole: true }), 5).ok, 'agent double sans badges');
  assert.ok(!validateComposition(custom(), 3).ok, '3 joueurs');
  assert.ok(!validateComposition(custom({ tech: 9, sab: 2 }), 9).ok, '9 joueurs');
  assert.equal(modeOf(custom({ tech: 4, sab: 4 }), 6), 'custom');
  assert.throws(() => createGame({ names: names(5), comp: custom({ tech: 1, sab: 1 }) }), code('bad-composition'));
});

test('câbles : composition et distribution de 4 à 8 joueurs', () => {
  const expected = { 4: [15, 4], 5: [19, 5], 6: [23, 6], 7: [27, 7], 8: [31, 8] };
  for (const [n, [inert, bypass]] of Object.entries(expected)) {
    const deck = wireDeck(+n);
    assert.equal(deck.length, +n * 5);
    assert.equal(count(deck, (k) => k === WIRE.INERT), inert);
    assert.equal(count(deck, (k) => k === WIRE.BYPASS), bypass);
    assert.equal(count(deck, (k) => k === WIRE.OVERLOAD), 1);
    const game = createGame({ names: names(+n), comp: presetComposition('classic', +n) }, seeded(7));
    assert.ok(game.hands.every((h) => h.length === 5), 'cinq câbles chacun');
    assert.deepEqual(tally(game), { inert, bypass, overload: 1 });
    assert.deepEqual(invariants(game), []);
  }
});

// ───────────────────────────────────────────── Chacun son téléphone : consultations en parallèle

test('rôles : chacun confirme de son côté, dans n\'importe quel ordre', () => {
  let s = createGame({ names: names(5), comp: presetComposition('classic', 5), firstPlayer: 3 }, seeded(2));
  for (const p of [4, 0, 2, 1]) {
    s = ackRole(s, p);
    assert.equal(s.phase, 'roles', 'on attend le dernier joueur');
  }
  assert.deepEqual(s.ready, [true, true, true, false, true]);
  const again = ackRole(s, 2);
  assert.equal(again, s, 'une confirmation reçue deux fois est sans effet');
  s = ackRole(s, 3);
  assert.equal(s.phase, 'inspect');
  assert.deepEqual(s.ready, [false, false, false, false, false], 'tout le monde doit maintenant consulter ses câbles');
  assert.equal(s.holder, 3, 'le premier joueur choisi tiendra la pince');
  assert.throws(() => ackRole(s, 0), code('not-roles'));
  assert.throws(() => ackRole(createGame({ names: names(5), comp: presetComposition('classic', 5) }, seeded(2)), 7), code('bad-player'));
});

test('l\'Électron libre doit choisir son badge avant de confirmer', () => {
  const comp = custom({ tech: 2, sab: 1, solo: 1, badges: 'neighbor' });
  let s = createGame({ names: names(4), comp }, seeded(11));
  const solo = s.roles.findIndex((r) => r.team === 'solo');
  const other = (solo + 1) % 4;
  assert.throws(() => chooseBadge(s, other, 'blue'), code('not-solo'));
  assert.throws(() => ackRole(s, solo), code('badge-required'));
  assert.throws(() => chooseBadge(s, solo, 'vert'), code('bad-badge'));
  s = chooseBadge(s, solo, 'orange');
  s = chooseBadge(s, solo, 'blue'); // il peut changer d'avis tant qu'il n'a pas confirmé
  assert.equal(s.roles[solo].badge, 'blue');
  s = ackRole(s, solo);
  assert.throws(() => chooseBadge(s, solo, 'orange'), code('already-ready'), 'plus de changement après confirmation');
  const classic = createGame({ names: names(4), comp: custom({ tech: 2, sab: 1, solo: 1 }) }, seeded(11));
  const solo2 = classic.roles.findIndex((r) => r.team === 'solo');
  assert.throws(() => chooseBadge(classic, solo2, 'blue'), code('badges-off'));
  assert.doesNotThrow(() => ackRole(classic, solo2), 'sans badges, rien à choisir');
});

test('consultation des câbles : chaque main est mélangée sans changer de contenu', () => {
  const rng = seeded(5);
  let s = passRoles(createGame({ names: names(6), comp: presetComposition('classic', 6) }, rng));
  const before = s.hands.map((h) => h.map((c) => c.kind).sort());
  let moved = 0;
  for (const p of [5, 1, 3, 0, 4, 2]) {
    const order = s.hands[p].map((c) => c.kind).join();
    s = ackInspect(s, p, rng);
    if (s.hands[p].map((c) => c.kind).join() !== order) moved += 1;
    if (s.phase === 'inspect') assert.equal(ackInspect(s, p, rng), s, 'pas de second mélange');
  }
  assert.equal(s.phase, 'play');
  assert.deepEqual(s.hands.map((h) => h.map((c) => c.kind).sort()), before);
  assert.ok(moved >= 1, 'au moins une main a changé d\'ordre');
  assert.equal(s.holder, 0, 'le premier joueur a la pince');
});

// ───────────────────────────────────────────── Tour de jeu

test('on ne peut pas couper ses propres câbles', () => {
  const { state } = ready(5, { firstPlayer: 2 });
  assert.throws(() => cut(state, 2, 0), code('own-wire'));
  assert.ok(legalCuts(state).every(([p]) => p !== 2));
});

test('coupes invalides refusées', () => {
  const { state } = ready(5);
  assert.throws(() => cut(state, 9, 0), code('bad-target'));
  assert.throws(() => cut(state, 1, 7), code('bad-wire'));
  const after = cut(state, 1, 0);
  const again = after.holder === 1 ? 2 : 1;
  const s2 = cut(after, again, 0);
  // le câble 0 du joueur 1 est déjà coupé
  if (s2.phase === 'play' && s2.holder !== 1) assert.throws(() => cut(s2, 1, 0), code('already-cut'));
  const { state: inRoles } = { state: createGame({ names: names(5), comp: presetComposition('classic', 5) }, seeded(1)) };
  assert.throws(() => cut(inRoles, 1, 0), code('not-playing'));
});

test('la pince passe au joueur dont le câble vient d\'être coupé', () => {
  let { state: s } = ready(6, { firstPlayer: 4, seed: 3 });
  for (const target of [1, 5, 0]) {
    const by = s.holder;
    const slot = s.hands[target].findIndex((c) => !c.cut && c.kind === WIRE.INERT);
    if (slot < 0) return; // main sans câble inerte : scénario non pertinent pour cette graine
    s = cut(s, target, slot);
    assert.equal(s.holder, target);
    assert.deepEqual(s.log.at(-1), { round: 1, by, from: target, kind: WIRE.INERT });
  }
  assert.equal(s.cuts, 3);
});

test('une action ne modifie jamais l\'état reçu', () => {
  const { state, rng } = ready(5);
  const frozen = JSON.stringify(state);
  const [p, slot] = legalCuts(state)[0];
  cut(state, p, slot);
  ackInspect({ ...state, phase: 'inspect' }, 0, rng);
  assert.equal(JSON.stringify(state), frozen);
});

// ───────────────────────────────────────────── Manches

test('une manche dure exactement autant de coupes qu\'il y a de joueurs', () => {
  for (const n of [4, 5, 6, 7, 8]) {
    let s = firstSeed((seed) => {
      let t = ready(n, { seed }).state;
      for (let i = 0; i < n - 1; i++) { t = quietCut(t); assert.equal(t.phase, 'play', `coupe ${i + 1}/${n}`); }
      return quietCut(t);
    }, n);
    assert.equal(s.phase, 'roundEnd');
    assert.equal(s.cuts, n);
    assert.throws(() => cutKind(s, WIRE.INERT), code('not-playing'));
  }
});

test('redistribution : 5 → 4 → 3 → 2 câbles, identités conservées, positions remélangées', () => {
  for (const n of [4, 5, 6, 7, 8]) {
    firstSeed((seed) => {
      let { state: s, rng } = ready(n, { seed });
      for (let round = 1; round < ROUNDS; round++) {
        while (s.phase === 'play') s = quietCut(s);
        const lastCut = s.log.at(-1).from;
        const before = tally(s);
        const hiddenBefore = hiddenCount(s);
        assert.equal(hiddenBefore, n * (handSize(round) - 1));
        assert.throws(() => ackInspect(s), code('not-inspect'));
        s = nextRound(s, rng);
        assert.equal(s.round, round + 1);
        assert.equal(s.cuts, 0);
        assert.ok(s.hands.every((h) => h.length === handSize(round + 1) && h.every((c) => !c.cut)), `manche ${round + 1} à ${n}`);
        assert.deepEqual(tally(s), before, 'aucun câble perdu ni transformé');
        assert.equal(hiddenCount(s), hiddenBefore);
        assert.equal(s.holder, lastCut, 'le dernier joueur coupé commence la manche suivante');
        assert.ok(s.ready.every((r) => !r), 'chacun doit consulter ses nouveaux câbles');
        assert.deepEqual(invariants(s), []);
        s = passInspect(s, rng);
        assert.equal(s.holder, lastCut);
      }
      assert.deepEqual([s.round, handSize(s.round)], [4, 2]);
    }, 40 + n);
  }
});

test('la redistribution dépend bien du hasard', () => {
  const { state } = ready(6, { seed: 9 });
  let s = state;
  while (s.phase === 'play') s = quietCut(s);
  const a = JSON.stringify(nextRound(s, seeded(1)).hands);
  const b = JSON.stringify(nextRound(s, seeded(2)).hands);
  assert.notEqual(a, b);
});

// ───────────────────────────────────────────── Fins de partie

/** Amène la pince chez un joueur donné en coupant un câble inerte chez lui. */
function giveTo(state, player) {
  if (state.holder === player) return state;
  const slot = state.hands[player].findIndex((c) => !c.cut && c.kind === WIRE.INERT);
  assert.ok(slot >= 0, 'câble inerte disponible');
  return cut(state, player, slot);
}

/** Fabrique une position de jeu où `cutter` tient la pince et où il reste `left` dérivations à trouver. */
function rigged(n, comp, { cutterTeam, left = 1 }) {
  const { state } = ready(n, { comp, seed: 77 });
  const s = JSON.parse(JSON.stringify(state));
  const cutter = s.roles.findIndex((r) => r.team === cutterTeam);
  assert.ok(cutter >= 0, `un joueur ${cutterTeam} à la table`);
  // On range les câbles : tout chez les autres joueurs, de façon déterministe.
  const others = [...Array(n).keys()].filter((p) => p !== cutter);
  const kinds = [WIRE.OVERLOAD, ...Array(left).fill(WIRE.BYPASS)];
  while (kinds.length < n * 5) kinds.push(WIRE.INERT);
  s.hands = Array.from({ length: n }, () => []);
  // la surcharge et les dérivations restantes chez le premier « autre », le reste inerte
  kinds.slice(0, 5).forEach((k) => s.hands[others[0]].push({ kind: k, cut: false }));
  let k = 5;
  for (const p of [cutter, ...others.slice(1)]) for (let i = 0; i < 5; i++) s.hands[p].push({ kind: kinds[k++], cut: false });
  s.found = n - left;
  s.holder = cutter;
  return { s, cutter, victim: others[0] };
}

test('victoire des Techniciens : toutes les dérivations trouvées', () => {
  for (const n of [4, 5, 6, 7, 8]) {
    const { s, cutter, victim } = rigged(n, presetComposition('classic', n), { cutterTeam: 'tech', left: 2 });
    let t = cut(s, victim, 1);
    assert.equal(t.phase, 'play');
    assert.equal(t.found, n - 1);
    t = giveTo(t, cutter);
    t = cut(t, victim, 2);
    assert.deepEqual([t.phase, t.winner, t.reason, t.endedBy], ['over', 'tech', 'bypass', cutter]);
    assert.equal(t.found, n);
    assert.throws(() => cut(t, victim, 3), code('not-playing'));
  }
});

test('victoire des Saboteurs : la surcharge est coupée (même par un Technicien)', () => {
  for (const team of ['tech', 'sab']) {
    const { s, cutter, victim } = rigged(6, presetComposition('classic', 6), { cutterTeam: team });
    const t = cut(s, victim, 0);
    assert.deepEqual([t.phase, t.winner, t.reason, t.endedBy], ['over', 'sab', 'overload', cutter]);
  }
});

/** Joue quatre manches sans jamais trouver la dernière dérivation ni la surcharge. */
function runOutTheClock(n, opts) {
  return firstSeed((seed) => {
    let { state: s, rng } = ready(n, { ...opts, seed });
    for (let round = 1; round <= 3; round++) s = burnRound(s, rng);
    assert.equal(s.round, 4);
    assert.ok(s.hands.every((h) => h.length === 2));
    while (s.phase === 'play') {
      assert.equal(s.winner, null);
      s = quietCut(s);
    }
    return s;
  }, 60 + n);
}

test('victoire des Saboteurs : fin de la quatrième manche', () => {
  for (const n of [4, 5, 6, 7, 8]) {
    const s = runOutTheClock(n);
    assert.deepEqual([s.phase, s.winner, s.reason], ['over', 'sab', 'timeout']);
    assert.equal(s.log.length, 4 * n);
    assert.ok(s.found < n);
    assert.throws(() => nextRound(s), code('not-round-end'));
  }
});

test('l\'Électron libre gagne seul s\'il coupe lui-même le câble final', () => {
  const comp = presetComposition('infiltration', 6);
  const byBypass = rigged(6, comp, { cutterTeam: 'solo' });
  const a = cut(byBypass.s, byBypass.victim, 1);
  assert.deepEqual([a.phase, a.winner, a.reason, a.endedBy], ['over', 'solo', 'bypass', byBypass.cutter]);
  const byOverload = rigged(6, comp, { cutterTeam: 'solo' });
  const b = cut(byOverload.s, byOverload.victim, 0);
  assert.deepEqual([b.phase, b.winner, b.reason, b.endedBy], ['over', 'solo', 'overload', byOverload.cutter]);
});

test('l\'Électron libre perd si un autre termine la partie, ou au temps écoulé', () => {
  const comp = presetComposition('infiltration', 6);
  const tech = rigged(6, comp, { cutterTeam: 'tech' });
  assert.equal(cut(tech.s, tech.victim, 1).winner, 'tech');
  const sab = rigged(6, comp, { cutterTeam: 'sab' });
  assert.equal(cut(sab.s, sab.victim, 0).winner, 'sab');
  // temps écoulé : personne n'a terminé la partie, l'Électron libre perd avec les Techniciens
  const s = runOutTheClock(6, { comp });
  assert.deepEqual([s.winner, s.reason], ['sab', 'timeout']);
});

test('les agents doubles gagnent avec leur équipe réelle', () => {
  const comp = custom({ tech: 3, sab: 3, mole: true, infiltrator: true, badges: 'public' });
  const { state } = ready(6, { comp, seed: 21 });
  const s = JSON.parse(JSON.stringify(state));
  const r = finalReveal({ ...s, phase: 'over' });
  const mole = r.players.find((p) => p.role === 'mole');
  const infiltrator = r.players.find((p) => p.role === 'infiltrator');
  assert.deepEqual([mole.team, mole.badge], ['sab', 'blue']);
  assert.deepEqual([infiltrator.team, infiltrator.badge], ['tech', 'orange']);
});

// ───────────────────────────────────────────── Confidentialité

const SECRET_KEYS = /"(role|team|char|roles|hands|undealt)":/;

test('la vue publique ne contient aucun secret', () => {
  for (const mode of ['classic', 'infiltration']) {
    let { state: s, rng } = ready(7, { mode, seed: 13 });
    for (let i = 0; i < 40 && s.phase !== 'over'; i++) {
      const view = publicView(s);
      const json = JSON.stringify(view);
      assert.ok(!SECRET_KEYS.test(json), `clé secrète dans la vue publique (${mode})`);
      view.players.forEach((p, i2) => {
        p.wires.forEach((w, slot) => {
          if (w.cut) assert.equal(w.kind, s.hands[i2][slot].kind);
          else assert.deepEqual(w, { cut: false }, 'un câble caché n\'expose rien');
        });
        assert.equal(p.badge, null, 'badge visible alors qu\'il ne doit pas l\'être');
      });
      if (s.phase === 'play') { const [p, slot] = legalCuts(s)[i % legalCuts(s).length]; s = cut(s, p, slot); }
      else if (s.phase === 'roundEnd') s = passInspect(nextRound(s, rng), rng);
    }
  }
});

test('badges : visibles de tous seulement avec le réglage « toute la table », et jamais pendant la distribution', () => {
  const comp = { ...presetComposition('infiltration', 6), badges: 'public' };
  const game = createGame({ names: names(6), comp }, seeded(4));
  assert.ok(publicView(game).players.every((p) => p.badge === null), 'pas de badge pendant la distribution des rôles');
  const s = passRoles(game);
  const view = publicView(s);
  assert.ok(view.players.every((p) => p.badge === 'blue' || p.badge === 'orange'));
  view.players.forEach((p, i) => assert.equal(p.badge, s.roles[i].badge));
  const off = passRoles(createGame({ names: names(6), comp: presetComposition('classic', 6) }, seeded(4)));
  assert.ok(publicView(off).players.every((p) => p.badge === null));
});

test('badges : en mode « voisin de gauche », chacun voit celui de son voisin de droite', () => {
  const game = createGame({ names: names(5), comp: presetComposition('infiltration', 5), firstPlayer: 2 }, seeded(8));
  assert.equal(privateView(game, 0).neighbor, null, 'pas de badge voisin avant que l\'Électron libre ait choisi le sien');
  const s = passRoles(game);
  for (let p = 0; p < 5; p++) {
    const mine = privateView(s, p);
    assert.equal(mine.neighbor.player, (p + 4) % 5);
    assert.equal(mine.neighbor.badge, s.roles[(p + 4) % 5].badge);
    assert.equal(mine.hand.kinds.length, 5);
    assert.equal(mine.hand.counts.overload + mine.hand.counts.bypass + mine.hand.counts.inert, 5);
  }
  const classic = passRoles(createGame({ names: names(5), comp: presetComposition('classic', 5) }, seeded(8)));
  assert.equal(privateView(classic, 0).neighbor, null);
});

test('vue privée : son rôle toujours, ses câbles seulement avant de les mélanger', () => {
  const rng = seeded(3);
  const game = createGame({ names: names(5), comp: presetComposition('infiltration', 5) }, rng);
  const solo = game.roles.findIndex((r) => r.team === 'solo');
  for (let p = 0; p < 5; p++) {
    const v = privateView(game, p);
    assert.deepEqual(v.role, { role: game.roles[p].role, team: game.roles[p].team, badge: game.roles[p].badge, char: game.roles[p].char });
    assert.equal(v.hand, null, 'pas de câbles pendant la distribution des rôles');
    assert.equal(v.needBadge, p === solo);
    assert.equal(v.seat, p);
  }
  assert.throws(() => privateView(game, 5), PrivacyError);
  let s = passRoles(game);
  assert.ok(privateView(s, 1).hand);
  s = ackInspect(s, 1, rng);
  assert.equal(privateView(s, 1).hand, null, 'après le mélange, plus personne ne revoit ses câbles');
  assert.ok(privateView(s, 2).hand, 'les autres n\'ont pas encore mélangé');
  s = passInspect(s, rng, [0, 2, 3, 4]);
  for (let p = 0; p < 5; p++) {
    assert.equal(privateView(s, p).hand, null, 'aucun câble pendant le jeu');
    assert.equal(privateView(s, p).role.role, s.roles[p].role, 'le rôle reste consultable');
  }
  // une vue privée ne contient rien sur les autres joueurs (hors badge du voisin)
  const json = JSON.stringify(privateView(s, 0));
  assert.ok(!/"(roles|hands|undealt|players|log)":/.test(json));
  assert.throws(() => finalReveal(s), PrivacyError);
});

// ───────────────────────────────────────────── Sauvegarde et hors ligne

test('reprise : un état sauvegardé en JSON se rejoue à l\'identique', () => {
  let { state: live, rng } = ready(6, { mode: 'infiltration', seed: 31 });
  let restored = JSON.parse(JSON.stringify(live));
  const rng2 = seeded(999);
  const rng3 = seeded(999);
  for (let i = 0; i < 60 && live.phase !== 'over'; i++) {
    if (live.phase === 'play') {
      const [p, slot] = legalCuts(live)[(i * 7) % legalCuts(live).length];
      live = cut(live, p, slot);
      restored = cut(JSON.parse(JSON.stringify(restored)), p, slot);
    } else if (live.phase === 'roundEnd') {
      live = nextRound(live, rng2); restored = nextRound(JSON.parse(JSON.stringify(restored)), rng3);
    } else if (live.phase === 'inspect') {
      const p = live.ready.indexOf(false);
      live = ackInspect(live, p, rng2); restored = ackInspect(JSON.parse(JSON.stringify(restored)), p, rng3);
    }
    assert.deepEqual(restored, live);
  }
  assert.ok(rng);
});

test('service worker : tous les fichiers de public/ sont mis en cache pour le hors-ligne', () => {
  const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
  const sw = path.join(root, 'sw.js');
  if (!fs.existsSync(sw)) return; // le service worker est écrit après le moteur
  const listed = new Set([...fs.readFileSync(sw, 'utf8').matchAll(/'\.\/([^']*)'/g)].map((m) => m[1]));
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
  const files = walk(root).map((f) => path.relative(root, f).split(path.sep).join('/')).filter((f) => f !== 'sw.js');
  const missing = files.filter((f) => !listed.has(f));
  assert.deepEqual(missing, [], 'fichiers absents de la liste du service worker');
  const ghosts = [...listed].filter((f) => f && !files.includes(f));
  assert.deepEqual(ghosts, [], 'fichiers listés mais inexistants');
});

test('findCut ne propose jamais un câble du porteur de la pince', () => {
  const { state } = ready(8, { seed: 2 });
  for (const kind of Object.values(WIRE)) {
    const c = findCut(state, kind);
    if (c) assert.notEqual(c[0], state.holder);
  }
});
