// Coupe-Circuit — une partie à plusieurs téléphones, sans serveur.
//
// Les téléphones communiquent par un relais MQTT public (comme Skyline). Le téléphone qui crée
// la partie est l'HÔTE : il exécute le moteur de règles et garde l'état complet, sans jamais
// l'afficher. Il publie :
//   • l'état PUBLIC de la table (en clair, message retenu)        → .../state
//   • l'état PRIVÉ de chaque joueur, chiffré pour lui seul        → .../p/<joueur>
//   • les erreurs d'un joueur, chiffrées pour lui seul            → .../e/<joueur>
// Chaque joueur envoie ses actions chiffrées à l'hôte              → .../c/<joueur>
// et signale sa présence                                          → .../hb
//
// Si l'hôte ferme l'appli, la partie se met en pause : son téléphone a tout sauvegardé et
// reprend là où il en était à sa réouverture.

import { createGame, chooseBadge, ackRole, ackInspect, cut, nextRound, RuleError } from '../engine/game.js';
import { MIN_PLAYERS, MAX_PLAYERS, MODE, BADGES, BADGE, TEAM, presetComposition, modeOf, validateComposition } from '../engine/rules.js';
import { publicView, privateView, finalReveal } from '../state/privacy.js';
import { makeKeyPair, sharedKey, seal, open, sameKey, publicJwk, randomId, cryptoRandom } from './crypto.js';

export const NS = 'coupe-circuit-v1';
export const PROTOCOL = 1;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const KEYS = { device: 'cc:device', host: 'cc:host', session: 'cc:session' };

const RULE_MESSAGES = {
  'own-wire': 'On ne coupe jamais ses propres câbles.',
  'already-cut': 'Ce câble est déjà coupé.',
  'bad-wire': 'Câble introuvable.',
  'bad-target': 'Joueur introuvable.',
  'not-playing': 'Ce n’est pas le moment de couper.',
  'not-roles': 'La distribution des rôles est terminée.',
  'not-inspect': 'La consultation des câbles est terminée.',
  'not-round-end': 'La manche n’est pas terminée.',
  'badge-required': 'Choisis d’abord ton badge.',
  'already-ready': 'Tu as déjà confirmé.',
  'not-solo': 'Seul l’Électron libre choisit son badge.',
  'bad-composition': 'Composition impossible.',
};

export class NetError extends Error {
  constructor(message, { fatal = false } = {}) { super(message); this.name = 'NetError'; this.fatal = fatal; }
}

const cleanName = (s) => String(s ?? '').replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 14);
const clampN = (n) => Math.min(MAX_PLAYERS, Math.max(MIN_PLAYERS, n));
const sameName = (a, b) => a.toLocaleLowerCase('fr') === b.toLocaleLowerCase('fr');
const validKey = (k) => !!k && k.kty === 'EC' && k.crv === 'P-256' && typeof k.x === 'string' && typeof k.y === 'string';
export const cleanCode = (s) => String(s ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);

export function defaultSettings(n = MIN_PLAYERS) {
  return { mode: MODE.CLASSIC, comp: presetComposition(MODE.CLASSIC, clampN(n)), first: 'random' };
}

/**
 * @param {object} o
 * @param {(url: string, opts: object) => any} o.connect  client MQTT (mqtt.connect du navigateur ou de Node)
 * @param {string} o.broker  adresse du relais
 * @param {{get(k:string):any, set(k:string,v:any):void, del(k:string):void}} o.storage  stockage local
 * @param {() => void} [o.onUpdate]  appelé à chaque changement visible
 * @param {(msg: string) => void} [o.onError]  message d'erreur à montrer au joueur
 */
export class Net {
  constructor({ connect, broker, storage, onUpdate = () => {}, onError = () => {}, now = () => Date.now(), rng = cryptoRandom, hbMs = 4000, offlineMs = 13000, joinWaitMs = 7000, joinRetryMs = 4000 }) {
    Object.assign(this, { storage, onUpdate, onError, now, rng, hbMs, offlineMs, joinWaitMs, joinRetryMs });
    this.status = 'idle'; // idle | joining | room
    this.code = null;
    this.isHost = false;
    this.connected = false;
    this.room = null; // dernier état public
    this.priv = null; // mon état privé (déchiffré)
    this.host = null; // { code, members, settings, status, game, gameId, ver, aim, lastN } — sur le téléphone de l'hôte seulement
    this.seen = new Map(); // id → dernier signe de vie
    this.memberKeys = new Map(); // id → Promise<CryptoKey> (hôte)
    this.lastPriv = new Map(); // id → dernier état privé publié (hôte)
    this.shared = null; // clé commune avec l'hôte (joueur)
    this.hostKey = null;
    this.pending = null; // { kind: 'join'|'resume', name, since, sentAt, tries }
    this.stashedPriv = null;
    this.n = 0;
    this.chain = Promise.resolve();
    this.ready = this.loadIdentity();

    this.client = connect(broker, { clientId: `cc_${randomId(5)}`, keepalive: 30, reconnectPeriod: 2000, connectTimeout: 10000, clean: true });
    this.client.on('connect', () => {
      this.connected = true;
      if (this.code) this.enqueue(() => this.subscribe());
      this.onUpdate();
    });
    const down = () => { if (this.connected) { this.connected = false; this.onUpdate(); } };
    this.client.on('close', down);
    this.client.on('offline', down);
    this.client.on('error', () => {});
    this.client.on('message', (topic, payload) => this.route(topic, payload.toString()));
    this.timer = setInterval(() => this.tick(), Math.max(250, Math.floor(hbMs / 2)));
  }

  // ─────────────────────────────────────────── identité de l'appareil

  async loadIdentity() {
    let dev = this.storage.get(KEYS.device);
    if (!dev || !dev.id || !dev.priv || !validKey(dev.pub)) {
      const keys = await makeKeyPair();
      dev = { id: randomId(6), ...keys };
      this.storage.set(KEYS.device, dev);
    }
    this.id = dev.id;
    this.keys = dev;
  }

  // ─────────────────────────────────────────── outils

  enqueue(fn) {
    const run = this.chain.then(fn);
    this.chain = run.catch((e) => { if (!(e instanceof NetError) && !(e instanceof RuleError)) console.error(e); });
    return run;
  }
  topic(kind, who) { return `${NS}/${this.code}/${kind}${who ? `/${who}` : ''}`; }
  pub(kind, who, payload, opts = {}) {
    if (!this.code) return;
    this.client.publish(this.topic(kind, who), typeof payload === 'string' ? payload : JSON.stringify(payload), { qos: 1, ...opts });
  }
  online(id) { return id === this.id || this.now() - (this.seen.get(id) || 0) < this.offlineMs; }
  get hostOnline() {
    if (this.isHost) return true;
    return !!this.room && this.online(this.room.hostId);
  }
  /** Ma place à la table pendant une partie (index), ou -1. */
  get seat() {
    if (!this.room?.game) return -1;
    return this.room.members.findIndex((m) => m.id === this.id);
  }

  subscribe() {
    const base = `${NS}/${this.code}`;
    const topics = this.isHost ? [`${base}/c/+`, `${base}/hb`] : [`${base}/state`, `${base}/hb`, `${base}/p/${this.id}`, `${base}/e/${this.id}`];
    this.client.subscribe(topics, { qos: 1 });
    this.subscribedAt = this.now();
    this.heartbeat();
    if (this.isHost && this.host) return this.commit({ bump: true });
    return undefined;
  }
  heartbeat() { if (this.code && this.connected) this.pub('hb', null, { id: this.id }, { qos: 0 }); }

  /** Quitte la salle localement (sans prévenir personne). */
  reset(message) {
    if (this.code && this.connected) {
      const base = `${NS}/${this.code}`;
      this.client.unsubscribe([`${base}/c/+`, `${base}/hb`, `${base}/state`, `${base}/p/${this.id}`, `${base}/e/${this.id}`]);
    }
    this.storage.del(KEYS.session);
    if (this.isHost) this.storage.del(KEYS.host);
    Object.assign(this, { status: 'idle', code: null, isHost: false, room: null, priv: null, host: null, shared: null, hostKey: null, pending: null, stashedPriv: null });
    this.seen.clear(); this.memberKeys.clear(); this.lastPriv.clear();
    this.onUpdate();
    if (message) this.onError(message);
  }

  // ─────────────────────────────────────────── API utilisée par l'interface

  /** Reprend la partie en cours sur cet appareil (hôte ou joueur), s'il y en a une. */
  async resume() {
    await this.ready;
    const snap = this.storage.get(KEYS.host);
    if (snap && snap.code && Array.isArray(snap.members)) {
      this.isHost = true;
      this.host = snap;
      this.code = snap.code;
      this.status = 'room';
      if (this.connected) await this.enqueue(() => this.subscribe());
      else this.publishState();
      this.onUpdate();
      return true;
    }
    const session = this.storage.get(KEYS.session);
    if (session && session.code) {
      this.hostKey = validKey(session.hostKey) ? session.hostKey : null;
      this.startJoin(session.code, { kind: 'resume', name: session.name || '' });
      return true;
    }
    return false;
  }

  async create(name) {
    await this.ready;
    name = cleanName(name);
    if (!name) throw new NetError('Indique ton prénom.');
    if (this.status !== 'idle') this.reset();
    const code = Array.from(globalThis.crypto.getRandomValues(new Uint8Array(5)), (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
    this.isHost = true;
    this.code = code;
    this.status = 'room';
    this.host = { code, members: [{ id: this.id, name, key: this.keys.pub }], settings: defaultSettings(1), status: 'lobby', game: null, gameId: null, ver: 0, aim: null, lastN: {} };
    if (this.connected) await this.enqueue(() => this.subscribe());
    else this.commit({ bump: true });
    return code;
  }

  async join(code, name) {
    await this.ready;
    code = cleanCode(code);
    name = cleanName(name);
    if (code.length !== 5) throw new NetError('Le code de la partie a 5 caractères.');
    if (!name) throw new NetError('Indique ton prénom.');
    if (this.status !== 'idle') this.reset();
    this.hostKey = null;
    this.startJoin(code, { kind: 'join', name });
  }

  startJoin(code, { kind, name }) {
    this.code = code;
    this.isHost = false;
    this.status = 'joining';
    this.pending = { kind, name, since: this.now(), sentAt: 0, tries: 0 };
    if (this.connected) this.enqueue(() => this.subscribe());
    this.onUpdate();
  }

  /** Envoie une action. Chez l'hôte elle est appliquée directement. Résout true si elle est partie. */
  send(cmd) {
    return this.enqueue(async () => {
      if (this.status !== 'room') throw new NetError('Tu n’es dans aucune partie.');
      if (this.isHost) {
        try { await this.apply(this.id, cmd); } catch (e) { this.onError(this.explain(e)); throw e; }
        return true;
      }
      if (!this.connected) { this.onError('Connexion au relais en cours…'); throw new NetError('offline'); }
      if (!this.shared) throw new NetError('Clé de la partie absente.');
      this.n = Math.max(this.n + 1, this.now() * 1000);
      this.pub('c', this.id, { box: await seal(this.shared, `cmd:${this.id}`, { ...cmd, n: this.n }) });
      return true;
    }).catch(() => false);
  }

  /** Quitter : l'hôte ferme la partie pour tout le monde ; un joueur quitte le salon. */
  leave() {
    return this.enqueue(async () => {
      if (this.isHost && this.host) {
        if (this.connected) {
          this.pub('state', null, '', { retain: true });
          for (const m of this.host.members) if (m.id !== this.id) this.pub('p', m.id, '', { retain: true });
        }
        return this.reset();
      }
      if (this.status === 'room' && this.room?.status === 'lobby' && this.shared && this.connected) {
        this.n = Math.max(this.n + 1, this.now() * 1000);
        this.pub('c', this.id, { box: await seal(this.shared, `cmd:${this.id}`, { t: 'leave', n: this.n }) });
      }
      return this.reset();
    });
  }

  explain(e) {
    if (e instanceof RuleError) return RULE_MESSAGES[e.code] || 'Action impossible.';
    if (e instanceof NetError) return e.message;
    return 'Erreur inattendue.';
  }

  // ─────────────────────────────────────────── réception

  route(topic, raw) {
    const [ns, code, kind, who] = topic.split('/');
    if (ns !== NS || code !== this.code) return;
    if (kind === 'hb') {
      let msg = null;
      try { msg = JSON.parse(raw); } catch { return; }
      if (msg && typeof msg.id === 'string') {
        const was = this.online(msg.id);
        this.seen.set(msg.id, this.now());
        if (!was && !this.isHost) this.onUpdate();
      }
      return;
    }
    if (this.isHost) {
      if (kind === 'c' && who) this.enqueue(() => this.onCommand(who, raw));
      return;
    }
    if (kind === 'state') this.enqueue(() => this.onState(raw));
    else if (kind === 'p' && who === this.id) this.enqueue(() => this.onPrivate(raw));
    else if (kind === 'e' && who === this.id) this.enqueue(() => this.onErrorMsg(raw));
  }

  // ── côté joueur

  async onState(raw) {
    if (!raw) {
      if (this.status === 'room') this.reset('L’hôte a fermé la partie.');
      return;
    }
    let room;
    try { room = JSON.parse(raw); } catch { return; }
    if (!room || room.v !== PROTOCOL || room.code !== this.code || !validKey(room.hostKey)) return;
    if (this.hostKey && !sameKey(this.hostKey, room.hostKey)) return; // ce n'est pas notre hôte : ignoré
    if (this.room && room.ver <= this.room.ver) return; // message en retard
    if (!this.shared) {
      this.hostKey = publicJwk(room.hostKey);
      this.shared = await sharedKey(this.keys.priv, this.hostKey);
    }
    this.room = room;
    if (!this.seen.has(room.hostId)) this.seen.set(room.hostId, this.now());
    const member = room.members.some((m) => m.id === this.id);

    if (this.status === 'joining') {
      const p = this.pending;
      if (member) {
        this.status = 'room';
        this.pending = null;
        const me = room.members.find((m) => m.id === this.id);
        this.storage.set(KEYS.session, { code: this.code, hostKey: this.hostKey, name: me.name });
      } else if (p.kind === 'resume') {
        return this.reset('Tu ne fais plus partie de cette partie.');
      } else if (room.status !== 'lobby') {
        return this.reset('Cette partie a déjà commencé.');
      } else if (!p.sentAt) {
        this.sendJoin();
        return this.onUpdate();
      } else {
        return this.onUpdate();
      }
    } else if (!member) {
      return this.reset('L’hôte t’a retiré de la partie.');
    }
    if (this.stashedPriv) { const s = this.stashedPriv; this.stashedPriv = null; await this.onPrivate(s, { silent: true }); }
    if (this.priv && this.priv.gameId !== room.gameId) this.priv = null;
    this.onUpdate();
  }

  sendJoin() {
    const p = this.pending;
    p.sentAt = this.now();
    p.tries += 1;
    this.pub('c', this.id, { t: 'join', name: p.name, key: this.keys.pub });
  }

  async onPrivate(raw, { silent = false } = {}) {
    if (!raw) { this.priv = null; if (!silent) this.onUpdate(); return; }
    if (!this.shared) { this.stashedPriv = raw; return; }
    let box;
    try { box = JSON.parse(raw); } catch { return; }
    const data = await open(this.shared, `priv:${this.id}`, box);
    if (!data) return;
    if (this.priv && this.priv.gameId === data.gameId && data.ver < this.priv.ver) return;
    this.priv = data.gameId ? data : null;
    if (!silent) this.onUpdate();
  }

  async onErrorMsg(raw) {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    if (msg?.box && this.shared) msg = await open(this.shared, `err:${this.id}`, msg.box);
    if (!msg || typeof msg.msg !== 'string') return;
    if (msg.fatal && this.status === 'joining') return this.reset(msg.msg);
    this.onError(msg.msg);
  }

  // ── côté hôte

  keyFor(member) {
    if (!this.memberKeys.has(member.id)) this.memberKeys.set(member.id, sharedKey(this.keys.priv, member.key));
    return this.memberKeys.get(member.id);
  }

  async onCommand(from, raw) {
    if (!this.host) return;
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    if (!msg) return;
    this.seen.set(from, this.now());
    if (msg.t === 'join') return this.onJoin(from, msg);
    const member = this.host.members.find((m) => m.id === from);
    if (!member || !msg.box) return;
    const key = await this.keyFor(member);
    const cmd = await open(key, `cmd:${from}`, msg.box);
    if (!cmd || typeof cmd.n !== 'number') return;
    if (cmd.n <= (this.host.lastN[from] || 0)) return; // message rejoué ou en double
    this.host.lastN[from] = cmd.n;
    try {
      await this.apply(from, cmd);
    } catch (e) {
      const text = this.explain(e);
      this.pub('e', from, { box: await seal(key, `err:${from}`, { msg: text }) }, { qos: 0 });
    }
  }

  async onJoin(from, msg) {
    const h = this.host;
    const refuse = (text) => this.pub('e', from, { msg: text, fatal: true }, { qos: 0 });
    if (!validKey(msg.key)) return;
    const existing = h.members.find((m) => m.id === from);
    if (existing) {
      if (!sameKey(existing.key, msg.key)) return refuse('Cet appareil ne peut pas rejoindre cette partie.');
      return this.commit({ bump: true }); // simple reconnexion
    }
    const name = cleanName(msg.name);
    if (h.status !== 'lobby') return refuse('Cette partie a déjà commencé.');
    if (h.members.length >= MAX_PLAYERS) return refuse(`La table est complète (${MAX_PLAYERS} joueurs).`);
    if (!name) return refuse('Indique ton prénom.');
    if (h.members.some((m) => sameName(m.name, name))) return refuse(`Le prénom « ${name} » est déjà pris à cette table.`);
    h.members.push({ id: from, name, key: publicJwk(msg.key) });
    this.normalizeSettings();
    return this.commit();
  }

  normalizeSettings() {
    const h = this.host;
    const n = clampN(h.members.length);
    if (h.settings.mode !== MODE.CUSTOM) h.settings.comp = presetComposition(h.settings.mode, n);
    if (h.settings.first !== 'random' && !h.members.some((m) => m.id === h.settings.first)) h.settings.first = 'random';
  }

  holderOffline() {
    const g = this.host.game;
    if (!g || g.phase !== 'play') return false;
    const id = this.host.members[g.holder].id;
    return id !== this.id && !this.online(id);
  }

  async apply(from, cmd) {
    const h = this.host;
    if (!h) throw new NetError('Aucune partie.');
    const isHost = from === this.id;
    const hostOnly = () => { if (!isHost) throw new NetError('Seul l’hôte peut faire ça.'); };
    const lobbyOnly = () => { if (h.status !== 'lobby') throw new NetError('La partie a déjà commencé.'); };
    const g = h.game;
    const needGame = (phase) => { if (!g || h.status !== 'game' || (phase && g.phase !== phase)) throw new NetError('Action impossible maintenant.'); };
    const seat = h.members.findIndex((m) => m.id === from);
    if (seat < 0) throw new NetError('Tu ne fais pas partie de cette table.');

    switch (cmd.t) {
      // ── salon (hôte)
      case 'settings': {
        hostOnly(); lobbyOnly();
        const s = { ...h.settings };
        if (Object.values(MODE).includes(cmd.mode)) s.mode = cmd.mode;
        if (cmd.comp && typeof cmd.comp === 'object') {
          const c = cmd.comp;
          const int = (v, lo, hi, d) => (Number.isInteger(v) ? Math.min(hi, Math.max(lo, v)) : d);
          s.comp = {
            tech: int(c.tech, 1, 8, s.comp.tech), sab: int(c.sab, 1, 8, s.comp.sab), solo: int(c.solo, 0, 1, s.comp.solo),
            mole: !!c.mole, infiltrator: !!c.infiltrator,
            badges: Object.values(BADGES).includes(c.badges) ? c.badges : s.comp.badges,
          };
          if (s.comp.badges === BADGES.OFF) { s.comp.mole = false; s.comp.infiltrator = false; }
          if (cmd.mode == null) s.mode = modeOf(s.comp, clampN(h.members.length));
        }
        if (cmd.first === 'random' || h.members.some((m) => m.id === cmd.first)) s.first = cmd.first;
        h.settings = s;
        this.normalizeSettings();
        return this.commit();
      }
      case 'move': {
        hostOnly(); lobbyOnly();
        const i = h.members.findIndex((m) => m.id === cmd.id);
        const j = i + (cmd.delta > 0 ? 1 : -1);
        if (i < 0 || j < 0 || j >= h.members.length) return undefined;
        [h.members[i], h.members[j]] = [h.members[j], h.members[i]];
        return this.commit();
      }
      case 'kick': {
        hostOnly(); lobbyOnly();
        if (cmd.id === this.id) throw new NetError('L’hôte ne peut pas se retirer.');
        h.members = h.members.filter((m) => m.id !== cmd.id);
        this.forget(cmd.id);
        this.normalizeSettings();
        return this.commit();
      }
      case 'leave': {
        if (isHost || h.status !== 'lobby') return undefined;
        h.members = h.members.filter((m) => m.id !== from);
        this.forget(from);
        this.normalizeSettings();
        return this.commit();
      }
      case 'start': {
        hostOnly(); lobbyOnly();
        return this.startGame();
      }

      // ── partie
      case 'badge':
        needGame('roles');
        h.game = chooseBadge(g, seat, cmd.badge);
        return this.commit();
      case 'ackRole':
        needGame('roles');
        h.game = ackRole(g, seat);
        return this.commit();
      case 'ackInspect':
        needGame('inspect');
        h.game = ackInspect(g, seat, this.rng);
        return this.commit();
      case 'force': {
        // l'hôte débloque la partie quand un joueur hors ligne la fait attendre
        hostOnly(); needGame();
        const target = cmd.seat;
        const id = h.members[target]?.id;
        if (!id || id === this.id) throw new NetError('Joueur introuvable.');
        if (this.online(id)) throw new NetError('Ce joueur est connecté.');
        if (g.phase === 'roles') {
          let s = g;
          if (s.roles[target].team === TEAM.SOLO && s.comp.badges !== BADGES.OFF && !s.roles[target].badge) {
            s = chooseBadge(s, target, this.rng() < 0.5 ? BADGE.BLUE : BADGE.ORANGE);
          }
          h.game = ackRole(s, target);
        } else if (g.phase === 'inspect') {
          h.game = ackInspect(g, target, this.rng);
        } else throw new NetError('Rien à débloquer.');
        return this.commit();
      }
      case 'aim': {
        needGame('play');
        if (seat !== g.holder && !(isHost && this.holderOffline())) return undefined;
        const ok = Number.isInteger(cmd.target) && cmd.target !== g.holder && g.hands[cmd.target]
          && Number.isInteger(cmd.slot) && g.hands[cmd.target][cmd.slot] && !g.hands[cmd.target][cmd.slot].cut;
        const aim = ok ? { target: cmd.target, slot: cmd.slot } : Number.isInteger(cmd.target) && cmd.target !== g.holder && g.hands[cmd.target] ? { target: cmd.target, slot: null } : null;
        if (JSON.stringify(aim) === JSON.stringify(h.aim)) return undefined;
        h.aim = aim;
        return this.commit({ privates: false });
      }
      case 'cut': {
        needGame('play');
        if (seat !== g.holder && !(isHost && this.holderOffline())) throw new NetError('Ce n’est pas toi qui tiens la pince.');
        h.game = cut(g, cmd.target, cmd.slot);
        h.aim = null;
        return this.commit();
      }
      case 'deal':
        needGame('roundEnd');
        h.game = nextRound(g, this.rng);
        return this.commit();
      case 'replay':
        hostOnly(); needGame('over');
        return this.startGame({ firstRandom: true });
      case 'lobby':
        hostOnly(); needGame('over');
        Object.assign(h, { status: 'lobby', game: null, gameId: null, aim: null });
        return this.commit();
      default:
        throw new NetError('Action inconnue.');
    }
  }

  startGame({ firstRandom = false } = {}) {
    const h = this.host;
    const n = h.members.length;
    if (n < MIN_PLAYERS) throw new NetError(`Il faut au moins ${MIN_PLAYERS} joueurs.`);
    if (n > MAX_PLAYERS) throw new NetError(`${MAX_PLAYERS} joueurs au maximum.`);
    const check = validateComposition(h.settings.comp, n);
    if (!check.ok) throw new NetError(check.errors[0]);
    let first = firstRandom || h.settings.first === 'random' ? -1 : h.members.findIndex((m) => m.id === h.settings.first);
    if (first < 0) first = Math.floor(this.rng() * n);
    h.game = createGame({ names: h.members.map((m) => m.name), comp: h.settings.comp, firstPlayer: first }, this.rng);
    h.gameId = randomId(4);
    h.status = 'game';
    h.aim = null;
    return this.commit();
  }

  /** Efface ce qui concerne un joueur retiré du salon. */
  forget(id) {
    this.memberKeys.delete(id);
    this.lastPriv.delete(id);
    delete this.host.lastN[id];
    this.pub('p', id, '', { retain: true });
  }

  /** Enregistre l'état de l'hôte puis publie l'état public et les états privés. */
  async commit({ bump = true, privates = true } = {}) {
    const h = this.host;
    if (bump) h.ver += 1;
    this.storage.set(KEYS.host, h);
    this.publishState();
    if (privates) await this.publishPrivates();
    this.onUpdate();
  }

  publishState() {
    const h = this.host;
    const g = h.game;
    const members = h.members.map((m) => ({ id: m.id, name: m.name, online: this.online(m.id) }));
    this.lastFlags = members.map((m) => m.online).join();
    const room = {
      v: PROTOCOL, code: h.code, hostId: this.id, hostKey: this.keys.pub, ver: h.ver, status: h.status,
      members, settings: h.settings, gameId: h.gameId,
      game: g ? publicView(g) : null,
      aim: h.aim,
      final: g && g.phase === 'over' ? finalReveal(g) : null,
    };
    this.room = room;
    if (this.connected) this.pub('state', null, room, { retain: true });
    // l'état privé de l'hôte, calculé sur place (il ne transite pas)
    const seat = h.members.findIndex((m) => m.id === this.id);
    this.priv = g ? { ver: h.ver, gameId: h.gameId, ...privateView(g, seat) } : null;
  }

  async publishPrivates() {
    const h = this.host;
    if (!this.connected) return;
    for (const [seat, m] of h.members.entries()) {
      if (m.id === this.id) continue;
      if (!h.game) {
        if (this.lastPriv.get(m.id) !== '') { this.pub('p', m.id, '', { retain: true }); this.lastPriv.set(m.id, ''); }
        continue;
      }
      const data = { gameId: h.gameId, ...privateView(h.game, seat) };
      const json = JSON.stringify(data);
      if (this.lastPriv.get(m.id) === json) continue;
      this.lastPriv.set(m.id, json);
      const box = await seal(await this.keyFor(m), `priv:${m.id}`, { ...data, ver: h.ver });
      this.pub('p', m.id, box, { retain: true });
    }
  }

  // ─────────────────────────────────────────── horloge : présence, délais

  tick() {
    if (!this.code || !this.connected) return;
    const now = this.now();
    if (!this.lastHb || now - this.lastHb >= this.hbMs) { this.lastHb = now; this.heartbeat(); }
    if (this.isHost && this.host) {
      const flags = this.host.members.map((m) => this.online(m.id)).join();
      if (flags !== this.lastFlags) this.enqueue(() => this.commit({ privates: false }));
      return;
    }
    if (this.status === 'joining' && this.pending) {
      const p = this.pending;
      if (!this.room && now - Math.max(p.since, this.subscribedAt || 0) > this.joinWaitMs) {
        return this.reset(p.kind === 'resume' ? 'La partie est introuvable : l’hôte l’a peut-être fermée.' : 'Partie introuvable : vérifie le code.');
      }
      if (p.sentAt && now - p.sentAt > this.joinRetryMs) {
        if (p.tries >= 3) return this.reset('L’hôte ne répond pas. Réessaie dans un instant.');
        this.sendJoin();
      }
      return;
    }
    // côté joueur : met à jour l'affichage quand l'hôte disparaît ou revient
    const hostOn = this.hostOnline;
    if (hostOn !== this.lastHostOnline) { this.lastHostOnline = hostOn; this.onUpdate(); }
  }

  /** Arrête tout (tests). */
  close() {
    clearInterval(this.timer);
    this.client.end(true);
  }
}
