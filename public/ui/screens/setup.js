// Écran 2 — Configuration : joueurs, ordre, premier joueur, rôles en jeu et fiches d'aide.
import { h, plural } from '../dom.js';
import { ICON } from '../art.js';
import { openRoleDoc, roleDocBody, toast } from '../components.js';
import { ROLE_DOCS } from '../texts.js';
import { MIN_PLAYERS, MAX_PLAYERS, MAX_TEAM_CARDS, MODE, BADGES, presetComposition, modeOf, validateComposition } from '../../engine/rules.js';
import { createGame } from '../../engine/game.js';
import { rng } from '../../state/store.js';

const MODE_HELP = {
  classic: 'Deux équipes secrètes, Techniciens contre Saboteurs. La version la plus simple pour découvrir le jeu.',
  infiltration: 'Ajoute les badges, un Électron libre qui joue seul, et des agents doubles dont le badge ment.',
  custom: 'Ta propre recette : règle chaque compteur comme tu veux.',
};

export const playerName = (draft, i) => draft.names[i].trim() || `Joueur ${i + 1}`;

export function setupScreen(ctx) {
  const { store } = ctx;
  const d = store.draft;
  const n = d.n;
  const check = validateComposition(d.comp, n);

  // ── modifications du brouillon
  // Les gestionnaires relisent toujours store.draft : `d` date du dernier rendu et ne contient pas
  // les prénoms tapés depuis (la frappe ne redessine pas l'écran).
  const update = (patch) => { store.setDraft(patch); ctx.render(); };
  const setComp = (patch) => {
    const comp = { ...store.draft.comp, ...patch };
    if (patch.badges === BADGES.OFF) { comp.mole = false; comp.infiltrator = false; }
    if ((patch.mole || patch.infiltrator) && comp.badges === BADGES.OFF) comp.badges = BADGES.NEIGHBOR;
    update({ comp, mode: modeOf(comp, store.draft.n) });
  };
  const setCount = (count) => {
    const { mode, comp, first } = store.draft;
    update({
      n: count,
      comp: mode === MODE.CUSTOM ? comp : presetComposition(mode, count),
      first: typeof first === 'number' && first >= count ? 'random' : first,
    });
  };
  const setMode = (mode) => {
    if (mode === MODE.CUSTOM) return update({ mode });
    update({ mode, comp: presetComposition(mode, store.draft.n) });
  };
  const move = (i, delta) => {
    const j = i + delta;
    if (j < 0 || j >= store.draft.n) return;
    const names = store.draft.names.slice();
    [names[i], names[j]] = [names[j], names[i]];
    let first = store.draft.first;
    if (first === i) first = j; else if (first === j) first = i;
    update({ names, first });
  };

  // ── joueurs
  const firstChips = h('div', { class: 'chips', id: 'firstPick' });
  const drawChips = () => {
    firstChips.replaceChildren(
      h('button', { class: `chip ${d.first === 'random' ? 'sel' : ''}`, 'data-first': 'random', onClick: () => update({ first: 'random' }) },
        h('span', { class: 'chip-ic', html: ICON.dice }), 'Tirage au sort'),
      ...Array.from({ length: n }, (_, i) => h('button', { class: `chip ${d.first === i ? 'sel' : ''}`, 'data-first': String(i), onClick: () => update({ first: i }) }, playerName(store.draft, i))));
  };
  drawChips();

  const nameRows = Array.from({ length: n }, (_, i) => h('li', { class: 'name-row' },
    h('span', { class: 'num' }, String(i + 1)),
    h('input', {
      type: 'text', class: 'name-input', value: d.names[i], placeholder: `Joueur ${i + 1}`, maxLength: 14,
      attrs: { autocomplete: 'off', autocapitalize: 'words', spellcheck: 'false', enterkeyhint: 'next' }, 'aria-label': `Prénom du joueur ${i + 1}`,
      onInput: (e) => {
        // pas de nouveau rendu pendant la frappe : on garde le clavier ouvert
        const names = store.draft.names.slice();
        names[i] = e.target.value;
        store.setDraft({ names });
        const chip = firstChips.querySelector(`[data-first="${i}"]`);
        if (chip) chip.textContent = playerName(store.draft, i);
      },
      onKeydown: (e) => {
        if (e.key !== 'Enter') return;
        const next = e.target.closest('li').nextElementSibling;
        if (next) next.querySelector('input').focus(); else e.target.blur();
      },
    }),
    h('button', { class: 'icon-btn sm', 'aria-label': `Monter le joueur ${i + 1}`, disabled: i === 0, html: ICON.up, onClick: () => move(i, -1) }),
    h('button', { class: 'icon-btn sm', 'aria-label': `Descendre le joueur ${i + 1}`, disabled: i === n - 1, html: ICON.down, onClick: () => move(i, 1) })));

  // ── composition
  const info = (id) => h('button', { class: 'info-btn', 'aria-label': 'En savoir plus', html: ICON.info, onClick: () => openRoleDoc(id) });
  const stepper = (key, label, cls, docId) => h('div', { class: `comp-row ${cls}` },
    h('span', { class: 'dot' }),
    h('span', { class: 'comp-label' }, label), info(docId),
    h('div', { class: 'stepper' },
      h('button', { class: 'step', 'aria-label': `Moins de ${label}`, disabled: d.comp[key] <= 1, onClick: () => setComp({ [key]: d.comp[key] - 1 }) }, '−'),
      h('output', { id: `count-${key}` }, String(d.comp[key])),
      h('button', { class: 'step', 'aria-label': `Plus de ${label}`, disabled: d.comp[key] >= MAX_TEAM_CARDS, onClick: () => setComp({ [key]: d.comp[key] + 1 }) }, '+')));
  const toggle = (key, label, sub, cls, docId, value, onChange) => h('div', { class: `comp-row ${cls}` },
    h('span', { class: 'dot' }),
    h('span', { class: 'comp-label' }, label, sub ? h('small', null, sub) : null), info(docId),
    h('input', { type: 'checkbox', class: 'switch', id: `sw-${key}`, checked: value, 'aria-label': label, onChange: (e) => onChange(e.target.checked) }));

  const seg = (items, current, onPick, id) => h('div', { class: 'seg', id, role: 'group' },
    items.map(([value, label]) => h('button', { class: value === current ? 'sel' : '', 'data-v': String(value), 'aria-pressed': String(value === current), onClick: () => onPick(value) }, label)));

  let summary;
  if (check.ok) {
    summary = h('div', { class: 'summary ok', id: 'compSummary' },
      h('b', null, `${plural(check.total, 'carte')} Rôle pour ${n} joueurs`),
      h('span', null, check.undealt ? ` · ${plural(check.undealt, 'carte')} ${check.undealt > 1 ? 'resteront cachées' : 'restera cachée'}` : ' · toutes distribuées'));
  } else {
    summary = h('div', { class: 'summary err', id: 'compSummary' }, check.errors.map((e) => h('div', null, e)));
  }

  function launch() {
    const names = Array.from({ length: n }, (_, i) => playerName(store.draft, i));
    const seen = new Set();
    for (const name of names) {
      const key = name.toLocaleLowerCase('fr');
      if (seen.has(key)) { toast(`Deux joueurs s’appellent « ${name} » : change un prénom.`, { tone: 'warn' }); ctx.sound.error(); return; }
      seen.add(key);
    }
    if (!check.ok) { toast(check.errors[0], { tone: 'warn' }); ctx.sound.error(); return; }
    const random = d.first === 'random';
    const firstPlayer = random ? Math.floor(rng() * n) : d.first;
    const game = createGame({ names, comp: d.comp, firstPlayer }, rng);
    ctx.startGame(game, random ? `Tirage au sort : ${names[firstPlayer]} commence avec la pince.` : null);
  }

  return h('section', { class: 'screen setup' },
    h('header', { class: 'topbar' },
      h('button', { class: 'icon-btn', 'aria-label': 'Retour', html: ICON.back, onClick: () => ctx.go('home') }),
      h('h1', null, 'Nouvelle partie'),
      h('span', { class: 'topbar-space' })),

    h('div', { class: 'card glass' },
      h('div', { class: 'lbl' }, 'Combien de joueurs ?'),
      seg(Array.from({ length: MAX_PLAYERS - MIN_PLAYERS + 1 }, (_, i) => [MIN_PLAYERS + i, String(MIN_PLAYERS + i)]), n, setCount, 'countPick'),
      h('div', { class: 'lbl' }, 'Qui est à table ?'),
      h('p', { class: 'hint left' }, 'Dans l’ordre de la table, en tournant dans le sens des aiguilles d’une montre.'),
      h('ol', { class: 'names' }, nameRows)),

    h('div', { class: 'card glass' },
      h('div', { class: 'lbl' }, 'Qui commence avec la pince ?'),
      firstChips),

    h('div', { class: 'card glass' },
      h('div', { class: 'lbl' }, 'Rôles en jeu'),
      seg([[MODE.CLASSIC, 'Classique'], [MODE.INFILTRATION, 'Infiltration'], [MODE.CUSTOM, 'Perso']], d.mode, setMode, 'modePick'),
      h('p', { class: 'hint left', id: 'modeHelp' }, MODE_HELP[d.mode]),
      stepper('tech', 'Techniciens', 'c-tech', 'tech'),
      stepper('sab', 'Saboteurs', 'c-sab', 'sab'),
      toggle('solo', 'Électron libre', 'joue seul', 'c-solo', 'solo', d.comp.solo === 1, (on) => setComp({ solo: on ? 1 : 0 })),
      toggle('mole', 'La Taupe', 'Saboteur au badge bleu', 'c-sab', 'mole', d.comp.mole, (on) => setComp({ mole: on })),
      toggle('infiltrator', 'L’Infiltré', 'Technicien au badge orange', 'c-tech', 'infiltrator', d.comp.infiltrator, (on) => setComp({ infiltrator: on })),
      h('div', { class: 'lbl with-info' }, 'Qui voit les badges ?', info('badge')),
      seg([[BADGES.OFF, 'Aucun badge'], [BADGES.NEIGHBOR, 'Voisin de gauche'], [BADGES.PUBLIC, 'Toute la table']], d.comp.badges, (badges) => setComp({ badges }), 'badgePick'),
      summary),

    h('div', { class: 'card glass' },
      h('div', { class: 'lbl' }, 'Les rôles'),
      h('p', { class: 'hint left' }, 'Touche un rôle pour savoir comment il gagne.'),
      ROLE_DOCS.map((doc) => h('details', { class: `acc acc-${doc.color}`, 'data-doc': doc.id },
        h('summary', null, h('span', { class: 'acc-title' }, doc.title), h('span', { class: 'acc-tag' }, doc.tag)),
        roleDocBody(doc)))),

    h('div', { class: 'cta-space' }),
    h('div', { class: 'cta-bar' },
      h('button', { class: 'btn primary big', id: 'btnLaunch', disabled: !check.ok, onClick: launch }, 'Lancer la partie')));
}
