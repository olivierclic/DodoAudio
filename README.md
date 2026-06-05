# Dodo Audio

Lecteur audio minimaliste pour s'endormir, conçu pour fonctionner **entièrement hors-ligne** sur iPhone via une PWA installée depuis Safari — **sans compte Apple Developer (99 $/an)**.

**App déployée :** https://olivierclic.github.io/DodoAudio/

---

## Fonctionnalités

- **Lecteur audio** — lecture, pause, +30s / -30s, retour au début, barre de progression avec seek fiable
- **Bibliothèque** — import de fichiers MP3 / WAV / M4A depuis l'appareil, vignettes avec pochettes extraites des tags ID3
- **Minuterie de sommeil** — 5 à 60 minutes, pause automatique en fin de minuterie
- **Vitesse de lecture** — de 0,80× à 1,00× par pas de 0,02
- **Pochette d'album par défaut** — image personnalisable affichée quand le MP3 n'a pas d'artwork embarqué
- **Persistance** — les fichiers et l'état de lecture survivent au redémarrage de l'iPhone
- **Mode hors-ligne complet** — une fois installée, l'app fonctionne en mode avion
- **Mémorisation de la dernière piste** — l'app rouvre sur le dernier morceau à la position où la lecture s'était arrêtée

---

## Stack technique

| Couche | Outil |
|--------|-------|
| Framework | Expo SDK 54 (React Native) |
| Routing | expo-router |
| Cible web | react-native-web (build via `expo export --platform web`) |
| Audio | expo-av (HTMLAudioElement sur web, native sur iOS/Android) |
| Tags ID3 | jsmediatags (chargé en `<script>` global) |
| Pickers | expo-document-picker, expo-image-picker |
| Persistance settings | AsyncStorage (localStorage sur web) |
| Persistance fichiers | IndexedDB (web uniquement) |
| Mode hors-ligne | Service Worker custom |
| Hébergement | GitHub Pages (branche `gh-pages`) |
| Langage | TypeScript |

---

## Architecture web/PWA — choix de conception

Le projet est **à la base une app mobile Expo native**. Pour répondre au besoin « pas de 99 $/an Apple », il a été adapté pour fonctionner comme **PWA sur iOS Safari**. Plusieurs limitations iOS ont imposé des solutions spécifiques :

### 1. Persistance des fichiers audio — IndexedDB
Sur web, `expo-document-picker` retourne un `blob:` URL qui **expire au rechargement de la page**. Sans persistance, l'utilisateur devrait ré-importer ses fichiers à chaque ouverture de la PWA.

**Solution** (`services/fileStore.ts`) :
- À l'import, le `Blob` est sauvegardé dans IndexedDB
- Le track stocke une URI custom `idb://<uuid>` (au lieu d'un blob URL)
- À la lecture, l'URI est résolue vers une URL exploitable

### 2. Seek fiable sur iOS Safari — Service Worker comme serveur HTTP virtuel
iOS Safari ne sait pas seek correctement dans un `<audio>` chargé depuis un `blob:` URL (pas de support fiable des HTTP Range requests). Conséquence : slider et boutons ±30s qui ne déplacent pas réellement la lecture.

**Solution** (`public/sw.js`) :
- Le Service Worker intercepte les requêtes vers `/DodoAudio/api/audio/<id>`
- Il lit le `Blob` depuis IndexedDB et répond avec des **headers HTTP Range complets** (status 206, `Content-Range`, `Accept-Ranges: bytes`)
- `HTMLAudioElement` peut alors seek normalement, même sur iOS Safari

### 3. Extraction des tags ID3 — jsmediatags en `<script>` global
Le bundling de `jsmediatags` par Metro échoue (la lib fait des `require()` internes pour ses readers Node.js qui n'existent pas en web).

**Solution** : la lib est copiée dans `public/lib/jsmediatags.min.js` et chargée via `<script>` dans `index.html`. Le code applicatif l'utilise via `window.jsmediatags`.

### 4. Routing sur GitHub Pages — trick 404.html
GitHub Pages ne sait pas servir une SPA : recharger `/DodoAudio/tabs/player` renverrait un 404 normalement.

**Solution** : `public/404.html` redirige vers `/DodoAudio/?p=<chemin_encodé>`, et un petit script dans `index.html` restaure l'URL via `history.replaceState` avant que React Router ne s'initialise.

### 5. Base URL `/DodoAudio` — configuration Expo
GitHub Pages héberge à `https://olivierclic.github.io/DodoAudio/` (sous-chemin). Le build Expo doit en tenir compte :

```json
// app.json
"expo": {
  "experiments": { "baseUrl": "/DodoAudio" }
}
```

### 6. `.nojekyll` — bypass Jekyll
GitHub Pages utilise Jekyll par défaut, qui **ignore les dossiers commençant par `_`** (comme `_expo/` qui contient le bundle JS). Un fichier `.nojekyll` à la racine de `gh-pages` désactive ce comportement.

### 7. Contrôles externes — API MediaSession (v1.2.0+)
Sur web, expo-av ne sait pas piloter les contrôles du système d'exploitation. L'API web `navigator.mediaSession` est utilisée à la place pour exposer :
- **Play / Pause** depuis l'écran de verrouillage, la notification (Android), ou les boutons média Bluetooth
- **Retour au début** (mapped sur `previoustrack` — bouton « précédent » des casques BT)
- **Scrub** depuis la barre de progression du lock screen
- **Métadonnées** (titre, artiste, pochette) affichées dans la notif / centre de contrôle

L'implémentation est dans `contexts/AudioContext.tsx`. Sur native, c'est `expo-media-control` qui prend le relais.

### 8. Limitations iOS connues (non contournées)
- **Volume programmatique** — Safari iOS ignore `audio.volume = x`. Les contrôles se font uniquement par les boutons physiques de l'iPhone. Le slider de volume a été retiré des paramètres avec un message explicatif.

---

## Structure du projet

```
react_native_space/
├── app/                          # Routes expo-router
│   ├── _layout.tsx               # Root layout (ErrorBoundary + Providers)
│   ├── index.tsx                 # Redirige vers /tabs/player
│   └── tabs/
│       ├── _layout.tsx           # Tabs (Lecteur / Bibliothèque / Paramètres)
│       ├── player.tsx
│       ├── library.tsx
│       └── settings.tsx
├── components/
│   └── ErrorBoundary.tsx
├── contexts/
│   ├── AudioContext.tsx          # État de lecture, sleep timer, controls
│   └── SettingsContext.tsx       # Vitesse, image par défaut, etc.
├── services/
│   ├── metadata.ts               # Extraction ID3 (native + web via jsmediatags)
│   └── fileStore.ts              # IndexedDB wrapper (web)
├── constants/
│   ├── theme.ts
│   ├── storage.ts                # Clés AsyncStorage
│   └── version.ts                # APP_VERSION lu depuis app.json
├── public/                       # Copiés dans dist/ au build
│   ├── sw.js                     # Service Worker (cache + Range server)
│   ├── manifest.json             # Web App Manifest (PWA installable)
│   ├── 404.html                  # SPA fallback pour GitHub Pages
│   ├── .nojekyll
│   ├── lib/jsmediatags.min.js
│   └── assets/                   # Icônes PWA
├── app.json                      # Config Expo + version (source unique)
├── check-mp3.js                  # Utilitaire CLI pour diagnostiquer les tags d'un MP3
└── README.md
```

---

## Développement local

### Prérequis
- Node.js 18+
- npm

### Installation
```bash
npm install --legacy-peer-deps
```

### Lancer le serveur de développement
```bash
npx expo start --web
```
L'app sera disponible sur `http://localhost:8081` (ou le port indiqué).

### Diagnostiquer un MP3
Pour vérifier si un fichier a bien des tags ID3 (titre, artiste, pochette) :
```bash
node check-mp3.js "C:\chemin\vers\fichier.mp3"
# ou pour tout un dossier
node check-mp3.js "C:\chemin\vers\dossier"
```

---

## Build et déploiement

### Build web
```bash
npx expo export --platform web
```
Le bundle est généré dans `dist/`. Tous les fichiers de `public/` sont copiés automatiquement.

### Patch de `dist/index.html`
Le template HTML par défaut d'Expo doit recevoir :
- Les tags PWA (`<link rel="manifest">`, `apple-touch-icon`, etc.)
- Le script de restauration d'URL (pour le 404 SPA fallback)
- Le `<script>` `jsmediatags.min.js`
- Le badge version (optionnel)
- L'enregistrement du Service Worker

Voir le script PowerShell dans l'historique git pour le détail des `Edit` à appliquer.

### Déploiement sur GitHub Pages
Le dossier `dist/` est poussé sur la branche `gh-pages` via `git worktree` :
```powershell
git worktree add ../wt gh-pages
# remplacer le contenu du worktree par dist/
git -C ../wt add -A
git -C ../wt commit -m "Deploy vX.Y.Z"
git -C ../wt push origin gh-pages
git worktree remove ../wt --force
```

GitHub Pages est configuré pour servir la racine de `gh-pages`. L'URL finale est `https://olivierclic.github.io/DodoAudio/`.

---

## Compatibilité Android

**L'app fonctionne déjà sur Android sans aucune modification.** Le code n'a rien d'iOS-spécifique au sens strict : tout ce qui a été fait pour contourner les limitations Safari iOS (Service Worker comme serveur HTTP virtuel, IndexedDB, etc.) fonctionne aussi sur Android Chrome — et celui-ci a en réalité un meilleur support PWA que Safari.

### Différences iOS vs Android (sans rien changer au code)

| Aspect | iOS Safari | Android Chrome |
|--------|-----------|----------------|
| Installation PWA | Manuel via « Partager → Sur l'écran d'accueil » | Bannière automatique « Installer l'app » |
| Audio en arrière-plan | Limité, peut s'interrompre | Continue tant que la PWA tourne |
| Service Worker | Quelques bugs historiques | Robuste |
| HTTP Range / seek | Bug nécessitant le SW virtuel | Marche partout nativement |
| `audio.volume` programmatique | **Bloqué par Apple** | **Fonctionne** |
| Meta tags `apple-mobile-web-app-*` | Utilisés | Ignorés silencieusement |
| Contrôles via API MediaSession | Centre de contrôle iOS | Notification, écran verrouillé, casque Bluetooth |

### Code iOS-spécifique présent dans le projet

Le code reste portable. Les seuls éléments propres à iOS :

1. **`isIOSWeb` dans `settings.tsx`** — détection user-agent pour adapter l'UI volume (sans effet sur Android)
2. **Meta tags `apple-mobile-web-app-*`** dans `index.html` — ignorés par Android
3. **Service Worker Range server** — créé pour iOS, mais **bénéficie aussi à Android** (mêmes URLs, même fonctionnement)

### Améliorations spécifiques Android (optionnelles)

| Amélioration | Effort | Bénéfice |
|--------------|--------|----------|
| Réactiver le slider de volume sur non-iOS | 5 min | Slider fonctionnel sur Android |
| Hook `beforeinstallprompt` | 15 min | Bouton « Installer » dans l'app |

L'API MediaSession (contrôles lock screen + Bluetooth) est **déjà implémentée depuis v1.2.0**.

---

## Installation sur iPhone

1. Ouvrir **https://olivierclic.github.io/DodoAudio/** dans **Safari** (pas Chrome — iOS ne sait installer une PWA que depuis Safari)
2. Bouton **Partager** → **Sur l'écran d'accueil**
3. L'app apparaît comme une application native. Elle fonctionne en mode avion une fois les fichiers importés.

---

## Versionnement

La version est définie à un seul endroit : `app.json` → `expo.version`.
Elle est importée en TypeScript via `constants/version.ts` (`import appJson from '../app.json'`) et lue depuis PowerShell via `ConvertFrom-Json` pour les scripts de build.

Tag git : `v1.1.0`
