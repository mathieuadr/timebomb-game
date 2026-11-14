// Textes du jeu : noms des rôles, fiches d'aide, règles. Tout l'habillage se change ici.

export const GAME_NAME = 'Coupe-Circuit';

export const TEAM_LABEL = { tech: 'Techniciens', sab: 'Saboteurs', solo: 'Électron libre' };
export const WIRE_LABEL = { inert: 'Câble inerte', bypass: 'Dérivation', overload: 'Surcharge' };
export const BADGE_LABEL = { blue: 'bleu', orange: 'orange' };

export const ROLE_TEXT = {
  tech: {
    name: 'Technicien',
    team: 'Équipe des Techniciens',
    goal: 'Trouve toutes les dérivations avant la fin de la 4ᵉ manche pour stabiliser le réacteur.',
  },
  sab: {
    name: 'Saboteur',
    team: 'Équipe des Saboteurs',
    goal: 'Fais couper la Surcharge, ou empêche les Techniciens de finir avant la fin de la 4ᵉ manche.',
  },
  mole: {
    name: 'La Taupe',
    team: 'Équipe des Saboteurs',
    goal: 'Tu es Saboteur, mais ton badge est bleu : fais-toi passer pour un Technicien et fais couper la Surcharge.',
  },
  infiltrator: {
    name: 'L’Infiltré',
    team: 'Équipe des Techniciens',
    goal: 'Tu es Technicien, mais ton badge est orange : à toi de convaincre que tu veux vraiment sauver la station.',
  },
  solo: {
    name: 'L’Électron libre',
    team: 'Tu joues seul',
    goal: 'Coupe toi-même le câble qui termine la partie : la dernière dérivation ou la Surcharge. Si un autre la termine, tu perds.',
  },
};

// Titres des personnages illustrés (purement décoratifs).
export const CHARACTERS = {
  tech: ['Cheffe de station', 'Opérateur radio', 'Glaciologue', 'Mécano', 'Pilote', 'Médecin', 'Géologue', 'Météorologue'],
  sab: ['Faux géologue', 'Passagère clandestine', 'Faux mécano', 'Fausse médecin', 'Faux pilote', 'Fausse cuisinière', 'Faux radio', 'Fausse météorologue'],
  mole: ['Technicien modèle… en apparence'],
  infiltrator: ['Agent sous couverture'],
  solo: ['Ni l’un, ni l’autre'],
};

/** Fiches affichées sur la page de configuration (« Les rôles »). */
export const ROLE_DOCS = [
  {
    id: 'tech', title: 'Technicien', tag: 'Les gentils', color: 'tech', badge: 'Badge bleu',
    body: [
      'Les Techniciens veulent **stabiliser le réacteur**. Ils gagnent ensemble dès que **toutes les dérivations** ont été coupées.',
      'Ils ne se connaissent pas entre eux. Leur arme : dire la vérité sur leurs câbles… et repérer ceux qui mentent.',
      'Attention : un Technicien qui coupe la Surcharge fait gagner les Saboteurs.',
    ],
  },
  {
    id: 'sab', title: 'Saboteur', tag: 'Les méchants', color: 'sab', badge: 'Badge orange',
    body: [
      'Les Saboteurs veulent **la surchauffe du réacteur**. Ils gagnent ensemble si la **Surcharge** est coupée, ou si la **4ᵉ manche se termine** sans que toutes les dérivations soient trouvées.',
      'Ils ne se connaissent pas non plus. Leur arme : mentir sur leurs câbles pour faire couper les mauvais.',
    ],
  },
  {
    id: 'solo', title: 'L’Électron libre', tag: 'Le solitaire', color: 'solo', badge: 'Badge au choix',
    body: [
      'Il joue **seul contre tous**. Il gagne s’il coupe **lui-même** le câble qui met fin à la partie : la **dernière dérivation** ou la **Surcharge**.',
      'Si la partie est terminée par quelqu’un d’autre, ou si la 4ᵉ manche s’achève, il perd et l’équipe gagnante l’emporte normalement.',
      'En découvrant son rôle, il choisit le badge qu’il montrera : bleu ou orange.',
    ],
  },
  {
    id: 'mole', title: 'La Taupe', tag: 'Agent double', color: 'sab', badge: 'Badge bleu',
    body: [
      'Un **Saboteur** qui porte un **badge bleu**. Son équipe réelle et son objectif sont ceux des Saboteurs.',
      'Elle compte dans le nombre de Saboteurs que tu règles ci-dessus.',
    ],
  },
  {
    id: 'infiltrator', title: 'L’Infiltré', tag: 'Agent double', color: 'tech', badge: 'Badge orange',
    body: [
      'Un **Technicien** qui porte un **badge orange**. Son équipe réelle et son objectif sont ceux des Techniciens.',
      'Il compte dans le nombre de Techniciens que tu règles ci-dessus.',
    ],
  },
  {
    id: 'badge', title: 'Le badge, c’est quoi ?', tag: 'La couverture', color: 'neutral', badge: null,
    body: [
      'Le badge est la **couverture** d’un joueur : une couleur, bleue ou orange, que d’autres peuvent voir. **Ce n’est pas forcément son équipe réelle** — les agents doubles et l’Électron libre brouillent les pistes.',
      '**Voisin de gauche** : pendant sa consultation privée, chacun découvre le badge de son voisin de droite, et lui seul.',
      '**Toute la table** : les badges sont affichés sur le plateau pendant toute la partie.',
      '**Aucun badge** : on joue sans couverture, avec seulement les équipes secrètes.',
    ],
  },
  {
    id: 'undealt', title: 'Les cartes non distribuées', tag: 'Le doute', color: 'neutral', badge: null,
    body: [
      'Si tu mets plus de cartes Rôle que de joueurs, les cartes en trop restent cachées jusqu’à la fin. Personne ne sait donc exactement combien de Saboteurs sont à la table.',
    ],
  },
];

export const RULES = [
  {
    title: 'Le principe',
    body: [
      'La station polaire est en alerte : son réacteur s’emballe. Autour de la table, deux équipes secrètes s’affrontent en se passant **un seul téléphone**. Tout le reste — discussions, bluff, accusations — se fait **à voix haute**.',
      'Les **Techniciens** cherchent les **dérivations** pour stabiliser le réacteur. Les **Saboteurs** veulent faire couper la **Surcharge**, ou gagner du temps.',
    ],
  },
  {
    title: 'Mise en place',
    body: [
      'Chaque joueur découvre son rôle **en privé**, puis consulte ses **5 câbles** : inertes, dérivations, ou la Surcharge. L’appli les mélange ensuite face cachée : personne ne sait plus où est quoi, pas même leur propriétaire.',
      'Il y a autant de dérivations que de joueurs, et une seule Surcharge.',
    ],
  },
  {
    title: 'Un tour',
    body: [
      'Le joueur qui tient la **pince** choisit **un autre joueur**, puis un de ses câbles cachés, et le coupe. Le câble est révélé à tous.',
      'La pince passe alors au joueur dont le câble vient d’être coupé. On ne coupe **jamais** ses propres câbles.',
      'Avant de couper, tout le monde peut annoncer ce qu’il a devant lui… en disant la vérité ou non.',
    ],
  },
  {
    title: 'Les manches',
    body: [
      'Une manche s’arrête quand on a coupé **autant de câbles qu’il y a de joueurs**. Les câbles restants sont ramassés, mélangés et redistribués : chacun en reçoit **un de moins** (5, puis 4, 3 et 2).',
      'Chacun consulte ses nouveaux câbles en privé, puis le dernier joueur coupé commence la manche suivante.',
    ],
  },
  {
    title: 'Fin de partie',
    body: [
      '**Toutes les dérivations coupées** : victoire des Techniciens.',
      '**Surcharge coupée** : victoire immédiate des Saboteurs.',
      '**Fin de la 4ᵉ manche** sans toutes les dérivations : victoire des Saboteurs.',
      'Si l’**Électron libre** est en jeu et coupe lui-même le câble final, il gagne seul.',
    ],
  },
  {
    title: 'Le téléphone partagé',
    body: [
      'Quand l’écran affiche un prénom, seul ce joueur regarde. Après chaque consultation, l’écran redevient neutre avant de changer de mains.',
      'Aucun compte, aucune connexion : tout reste sur ce téléphone, et la partie reprend là où elle en était si l’appli se ferme.',
    ],
  },
];

/** Petit balisage : **gras** uniquement. Renvoie des nœuds DOM (jamais d'innerHTML). */
export function rich(text) {
  return text.split(/(\*\*[^*]+\*\*)/).filter(Boolean).map((part) => {
    if (part.startsWith('**')) {
      const b = document.createElement('strong');
      b.textContent = part.slice(2, -2);
      return b;
    }
    return document.createTextNode(part);
  });
}
