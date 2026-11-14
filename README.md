# ⚡ Coupe-Circuit — rôles secrets à la station polaire

Un jeu de bluff pour **4 à 8 joueurs réunis autour d'une table**, avec **un seul téléphone** qui passe de main en main.
Le réacteur de la station s'emballe : les Techniciens cherchent les dérivations, les Saboteurs veulent la surcharge.
On discute, on ment et on s'accuse à voix haute ; l'appli ne fait que tenir les cartes.

👉 **Jouer : https://mathieuadr.github.io/timebomb-game/**

- 📱 **PWA** installable sur l'écran d'accueil (iOS : Partager → « Sur l'écran d'accueil » ; Android : « Installer l'application »)
- ✈️ **Hors ligne** : une fois ouverte, l'appli fonctionne sans aucune connexion
- 🔒 **Aucun compte, aucun serveur** : tout reste sur le téléphone, et la partie reprend où elle en était si l'appli se ferme
- 🤫 **Pensée pour le téléphone partagé** : écran neutre entre deux joueurs, secrets retirés de la page dès qu'on les masque
- 🔇 Sons et animations désactivables

Coupe-Circuit est un jeu original : son nom, son univers et toutes ses illustrations (SVG) ont été créés pour ce projet.

## Règles en bref

- Chaque joueur reçoit en secret un **rôle** et **5 câbles** : inertes, **dérivations** (autant que de joueurs) ou la **Surcharge** (une seule).
  Après consultation, l'appli mélange les câbles face cachée.
- Le joueur qui tient la **pince** coupe un câble caché **d'un autre joueur** ; le câble est révélé et la pince passe au joueur coupé.
- Une manche dure autant de coupes qu'il y a de joueurs. Les câbles restants sont alors mélangés et redistribués : 5, puis 4, 3 et 2 par joueur.
- **Techniciens** : gagnent si toutes les dérivations sont coupées.
  **Saboteurs** : gagnent si la Surcharge est coupée, ou à la fin de la 4ᵉ manche.

### Rôles en jeu (réglables avant chaque partie)

| Rôle | Équipe réelle | Badge | Particularité |
|---|---|---|---|
| Technicien | Techniciens | bleu | — |
| Saboteur | Saboteurs | orange | — |
| La Taupe | Saboteurs | **bleu** | agent double |
| L'Infiltré | Techniciens | **orange** | agent double |
| L'Électron libre | aucune | au choix | gagne seul s'il coupe lui-même le câble final |

Le **badge** est une couverture : selon le réglage, il est montré au voisin de gauche, à toute la table, ou pas du tout.
Trois modes : **Classique** (deux équipes), **Infiltration** (badges, agents doubles, Électron libre) et **Perso**
(nombre de Techniciens, de Saboteurs et de rôles spéciaux au choix ; les cartes en trop restent cachées).

## Comment c'est fait

```
public/engine/   moteur de règles pur (rules.js, game.js) — testable sans interface
public/state/    sauvegarde locale (store.js) et cloisonnement des secrets (privacy.js)
public/ui/       illustrations SVG, sons synthétisés, composants et écrans (HTML/CSS/JS sans framework)
public/sw.js     service worker : toute l'appli est mise en cache pour le hors-ligne
test/            tests du moteur, simulation de parties, parties complètes en téléphone émulé
```

Les écrans visibles de tous ne reçoivent que `publicView()` : ni équipe, ni identité d'un câble caché.
Un écran privé ne lit que les secrets du joueur qui tient le téléphone, et revient à l'écran neutre
après une actualisation ou un passage en arrière-plan.

## Déploiement

Chaque push sur `main` lance `.github/workflows/pages.yml` : tests du moteur, puis publication de `public/` sur GitHub Pages.
Si le premier déploiement échoue sur « configure-pages » : **Settings → Pages → Source : GitHub Actions**, puis relance le workflow.

## Développement

```bash
npm start            # appli sur http://localhost:8099/timebomb-game/
npm test             # tests du moteur + 3 000 parties aléatoires vérifiées coup par coup
npm run e2e          # 6 parties complètes dans des téléphones émulés (Playwright requis)
```

Aucune dépendance à installer pour jouer ou pour lancer `npm start` et `npm test`.
