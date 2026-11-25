# 🌍 Orbi : le monde, pays par pays

MVP réalisé pour le cours de **marketing de l'innovation** (M2 Management de l'innovation).

On fait tourner un globe coloré, on touche un pays, et on voit son actualité.
Des filtres changent ce que montre la carte :

| Filtre | Ce que montre le globe | Ce que montre le panneau |
|---|---|---|
| 🌍 **Tout** | Les continents en couleurs | Les actus des 3 derniers jours (médias francophones) |
| 🌈 **Good news** | L'« humeur » de l'actu de chaque pays (plus c'est vert, plus c'est positif) | Les bonnes nouvelles de la semaine |
| ⚔️ **Géopolitique** | Les pays en conflit par gravité, avec pictogrammes, flèches d'offensive, lignes de front et routes maritimes bloquées (Ormuz, Bab-el-Mandeb) | Une fiche sourcée par zone + les titres « en direct » |
| ⚽ **Foot** | Le logo du leader de 29 championnats + des flèches pour les transferts du mercato | Le classement du championnat + les transferts + les actus foot |
| 💼 **Économie** | Des flèches acheteur → cible pour les grands rachats de 2026 | La fiche du rachat + les actus économiques du pays |

Le site s'utilise sur ordinateur et sur téléphone, et **s'installe comme une appli** (web app / PWA).

---

## 1. Voir le site sur son ordinateur

Il faut Python, ou n'importe quel petit serveur web. Dans le dossier du projet :

```
python -m http.server 8080
```

puis ouvrir <http://localhost:8080>.

Raccourcis pratiques pour la démo :
- `?mode=geo` ouvre directement un filtre (valeurs : `all`, `good`, `geo`, `foot`, `eco`) ;
- `?pays=FR` ouvre directement un pays (code ISO à 2 lettres) ;
- exemple : <http://localhost:8080/?mode=geo&pays=CD>

## 2. Mettre le site en ligne gratuitement (GitHub Pages)

Comptez environ 10 minutes, sans rien installer.

1. Créer un compte sur <https://github.com>.
2. Cliquer sur **New repository**, l'appeler par exemple `orbi`, le mettre en **Public** (obligatoire pour le site gratuit), puis **Create repository**.
3. Sur la page du dépôt vide, cliquer sur **uploading an existing file**, puis **glisser tout le contenu du dossier** (sélectionner tous les fichiers et dossiers, pas le dossier lui-même). Valider avec **Commit changes**.
   - Vérifier que le dossier `.github` apparaît dans la liste. Sinon : **Add file → Create new file**, taper `.github/workflows/update-data.yml` comme nom et y coller le contenu du fichier.
   - Le dossier `data/news` (un fichier par pays) n'est pas à envoyer : il est fabriqué automatiquement à l'étape 5.
4. Aller dans **Settings → Pages**, puis, dans *Build and deployment → Source*, choisir **GitHub Actions**.
5. Aller dans l'onglet **Actions**, cliquer à gauche sur « Mise à jour et publication du site », puis sur **Run workflow** (bouton gris à droite), et encore **Run workflow**.
   - Le travail dure environ 4 à 5 minutes : il récupère les actus des 177 pays puis publie le site.
   - Une première exécution en rouge ❌ juste après l'envoi des fichiers est normale (la publication n'était pas encore activée). Seule celle de l'étape 5 compte.
6. Quand la pastille devient verte ✅, le site est en ligne à l'adresse `https://<votre-pseudo>.github.io/orbi/` (le lien s'affiche aussi dans **Settings → Pages**).

Ensuite, tout est automatique : **les actus se mettent à jour chaque matin vers 6h**, et toute modification d'un fichier sur GitHub est publiée en environ 1 minute.

### Installer l'appli sur son téléphone
- **iPhone** (Safari) : bouton Partager, puis *Sur l'écran d'accueil*.
- **Android** (Chrome) : menu ⋮, puis *Installer l'application* (ou *Ajouter à l'écran d'accueil*).

## 3. Modifier le contenu (sans coder)

Tout se trouve dans le dossier `data/`. Sur GitHub, il suffit d'ouvrir un fichier, de cliquer sur ✏️, de modifier puis de **Commit**.

| Fichier | Contenu | Mise à jour |
|---|---|---|
| `data/geopolitics.json` | Les zones de tension : nom, pictogramme (`type`), gravité de 1 à 3, résumé, sources, flèches, lignes | **À la main** |
| `data/transfers.json` | Les transferts du mercato (joueur, clubs, coordonnées, montant) | **À la main** |
| `data/business.json` | Les grands rachats (acheteur, cible, montant, résumé, source) | **À la main** |
| `data/daily.json` + `data/news/*.json` | Actus par pays, classements de foot, titres « en direct » | **Automatique** (chaque matin) |
| `data/countries.geojson` | Les frontières des pays | Ne pas toucher |

Types de pictogrammes disponibles pour une zone : `war` ⚔️, `maritime` ⛔, `insurgency` 💥, `humanitarian` 🆘, `ceasefire` 🕊️, `intervention` 🎯, `tension` ⚠️.

Le nom « Orbi » est provisoire. Pour le changer, il suffit de remplacer le texte dans `index.html` et `manifest.webmanifest`.

## 4. Comment ça marche (à expliquer à l'oral)

```
 Chaque matin (GitHub Actions, gratuit)
 ┌──────────────────────────────────────────────┐
 │ scripts/update-data.mjs                      │
 │  • Google Actualités (FR) × 177 pays         │──► data/daily.json
 │  • tri automatique : géopo / éco / foot /    │──► data/news/<PAYS>.json
 │    bonne nouvelle (mots-clés)                │
 │  • classements de 29 championnats (ESPN)     │
 │  • titres récents par zone et par rachat     │
 └──────────────────────────────────────────────┘
                     │
                     ▼
  Site statique (GitHub Pages) → globe 3D (globe.gl / three.js)
  + fiches éditoriales sourcées (géopolitique, mercato, rachats)
```

**Coût actuel : 0 €.** Les données sont rafraîchies une fois par jour.

### Feuille de route vers le temps réel

| Étape | Ce qui change | Outils envisagés |
|---|---|---|
| **V1 (MVP actuel)** | 1 collecte par jour, fiches géopolitiques rédigées à la main | GitHub Actions, Google Actualités, ESPN |
| **V2 : quasi temps réel** | Collecte toutes les 15 min, base de données, notifications | GDELT (actus mondiales géolocalisées, mises à jour toutes les 15 min, avec score de ton), Cloudflare Workers / Supabase |
| **V3 : IA éditoriale** | Résumé « ce qui se passe en 3 lignes », vraie détection des bonnes nouvelles, traduction en français des médias locaux, détection de nouvelles zones de tension (validées par un humain) | API d'un modèle de langage (Claude, Gemini) |
| **V4 : données sous licence** | Sources fiables et autorisées pour un usage commercial | API presse (AFP, Event Registry), API-Football (transferts en direct), ACLED (événements de conflit) |

### Limites honnêtes du MVP
- Le flux Google Actualités est prévu pour un usage personnel et non commercial. Il convient pour un prototype étudiant, mais une version commerciale nécessiterait des sources sous licence.
- L'API ESPN des classements est publique mais non officielle.
- Le tri « bonne nouvelle » repose sur des mots-clés. Il se trompe parfois et fait souvent remonter du sport. Une IA ferait beaucoup mieux (voir V3).
- Les fiches géopolitiques datent du 25 novembre 2026 et doivent être relues avant chaque présentation. Les titres « en direct » sous chaque fiche, eux, se mettent à jour automatiquement.

## 5. Scénario de démo (environ 2 minutes)

1. Ouvrir le site : le globe tourne seul. Le faire tourner à la souris ou au doigt.
2. **Tout** : cliquer sur la **France** pour montrer les actus du jour et leurs étiquettes (Géopo, Éco…).
3. **Géopolitique** : la carte devient rouge et orange. Cliquer sur **Détroit d'Ormuz** pour montrer la route pétrolière coupée en pointillés, la fiche sourcée et les titres en direct. Puis cliquer sur **RD Congo**.
4. **Foot** : montrer les logos des leaders. Cliquer sur **Bradley Barcola** pour voir la flèche PSG → Liverpool. Puis cliquer sur la France pour montrer le classement de Ligue 1.
5. **Économie** : cliquer sur **Sanofi → Insmed** pour voir la flèche Paris → New Jersey, le résumé et la presse du jour.
6. Sortir son téléphone : montrer l'appli installée sur l'écran d'accueil.

---

Crédits : globe [globe.gl](https://github.com/vasturiano/globe.gl) · frontières [Natural Earth](https://www.naturalearthdata.com) · drapeaux [flagcdn](https://flagcdn.com) · police Nunito (Google Fonts).
