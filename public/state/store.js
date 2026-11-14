// Coupe-Circuit — préférences de l'appareil et accès au stockage local.
// La partie elle-même est sauvegardée par la couche réseau (net/room.js) : chez l'hôte l'état
// complet, chez chaque joueur seulement de quoi se reconnecter.

/** Stockage JSON tolérant aux erreurs (navigation privée, quota plein…). */
export const storage = {
  get(key) {
    try { const v = localStorage.getItem(key); return v == null ? null : JSON.parse(v); } catch { return null; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* sans stockage, la partie continue en mémoire */ }
  },
  del(key) {
    try { localStorage.removeItem(key); } catch { /* idem */ }
  },
};

const KEY = 'cc:prefs';
const prefersReduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export const prefs = {
  name: '',
  sound: true,
  motion: !prefersReduced(),
  load() { Object.assign(this, storage.get(KEY) || {}); },
  set(key, value) {
    this[key] = value;
    storage.set(KEY, { name: this.name, sound: this.sound, motion: this.motion });
  },
};
