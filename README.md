# ⚡ Coupe-Circuit — rôles secrets à la station polaire

Un jeu de bluff pour **4 à 8 joueurs réunis autour d'une table**, **chacun sur son propre téléphone**.
Le réacteur de la station s'emballe : les Techniciens cherchent les dérivations, les Saboteurs veulent la surcharge.
On discute, on ment et on s'accuse à voix haute ; l'appli ne fait que tenir les cartes.

👉 **Jouer : https://mathieuadr.github.io/timebomb-game/**

- 📱 **PWA** installable sur l'écran d'accueil (iOS : Partager → « Sur l'écran d'accueil » ; Android : « Installer l'application »)
- 🔗 **Invitation en un geste** : code à 5 caractères ou lien partagé (`…/timebomb-game/?room=ABCDE`)
- 🔒 **Secrets chiffrés de bout en bout** : ton rôle et tes câbles ne sont lisibles que sur ton téléphone
- ☁️ **Sans serveur ni compte** : hébergé sur GitHub Pages, les téléphones communiquent par un relais MQTT public
- 🔄 **Reprise** : un joueur ou l'hôte qui recharge l'appli retrouve la partie là où elle en était
- 🔇 Sons et animations désactivables

Coupe-Circuit est un jeu original : son nom, son univers et toutes ses illustrations (SVG) ont été créés pour ce projet.

## Règles en bref

- Un joueur crée la partie (l'**hôte**), les autres la rejoignent. L'hôte range la table et choisit les rôles en jeu.
- Chaque joueur découvre sur son téléphone son **rôle** et ses **5 câbles** : inertes, **dérivations** (autant que de joueurs) ou la **Surcharge** (une seule).
  Après consultation, l'appli mélange les câbles face cachée.
- Le joueur qui tient la **pince** coupe un câble caché **d'un autre joueur** depuis son téléphone ; tous les téléphones montrent la révélation et la pince passe au joueur coupé.
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
public/state/    cloisonnement des secrets (privacy.js) et préférences de l'appareil (store.js)
public/net/      partie à plusieurs : relais MQTT, salon, chiffrement de bout en bout (room.js, crypto.js)
public/ui/       illustrations SVG, sons synthétisés, composants et écrans (HTML/CSS/JS sans framework)
public/vendor/   client MQTT.js (licence MIT)
test/            tests du moteur et du réseau, simulation de parties, parties complètes en téléphones émulés
```

Le téléphone de l'**hôte** exécute le moteur de règles et garde l'état complet, sans jamais l'afficher. Sur le relais circulent :

| Sujet | Contenu | Visibilité |
|---|---|---|
| `…/state` | la table : noms, câbles coupés, pince, manche | en clair, sans aucun secret |
| `…/p/<joueur>` | rôle, câbles pendant la consultation, badge du voisin | chiffré pour ce seul joueur (ECDH P-256 + AES-GCM) |
| `…/c/<joueur>` | actions du joueur (couper, confirmer, choisir son badge…) | chiffré pour l'hôte |

Les autres joueurs, comme toute personne qui écouterait le relais, ne voient que l'état public et des messages chiffrés.
L'hôte détient forcément tous les secrets (c'est lui l'arbitre) ; son appli ne les affiche jamais.
Si l'hôte ferme l'appli, la partie se met en pause et reprend à son retour. Si un joueur perd la connexion,
l'hôte peut confirmer ou couper à sa place pour débloquer la table.

Pour utiliser un autre relais MQTT en WebSocket : ajoute `?broker=wss://…` à l'adresse (tous les joueurs doivent utiliser le même).

## Déploiement

Chaque push sur `main` lance `.github/workflows/pages.yml` : tests du moteur, puis publication de `public/` sur GitHub Pages.
Si le premier déploiement échoue sur « configure-pages » : **Settings → Pages → Source : GitHub Actions**, puis relance le workflow.

## Développement

```bash
npm install
npm start            # appli + relais local : ouvre l'adresse affichée dans plusieurs onglets
npm test             # moteur, réseau (relais local + « espion ») et 3 000 parties aléatoires
npm run e2e          # parties complètes avec un navigateur par joueur (Playwright requis)
```
