// Simulation : joue des milliers de parties aléatoires dans tous les modes et vérifie
// les invariants du moteur après chaque action.
// Usage : node test/simulate.mjs [parties par configuration]
import { createGame, cut, nextRound } from '../public/engine/game.js';
import { presetComposition, validateComposition } from '../public/engine/rules.js';
import { publicView } from '../public/state/privacy.js';
import { seeded, names, passRoles, passInspect, legalCuts, invariants } from './helpers.mjs';

const GAMES = Number(process.argv[2]) || 400;
const SECRET = /"(role|team|char|roles|hands|undealt)":/;
let total = 0;
const rows = [];

function randomComp(n, rng) {
  for (;;) {
    const comp = {
      tech: 1 + Math.floor(rng() * 6),
      sab: 1 + Math.floor(rng() * 4),
      solo: rng() < 0.5 ? 1 : 0,
      mole: rng() < 0.4,
      infiltrator: rng() < 0.4,
      badges: ['off', 'neighbor', 'public'][Math.floor(rng() * 3)],
    };
    if (validateComposition(comp, n).ok) return comp;
  }
}

function check(state, label) {
  const bad = invariants(state);
  if (SECRET.test(JSON.stringify(publicView(state)))) bad.push('secret dans la vue publique');
  if (bad.length) {
    console.error(`✗ ${label}\n  ${bad.join('\n  ')}`);
    process.exit(1);
  }
}

for (const mode of ['classic', 'infiltration', 'custom']) {
  for (let n = 4; n <= 8; n++) {
    const wins = { tech: 0, sab: 0, solo: 0 };
    const reasons = { bypass: 0, overload: 0, timeout: 0 };
    let cutsSum = 0;
    for (let g = 0; g < GAMES; g++) {
      const rng = seeded(n * 100003 + g * 7919 + mode.length);
      const comp = mode === 'custom' ? randomComp(n, rng) : presetComposition(mode, n);
      const label = `${mode} · ${n} joueurs · partie ${g}`;
      let s = createGame({ names: names(n), comp, firstPlayer: Math.floor(rng() * n) }, rng);
      check(s, label);
      s = passInspect(passRoles(s), rng);
      check(s, label);
      let guard = 0;
      while (s.phase !== 'over') {
        if (++guard > 200) { console.error(`✗ ${label} : partie sans fin`); process.exit(1); }
        if (s.phase === 'play') {
          const moves = legalCuts(s);
          if (!moves.length) { console.error(`✗ ${label} : aucune coupe possible`); process.exit(1); }
          const [p, slot] = moves[Math.floor(rng() * moves.length)];
          s = cut(s, p, slot);
        } else if (s.phase === 'roundEnd') {
          s = passInspect(nextRound(s, rng), rng);
        }
        check(s, label);
      }
      if (s.log.length > 4 * n) { console.error(`✗ ${label} : trop de coupes`); process.exit(1); }
      wins[s.winner] += 1;
      reasons[s.reason] += 1;
      cutsSum += s.log.length;
      total += 1;
    }
    rows.push({ mode, joueurs: n, Techniciens: wins.tech, Saboteurs: wins.sab, 'Électron libre': wins.solo, dérivations: reasons.bypass, surcharge: reasons.overload, 'temps écoulé': reasons.timeout, 'coupes moy.': (cutsSum / GAMES).toFixed(1) });
  }
}
console.table(rows);
console.log(`✓ ${total} parties aléatoires jouées jusqu'au bout, invariants respectés à chaque action.`);
console.log('  (Coupes tirées au hasard : ces proportions ne reflètent pas des parties jouées par des humains.)');
