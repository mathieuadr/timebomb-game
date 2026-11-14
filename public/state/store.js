// Coupe-Circuit — état de l'application et sauvegarde locale automatique.
// Tout est conservé sur le téléphone (localStorage) : aucun serveur, aucun compte.
// L'état complet de la partie y figure pour permettre la reprise, mais il n'est jamais affiché :
// les écrans ne le lisent qu'à travers state/privacy.js.

import { STATE_VERSION } from '../engine/game.js';
import { MAX_PLAYERS, MODE, presetComposition } from '../engine/rules.js';

const KEY = 'coupe-circuit:v1';

export function defaultDraft() {
  return {
    n: 5,
    names: Array(MAX_PLAYERS).fill(''),
    first: 'random', // 'random' ou index du premier joueur
    mode: MODE.CLASSIC,
    comp: presetComposition(MODE.CLASSIC, 5),
  };
}

const prefersReduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export const store = {
  game: null,
  draft: defaultDraft(),
  settings: { sound: true, motion: !prefersReduced() },

  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data.settings) this.settings = { ...this.settings, ...data.settings };
      if (data.draft && Array.isArray(data.draft.names)) this.draft = { ...defaultDraft(), ...data.draft };
      if (data.game && data.game.v === STATE_VERSION) this.game = data.game;
    } catch {
      // sauvegarde illisible : on repart d'une appli vierge
    }
  },

  save() {
    try {
      localStorage.setItem(KEY, JSON.stringify({ settings: this.settings, draft: this.draft, game: this.game }));
    } catch {
      // stockage indisponible (navigation privée, quota) : la partie continue en mémoire
    }
  },

  setGame(game) { this.game = game; this.save(); },
  clearGame() { this.game = null; this.save(); },
  setDraft(patch) { this.draft = { ...this.draft, ...patch }; this.save(); },
  setSetting(key, value) { this.settings = { ...this.settings, [key]: value }; this.save(); },
};

/** Hasard de qualité cryptographique quand il est disponible (mélanges et tirages). */
export function rng() {
  if (globalThis.crypto?.getRandomValues) {
    const buf = new Uint32Array(1);
    globalThis.crypto.getRandomValues(buf);
    return buf[0] / 4294967296;
  }
  return Math.random();
}
