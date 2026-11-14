// Coupe-Circuit — démarrage, navigation entre écrans, garde-fous de confidentialité.

import { store } from './state/store.js';
import { sound } from './ui/sound.js';
import { h } from './ui/dom.js';
import { installDefs } from './ui/art.js';
import { openSheet, closeTopSheet, closeAllSheets, confirmSheet, settingRows, rulesContent, toast } from './ui/components.js';
import { homeScreen } from './ui/screens/home.js';
import { setupScreen } from './ui/screens/setup.js';
import { rulesScreen } from './ui/screens/rules.js';
import { passScreen } from './ui/screens/pass.js';
import { tableScreen } from './ui/screens/table.js';
import { roundEndScreen } from './ui/screens/roundEnd.js';
import { gameOverScreen } from './ui/screens/gameOver.js';

const ui = {
  screen: 'home', // home | setup | rules | game
  pass: { stage: 'handoff' }, // jamais sauvegardé : on repart toujours de l'écran neutre
  overPlayed: false,
};

const ctx = { store, ui, sound, render, go, startGame, openMenu, setSetting };

function applySettings() {
  sound.setEnabled(store.settings.sound);
  document.documentElement.classList.toggle('reduced', !store.settings.motion);
}

function setSetting(key, value, { silent = false } = {}) {
  store.setSetting(key, value);
  applySettings();
  if (key === 'sound' && value) sound.tap();
  if (!silent) render();
}

function currentView() {
  if (ui.screen === 'game' && store.game) {
    const phase = store.game.phase;
    if (ui.pass.stage === 'done' || phase === 'roles' || phase === 'inspect') return ['pass', passScreen(ctx)];
    if (phase === 'play') return ['table', tableScreen(ctx)];
    if (phase === 'roundEnd') return ['roundEnd', roundEndScreen(ctx)];
    return ['over', gameOverScreen(ctx)];
  }
  if (ui.screen === 'setup') return ['setup', setupScreen(ctx)];
  if (ui.screen === 'rules') return ['rules', rulesScreen(ctx)];
  return ['home', homeScreen(ctx)];
}

let lastKey = null;
function render() {
  const app = document.getElementById('app');
  const y = window.scrollY;
  const [key, view] = currentView();
  app.replaceChildren(view);
  document.body.dataset.screen = key;
  // même écran (réglage modifié dans la configuration) : on reste où l'on était
  window.scrollTo(0, key === lastKey && key === 'setup' ? y : 0);
  lastKey = key;
}

function go(screen) {
  closeAllSheets();
  ui.screen = screen;
  ui.pass = { stage: 'handoff' };
  if (screen !== 'game') ui.overPlayed = false;
  render();
  if (screen === 'game') keepAwake();
}

function startGame(game, message) {
  ui.overPlayed = false;
  store.setGame(game);
  go('game');
  if (message) toast(message);
}

function openMenu() {
  const sheet = openSheet(
    h('div', { class: 'menu' },
      settingRows(ctx),
      h('div', { class: 'btn-col' },
        h('button', { class: 'btn big', id: 'menuRules', onClick: () => openSheet(rulesContent(), { title: 'Règles du jeu', cls: 'tall' }) }, 'Règles du jeu'),
        h('button', {
          class: 'btn big danger', id: 'menuQuit',
          onClick: async () => {
            const ok = await confirmSheet({ title: 'Abandonner la partie ?', text: 'La partie en cours sera effacée de ce téléphone.', yes: 'Abandonner la partie', danger: true });
            if (!ok) return;
            sheet.close();
            store.clearGame();
            go('home');
          },
        }, 'Abandonner la partie'))),
    { title: 'Menu' });
}

// ───────────────────────────────────────────── Garde-fous

/** Un écran privé ne survit jamais à un passage en arrière-plan. */
function hideSecrets() {
  if (ui.screen === 'game' && ui.pass.stage === 'secret') {
    ui.pass = { stage: 'handoff' };
    closeAllSheets();
    render();
  }
}
document.addEventListener('visibilitychange', () => { if (document.hidden) hideSecrets(); else keepAwake(); });
window.addEventListener('pagehide', hideSecrets);

/** Le geste « retour » ne ramène jamais à un écran précédent : il ferme une feuille, au plus. */
function trapBack() { try { history.pushState({ cc: 1 }, ''); } catch { /* sans importance */ } }
window.addEventListener('popstate', () => {
  trapBack();
  if (closeTopSheet()) return;
  if (ui.screen === 'setup' || ui.screen === 'rules') go('home');
});

document.addEventListener('pointerdown', () => { sound.unlock(); trapBack(); }, { once: true });

// pas de zoom par double-tap ni de pincement : rien n'est petit au point d'en avoir besoin
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('focusin', (e) => { if (e.target.matches('input[type="text"]')) document.body.classList.add('typing'); });
document.addEventListener('focusout', () => document.body.classList.remove('typing'));

/** Empêche l'écran de s'éteindre pendant la partie, quand le navigateur le permet. */
let wake = null;
async function keepAwake() {
  try {
    if (!('wakeLock' in navigator) || document.hidden || ui.screen !== 'game') return;
    if (wake && !wake.released) return;
    wake = await navigator.wakeLock.request('screen');
  } catch { /* refusé : sans conséquence */ }
}

// ───────────────────────────────────────────── Démarrage

store.load();
applySettings();
installDefs();
// Reprise : une partie en cours se rouvre directement (sur un écran neutre ou sur la table).
if (store.game && store.game.phase !== 'over') ui.screen = 'game';
render();
trapBack();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').catch(() => {}); });
}

// pour les tests de bout en bout uniquement : savoir quand l'appli est prête
window.__ccReady = true;
