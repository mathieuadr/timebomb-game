// Tests de la partie à plusieurs téléphones : un relais MQTT local, un hôte, des joueurs,
// et un « espion » abonné à tout le trafic du relais.
// `node --test test/net.test.mjs`
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { createRequire } from 'node:module';
import { Net, NS } from '../public/net/room.js';
import { open, sharedKey } from '../public/net/crypto.js';
import { publicView } from '../public/state/privacy.js';
import { WIRE } from '../public/engine/rules.js';

const require = createRequire(import.meta.url);
const mqtt = require('mqtt');
const aedes = require('aedes');

let broker; let server; let url;
before(async () => {
  broker = await aedes.createBroker();
  server = net.createServer(broker.handle);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  url = `mqtt://127.0.0.1:${server.address().port}`;
});

const memory = () => { const m = new Map(); return { get: (k) => (m.has(k) ? JSON.parse(m.get(k)) : null), set: (k, v) => m.set(k, JSON.stringify(v)), del: (k) => m.delete(k), raw: m }; };
const live = new Set();
function phone(label, storage = memory()) {
  const errors = [];
  const p = new Net({ connect: mqtt.connect, broker: url, storage, onError: (m) => errors.push(m), hbMs: 150, offlineMs: 600, joinWaitMs: 1500, joinRetryMs: 500 });
  Object.assign(p, { label, errors, store: storage });
  live.add(p);
  return p;
}
const close = (p) => { p.close(); live.delete(p); };
after(async () => {
  for (const p of live) p.close(); // d'abord les téléphones encore ouverts (test en échec), puis le relais
  await new Promise((r) => server.close(r));
  await new Promise((r) => broker.close(r));
});

async function until(pred, what, timeout = 5000) {
  const t = Date.now();
  for (;;) {
    let ok = false;
    try { ok = await pred(); } catch { ok = false; }
    if (ok) return;
    if (Date.now() - t > timeout) throw new Error(`Délai dépassé : ${what}`);
    await new Promise((r) => setTimeout(r, 15));
  }
}
const connected = (...ps) => until(() => ps.every((p) => p.connected), 'connexion au relais');

function spy(code) {
  const seen = [];
  const c = mqtt.connect(url);
  c.on('connect', () => c.subscribe(`${NS}/${code}/#`));
  c.on('message', (topic, payload) => seen.push({ topic, raw: payload.toString() }));
  return { seen, client: c, ready: until(() => c.connected, 'espion connecté') };
}

/** Monte une table : un hôte et des joueurs dans le salon. */
async function table(names) {
  const host = phone(names[0]);
  await connected(host);
  const code = await host.create(names[0]);
  const guests = names.slice(1).map((n) => phone(n));
  await connected(...guests);
  // un par un, pour que l'ordre autour de la table soit celui de la liste
  for (const [i, g] of guests.entries()) {
    await g.join(code, names[i + 1]);
    await until(() => g.status === 'room', `${names[i + 1]} dans le salon`);
  }
  await until(() => host.room.members.length === names.length, 'tout le monde dans le salon');
  assert.deepEqual(host.room.members.map((m) => m.name), names);
  return { host, guests, all: [host, ...guests], code };
}
const bySeat = (all, room) => room.members.map((m) => all.find((p) => p.id === m.id));
const sameView = (all) => until(() => {
  const ref = JSON.stringify(all[0].room.game);
  return all.every((p) => JSON.stringify(p.room.game) === ref && p.room.ver === all[0].room.ver);
}, 'tous les téléphones voient la même table');

/** Fait jouer une partie entière ; `choose` choisit la coupe du joueur qui tient la pince. */
async function playOut(t, choose) {
  const { host, all } = t;
  for (let guard = 0; guard < 80; guard++) {
    await sameView(all);
    const g = host.room.game;
    if (g.phase === 'over') return g;
    if (g.phase === 'roundEnd') {
      const ver = host.room.ver;
      await all[1 + (guard % (all.length - 1))].send({ t: 'deal' });
      await until(() => host.room.ver > ver && host.room.game.phase === 'inspect', 'redistribution');
      await inspectAll(t);
      continue;
    }
    const seats = bySeat(all, host.room);
    const cutter = seats[g.holder];
    const [target, slot] = choose(host.host.game);
    const before = host.room.game.log.length;
    await cutter.send({ t: 'aim', target, slot });
    await cutter.send({ t: 'cut', target, slot });
    await until(() => host.room.game.log.length === before + 1, 'coupe appliquée');
  }
  throw new Error('partie sans fin');
}

async function rolesAll({ host, all }, skip = []) {
  await until(() => all.every((p) => p.priv && p.room.game?.phase === 'roles'), 'chacun reçoit son rôle');
  for (const p of all) {
    if (skip.includes(p)) continue;
    if (p.priv.needBadge) await p.send({ t: 'badge', badge: 'orange' });
    await p.send({ t: 'ackRole' });
  }
  if (!skip.length) await until(() => host.room.game.phase === 'inspect', 'tout le monde a vu son rôle');
}
async function inspectAll({ host, all }, skip = []) {
  await until(() => all.filter((p) => !skip.includes(p)).every((p) => p.priv?.hand && p.room.game?.phase === 'inspect'), 'chacun reçoit ses câbles');
  for (const p of all) {
    if (skip.includes(p)) continue;
    const seat = p.priv.seat;
    assert.deepEqual([...p.priv.hand.kinds].sort(), host.host.game.hands[seat].map((c) => c.kind).sort(), `${p.label} reçoit ses vrais câbles`);
    await p.send({ t: 'ackInspect' });
  }
  if (!skip.length) await until(() => host.room.game.phase === 'play', 'tout le monde a mélangé');
}

const legal = (g) => {
  const out = [];
  g.hands.forEach((h, p) => { if (p !== g.holder) h.forEach((c, s) => { if (!c.cut) out.push([p, s, c.kind]); }); });
  return out;
};
const quiet = (g) => {
  const l = legal(g);
  return l.find((x) => x[2] === WIRE.INERT) || (g.found < g.n - 1 && l.find((x) => x[2] === WIRE.BYPASS)) || l[0];
};

// ───────────────────────────────────────────── scénarios

test('salon : rejoindre, refus d\'un prénom en double, réglages, ordre, retrait', async () => {
  const t = await table(['Ana', 'Ben', 'Chloé', 'Dov']);
  const { host, guests, code } = t;
  // prénom déjà pris : refusé, le joueur revient à l'accueil avec un message
  const dup = phone('Ana bis');
  await connected(dup);
  await dup.join(code, 'ana');
  await until(() => dup.status === 'idle', 'refus du prénom en double');
  assert.match(dup.errors.at(-1), /déjà pris/);
  close(dup);
  // code inexistant
  const lost = phone('Perdu');
  await connected(lost);
  await lost.join('ZZZZZ', 'Perdu');
  await until(() => lost.status === 'idle', 'salle introuvable', 4000);
  assert.match(lost.errors.at(-1), /introuvable/);
  close(lost);
  // seul l'hôte règle la partie
  assert.equal(await guests[0].send({ t: 'settings', mode: 'infiltration' }), true);
  await until(() => guests[0].errors.length, 'refus côté joueur');
  assert.match(guests[0].errors.at(-1), /Seul l’hôte/);
  await host.send({ t: 'settings', mode: 'infiltration' });
  await until(() => guests.every((g) => g.room.settings.mode === 'infiltration'), 'réglages diffusés');
  assert.deepEqual([host.room.settings.comp.tech, host.room.settings.comp.sab, host.room.settings.comp.solo], [3, 1, 1], 'composition Infiltration à 4');
  // l'ordre autour de la table
  await host.send({ t: 'move', id: guests[2].id, delta: -1 });
  await until(() => guests[0].room.members.map((m) => m.name).join() === 'Ana,Ben,Dov,Chloé', 'ordre mis à jour');
  // un joueur quitte, la composition suit le nombre de joueurs
  await host.send({ t: 'settings', mode: 'classic' });
  await guests[2].leave();
  await until(() => host.room.members.length === 3, 'départ pris en compte');
  assert.equal(guests[2].status, 'idle');
  // impossible de lancer à 3
  await host.send({ t: 'start' });
  assert.match(host.errors.at(-1), /au moins 4/);
  // retrait par l'hôte
  await host.send({ t: 'kick', id: guests[1].id });
  await until(() => guests[1].status === 'idle', 'joueur retiré');
  assert.match(guests[1].errors.at(-1), /retiré/);
  // l'hôte ferme la partie : tout le monde est prévenu
  await host.leave();
  await until(() => guests[0].status === 'idle', 'fermeture reçue');
  assert.match(guests[0].errors.at(-1), /fermé/);
  for (const p of t.all) close(p);
});

test('partie complète à 6 en mode Infiltration : chacun son téléphone, aucun secret en clair sur le relais', async () => {
  const t = await table(['Ana', 'Ben', 'Chloé', 'Dov', 'Emma', 'Farid']);
  const { host, guests, all, code } = t;
  const s = spy(code);
  await s.ready;
  await host.send({ t: 'settings', mode: 'infiltration' });
  await guests[1].send({ t: 'ackRole' }); // trop tôt : ignoré proprement
  await host.send({ t: 'start' });
  await rolesAll(t);
  // chacun ne connaît que son propre rôle
  for (const p of all) {
    const real = host.host.game.roles[p.priv.seat];
    assert.equal(p.priv.role.role, real.role, `${p.label} reçoit son vrai rôle`);
  }
  await inspectAll(t);
  // le badge du voisin de droite
  for (const p of all) {
    const right = (p.priv.seat + 5) % 6;
    assert.equal(p.priv.neighbor.badge, host.host.game.roles[right].badge);
  }
  // on ne coupe pas ses propres câbles ; seul le porteur de la pince coupe
  const g = host.host.game;
  const holder = bySeat(all, host.room)[g.holder];
  const other = all.find((p) => p !== holder && p !== host);
  await other.send({ t: 'cut', target: (g.holder + 1) % 6, slot: 0 });
  await until(() => other.errors.some((e) => /pince/.test(e)), 'coupe refusée à un autre joueur');
  await holder.send({ t: 'cut', target: g.holder, slot: 0 });
  await until(() => holder.errors.some((e) => /propres câbles/.test(e)), 'on ne coupe pas ses câbles');
  assert.equal(host.room.game.log.length, 0);

  const end = await playOut(t, quiet);
  assert.equal(end.phase, 'over');
  assert.ok(['tech', 'sab', 'solo'].includes(end.winner));
  await until(() => all.every((p) => p.room.final), 'révélation finale reçue partout');
  assert.equal(guests[0].room.final.players.length, 6);
  assert.deepEqual(guests[0].room.game, publicView(host.host.game));

  // ── analyse du trafic capturé par l'espion
  await new Promise((r) => setTimeout(r, 200));
  const secrets = /"(role|team|char|roles|hands|undealt|kinds|counts|neighbor)":/;
  let publicMsgs = 0; let sealed = 0;
  for (const { topic, raw } of s.seen) {
    if (!raw) continue;
    const kind = topic.split('/')[2];
    const msg = JSON.parse(raw);
    if (kind === 'state') {
      publicMsgs += 1;
      if (msg.game?.phase !== 'over') assert.ok(!secrets.test(raw), `secret en clair dans l'état public : ${raw.slice(0, 200)}`);
      for (const p of msg.game?.players || []) for (const w of p.wires) if (!w.cut) assert.deepEqual(w, { cut: false });
    } else if (kind === 'p') {
      sealed += 1;
      assert.deepEqual(Object.keys(msg).sort(), ['ct', 'iv'], 'état privé chiffré');
    } else if (kind === 'c' && msg.t !== 'join') {
      assert.deepEqual(Object.keys(msg), ['box'], 'action chiffrée');
      assert.deepEqual(Object.keys(msg.box).sort(), ['ct', 'iv']);
    } else if (kind === 'c') {
      assert.deepEqual(Object.keys(msg).sort(), ['key', 'name', 't'], 'une demande pour rejoindre ne contient que le prénom et la clé publique');
    }
  }
  assert.ok(publicMsgs > 20 && sealed >= 6, `trafic observé (${publicMsgs} publics, ${sealed} privés)`);
  // un joueur ne peut pas lire l'état privé d'un autre, même en écoutant le relais
  const [a, b] = guests;
  const bMsg = s.seen.filter((m) => m.topic.endsWith(`/p/${b.id}`) && m.raw).at(-1);
  const aKey = await sharedKey(a.keys.priv, host.keys.pub);
  assert.equal(await open(aKey, `priv:${b.id}`, JSON.parse(bMsg.raw)), null, 'chiffré pour B : illisible pour A');
  assert.ok(await open(aKey, `priv:${a.id}`, JSON.parse(s.seen.filter((m) => m.topic.endsWith(`/p/${a.id}`) && m.raw).at(-1).raw)), 'lisible par son destinataire');
  // le choix de badge de l'Électron libre ne transite que chiffré
  assert.ok(!s.seen.some((m) => m.raw.includes('"badge":"orange"') && m.topic.includes('/c/')));

  // ── rejouer avec la même table
  await host.send({ t: 'replay' });
  await until(() => all.every((p) => p.room.game?.phase === 'roles' && p.room.game.log.length === 0 && p.priv?.gameId === host.room.gameId), 'nouvelle partie partout');
  await host.send({ t: 'lobby' }).catch(() => {});
  s.client.end(true);
  for (const p of all) close(p);
});

test('rechargement : un joueur puis l\'hôte rechargent l\'appli en pleine partie', async () => {
  const t = await table(['Léa', 'Tom', 'Inès', 'Noé', 'Jade']);
  const { host, guests, all } = t;
  await host.send({ t: 'start' });
  await rolesAll(t);
  // un joueur recharge pendant la consultation des câbles : il retrouve ses câbles
  await until(() => guests[1].priv?.hand, 'câbles reçus');
  const hand = JSON.stringify(guests[1].priv.hand);
  const store = guests[1].store;
  close(guests[1]);
  const back = phone('Tom (rechargé)', store);
  await connected(back);
  assert.equal(await back.resume(), true);
  await until(() => back.status === 'room' && back.priv?.hand, 'reprise du joueur');
  assert.equal(JSON.stringify(back.priv.hand), hand);
  t.guests[1] = back; t.all[2] = back;
  await inspectAll(t);
  for (let i = 0; i < 3; i++) {
    const g = host.host.game;
    const [target, slot] = quiet(g);
    const before = g.log.length;
    await bySeat(t.all, host.room)[g.holder].send({ t: 'cut', target, slot });
    await until(() => host.room.game.log.length === before + 1, 'coupe');
  }
  // l'hôte recharge : la partie reprend exactement où elle en était
  const snapshot = JSON.stringify(host.host.game);
  const hostStore = host.store;
  close(host);
  await until(() => !t.guests[0].hostOnline, 'les joueurs voient l\'hôte hors ligne', 3000);
  const host2 = phone('Léa (rechargée)', hostStore);
  await connected(host2);
  assert.equal(await host2.resume(), true);
  assert.equal(JSON.stringify(host2.host.game), snapshot);
  t.host = host2; t.all[0] = host2;
  await until(() => t.guests.every((g) => g.hostOnline), 'hôte de retour');
  const end = await playOut(t, quiet);
  assert.equal(end.phase, 'over');
  for (const p of t.all) close(p);
});

test('un joueur perd la connexion : l\'hôte débloque la partie à sa place', async () => {
  const t = await table(['Un', 'Deux', 'Trois', 'Quatre']);
  const { host, guests, all } = t;
  await host.send({ t: 'start' });
  const gone = guests[2];
  await rolesAll(t, [gone]);
  // tant qu'il est connecté, on ne peut pas confirmer à sa place
  await host.send({ t: 'force', seat: gone.priv.seat });
  assert.match(host.errors.at(-1), /connecté/);
  close(gone);
  await until(() => !host.room.members.find((m) => m.id === gone.id).online, 'joueur vu hors ligne', 3000);
  await host.send({ t: 'force', seat: host.room.members.findIndex((m) => m.id === gone.id) });
  await until(() => host.room.game.phase === 'inspect', 'rôles débloqués');
  const rest = all.filter((p) => p !== gone);
  await inspectAll({ host, all: rest }, []).catch(() => {});
  await until(() => rest.every((p) => p.room.game.ready[p.priv.seat]), 'les autres ont mélangé');
  await host.send({ t: 'force', seat: host.room.members.findIndex((m) => m.id === gone.id) });
  await until(() => host.room.game.phase === 'play', 'câbles débloqués');
  // si le joueur absent tient la pince, l'hôte coupe pour lui
  const goneSeat = host.room.members.findIndex((m) => m.id === gone.id);
  let g = host.host.game;
  if (g.holder !== goneSeat) {
    const slot = g.hands[goneSeat].findIndex((c) => !c.cut && c.kind === WIRE.INERT);
    await bySeat(all, host.room)[g.holder].send({ t: 'cut', target: goneSeat, slot });
    await until(() => host.host.game.holder === goneSeat, 'la pince arrive chez l\'absent');
  }
  g = host.host.game;
  const [target, slot] = quiet(g);
  await host.send({ t: 'cut', target, slot });
  await until(() => host.host.game.log.length >= 1 && host.host.game.holder === target, 'coupe faite par l\'hôte pour l\'absent');
  for (const p of rest) close(p);
});
