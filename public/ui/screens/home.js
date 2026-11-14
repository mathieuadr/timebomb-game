// Écran d'accueil : prénom, créer une partie ou en rejoindre une.
import { h } from '../dom.js';
import { ICON, sceneArt } from '../art.js';
import { settingToggles, toast } from '../components.js';
import { cleanCode } from '../../net/room.js';

export function homeScreen(ctx) {
  const { prefs, ui, net } = ctx;
  const invited = cleanCode(ui.invite || '');

  const nameInput = h('input', {
    type: 'text', class: 'field', id: 'name', value: prefs.name, placeholder: 'ex. Camille', maxLength: 14,
    'aria-label': 'Ton prénom', attrs: { autocomplete: 'nickname', autocapitalize: 'words', spellcheck: 'false', enterkeyhint: 'done' },
    onInput: (e) => prefs.set('name', e.target.value),
  });
  const codeInput = h('input', {
    type: 'text', class: 'field code-input', id: 'code', value: ui.code || '', placeholder: 'CODE', maxLength: 5,
    'aria-label': 'Code de la partie', attrs: { autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false', enterkeyhint: 'go' },
    onInput: (e) => { e.target.value = cleanCode(e.target.value); ui.code = e.target.value; },
    onKeydown: (e) => { if (e.key === 'Enter') join(e.target.value); },
  });

  const name = () => {
    const v = nameInput.value.trim();
    if (!v) { toast('Indique d’abord ton prénom.', { tone: 'warn' }); ctx.sound.error(); nameInput.focus(); return null; }
    prefs.set('name', v);
    return v;
  };
  async function create() {
    const n = name();
    if (!n) return;
    ctx.sound.unlock();
    try { await net.create(n); } catch (e) { toast(e.message, { tone: 'warn' }); }
  }
  async function join(code) {
    const n = name();
    if (!n) return;
    code = cleanCode(code);
    if (code.length !== 5) { toast('Le code de la partie a 5 caractères.', { tone: 'warn' }); ctx.sound.error(); codeInput.focus(); return; }
    ctx.sound.unlock();
    ui.invite = null;
    try { await net.join(code, n); } catch (e) { toast(e.message, { tone: 'warn' }); }
  }

  const actions = invited
    ? [
      h('div', { class: 'invite' }, 'Tu es invité·e à la partie ', h('b', { class: 'mono' }, invited)),
      h('button', { class: 'btn primary big', id: 'btnJoinInvite', onClick: () => join(invited) }, 'Rejoindre la partie'),
      h('button', { class: 'btn ghost', id: 'btnOwn', onClick: () => { ui.invite = null; ctx.render(true); } }, 'Créer plutôt ma propre partie'),
    ]
    : [
      h('button', { class: 'btn primary big', id: 'btnCreate', onClick: create }, 'Créer une partie'),
      h('div', { class: 'sep' }, h('span', null, 'ou rejoindre une partie')),
      h('div', { class: 'row' }, codeInput, h('button', { class: 'btn', id: 'btnJoin', onClick: () => join(codeInput.value) }, 'Rejoindre')),
    ];

  return h('section', { class: 'screen home' },
    h('div', { class: 'home-art', html: sceneArt('home'), 'aria-hidden': 'true' }),
    h('div', { class: 'home-top' }, settingToggles(ctx)),
    h('div', { class: 'home-title' },
      h('h1', { class: 'logo', 'aria-label': 'Coupe-Circuit' },
        h('span', { class: 'l1' }, 'COUPE'),
        h('span', { class: 'cutmark', html: ICON.pince }),
        h('span', { class: 'l2' }, 'CIRCUIT')),
      h('p', { class: 'tagline' }, 'Rôles secrets à la station polaire.', h('br'), 'Chacun son téléphone, autour de la même table.')),
    h('div', { class: 'card glass home-card' },
      h('label', { class: 'lbl', for: 'name' }, 'Ton prénom'),
      nameInput,
      actions),
    h('div', { class: 'home-foot' },
      h('button', { class: 'btn ghost', id: 'btnRules', onClick: () => ctx.go('rules') }, h('span', { class: 'btn-ic', html: ICON.book }), 'Règles du jeu'),
      h('p', { class: 'hint' }, '4 à 8 joueurs · un téléphone chacun · sans compte')));
}

/** Pendant la connexion à une partie. */
export function joiningScreen(ctx) {
  const { net } = ctx;
  const resuming = net.pending?.kind === 'resume';
  return h('section', { class: 'screen joining' },
    h('div', { class: 'handoff-main' },
      h('div', { class: 'spinner', 'aria-hidden': 'true' }),
      h('p', { class: 'handoff-lead' }, resuming ? 'Retour dans la partie' : 'Connexion à la partie'),
      h('div', { class: 'room-code', id: 'joiningCode' }, net.code),
      h('p', { class: 'handoff-note' }, net.connected ? 'On attend la réponse de l’hôte…' : 'Connexion au relais…')),
    h('div', { class: 'bottom-actions' },
      h('button', { class: 'btn big', id: 'btnCancelJoin', onClick: () => net.reset() }, 'Annuler')));
}
