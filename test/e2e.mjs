// Test de bout en bout : de vraies parties, un téléphone émulé par joueur (Playwright),
// reliés par un relais MQTT local.
//
//   node test/e2e.mjs                       tous les scénarios
//   ONLY=classique-5 node test/e2e.mjs      un seul scénario
//   OUT=dossier SCALE=2 node test/e2e.mjs   captures d'écran haute définition
//
// Le test joue l'arbitre : il lit l'état complet dans le stockage du téléphone de l'hôte pour
// savoir quel câble couper et vérifier que chaque écran ne montre que ce qu'il a le droit de montrer.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { start, startBroker } from './serve.mjs';

const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');
const mqtt = require('mqtt');
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = process.env.OUT || path.join(HERE, 'shots');
const SCALE = Number(process.env.SCALE) || 1;
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const ROLE_NAME = { tech: 'Technicien', sab: 'Saboteur', mole: 'La Taupe', infiltrator: 'L’Infiltré', solo: 'L’Électron libre' };
const NS = 'coupe-circuit-v1';
fs.mkdirSync(OUT, { recursive: true });

const web = await start(Number(process.env.PORT) || 8099);
const relay = await startBroker(Number(process.env.BROKER_PORT) || 8883);
const APP = `${web.url}?broker=${encodeURIComponent(relay.url)}`;
const browser = await chromium.launch();
const errors = [];
const done = [];

// ───────────────────────────────────────────── outils

const IPHONE = devices['iPhone 13'];
const sized = (width, height, ua = IPHONE.userAgent) => ({ viewport: { width, height }, deviceScaleFactor: SCALE, isMobile: true, hasTouch: true, userAgent: ua });

async function phone(label, device = IPHONE, { motion = false, url = APP } = {}) {
  const context = await browser.newContext({ ...device, deviceScaleFactor: SCALE, locale: 'fr-FR' });
  await context.addInitScript((m) => {
    if (!localStorage.getItem('cc:prefs')) localStorage.setItem('cc:prefs', JSON.stringify({ name: '', sound: false, motion: m }));
  }, motion);
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(`${label} : ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${label} : console — ${m.text()}`); });
  await page.goto(url);
  await page.waitForFunction(() => window.__ccReady === true);
  const p = { label, context, page };
  p.id = await page.evaluate(() => JSON.parse(localStorage.getItem('cc:device')).id);
  return p;
}
async function reload(p) {
  await p.page.reload();
  await p.page.waitForFunction(() => window.__ccReady === true);
}
const shot = async (p, name) => { await p.page.waitForTimeout(300); await p.page.screenshot({ path: path.join(OUT, `${name}.png`) }); };
const text = async (page, sel) => (await page.textContent(sel)).trim();
const hostState = (host) => host.page.evaluate(() => JSON.parse(localStorage.getItem('cc:host')));
async function until(fn, what, timeout = 15000) {
  const t = Date.now();
  for (;;) {
    if (await fn().catch(() => false)) return;
    if (Date.now() - t > timeout) throw new Error(`Délai dépassé : ${what}`);
    await new Promise((r) => setTimeout(r, 60));
  }
}
const phaseIs = async (host, phase) => (await hostState(host)).game?.phase === phase;
const phoneOf = (phones, id) => phones.find((p) => p.id === id);

/** Aucun secret ne doit être visible ni présent dans la page sur un écran public. */
async function assertPublic(p, where) {
  const found = await p.page.evaluate(() => ({
    faces: [...document.querySelectorAll('#app .wfront')].length,
    roles: document.querySelectorAll('#app .rolecard:not(.back), #app .portrait').length,
    hiddenKinds: [...document.querySelectorAll('.mini:not(.cut)')].filter((el) => !/^mini( aim)?$/.test(el.className)).length,
    words: /Saboteur|Technicien|Taupe|Infiltré|Électron libre/i.test(document.getElementById('app').innerText),
  }));
  assert.deepEqual(found, { faces: 0, roles: 0, hiddenKinds: 0, words: false }, `fuite d'information chez ${p.label} (${where})`);
}

/** Écoute tout le trafic du relais pour une partie. */
function spy(code) {
  const seen = [];
  const c = mqtt.connect(relay.url);
  c.on('connect', () => c.subscribe(`${NS}/${code}/#`));
  c.on('message', (topic, payload) => seen.push({ topic, raw: payload.toString() }));
  return { seen, end: () => c.end(true) };
}
function assertSealed(seen) {
  const secrets = /"(role|team|char|roles|hands|undealt|kinds|counts|neighbor)":/;
  let n = 0;
  for (const { topic, raw } of seen) {
    if (!raw) continue;
    const kind = topic.split('/')[2];
    const msg = JSON.parse(raw);
    if (kind === 'state' && msg.game?.phase !== 'over') assert.ok(!secrets.test(raw), 'secret en clair dans l\'état public');
    if (kind === 'p') { assert.deepEqual(Object.keys(msg).sort(), ['ct', 'iv']); n += 1; }
    if (kind === 'c' && msg.t !== 'join') assert.deepEqual(Object.keys(msg), ['box']);
  }
  assert.ok(n > 0, 'des états privés chiffrés ont circulé');
}

// ── salon

async function createTable(host, guests, { invite = 1 } = {}) {
  await host.page.fill('#name', host.label);
  await host.page.click('#btnCreate');
  await host.page.waitForSelector('#roomCode');
  const code = await text(host.page, '#roomCode');
  for (const [i, g] of guests.entries()) {
    if (i < invite) {
      // arrivée par le lien d'invitation
      await g.page.goto(`${APP}&room=${code}`);
      await g.page.waitForFunction(() => window.__ccReady === true);
      await g.page.fill('#name', g.label);
      assert.ok((await text(g.page, '.invite')).includes(code));
      await g.page.click('#btnJoinInvite');
    } else {
      await g.page.fill('#name', g.label);
      await g.page.fill('#code', code.toLowerCase());
      await g.page.click('#btnJoin');
    }
    await g.page.waitForSelector('#members');
    await until(async () => (await host.page.locator('#members li').count()) === i + 2, `${g.label} dans le salon`);
  }
  return code;
}

// ── consultations

async function doRoles(phones, host, { badge = 'blue', shots = null } = {}) {
  const st = await hostState(host);
  for (const [k, p] of phones.entries()) {
    const seat = st.members.findIndex((m) => m.id === p.id);
    const role = st.game.roles[seat];
    await p.page.waitForSelector('[data-stage="role"] #btnReveal');
    assert.equal(await p.page.locator('.rolecard:not(.back)').count(), 0, 'le rôle n\'est pas affiché avant d\'être demandé');
    assert.ok(await p.page.locator('#btnDone').isDisabled(), 'impossible de confirmer sans avoir vu sa carte');
    await p.page.click('#btnReveal');
    assert.equal(await text(p.page, '.rolecard .rc-name'), ROLE_NAME[role.role], `${p.label} voit son propre rôle`);
    if (await p.page.locator('.badge-pick').count()) {
      assert.equal(role.team, 'solo');
      assert.ok(await p.page.locator('#btnDone').isDisabled(), 'l\'Électron libre choisit d\'abord un badge');
      if (shots) await shot(p, `${shots}-role-electron-libre`);
      await p.page.click(`.badge-pick.${badge}`);
      await until(async () => !(await p.page.locator('#btnDone').isDisabled()), 'badge enregistré');
    } else if (shots && k === 0) await shot(p, `${shots}-role`);
    await p.page.click('#btnDone');
    // le dernier à confirmer passe directement à ses câbles
    await p.page.waitForSelector('#waitList, [data-stage="wires"]');
    if (await p.page.locator('#waitList').count()) {
      if (shots && k === 0) await shot(p, `${shots}-attente`);
      await assertPublic(p, 'attente des autres');
    }
  }
  await until(() => phaseIs(host, 'inspect'), 'tout le monde a vu son rôle');
}

async function doInspect(phones, host, { shots = null } = {}) {
  const st = await hostState(host);
  for (const [k, p] of phones.entries()) {
    const seat = st.members.findIndex((m) => m.id === p.id);
    const hand = st.game.hands[seat].map((c) => c.kind);
    await p.page.waitForSelector('[data-stage="wires"] #btnReveal');
    assert.equal(await p.page.locator('.wfront').count(), 0, 'aucun câble visible avant la demande');
    await p.page.click('#btnReveal');
    assert.equal(await p.page.locator('#myWires .wfront').count(), hand.length);
    const summary = await text(p.page, '#handSummary');
    const n = (k2) => hand.filter((x) => x === k2).length;
    assert.ok(summary.includes(`${n('bypass')} dérivation`) && summary.includes(`${n('inert')} câble`), `câbles de ${p.label} : ${summary}`);
    assert.equal(summary.includes('Surcharge'), n('overload') === 1);
    if (st.settings.comp.badges === 'neighbor') {
      const right = (seat - 1 + st.members.length) % st.members.length;
      const line = await text(p.page, '#neighborBadge');
      assert.ok(line.includes(st.members[right].name) && line.includes(st.game.roles[right].badge === 'blue' ? 'bleu' : 'orange'), `badge du voisin : ${line}`);
    }
    if (shots && k === 0) await shot(p, `${shots}-cables`);
    await p.page.click('#btnMix');
    await until(async () => (await p.page.locator('#waitList, .table').count()) > 0, `${p.label} a mélangé`);
    assert.equal(await p.page.locator('.wfront').count(), 0, 'plus aucun câble visible après le mélange');
  }
  // un joueur hors ligne bloque la table : l'hôte continue sans l'attendre
  await until(async () => {
    if (await phaseIs(host, 'play')) return true;
    const force = host.page.locator('[data-force]');
    if (await force.count()) await force.first().click().catch(() => {});
    return false;
  }, 'tout le monde a mélangé', 25000);
  for (const p of phones) await p.page.waitForSelector('.table');
}

// ── coupes

/** Coupe qui ne termine pas la partie (si possible). */
function quiet(g) {
  const all = [];
  g.hands.forEach((h, p) => { if (p !== g.holder) h.forEach((c, s) => { if (!c.cut) all.push([p, s, c.kind]); }); });
  return all.find((x) => x[2] === 'inert') || (g.found < g.n - 1 && all.find((x) => x[2] === 'bypass')) || all[0];
}
function find(g, kind) {
  for (const [p, h] of g.hands.entries()) {
    if (p === g.holder) continue;
    const s = h.findIndex((c) => !c.cut && c.kind === kind);
    if (s >= 0) return [p, s, kind];
  }
  return null;
}

async function dismiss(page) {
  if (await page.locator('#reveal.shown #btnContinue').count()) await page.click('#reveal #btnContinue').catch(() => {});
}

async function cutWire(phones, host, [target, slot], { by = null, shots = null } = {}) {
  const st = await hostState(host);
  const g = st.game;
  const cutter = by || phoneOf(phones, st.members[g.holder].id);
  const page = cutter.page;
  await dismiss(page);
  await page.waitForSelector('.table');
  await page.click(`.seat[data-seat="${target}"]`);
  await page.waitForSelector('#targetWires');
  assert.ok(await page.locator('#btnCut').isDisabled(), 'pas de coupe sans sélection');
  const other = g.hands[target].findIndex((c, i) => !c.cut && i !== slot);
  if (other >= 0) await page.click(`#targetWires .slot[data-slot="${other}"]`); // on change d'avis une fois
  await page.click(`#targetWires .slot[data-slot="${slot}"]`);
  // les autres téléphones voient ce que vise le porteur de la pince
  const watcher = phones.find((p) => p !== cutter && phoneOf(phones, p.id));
  await until(async () => (await watcher.page.locator(`.seat.aimed[data-seat="${target}"] .mini.aim`).count()) === 1, 'visée visible des autres');
  if (shots) { await shot(cutter, `${shots}-choix`); await shot(watcher, `${shots}-visee-vue-par-un-autre`); }
  await page.click('#btnCut');
  await until(async () => (await hostState(host)).game.log.length === g.log.length + 1, 'coupe appliquée');
  const after = (await hostState(host)).game;
  assert.deepEqual(after.log.at(-1), { round: g.round, by: g.holder, from: target, kind: g.hands[target][slot].kind });
  assert.equal(after.holder, target, 'la pince passe au joueur coupé');
  return after;
}

/** Vérifie la table sur chaque téléphone. */
async function checkTables(phones, host) {
  const st = await hostState(host);
  const g = st.game;
  for (const p of phones) {
    const page = p.page;
    await until(async () => (await page.locator('.mini.cut').count()) === g.cuts && (await page.locator(`.seat.holder[data-seat="${g.holder}"]`).count()) === 1, `table à jour chez ${p.label}`);
    await assertPublic(p, 'table');
    const mine = st.members[g.holder].id === p.id;
    assert.equal((await text(page, '#holderName')) === 'À toi', mine, `${p.label} sait si c'est son tour`);
    assert.ok((await text(page, '#hudFound')).includes(`${g.found}/${g.n}`));
    const me = st.members.findIndex((m) => m.id === p.id);
    assert.equal(await page.locator(`.seat.me[data-seat="${me}"]`).count(), 1, 'sa place est repérée');
    const fit = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.querySelector('.table').getBoundingClientRect().height <= innerHeight + 1);
    assert.ok(fit, `la table tient dans l'écran de ${p.label}`);
  }
}

async function nextRound(phones, host, { shots = null } = {}) {
  const st = await hostState(host);
  for (const p of phones) {
    await dismiss(p.page);
    await p.page.waitForSelector('#btnDeal');
    await assertPublic(p, 'fin de manche');
    const starter = await text(p.page, '#nextStarter');
    assert.equal(starter, st.members[st.game.holder].id === p.id ? 'Tu' : st.members[st.game.holder].name);
  }
  if (shots) await shot(phones[1], `${shots}-fin-de-manche`);
  await phones.at(-1).page.click('#btnDeal'); // n'importe quel joueur
  await until(() => phaseIs(host, 'inspect'), 'redistribution');
  const g = (await hostState(host)).game;
  assert.ok(g.hands.every((h) => h.length === 5 - st.game.round), 'un câble de moins par joueur');
}

/** Joue jusqu'à la fin ; `choose(g)` donne la coupe à faire. */
async function playOut(phones, host, choose, { shots = null } = {}) {
  for (let guard = 0; guard < 80; guard++) {
    const st = await hostState(host);
    const g = st.game;
    if (g.phase === 'over') return st;
    if (g.phase === 'roundEnd') {
      await nextRound(phones, host, { shots: guard < 12 ? shots : null });
      await doInspect(phones.filter((p) => !p.gone), host);
      continue;
    }
    // si le porteur de la pince n'a plus de téléphone, l'hôte coupe à sa place
    const holderId = st.members[g.holder].id;
    await cutWire(phones, host, choose(g), { by: holderId === host.id || !phoneOf(phones, holderId) ? host : null });
  }
  throw new Error('partie sans fin');
}

async function scenario(name, fn) {
  if (ONLY && !ONLY.some((o) => name.startsWith(o))) return;
  const t = Date.now();
  await fn();
  done.push(`${name} (${((Date.now() - t) / 1000).toFixed(1)} s)`);
  console.log(`✓ ${name}`);
}

// ───────────────────────────────────────────── scénarios

await scenario('classique-5-joueurs : partie complète, rechargements, rejouer', async () => {
  const host = await phone('Léa');
  const guests = [await phone('Tom'), await phone('Inès', devices['Pixel 7']), await phone('Noé'), await phone('Jade')];
  const all = [host, ...guests];
  const code = await createTable(host, guests);
  const sp = spy(code);
  // l'hôte range la table : Jade passe avant Noé, et c'est Inès qui commence
  await host.page.click(`.member[data-id="${guests[3].id}"] [aria-label^="Monter"]`);
  await until(async () => (await guests[0].page.locator('#members li .m-name').allTextContents()).map((s) => s.replace(/hôte|toi|hors ligne/gi, '').trim()).join() === 'Léa,Tom,Inès,Jade,Noé', 'ordre diffusé');
  await host.page.click(`#firstPick [data-first="${guests[1].id}"]`);
  await until(async () => (await guests[0].page.locator('.comp-row.ro').last().textContent()).includes('Inès'), 'premier joueur diffusé');
  assert.equal(await guests[0].page.locator('#btnLaunch').count(), 0, 'seul l\'hôte peut lancer');
  await host.page.click('#btnLaunch');

  await doRoles(all, host);
  // un joueur recharge pendant la consultation de ses câbles : rien n'est révélé d'office
  await guests[0].page.waitForSelector('[data-stage="wires"]');
  await guests[0].page.click('#btnReveal');
  await reload(guests[0]);
  await guests[0].page.waitForSelector('[data-stage="wires"] #btnReveal');
  assert.equal(await guests[0].page.locator('.wfront').count(), 0, 'après actualisation, les câbles sont cachés');
  await doInspect(all, host);
  let st = await hostState(host);
  assert.equal(st.game.holder, 2, 'Inès commence');
  await checkTables(all, host);

  // un spectateur ne peut pas couper
  const watcher = guests[0];
  await watcher.page.click('.seat[data-seat="3"]');
  await watcher.page.waitForSelector('.toast');
  assert.equal(await watcher.page.locator('#targetWires').count(), 0);
  // le porteur de la pince ne coupe pas ses propres câbles
  await guests[1].page.click('.seat[data-seat="2"]');
  assert.equal(await guests[1].page.locator('#targetWires').count(), 0);

  // manche 1, avec rechargement de l'hôte en plein milieu
  for (let i = 0; i < 5; i++) {
    st = await hostState(host);
    if (st.game.phase !== 'play') break;
    await cutWire(all, host, quiet(st.game), { by: st.members[st.game.holder].id === host.id ? host : null });
    if (i === 1) {
      await reload(host);
      await host.page.waitForSelector('.table');
      await checkTables(all, host);
    }
  }
  // le rôle reste consultable à tout moment, et seulement sur son propre téléphone
  await dismiss(guests[2].page);
  if (await guests[2].page.locator('#btnMyRole').count()) {
    await guests[2].page.click('#btnMyRole');
    const s2 = await hostState(host);
    const seat = s2.members.findIndex((m) => m.id === guests[2].id);
    assert.equal(await text(guests[2].page, '.myrole .rc-name'), ROLE_NAME[s2.game.roles[seat].role]);
    await guests[2].page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
    await guests[2].page.waitForSelector('.myrole', { state: 'detached' });
    await guests[2].page.evaluate(() => { delete document.hidden; });
  }
  st = await playOut(all, host, (g) => find(g, 'bypass') || quiet(g));
  assert.deepEqual([st.game.winner, st.game.reason], ['tech', 'bypass']);
  for (const p of all) {
    await dismiss(p.page);
    await p.page.waitForSelector('.over.safe');
    assert.equal(await text(p.page, '#overTitle'), 'Victoire des Techniciens');
  }
  await guests[0].page.click('#btnRevealRoles');
  assert.equal(await guests[0].page.locator('#rolesReveal .role-row').count(), 5);
  assertSealed(sp.seen);
  sp.end();
  // rejouer avec la même table
  assert.equal(await guests[0].page.locator('#btnReplay').count(), 0);
  await host.page.click('#btnReplay');
  for (const p of all) await p.page.waitForSelector('[data-stage="role"]');
  for (const p of all) await p.context.close();
});

await scenario('infiltration-6-joueurs : Électron libre, joueur déconnecté, retour au salon', async () => {
  const host = await phone('Ana', sized(375, 667));
  const guests = [await phone('Ben'), await phone('Chloé', devices['Pixel 7']), await phone('Dov'), await phone('Emma', sized(360, 640, devices['Pixel 7'].userAgent)), await phone('Farid')];
  const all = [host, ...guests];
  await createTable(host, guests, { invite: 2 });
  await host.page.click('#modePick button[data-v="infiltration"]');
  await until(async () => (await text(guests[0].page, '#modeName')) === 'Infiltration', 'mode diffusé');
  await host.page.click('#btnLaunch');
  await doRoles(all, host, { badge: 'orange' });
  let st = await hostState(host);
  const solo = st.game.roles.findIndex((r) => r.team === 'solo');
  assert.equal(st.game.roles[solo].badge, 'orange');
  await doInspect(all, host);
  await checkTables(all, host);

  // un joueur perd la connexion : la table l'affiche, l'hôte coupe à sa place quand il tient la pince
  const lost = guests.find((g) => g.id !== st.members[solo].id && g.id !== st.members[st.game.holder].id);
  const lostSeat = st.members.findIndex((m) => m.id === lost.id);
  await lost.context.close();
  lost.gone = true;
  const live = all.filter((p) => !p.gone);
  await until(async () => (await host.page.locator(`.seat.off[data-seat="${lostSeat}"]`).count()) === 1, 'joueur vu hors ligne', 25000);
  st = await hostState(host);
  if (st.game.holder !== lostSeat) {
    const slot = st.game.hands[lostSeat].findIndex((c) => !c.cut && c.kind === 'inert');
    await cutWire(live, host, [lostSeat, slot], { by: st.members[st.game.holder].id === host.id ? host : null });
  }
  await dismiss(host.page);
  await until(async () => (await text(host.page, '.turnbar')).includes('hors ligne'), 'l\'hôte voit qu\'il peut jouer à sa place');
  st = await hostState(host);
  await cutWire(live, host, quiet(st.game), { by: host });

  st = await playOut(live, host, quiet);
  assert.equal(st.game.phase, 'over');
  for (const p of live) { await dismiss(p.page); await p.page.waitForSelector('.over'); }
  await host.page.click('#btnBackLobby');
  for (const p of live) await p.page.waitForSelector('#members');
  assert.equal(await host.page.locator('.member.off').count(), 1, 'le joueur parti apparaît hors ligne dans le salon');
  // l'hôte retire le joueur absent puis ferme la partie
  await host.page.click(`.member[data-id="${lost.id}"] [aria-label^="Retirer"]`);
  await host.page.click('.confirm .btn.danger');
  await until(async () => (await host.page.locator('#members li').count()) === 5, 'joueur retiré');
  await host.page.click('#btnLeaveLobby');
  await host.page.click('.confirm .btn.danger');
  for (const p of live) await p.page.waitForSelector('#btnCreate, #btnJoinInvite');
  for (const p of live) await p.context.close();
});

await scenario('captures : 4 joueurs, animations, petits écrans', async () => {
  const host = await phone('Zoé', sized(375, 667), { motion: true });
  const guests = [await phone('Yan', IPHONE, { motion: true }), await phone('Xu', sized(360, 640, devices['Pixel 7'].userAgent), { motion: true }), await phone('Wim', sized(430, 932), { motion: true })];
  const all = [host, ...guests];
  await shot(host, 'z-accueil');
  await guests[0].page.goto(`${APP}&room=ABCDE`);
  await guests[0].page.waitForFunction(() => window.__ccReady === true);
  await shot(guests[0], 'z-accueil-invitation');
  await guests[0].page.goto(APP);
  await guests[0].page.waitForFunction(() => window.__ccReady === true);
  await createTable(host, guests, { invite: 0 });
  await host.page.click('#modePick button[data-v="infiltration"]');
  await until(async () => (await text(guests[0].page, '#modeName')) === 'Infiltration', 'mode diffusé');
  await shot(host, 'z-salon-hote');
  await shot(guests[0], 'z-salon-joueur');
  await host.page.click('#btnLaunch');
  await doRoles(all, host, { shots: 'z' });
  await doInspect(all, host, { shots: 'z' });
  await checkTables(all, host);
  let st = await hostState(host);
  const holder = phoneOf(all, st.members[st.game.holder].id);
  const other = all.find((p) => p !== holder);
  await shot(holder, 'z-table-a-toi');
  await shot(other, 'z-table-spectateur');
  await cutWire(all, host, quiet(st.game), { shots: 'z' });
  await other.page.waitForSelector('#reveal.shown');
  await shot(other, 'z-revelation');
  st = await playOut(all, host, (g) => find(g, 'overload') && g.round >= 2 ? find(g, 'overload') : quiet(g), { shots: 'z' });
  for (const p of all) { await dismiss(p.page); await p.page.waitForSelector('.over'); }
  await host.page.waitForTimeout(1200);
  await shot(host, `z-fin-${st.game.winner}`);
  await guests[2].page.click('#btnRevealRoles');
  await shot(guests[2], 'z-fin-roles');
  for (const p of all) await p.context.close();
});

// ───────────────────────────────────────────── bilan

await browser.close();
web.server.close();
await relay.close();
if (errors.length) {
  console.error(`\n✗ Erreurs dans les pages :\n  ${[...new Set(errors)].join('\n  ')}`);
  process.exit(1);
}
console.log(`\n✓ ${done.length} scénarios de bout en bout réussis :\n  ${done.join('\n  ')}\n  Captures : ${OUT}`);
