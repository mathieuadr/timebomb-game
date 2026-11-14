// Salon : on attend les joueurs, l'hôte range la table et règle les rôles en jeu.
import { h, plural } from '../dom.js';
import { ICON } from '../art.js';
import { openRoleDoc, roleDocBody, confirmSheet, toast } from '../components.js';
import { ROLE_DOCS } from '../texts.js';
import { MIN_PLAYERS, MAX_PLAYERS, MAX_TEAM_CARDS, MODE, BADGES, validateComposition } from '../../engine/rules.js';

const MODE_LABEL = { classic: 'Classique', infiltration: 'Infiltration', custom: 'Perso' };
const MODE_HELP = {
  classic: 'Deux équipes secrètes, Techniciens contre Saboteurs. La version la plus simple pour découvrir le jeu.',
  infiltration: 'Ajoute les badges, un Électron libre qui joue seul, et des agents doubles dont le badge ment.',
  custom: 'Ta propre recette : règle chaque compteur comme tu veux.',
};
const BADGE_RULE = { off: 'Aucun badge', neighbor: 'Badge montré au voisin de gauche', public: 'Badges visibles de toute la table' };

export function inviteLink(code) {
  const url = new URL(location.href);
  url.search = '';
  url.hash = '';
  url.searchParams.set('room', code);
  const broker = new URLSearchParams(location.search).get('broker');
  if (broker) url.searchParams.set('broker', broker);
  return url.toString();
}

async function share(code) {
  const link = inviteLink(code);
  try {
    if (navigator.share) { await navigator.share({ title: 'Coupe-Circuit', text: `Rejoins ma partie de Coupe-Circuit : code ${code}`, url: link }); return; }
  } catch (e) { if (e?.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(link); toast('Lien d’invitation copié.'); } catch { toast(`Code de la partie : ${code}`); }
}

export function lobbyScreen(ctx) {
  const { net } = ctx;
  const room = net.room;
  const isHost = net.isHost;
  const s = room.settings;
  const comp = s.comp;
  const n = room.members.length;
  const check = validateComposition(comp, Math.max(n, MIN_PLAYERS));
  const missing = Math.max(0, MIN_PLAYERS - n);
  const hostName = room.members.find((m) => m.id === room.hostId)?.name || 'l’hôte';
  const send = (cmd) => net.send(cmd);
  const setComp = (patch) => {
    const next = { ...comp, ...patch };
    if (patch.badges === BADGES.OFF) { next.mole = false; next.infiltrator = false; }
    if ((patch.mole || patch.infiltrator) && next.badges === BADGES.OFF) next.badges = BADGES.NEIGHBOR;
    send({ t: 'settings', comp: next });
  };

  async function leave() {
    const ok = await confirmSheet(isHost
      ? { title: 'Fermer la partie ?', text: 'Tous les joueurs du salon seront renvoyés à l’accueil.', yes: 'Fermer la partie', danger: true }
      : { title: 'Quitter le salon ?', text: 'Tu pourras revenir avec le même code tant que la partie n’a pas commencé.', yes: 'Quitter', danger: true });
    if (ok) net.leave();
  }

  // ── joueurs
  const rows = room.members.map((m, i) => {
    const me = m.id === net.id;
    return h('li', { class: `member ${m.online ? '' : 'off'} ${me ? 'me' : ''}`.trim(), 'data-id': m.id },
      h('span', { class: 'num' }, String(i + 1)),
      h('span', { class: `presence ${m.online ? 'on' : 'off'}`, title: m.online ? 'Connecté' : 'Hors ligne' }),
      h('span', { class: 'm-name' }, m.name,
        m.id === room.hostId ? h('span', { class: 'tag-mini host' }, 'hôte') : null,
        me ? h('span', { class: 'tag-mini' }, 'toi') : null,
        m.online ? null : h('span', { class: 'tag-mini warn' }, 'hors ligne')),
      isHost ? h('span', { class: 'm-tools' },
        h('button', { class: 'icon-btn sm', 'aria-label': `Monter ${m.name}`, disabled: i === 0, html: ICON.up, onClick: () => send({ t: 'move', id: m.id, delta: -1 }) }),
        h('button', { class: 'icon-btn sm', 'aria-label': `Descendre ${m.name}`, disabled: i === n - 1, html: ICON.down, onClick: () => send({ t: 'move', id: m.id, delta: 1 }) }),
        me ? h('span', { class: 'icon-spacer' }) : h('button', {
          class: 'icon-btn sm danger-ic', 'aria-label': `Retirer ${m.name}`, html: ICON.close,
          onClick: async () => { if (await confirmSheet({ title: `Retirer ${m.name} ?`, text: `${m.name} sera renvoyé·e à l’accueil.`, yes: 'Retirer', danger: true })) send({ t: 'kick', id: m.id }); },
        })) : null);
  });

  // ── réglages
  const info = (id) => h('button', { class: 'info-btn', 'aria-label': 'En savoir plus', html: ICON.info, onClick: () => openRoleDoc(id) });
  const seg = (items, current, onPick, id) => h('div', { class: 'seg', id, role: 'group' },
    items.map(([value, label]) => h('button', { class: value === current ? 'sel' : '', 'data-v': String(value), 'aria-pressed': String(value === current), onClick: () => onPick(value) }, label)));
  const stepper = (key, label, cls, docId) => h('div', { class: `comp-row ${cls}` },
    h('span', { class: 'dot' }), h('span', { class: 'comp-label' }, label), info(docId),
    h('div', { class: 'stepper' },
      h('button', { class: 'step', 'aria-label': `Moins de ${label}`, disabled: comp[key] <= 1, onClick: () => setComp({ [key]: comp[key] - 1 }) }, '−'),
      h('output', { id: `count-${key}` }, String(comp[key])),
      h('button', { class: 'step', 'aria-label': `Plus de ${label}`, disabled: comp[key] >= MAX_TEAM_CARDS, onClick: () => setComp({ [key]: comp[key] + 1 }) }, '+')));
  const toggle = (key, label, sub, cls, docId, value, onChange) => h('div', { class: `comp-row ${cls}` },
    h('span', { class: 'dot' }), h('span', { class: 'comp-label' }, label, sub ? h('small', null, sub) : null), info(docId),
    h('input', { type: 'checkbox', class: 'switch', id: `sw-${key}`, checked: value, 'aria-label': label, onChange: (e) => onChange(e.target.checked) }));

  const firstName = s.first === 'random' ? 'Tirage au sort' : room.members.find((m) => m.id === s.first)?.name || 'Tirage au sort';
  let settings;
  if (isHost) {
    settings = [
      seg([[MODE.CLASSIC, 'Classique'], [MODE.INFILTRATION, 'Infiltration'], [MODE.CUSTOM, 'Perso']], s.mode, (mode) => send({ t: 'settings', mode }), 'modePick'),
      h('p', { class: 'hint left', id: 'modeHelp' }, MODE_HELP[s.mode]),
      stepper('tech', 'Techniciens', 'c-tech', 'tech'),
      stepper('sab', 'Saboteurs', 'c-sab', 'sab'),
      toggle('solo', 'Électron libre', 'joue seul', 'c-solo', 'solo', comp.solo === 1, (on) => setComp({ solo: on ? 1 : 0 })),
      toggle('mole', 'La Taupe', 'Saboteur au badge bleu', 'c-sab', 'mole', comp.mole, (on) => setComp({ mole: on })),
      toggle('infiltrator', 'L’Infiltré', 'Technicien au badge orange', 'c-tech', 'infiltrator', comp.infiltrator, (on) => setComp({ infiltrator: on })),
      h('div', { class: 'lbl with-info' }, 'Qui voit les badges ?', info('badge')),
      seg([[BADGES.OFF, 'Aucun badge'], [BADGES.NEIGHBOR, 'Voisin de gauche'], [BADGES.PUBLIC, 'Toute la table']], comp.badges, (badges) => setComp({ badges }), 'badgePick'),
      h('div', { class: 'lbl' }, 'Qui commence avec la pince ?'),
      h('div', { class: 'chips', id: 'firstPick' },
        h('button', { class: `chip ${s.first === 'random' ? 'sel' : ''}`, 'data-first': 'random', onClick: () => send({ t: 'settings', first: 'random' }) }, h('span', { class: 'chip-ic', html: ICON.dice }), 'Tirage au sort'),
        room.members.map((m) => h('button', { class: `chip ${s.first === m.id ? 'sel' : ''}`, 'data-first': m.id, onClick: () => send({ t: 'settings', first: m.id }) }, m.name))),
    ];
  } else {
    const line = (cls, label, value, docId) => h('div', { class: `comp-row ro ${cls}` }, h('span', { class: 'dot' }), h('span', { class: 'comp-label' }, label), docId ? info(docId) : null, h('b', { class: 'ro-v' }, value));
    settings = [
      h('div', { class: 'ro-mode' }, h('b', { id: 'modeName' }, MODE_LABEL[s.mode]), h('span', { class: 'muted' }, ` · réglé par ${hostName}`)),
      h('p', { class: 'hint left' }, MODE_HELP[s.mode]),
      line('c-tech', 'Techniciens', String(comp.tech), 'tech'),
      line('c-sab', 'Saboteurs', String(comp.sab), 'sab'),
      comp.solo ? line('c-solo', 'Électron libre', 'oui', 'solo') : null,
      comp.mole ? line('c-sab', 'La Taupe', 'oui', 'mole') : null,
      comp.infiltrator ? line('c-tech', 'L’Infiltré', 'oui', 'infiltrator') : null,
      line('', 'Badges', BADGE_RULE[comp.badges], 'badge'),
      line('', 'Commence', firstName),
    ];
  }

  let summary;
  if (missing) summary = h('div', { class: 'summary wait', id: 'compSummary' }, `Encore ${plural(missing, 'joueur')} à attendre (${MIN_PLAYERS} minimum).`);
  else if (check.ok) {
    summary = h('div', { class: 'summary ok', id: 'compSummary' },
      h('b', null, `${plural(check.total, 'carte')} Rôle pour ${n} joueurs`),
      h('span', null, check.undealt ? ` · ${plural(check.undealt, 'carte')} ${check.undealt > 1 ? 'resteront cachées' : 'restera cachée'}` : ' · toutes distribuées'));
  } else summary = h('div', { class: 'summary err', id: 'compSummary' }, check.errors.map((e) => h('div', null, e)));

  const canStart = !missing && check.ok && n <= MAX_PLAYERS;
  return h('section', { class: 'screen lobby' },
    h('header', { class: 'topbar' },
      h('button', { class: 'icon-btn', id: 'btnLeaveLobby', 'aria-label': isHost ? 'Fermer la partie' : 'Quitter le salon', html: ICON.back, onClick: leave }),
      h('h1', null, 'Salon'),
      h('button', { class: 'icon-btn', 'aria-label': 'Menu', html: ICON.menu, onClick: () => ctx.openMenu() })),

    h('div', { class: 'card glass center code-card' },
      h('div', { class: 'lbl' }, 'Code de la partie'),
      h('div', { class: 'room-code', id: 'roomCode' }, room.code),
      h('button', { class: 'btn primary', id: 'btnShare', onClick: () => share(room.code) }, h('span', { class: 'btn-ic', html: ICON.users }), 'Inviter des joueurs'),
      h('p', { class: 'hint' }, 'Les autres ouvrent le lien, ou tapent ce code sur l’accueil.')),

    h('div', { class: 'card glass' },
      h('div', { class: 'lbl' }, `Autour de la table · ${n}/${MAX_PLAYERS}`),
      isHost ? h('p', { class: 'hint left' }, 'Range les joueurs dans l’ordre où vous êtes assis, dans le sens des aiguilles d’une montre.') : null,
      h('ol', { class: 'members', id: 'members' }, rows)),

    h('div', { class: 'card glass', id: 'settingsCard' },
      h('div', { class: 'lbl' }, 'Rôles en jeu'),
      settings,
      summary),

    h('div', { class: 'card glass' },
      h('div', { class: 'lbl' }, 'Les rôles'),
      h('p', { class: 'hint left' }, 'Touche un rôle pour savoir comment il gagne.'),
      ROLE_DOCS.map((doc) => h('details', { class: `acc acc-${doc.color}`, 'data-doc': doc.id },
        h('summary', null, h('span', { class: 'acc-title' }, doc.title), h('span', { class: 'acc-tag' }, doc.tag)),
        roleDocBody(doc)))),

    h('div', { class: 'cta-space' }),
    h('div', { class: 'cta-bar' },
      isHost
        ? h('button', { class: 'btn primary big', id: 'btnLaunch', disabled: !canStart, onClick: () => { ctx.sound.unlock(); send({ t: 'start' }); } },
          missing ? `Lancer · encore ${plural(missing, 'joueur')}` : 'Lancer la partie')
        : h('div', { class: 'waiting-host', id: 'waitStart' }, h('span', { class: 'spinner sm', 'aria-hidden': 'true' }), `En attente que ${hostName} lance la partie…`)));
}
