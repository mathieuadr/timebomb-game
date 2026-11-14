// Écran 7 — fin de partie : trois dénouements distincts.
import { h } from '../dom.js';
import { sceneArt, rolePortrait } from '../art.js';
import { badgeChip, confirmSheet } from '../components.js';
import { ROLE_TEXT, TEAM_LABEL, BADGE_LABEL } from '../texts.js';

function story(view) {
  const by = view.players[view.endedBy].name;
  const from = view.players[view.log.at(-1).from].name;
  if (view.winner === 'tech') {
    return { mood: 'safe', kicker: 'Réacteur stabilisé', title: 'Victoire des Techniciens', text: `${by} coupe la dernière dérivation chez ${from}. L’aurore revient sur la station.` };
  }
  if (view.winner === 'solo') {
    return {
      mood: 'solo', kicker: 'Coup de maître', title: `${by} gagne en solitaire`,
      text: view.reason === 'overload'
        ? `${by} était l’Électron libre… et a déclenché la Surcharge de sa propre main, chez ${from}.`
        : `${by} était l’Électron libre… et a coupé la dernière dérivation de sa propre main, chez ${from}.`,
    };
  }
  if (view.reason === 'overload') {
    return { mood: 'boom', kicker: 'Surcharge !', title: 'Victoire des Saboteurs', text: `${by} coupe la Surcharge chez ${from}. Le réacteur explose.` };
  }
  return { mood: 'boom', kicker: 'Trop tard…', title: 'Victoire des Saboteurs', text: 'La 4ᵉ manche s’achève sans que toutes les dérivations soient trouvées. Le réacteur lâche.' };
}

export function gameOverScreen(ctx) {
  const { net, ui } = ctx;
  const room = net.room;
  const view = room.game;
  const s = story(view);
  const hostName = room.members.find((m) => m.id === room.hostId)?.name || 'l’hôte';
  const st = ui.over?.gameId === room.gameId ? ui.over : (ui.over = { gameId: room.gameId, played: false, shown: false });

  if (!st.played) {
    st.played = true;
    setTimeout(() => (view.winner === 'tech' ? ctx.sound.win() : view.winner === 'solo' ? ctx.sound.solo() : view.reason === 'timeout' ? ctx.sound.timeout() : ctx.sound.overload()), 250);
  }

  const revealBox = h('div', { class: 'reveal-roles', id: 'rolesReveal' });
  const fill = () => {
    const row = (name, r, extra = '') => h('div', { class: `role-row team-${r.team} ${extra}` },
      h('span', { class: 'rr-portrait', html: rolePortrait(r.role, r.char) }),
      h('span', { class: 'rr-text' }, h('b', null, name), h('small', null, ROLE_TEXT[r.role].name)),
      r.badge ? badgeChip(r.badge, BADGE_LABEL[r.badge]) : null);
    revealBox.replaceChildren(
      ...room.final.players.map((p, i) => row(i === net.seat ? `${p.name} (toi)` : p.name, p, p.team === view.winner ? 'won' : '')),
      ...room.final.undealt.map((r) => row('Carte non distribuée', r, 'undealt')));
  };
  const revealBtn = st.shown || !room.final ? null : h('button', {
    class: 'btn big', id: 'btnRevealRoles',
    onClick: () => { ctx.sound.flip(); st.shown = true; fill(); revealBtn.remove(); },
  }, 'Révéler les rôles');
  if (st.shown && room.final) fill();

  const fx = s.mood === 'boom'
    ? h('div', { class: 'fx fx-boom', 'aria-hidden': 'true' }, h('i', { class: 'flash' }), h('i', { class: 'ring r1' }), h('i', { class: 'ring r2' }), h('i', { class: 'ring r3' }),
      Array.from({ length: 14 }, (_, i) => h('i', { class: 'debris', style: { '--a': `${(i * 360) / 14 + (i % 2) * 9}deg`, '--d': `${90 + (i % 5) * 28}px`, '--t': `${0.9 + (i % 4) * 0.18}s` } })))
    : h('div', { class: `fx fx-sparks ${s.mood}`, 'aria-hidden': 'true' }, s.mood === 'solo' ? h('i', { class: 'flash violet' }) : null,
      Array.from({ length: 16 }, (_, i) => h('i', { class: 'spark', style: { left: `${6 + ((i * 37) % 88)}%`, '--t': `${2.6 + (i % 5) * 0.5}s`, '--w': `${(i % 4) * 0.6}s` } })));

  async function quit() {
    const ok = await confirmSheet(net.isHost
      ? { title: 'Fermer la partie ?', text: 'Tous les joueurs seront renvoyés à l’accueil.', yes: 'Fermer la partie', danger: true }
      : { title: 'Quitter la table ?', text: `Tu quittes la partie de ${hostName}.`, yes: 'Quitter', danger: true });
    if (ok) net.leave();
  }

  const won = view.winner === (room.final?.players[net.seat]?.team);
  return h('section', { class: `screen over ${s.mood} win-${view.winner}`, 'data-winner': view.winner, 'data-reason': view.reason },
    h('div', { class: 'over-art', html: sceneArt(s.mood), 'aria-hidden': 'true' }),
    fx,
    h('div', { class: 'over-main' },
      h('p', { class: 'over-kicker' }, s.kicker),
      h('h1', { class: 'over-title', id: 'overTitle' }, s.title),
      h('p', { class: 'over-text' }, s.text),
      room.final ? h('p', { class: `over-me ${won ? 'won' : 'lost'}`, id: 'overMe' }, won ? 'Tu as gagné !' : 'Tu as perdu…') : null),
    h('div', { class: 'stat-grid' },
      h('div', { class: 'card glass stat-card' }, h('b', null, `${view.round}/${view.rounds}`), h('small', null, 'manches jouées')),
      h('div', { class: 'card glass stat-card' }, h('b', null, String(view.log.length)), h('small', null, 'câbles coupés')),
      h('div', { class: 'card glass stat-card aurora' }, h('b', null, `${view.found}/${view.total}`), h('small', null, 'dérivations'))),
    h('div', { class: 'card glass' },
      h('div', { class: 'lbl' }, 'Qui était qui ?'),
      h('p', { class: 'hint left' }, `Vainqueur : ${view.winner === 'solo' ? 'l’Électron libre' : `les ${TEAM_LABEL[view.winner]}`}.`),
      revealBox, revealBtn),
    h('div', { class: 'bottom-actions static' },
      net.isHost
        ? [
          h('button', { class: 'btn primary big', id: 'btnReplay', onClick: () => net.send({ t: 'replay' }) }, 'Rejouer avec la même table'),
          h('button', { class: 'btn big', id: 'btnBackLobby', onClick: () => net.send({ t: 'lobby' }) }, 'Retour au salon (changer les réglages)'),
        ]
        : h('div', { class: 'waiting-host', id: 'waitNext' }, h('span', { class: 'spinner sm', 'aria-hidden': 'true' }), `${hostName} choisit la suite : rejouer ou revenir au salon.`),
      h('button', { class: 'btn big ghost', id: 'btnQuit', onClick: quit }, net.isHost ? 'Fermer la partie' : 'Quitter la table')));
}
