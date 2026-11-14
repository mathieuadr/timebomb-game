// Coupe-Circuit — démarrage, navigation entre écrans, garde-fous de confidentialité.

import * as MQ from './vendor/mqtt.esm.js';
import { Net } from './net/room.js';
import { storage, prefs } from './state/store.js';
import { sound } from './ui/sound.js';
import { h } from './ui/dom.js';
import { installDefs } from './ui/art.js';
import { openSheet, closeTopSheet, closeAllSheets, confirmSheet, settingRows, rulesContent, toast } from './ui/components.js';
import { homeScreen, joiningScreen } from './ui/screens/home.js';
import { lobbyScreen } from './ui/screens/lobby.js';
import { rulesScreen } from './ui/screens/rules.js';
import { secretScreen } from './ui/screens/secret.js';
import { tableScreen, showReveal, openMyRole } from './ui/screens/table.js';
import { roundEndScreen } from './ui/screens/roundEnd.js';
import { gameOverScreen } from './ui/screens/gameOver.js';

const mqtt = MQ.default?.connect ? MQ.default : MQ;
const params = new URLSearchParams(location.search);
// Relais public par défaut ; `?broker=wss://…` pour en utiliser un autre (tous les joueurs doivent avoir le même).
const BROKER = params.get('broker') || 'wss://broker.hivemq.com:8884/mqtt';

const ui = {
  screen: 'home', // home | rules (hors partie)
  invite: params.get('room'), // code reçu par un lien d'invitation
  code: '',
  secret: null, // affichage local des secrets (révélé ou non) — jamais sauvegardé
  over: null,
  dealing: null,
  seenLog: null,
};
// le code d'invitation n'a pas à survivre à une actualisation
if (params.has('room')) {
  params.delete('room');
  const q = params.toString();
  history.replaceState(null, '', `${location.pathname}${q ? `?${q}` : ''}`);
}

prefs.load();
const ctx = { prefs, ui, sound, render, go, openMenu, setSetting, net: null };

function applySettings() {
  sound.setEnabled(prefs.sound);
  document.documentElement.classList.toggle('reduced', !prefs.motion);
}

function setSetting(key, value, { silent = false } = {}) {
  prefs.set(key, value);
  applySettings();
  if (key === 'sound' && value) sound.tap();
  if (!silent) render(true);
}

// ───────────────────────────────────────────── Navigation

/** Écran à afficher : [clé, signature, construction]. On ne redessine que si la signature change. */
function route() {
  const { net } = ctx;
  if (net.status === 'idle') {
    if (ui.screen === 'rules') return ['rules', '', () => rulesScreen(ctx)];
    return ['home', ui.invite || '', () => homeScreen(ctx)];
  }
  const room = net.room;
  if (net.status === 'joining' || !room) return ['joining', `${net.connected}|${net.code}`, () => joiningScreen(ctx)];
  if (room.status === 'lobby' || !room.game) return ['lobby', `${room.ver}|${net.connected}`, () => lobbyScreen(ctx)];
  const phase = room.game.phase;
  if (phase === 'roles' || phase === 'inspect') return ['secret', `${room.ver}|${net.priv?.gameId}|${net.priv?.ver}`, () => secretScreen(ctx)];
  if (phase === 'play') return ['table', `${room.ver}|${net.priv?.ver}`, () => tableScreen(ctx)];
  if (phase === 'roundEnd') return ['roundEnd', `${room.ver}`, () => roundEndScreen(ctx)];
  return ['over', `${room.gameId}|${!!room.final}|${net.isHost}`, () => gameOverScreen(ctx)];
}

let last = { key: null, sig: null, sheets: null };
function render(force = false) {
  const { net } = ctx;
  const [key, sig, build] = route();
  // une feuille ouverte (choix d'un câble…) n'a plus de sens si la partie a avancé
  const g = net.room?.game;
  const sheets = `${net.status}|${net.room?.status}|${net.room?.gameId}|${g?.phase}|${g?.round}|${g?.log.length}`;
  if (last.sheets !== null && sheets !== last.sheets) closeAllSheets();
  last.sheets = sheets;
  if (!force && key === last.key && sig === last.sig) return;
  const same = key === last.key;
  const y = window.scrollY;
  document.getElementById('app').replaceChildren(build());
  document.body.dataset.screen = key;
  window.scrollTo(0, same ? y : 0);
  last.key = key;
  last.sig = sig;
}

function go(screen) {
  closeAllSheets();
  ui.screen = screen;
  render(true);
}

/** Bandeau d'état de la connexion. */
function netbar() {
  const { net } = ctx;
  const bar = document.getElementById('netbar');
  let text = '';
  if (net.status !== 'idle' && !net.connected) text = 'Connexion au relais…';
  else if (net.status === 'room' && !net.isHost && net.room && !net.hostOnline) {
    const host = net.room.members.find((m) => m.id === net.room.hostId)?.name || 'L’hôte';
    text = `${host} (l’hôte) est hors ligne : la partie reprendra dès son retour.`;
  }
  bar.textContent = text;
  bar.classList.toggle('hidden', !text);
}

/** Appelé à chaque changement venant du réseau : animation de coupe, puis nouvel affichage. */
function update() {
  const { net } = ctx;
  const room = net.room;
  if (net.status === 'room' && room?.game) {
    const len = room.game.log.length;
    const prev = ui.seenLog;
    if (prev && prev.id === room.gameId && len === prev.len + 1) showReveal(ctx, room);
    ui.seenLog = { id: room.gameId, len };
  } else {
    ui.seenLog = null;
  }
  if (ui.dealing && room?.game?.phase !== 'roundEnd') ui.dealing = null;
  render();
  netbar();
  keepAwake();
}
let scheduled = false;
function schedule() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => { scheduled = false; update(); });
}

// ───────────────────────────────────────────── Menu

function openMenu() {
  const { net } = ctx;
  const inRoom = net.status === 'room' && net.room;
  const inGame = inRoom && net.room.game && net.priv;
  const sheet = openSheet(
    h('div', { class: 'menu' },
      settingRows(ctx),
      h('div', { class: 'btn-col' },
        inGame ? h('button', { class: 'btn big', id: 'menuRole', onClick: () => { sheet.close(); openMyRole(ctx); } }, 'Mon rôle') : null,
        h('button', { class: 'btn big', id: 'menuRules', onClick: () => openSheet(rulesContent(), { title: 'Règles du jeu', cls: 'tall' }) }, 'Règles du jeu'),
        inRoom ? h('button', {
          class: 'btn big danger', id: 'menuQuit',
          onClick: async () => {
            const host = net.isHost;
            const playing = !!net.room.game && net.room.game.phase !== 'over';
            const ok = await confirmSheet(host
              ? { title: 'Fermer la partie ?', text: 'La partie s’arrête pour tout le monde et tous les joueurs reviennent à l’accueil.', yes: 'Fermer la partie', danger: true }
              : { title: 'Quitter la partie ?', text: playing ? 'La table devra t’attendre, ou l’hôte jouera à ta place. Tu pourras revenir en rouvrant l’appli.' : 'Tu reviendras à l’accueil.', yes: 'Quitter', danger: true });
            if (!ok) return;
            sheet.close();
            if (host || !playing) net.leave(); else net.reset();
          },
        }, net.isHost ? 'Fermer la partie pour tout le monde' : 'Quitter la partie') : null)),
    { title: 'Menu' });
}

// ───────────────────────────────────────────── Garde-fous

/** Un secret affiché ne survit jamais à un passage en arrière-plan. */
function hideSecrets() {
  let changed = false;
  if (ui.secret && (ui.secret.shown || ui.secret.peek)) { ui.secret.shown = false; ui.secret.peek = false; changed = true; }
  if (document.querySelector('.myrole')) { closeAllSheets(); changed = true; }
  if (changed) render(true);
}
document.addEventListener('visibilitychange', () => { if (document.hidden) hideSecrets(); else keepAwake(); });
window.addEventListener('pagehide', hideSecrets);

/** Le geste « retour » ne fait jamais quitter l'appli : il ferme une feuille, au plus. */
function trapBack() { try { history.pushState({ cc: 1 }, ''); } catch { /* sans importance */ } }
window.addEventListener('popstate', () => {
  trapBack();
  if (closeTopSheet()) return;
  if (ctx.net.status === 'idle' && ui.screen === 'rules') go('home');
});
document.addEventListener('pointerdown', () => { sound.unlock(); trapBack(); }, { once: true });

document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('focusin', (e) => { if (e.target.matches('input[type="text"]')) document.body.classList.add('typing'); });
document.addEventListener('focusout', () => document.body.classList.remove('typing'));

/** Empêche l'écran de s'éteindre pendant une partie, quand le navigateur le permet. */
let wake = null;
async function keepAwake() {
  try {
    if (!('wakeLock' in navigator) || document.hidden || ctx.net?.status !== 'room') return;
    if (wake && !wake.released) return;
    wake = await navigator.wakeLock.request('screen');
  } catch { /* refusé : sans conséquence */ }
}

// ───────────────────────────────────────────── Démarrage

applySettings();
installDefs();
ctx.net = new Net({
  connect: mqtt.connect,
  broker: BROKER,
  storage,
  onUpdate: schedule,
  onError: (msg) => { toast(msg, { tone: 'warn' }); sound.error(); },
});
render(true);
trapBack();
ctx.net.resume().finally(() => { window.__ccReady = true; schedule(); });

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').catch(() => {}); });
}
