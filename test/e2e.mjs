// Test de bout en bout : des parties complètes jouées dans des téléphones émulés (Playwright).
//
//   node test/e2e.mjs                 lance son propre serveur local
//   URL="https://…/timebomb-game/" node test/e2e.mjs     contre le site publié
//   OUT=dossier SCALE=2 node test/e2e.mjs                captures d'écran haute définition
//
// Le test joue le rôle d'un arbitre omniscient : il lit la sauvegarde locale pour savoir quel
// câble couper et pour vérifier que l'écran ne montre que ce qu'il a le droit de montrer.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { start } from './serve.mjs';

const { chromium, devices } = createRequire(import.meta.url)('playwright');
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = process.env.OUT || path.join(HERE, 'shots');
const SCALE = Number(process.env.SCALE) || 1;
const KEY = 'coupe-circuit:v1';
const ROLE_NAME = { tech: 'Technicien', sab: 'Saboteur', mole: 'La Taupe', infiltrator: 'L’Infiltré', solo: 'L’Électron libre' };
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;

fs.mkdirSync(OUT, { recursive: true });
let server = null;
let URL_ = process.env.URL;
if (!URL_) { const s = await start(Number(process.env.PORT) || 8099); server = s.server; URL_ = s.url; }

const browser = await chromium.launch();
const errors = [];
const done = [];

// ───────────────────────────────────────────── outils

async function phone(label, options, { seed = 1, css = '' } = {}) {
  const context = await browser.newContext({ locale: 'fr-FR', serviceWorkers: 'allow', ...options });
  // hasard reproductible : chaque scénario se déroule toujours de la même façon
  await context.addInitScript((s) => {
    let a = s >>> 0;
    const next = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return (t ^ (t >>> 14)) >>> 0; };
    Object.defineProperty(crypto, 'getRandomValues', { configurable: true, value: (arr) => { for (let i = 0; i < arr.length; i++) arr[i] = next(); return arr; } });
  }, seed);
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(`${label} : ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${label} : console — ${m.text()}`); });
  await page.goto(URL_);
  await page.waitForFunction(() => window.__ccReady === true);
  if (css) await page.addStyleTag({ content: css });
  return { context, page, label };
}

const shot = async (page, name) => { await page.waitForTimeout(350); await page.screenshot({ path: path.join(OUT, `${name}.png`), scale: SCALE === 1 ? 'css' : 'device' }); };
const game = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k)).game, KEY);
const text = async (page, sel) => (await page.textContent(sel)).trim();
const passIdx = (g) => (g.holder + g.pass) % g.n;

/** Rien de secret ne doit exister dans la page sur un écran public. */
async function assertPublic(page, where, { badges = false } = {}) {
  const found = await page.evaluate(() => {
    const fronts = [...document.querySelectorAll('.wfront')].filter((el) => !el.closest('.slot.done') && !el.closest('#reveal'));
    return {
      faces: fronts.length,
      roles: document.querySelectorAll('.rolecard:not(.back), .reminder-card, #app .portrait, .badge-pick, #neighborBadge, #handSummary').length,
      hiddenKinds: [...document.querySelectorAll('.mini:not(.cut)')].filter((el) => el.className !== 'mini').length,
      words: /Saboteur|Technicien|Taupe|Infiltré|Électron libre/i.test(document.getElementById('app').innerText),
      badges: document.querySelectorAll('.bdot, .badge-chip').length,
    };
  });
  const expectBadges = found.badges;
  assert.deepEqual({ ...found, badges: 0 }, { faces: 0, roles: 0, hiddenKinds: 0, words: false, badges: 0 }, `fuite d'information sur l'écran « ${where} »`);
  if (!badges) assert.equal(expectBadges, 0, `badge visible sur l'écran « ${where} »`);
}

async function setup(page, { n, names, mode, first, tweak }) {
  await page.click('#btnNew');
  await page.waitForSelector('#countPick');
  await page.click(`#countPick button[data-v="${n}"]`);
  for (let i = 0; i < n; i++) await page.locator('.name-input').nth(i).fill(names[i]);
  if (mode) await page.click(`#modePick button[data-v="${mode}"]`);
  if (tweak) await tweak(page);
  if (first != null) await page.click(`#firstPick [data-first="${first}"]`);
}
const launch = async (page) => { await page.click('#btnLaunch'); await page.waitForSelector('#handoffName'); };

/** Distribution des rôles : chaque joueur confirme, révèle, vérifie, masque. */
async function passRoles(page, { badge = 'blue', shots = null, onSecond = null } = {}) {
  let turn = 0;
  for (;;) {
    const g = await game(page);
    if (g.phase !== 'roles') break;
    const p = passIdx(g);
    assert.equal(await text(page, '#handoffName'), g.players[p].name, 'le téléphone est demandé au bon joueur');
    await assertPublic(page, 'passage du téléphone (rôles)');
    if (shots && turn === 0) await shot(page, `${shots}-handoff`);
    await page.click('#btnIam');
    await page.waitForSelector('#btnReveal');
    assert.equal(await page.locator('.rolecard:not(.back)').count(), 0, 'le rôle n\'est pas affiché avant d\'être demandé');
    assert.ok(await page.locator('#btnHide').isDisabled(), 'impossible de passer sans avoir vu sa carte');
    if (onSecond && turn === 1) { await onSecond(page, g, p); continue; }
    await page.click('#btnReveal');
    const role = g.roles[p];
    assert.equal(await text(page, '.rolecard .rc-name'), ROLE_NAME[role.role], `carte Rôle de ${g.players[p].name}`);
    if (role.team === 'solo' && g.comp.badges !== 'off') {
      assert.ok(await page.locator('#btnHide').isDisabled(), 'l\'Électron libre doit choisir un badge');
      if (shots) await shot(page, `${shots}-role-solo`);
      await page.click(`.badge-pick.${badge}`);
      assert.equal((await game(page)).roles[p].badge, badge);
    } else if (role.badge) {
      assert.ok((await text(page, '.rc-badge')).includes(role.badge === 'blue' ? 'bleu' : 'orange'));
    }
    if (shots && turn === 0) await shot(page, `${shots}-role`);
    // cacher / revoir : la carte disparaît vraiment de la page
    if (turn === 0) {
      await page.click('#btnReveal');
      assert.equal(await page.locator('.rolecard:not(.back)').count(), 0);
      await page.click('#btnReveal');
    }
    await page.click('#btnHide');
    await page.waitForFunction((k) => { const s = JSON.parse(localStorage.getItem(k)).game; return s.phase !== 'roles' || document.querySelector('#handoffName'); }, KEY);
    turn += 1;
  }
}

/** Consultation des câbles : chaque joueur révèle, vérifie, mélange. */
async function passInspect(page, { shots = null } = {}) {
  let turn = 0;
  for (;;) {
    const g = await game(page);
    if (g.phase !== 'inspect') break;
    const p = passIdx(g);
    assert.equal(await text(page, '#handoffName'), g.players[p].name);
    await assertPublic(page, 'passage du téléphone (câbles)', { badges: g.comp.badges === 'public' });
    await page.click('#btnIam');
    await page.waitForSelector('#btnReveal');
    assert.equal(await page.locator('.wfront').count(), 0, 'aucun câble visible avant la demande');
    assert.equal(await page.locator('.wire-row .wcard').count(), g.hands[p].length);
    await page.click('#btnReveal');
    assert.equal(await page.locator('.wfront').count(), g.hands[p].length);
    const summary = await text(page, '#handSummary');
    const count = (k) => g.hands[p].filter((c) => c.kind === k).length;
    assert.ok(summary.includes(`${count('bypass')} dérivation`), `résumé des câbles : ${summary}`);
    assert.ok(summary.includes(`${count('inert')} câble`), `résumé des câbles : ${summary}`);
    assert.equal(summary.includes('Surcharge'), count('overload') === 1);
    if (g.comp.badges === 'neighbor') {
      const right = (p - 1 + g.n) % g.n;
      const line = await text(page, '#neighborBadge');
      assert.ok(line.includes(g.players[right].name) && line.includes(g.roles[right].badge === 'blue' ? 'bleu' : 'orange'), `badge du voisin : ${line}`);
    } else {
      assert.equal(await page.locator('#neighborBadge').count(), 0);
    }
    if (turn === 0) {
      await page.click('#btnRemind');
      assert.ok((await text(page, '#reminderCard')).includes(ROLE_NAME[g.roles[p].role]));
      if (shots) await shot(page, `${shots}-cables`);
      await page.click('#btnRemind');
      assert.equal(await page.locator('#reminderCard').count(), 0);
    }
    await page.click('#btnMix');
    await page.waitForSelector('#btnReady');
    assert.equal(await page.locator('.wfront').count(), 0, 'les câbles sont de nouveau cachés');
    const after = await game(page);
    assert.deepEqual(after.hands[p].map((c) => c.kind).sort(), g.hands[p].map((c) => c.kind).sort(), 'le mélange conserve les câbles');
    if (shots && turn === 0) await shot(page, `${shots}-melange`);
    await page.click('#btnReady');
    turn += 1;
  }
  await page.waitForSelector('.table');
}

function find(g, kinds, prefer = null) {
  const order = [...g.players.keys()].filter((p) => p !== g.holder);
  if (prefer != null && prefer !== g.holder) order.sort((a, b) => (a === prefer ? -1 : b === prefer ? 1 : 0));
  for (const p of order) {
    const slot = g.hands[p].findIndex((c) => !c.cut && kinds.includes(c.kind));
    if (slot >= 0) return [p, slot];
  }
  return null;
}
/** Coupe qui ne termine pas la partie. */
const quiet = (g, prefer) => find(g, ['inert'], prefer) || (g.found < g.n - 1 ? find(g, ['bypass'], prefer) : null);

async function cutWire(page, [target, slot], { shots = null } = {}) {
  const before = await game(page);
  await page.click(`.seat[data-seat="${target}"]`);
  await page.waitForSelector('#targetWires');
  assert.ok(await page.locator('#btnCut').isDisabled(), 'pas de coupe sans sélection');
  // on change d'avis une fois : la sélection se corrige avant la coupe
  const other = before.hands[target].findIndex((c, i) => !c.cut && i !== slot);
  if (other >= 0) {
    await page.click(`#targetWires .slot[data-slot="${other}"]`);
    assert.equal(await page.locator('#targetWires .slot.sel').count(), 1);
  }
  await page.click(`#targetWires .slot[data-slot="${slot}"]`);
  assert.equal(await page.locator('#targetWires .slot.sel').getAttribute('data-slot'), String(slot));
  assert.equal(await page.locator('#targetWires .wfront').count(), before.hands[target].filter((c) => c.cut).length, 'seuls les câbles déjà coupés montrent leur face');
  if (shots) await shot(page, `${shots}-choix`);
  await page.click('#btnCut');
  await page.waitForSelector('#reveal.shown');
  const after = await game(page);
  const kind = before.hands[target][slot].kind;
  assert.deepEqual(after.log.at(-1), { round: before.round, by: before.holder, from: target, kind });
  assert.equal(after.holder, target, 'la pince passe au joueur coupé');
  const title = await text(page, '#revealTitle');
  assert.ok({ inert: /inerte/i, bypass: /Dérivation/, overload: /Surcharge/ }[kind].test(title), `révélation : ${title}`);
  if (shots) await shot(page, `${shots}-revelation-${kind}`);
  await page.click('#btnContinue');
  await page.waitForSelector('#reveal', { state: 'detached' });
  return after;
}

async function checkTable(page, where = 'table') {
  const g = await game(page);
  await assertPublic(page, where, { badges: g.comp.badges === 'public' });
  assert.equal(await text(page, '#holderName'), g.players[g.holder].name);
  assert.equal(await page.locator('.seat.holder').getAttribute('data-seat'), String(g.holder), 'la pince est affichée chez le bon joueur');
  assert.equal(await page.locator('.seat').count(), g.n);
  assert.equal(await page.locator('.mini.cut').count(), g.cuts);
  assert.equal(await page.locator('.mini:not(.cut)').count(), g.hands.flat().filter((c) => !c.cut).length);
  assert.ok((await text(page, '#hudRound')).includes(`${g.round}/4`));
  assert.ok((await text(page, '#hudCuts')).includes(`${g.cuts}/${g.n}`));
  assert.ok((await text(page, '#hudFound')).includes(`${g.found}/${g.n}`));
  // rien ne déborde de l'écran
  const fit = await page.evaluate(() => ({ w: document.documentElement.scrollWidth <= innerWidth, h: document.querySelector('.table').getBoundingClientRect().height <= innerHeight + 1 }));
  assert.deepEqual(fit, { w: true, h: true }, 'la table tient dans l\'écran');
  const small = await page.evaluate(() => [...document.querySelectorAll('.seat, .icon-btn, .turnbar .btn')].filter((el) => { const r = el.getBoundingClientRect(); return r.width < 44 || r.height < 44; }).length);
  assert.equal(small, 0, 'toutes les cibles tactiles font au moins 44 px');
  return g;
}

async function nextRound(page, { shots = null } = {}) {
  await page.waitForSelector('#btnDeal');
  const g = await game(page);
  await assertPublic(page, 'fin de manche');
  assert.ok((await text(page, '#roundEndTitle')).includes(`Manche ${g.round}`));
  assert.equal(await text(page, '#reFound'), `${g.found}/${g.n}`);
  assert.equal(await text(page, '#reHidden'), String(g.hands.flat().filter((c) => !c.cut).length));
  assert.equal(await text(page, '#nextStarter'), g.players[g.holder].name, 'le dernier joueur coupé commence la manche suivante');
  if (shots) await shot(page, `${shots}-fin-de-manche`);
  await page.click('#btnDeal');
  await page.waitForSelector('#handoffName');
  const after = await game(page);
  assert.equal(after.round, g.round + 1);
  assert.ok(after.hands.every((h) => h.length === 5 - g.round), 'un câble de moins par joueur');
  assert.equal(await text(page, '#handoffName'), g.players[g.holder].name);
}

async function scenario(name, fn) {
  if (ONLY && !ONLY.includes(name)) return;
  const t = Date.now();
  await fn();
  done.push(`${name} (${((Date.now() - t) / 1000).toFixed(1)} s)`);
  console.log(`✓ ${name}`);
}

const IPHONE_UA = devices['iPhone 13'].userAgent;
const view = (width, height) => ({ viewport: { width, height }, deviceScaleFactor: SCALE, isMobile: true, hasTouch: true, userAgent: IPHONE_UA });

// ───────────────────────────────────────────── scénarios

await scenario('classique-5-joueurs-victoire-techniciens', async () => {
  const { page, context } = await phone('iPhone 13', { ...devices['iPhone 13'] }, { seed: 11 });
  await shot(page, 'a-accueil');
  await page.click('#btnRules');
  await page.waitForSelector('.rules');
  await page.click('.topbar .icon-btn');
  await setup(page, { n: 5, names: ['Léa', 'Tom', 'Inès', 'Noé', 'Jade'], first: 2 });
  await shot(page, 'a-configuration');
  await launch(page);
  let g = await game(page);
  assert.deepEqual([g.n, g.comp.tech, g.comp.sab, g.undealt.length, g.holder], [5, 3, 2, 0, 2]);

  await passRoles(page, {
    shots: 'a',
    onSecond: async (p2, state, p) => {
      // actualisation pendant une consultation privée : retour à l'écran neutre du même joueur
      await p2.click('#btnReveal');
      assert.equal(await p2.locator('.rolecard:not(.back)').count(), 1);
      await p2.reload();
      await p2.waitForFunction(() => window.__ccReady === true);
      assert.equal(await text(p2, '#handoffName'), state.players[p].name);
      await assertPublic(p2, 'reprise après actualisation');
      // passage en arrière-plan : l'écran privé disparaît
      await p2.click('#btnIam');
      await p2.click('#btnReveal');
      await p2.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
      await p2.waitForSelector('#btnIam');
      await assertPublic(p2, 'retour d\'arrière-plan');
      await p2.evaluate(() => { delete document.hidden; });
      // geste « retour » : on reste dans l'appli, sur l'écran neutre
      await p2.click('#btnIam');
      await p2.click('#btnReveal');
      await p2.goBack().catch(() => {});
      await p2.waitForTimeout(200);
      assert.ok(p2.url().startsWith(URL_.split('?')[0]), 'le retour ne quitte pas l\'application');
      await p2.click('#btnHide');
    },
  });
  await passInspect(page, { shots: 'a' });
  g = await checkTable(page);
  assert.equal(g.holder, 2, 'le premier joueur choisi tient la pince');
  await shot(page, 'a-table');

  // on ne coupe pas ses propres câbles
  await page.click(`.seat[data-seat="${g.holder}"]`);
  assert.equal(await page.locator('#targetWires').count(), 0);
  await page.waitForSelector('.toast');

  // manche 1 : rien de décisif, avec une actualisation en plein milieu
  for (let i = 0; i < 5; i++) {
    g = await game(page);
    await cutWire(page, quiet(g), { shots: i === 0 ? 'a' : null });
    if (i === 1) {
      await page.reload();
      await page.waitForFunction(() => window.__ccReady === true);
      await page.waitForSelector('.table');
      const again = await checkTable(page, 'table après actualisation');
      assert.equal(again.log.length, 2, 'la partie reprend exactement où elle en était');
      await page.click('#btnHistory');
      await page.waitForSelector('.history .hist-row');
      assert.equal(await page.locator('.history .hist-row').count(), 2);
      await shot(page, 'a-historique');
      await page.goBack().catch(() => {}); // le retour ferme la feuille, rien d'autre
      await page.waitForSelector('.history', { state: 'detached' });
      await page.waitForSelector('.table');
    }
    if (i < 4) await checkTable(page);
  }
  await nextRound(page, { shots: 'a' });
  await passInspect(page);
  g = await checkTable(page);
  assert.equal(g.round, 2);
  assert.ok(g.hands.every((h) => h.length === 4));

  // les Techniciens trouvent toutes les dérivations
  for (let guard = 0; guard < 40; guard++) {
    g = await game(page);
    if (g.phase === 'over') break;
    if (g.phase === 'roundEnd') { await nextRound(page); await passInspect(page); continue; }
    const soloOrNot = find(g, ['bypass']) || find(g, ['inert']);
    await cutWire(page, soloOrNot, { shots: g.found === g.n - 1 && find(g, ['bypass']) ? 'a-final' : null });
  }
  g = await game(page);
  assert.deepEqual([g.phase, g.winner, g.reason], ['over', 'tech', 'bypass']);
  await page.waitForSelector('.over.safe');
  assert.equal(await text(page, '#overTitle'), 'Victoire des Techniciens');
  await shot(page, 'a-victoire-techniciens');
  assert.equal(await page.locator('#rolesReveal .role-row').count(), 0, 'les rôles ne sont révélés que sur demande');
  await page.click('#btnRevealRoles');
  assert.equal(await page.locator('#rolesReveal .role-row').count(), 5);
  await shot(page, 'a-roles-reveles');

  // rejouer avec les mêmes joueurs
  await page.click('#btnReplay');
  await page.waitForSelector('#handoffName');
  const fresh = await game(page);
  assert.deepEqual([fresh.phase, fresh.round, fresh.log.length, fresh.players.map((p) => p.name).join()], ['roles', 1, 0, 'Léa,Tom,Inès,Noé,Jade']);
  await context.close();
});

await scenario('infiltration-6-joueurs-victoire-electron-libre', async () => {
  const { page, context } = await phone('Pixel 7', { ...devices['Pixel 7'] }, { seed: 23 });
  await setup(page, { n: 6, names: ['Ana', 'Ben', 'Chloé', 'Dov', 'Emma', 'Farid'], mode: 'infiltration', first: 'random' });
  await page.locator('#modeHelp').scrollIntoViewIfNeeded();
  await shot(page, 'b-configuration-infiltration');
  await page.click('.acc[data-doc="solo"] summary');
  await page.locator('.acc[data-doc="solo"]').scrollIntoViewIfNeeded();
  await shot(page, 'b-fiche-role');
  await page.click('.comp-row.c-solo .info-btn');
  await page.waitForSelector('.sheet.open .doc');
  await shot(page, 'b-fiche-role-feuille');
  await page.click('.sheet .icon-btn');
  await page.waitForSelector('.sheet', { state: 'detached' });
  await launch(page);
  let g = await game(page);
  assert.deepEqual([g.comp.tech, g.comp.sab, g.comp.solo, g.comp.badges, g.undealt.length], [3, 2, 1, 'neighbor', 0]);
  assert.equal(g.roles.filter((r) => r.role === 'mole').length, 1);
  assert.equal(g.roles.filter((r) => r.role === 'infiltrator').length, 1);
  const solo = g.roles.findIndex((r) => r.team === 'solo');

  await passRoles(page, { badge: 'orange', shots: 'b' });
  assert.equal((await game(page)).roles[solo].badge, 'orange');
  await passInspect(page, { shots: 'b' });
  await checkTable(page);
  await shot(page, 'b-table');

  // l'Électron libre doit couper lui-même le câble final : on lui amène la pince, puis il coupe la Surcharge
  for (let guard = 0; guard < 60; guard++) {
    g = await game(page);
    if (g.phase === 'over') break;
    if (g.phase === 'roundEnd') { await nextRound(page); await passInspect(page); continue; }
    if (g.holder === solo && find(g, ['overload'])) { await cutWire(page, find(g, ['overload']), { shots: 'b' }); continue; }
    await cutWire(page, quiet(g, solo));
  }
  g = await game(page);
  assert.deepEqual([g.phase, g.winner, g.reason, g.endedBy], ['over', 'solo', 'overload', solo]);
  await page.waitForSelector('.over.solo');
  assert.ok((await text(page, '#overTitle')).includes(g.players[solo].name));
  await shot(page, 'b-victoire-electron-libre');
  await page.click('#btnRevealRoles');
  assert.equal(await page.locator('#rolesReveal .role-row').count(), 6);
  await context.close();
});

await scenario('perso-4-joueurs-badges-publics-surcharge', async () => {
  const { page, context } = await phone('iPhone SE', view(375, 667), { seed: 5 });
  await setup(page, {
    n: 4, names: ['Zoé', 'Yan', 'Zoé', 'Wim'], mode: 'custom',
    tweak: async (p) => {
      // trop peu de cartes : lancement impossible
      await p.click('.comp-row.c-tech .step:first-child');
      await p.click('.comp-row.c-tech .step:first-child');
      await p.click('.comp-row.c-sab .step:first-child');
      assert.equal(await text(p, '#count-tech'), '1');
      assert.ok((await text(p, '#compSummary')).includes('Il manque 2 cartes'));
      assert.ok(await p.locator('#btnLaunch').isDisabled());
      await shot(p, 'c-configuration-invalide');
      for (let i = 0; i < 2; i++) await p.click('.comp-row.c-tech .step:last-child');
      await p.click('.comp-row.c-sab .step:last-child');
      // un agent double active les badges tout seul
      await p.locator('#sw-mole').check();
      assert.equal(await p.locator('#badgePick button.sel').getAttribute('data-v'), 'neighbor');
      await p.click('#badgePick button[data-v="public"]');
      assert.ok((await text(p, '#compSummary')).includes('5 cartes Rôle pour 4 joueurs'));
      assert.equal(await p.locator('#modePick button.sel').getAttribute('data-v'), 'custom');
    },
  });
  // deux joueurs portent le même prénom : refusé
  await page.click('#btnLaunch');
  await page.waitForSelector('.toast.warn');
  assert.equal(await page.locator('#handoffName').count(), 0);
  await page.locator('.name-input').nth(2).fill('Xu');
  await page.locator('.name-input').nth(2).blur();
  // changement d'ordre autour de la table
  await page.click('.name-row:nth-child(4) .icon-btn[aria-label^="Monter"]');
  assert.deepEqual(await page.locator('.name-input').evaluateAll((els) => els.map((e) => e.value)), ['Zoé', 'Yan', 'Wim', 'Xu']);
  await page.click('#firstPick [data-first="3"]');
  await launch(page);
  let g = await game(page);
  assert.deepEqual([g.players.map((p) => p.name).join(), g.holder, g.undealt.length, g.comp.badges], ['Zoé,Yan,Wim,Xu', 3, 1, 'public']);

  await passRoles(page);
  await passInspect(page);
  g = await checkTable(page);
  // badges publics : un par joueur, à la bonne couleur
  for (let i = 0; i < g.n; i++) {
    assert.ok(await page.locator(`.seat[data-seat="${i}"] .bdot.${g.roles[i].badge}`).count(), `badge du joueur ${i}`);
  }
  await shot(page, 'c-table-badges-publics');
  for (let guard = 0; guard < 30; guard++) {
    g = await game(page);
    if (g.phase === 'over') break;
    if (g.phase === 'roundEnd') { await nextRound(page); await passInspect(page); continue; }
    await cutWire(page, find(g, ['overload']) || quiet(g), { shots: find(g, ['overload']) ? 'c' : null });
  }
  g = await game(page);
  assert.deepEqual([g.phase, g.winner, g.reason], ['over', 'sab', 'overload']);
  await page.waitForSelector('.over.boom');
  assert.equal(await text(page, '#overTitle'), 'Victoire des Saboteurs');
  await shot(page, 'c-victoire-saboteurs');
  await page.click('#btnRevealRoles');
  assert.equal(await page.locator('#rolesReveal .role-row').count(), 5, '4 joueurs + 1 carte non distribuée');
  assert.equal(await page.locator('#rolesReveal .role-row.undealt').count(), 1);
  await page.click('#btnHome');
  await page.waitForSelector('#btnNew');
  assert.equal(await page.locator('#btnResume').count(), 0);
  await context.close();
});

await scenario('classique-8-joueurs-petit-ecran-temps-ecoule', async () => {
  const { page, context } = await phone('Android 360×640', { ...view(360, 640), userAgent: devices['Pixel 7'].userAgent }, { seed: 4 });
  // animations coupées depuis l'accueil
  await page.click('.toggles .icon-btn[title="Animations"]');
  assert.ok(await page.evaluate(() => document.documentElement.classList.contains('reduced')));
  await page.click('.toggles .icon-btn[title="Sons"]');
  await setup(page, { n: 8, names: ['Alix', 'Basile', 'Capucine', 'Dorian', 'Élodie', 'Félix', 'Gabrielle', 'Hippolyte'] });
  await shot(page, 'd-configuration-8');
  await launch(page);
  let g = await game(page);
  assert.deepEqual([g.n, g.comp.tech, g.comp.sab, g.undealt.length], [8, 5, 3, 0]);
  await passRoles(page);
  await passInspect(page, { shots: 'd' });
  await checkTable(page);
  await shot(page, 'd-table-8');
  for (let guard = 0; guard < 80; guard++) {
    g = await game(page);
    if (g.phase === 'over') break;
    if (g.phase === 'roundEnd') { await nextRound(page); await passInspect(page); await checkTable(page); continue; }
    const c = quiet(g);
    assert.ok(c, 'une coupe neutre est disponible (sinon changer la graine du scénario)');
    await cutWire(page, c);
  }
  g = await game(page);
  assert.deepEqual([g.phase, g.winner, g.reason, g.round, g.log.length], ['over', 'sab', 'timeout', 4, 32]);
  await page.waitForSelector('.over.boom');
  await shot(page, 'd-temps-ecoule');
  // le menu : abandon avec confirmation
  await page.click('#btnNewSetup');
  await page.waitForSelector('#countPick');
  assert.equal(await page.locator('.name-input').first().inputValue(), 'Alix', 'les prénoms sont conservés');
  await context.close();
});

await scenario('hors-ligne', async () => {
  const { page, context } = await phone('iPhone 15 Pro Max', view(430, 932), { seed: 9 });
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null || navigator.serviceWorker.ready.then(() => true));
  await page.reload(); // la page est désormais servie par le service worker
  await page.waitForFunction(() => window.__ccReady === true && !!navigator.serviceWorker.controller);
  await context.setOffline(true);
  await page.reload();
  await page.waitForFunction(() => window.__ccReady === true);
  await shot(page, 'e-accueil-hors-ligne');
  await setup(page, { n: 7, names: ['Un', 'Deux', 'Trois', 'Quatre', 'Cinq', 'Six', 'Sept'], mode: 'infiltration' });
  await launch(page);
  let g = await game(page);
  assert.equal(g.undealt.length, 0);
  await passRoles(page);
  await passInspect(page);
  await checkTable(page);
  await shot(page, 'e-table-7-hors-ligne');
  for (let i = 0; i < 3; i++) { g = await game(page); await cutWire(page, quiet(g)); }
  await page.reload(); // toujours sans réseau
  await page.waitForFunction(() => window.__ccReady === true);
  await page.waitForSelector('.table');
  g = await checkTable(page, 'table après actualisation hors ligne');
  assert.equal(g.log.length, 3);
  // abandon de la partie depuis le menu, avec confirmation
  await page.click('#btnMenu');
  await page.click('#menuQuit');
  await page.click('.confirm .btn.ghost');
  await page.waitForTimeout(350);
  assert.ok((await game(page)) !== null, 'annuler ne supprime rien');
  await page.click('#menuQuit');
  await page.click('.confirm .btn.danger');
  await page.waitForSelector('#btnNew');
  assert.equal(await game(page), null);
  await context.close();
});

await scenario('encoche-et-barre-d-accueil', async () => {
  // Playwright n'émule pas les zones de sécurité : on les simule pour vérifier que rien ne passe dessous.
  const css = ':root{--safe-t:59px;--safe-b:34px}';
  const { page, context } = await phone('iPhone 15', view(393, 852), { seed: 3, css });
  await shot(page, 'f-accueil-encoche');
  await setup(page, { n: 6, names: ['Ana', 'Ben', 'Chloé', 'Dov', 'Emma', 'Farid'] });
  await launch(page);
  await passRoles(page);
  await passInspect(page);
  await page.addStyleTag({ content: css });
  await checkTable(page);
  const box = await page.evaluate(() => { const hud = document.querySelector('.hud').getBoundingClientRect(); const bar = document.querySelector('.turnbar').getBoundingClientRect(); return { top: hud.top, bottom: innerHeight - bar.bottom }; });
  assert.ok(box.top >= 59 && box.bottom >= 34, `zones de sécurité respectées (${JSON.stringify(box)})`);
  await shot(page, 'f-table-encoche');
  await context.close();
});

// ───────────────────────────────────────────── bilan

await browser.close();
if (server) server.close();
if (errors.length) {
  console.error(`\n✗ Erreurs dans la page :\n  ${[...new Set(errors)].join('\n  ')}`);
  process.exit(1);
}
console.log(`\n✓ ${done.length} scénarios de bout en bout réussis :\n  ${done.join('\n  ')}\n  Captures : ${OUT}`);
