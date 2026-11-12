# BATIS — application mobile

Assistant personnel (un seul utilisateur) pour suivre la maintenance de plusieurs Salles du Royaume : import des programmes, planning, répartition des appels entre volontaires, messages WhatsApp préparés, réponses des frères et rapport mensuel Word.

Le serveur se trouve dans `backend/`, qui est un **dépôt Git séparé** (ignoré ici). Voir `backend/README.md`.

## Pile

Expo SDK 58 · React Native · TypeScript · Expo Router (`src/app/`) · TanStack Query (cache hors connexion) · React Hook Form + Zod · Reanimated 4 · expo-local-authentication · expo-notifications · expo-secure-store

## Installation

```bash
npm install --legacy-peer-deps
cp .env.example .env.local      # EXPO_PUBLIC_API_URL = IP du PC (http://192.168.x.x:5000) ou URL HTTPS de production
npx expo start
```

## Builds et mises à jour (EAS)

L’application est distribuée en **APK**, hors Play Store. L’empreinte, Face ID et les notifications exigent un vrai build (pas Expo Go). Les builds utilisent l’**environnement EAS `production`** et le **canal `production`** :

```bash
npx eas-cli@latest login
npx eas-cli@latest init                       # lie le projet (extra.eas.projectId, requis pour les notifications)
npx eas-cli@latest update:configure           # adresse des mises à jour OTA
npx eas-cli@latest env:create --environment production --name EXPO_PUBLIC_API_URL --value https://api.exemple.com --visibility plaintext
npx eas-cli@latest build --profile production --platform android
npx eas-cli@latest update --channel production --environment production --message "…"   # correctif JS sans rebuild
```

Profils `eas.json` : `production` produit un **APK** à installer directement sur le téléphone (pas de Play Store) ; `development` produit le client de développement. À la fin du build, EAS affiche un lien et un QR code pour télécharger l’APK.

Taille : l’APK ne contient que l’architecture `arm64-v8a` (tous les téléphones Android 64 bits) ; code natif compressé, code Java/Kotlin minifié, ressources inutilisées retirées (`expo-build-properties` dans `app.json`). Pour un ancien téléphone 32 bits, ajouter `armeabi-v7a` à `buildArchs` (APK plus lourd).

## Parcours

- **Démarrage** : chargeur animé, puis demande d’autorisation des notifications. L’application ne continue qu’une fois les notifications autorisées (sinon, bouton vers les réglages du téléphone).
- **Connexion** : e-mail + mot de passe (aucune inscription publique). Après la première connexion, l’application propose l’empreinte / Face ID ; ensuite l’écran n’affiche plus que le bouton d’empreinte et « Autre méthode ». Verrouillage après 2 min en arrière-plan. Réglable dans Paramètres › Sécurité.
- **Onglets** : Accueil · Planning · Missions · Documents · Rapports. Les listes sont groupées par date en cartes repliables (« Tout replier / Tout déplier »).
- **WhatsApp** : message prérempli, « Copier » ou « WhatsApp », puis confirmation manuelle « Message envoyé ». Aucun envoi automatique.
- **Réponses** : le message collé est conservé tel quel. L’IA ne le pré-remplit que sur demande (« Analyser avec l’IA »), sauf si l’analyse automatique est activée dans Paramètres.
- **Hors connexion** : données déjà chargées consultables, réponses gardées en brouillon puis synchronisées sans doublon.

## Personnalisation

- **Image de fond de la connexion** : remplacez `assets/login-background.jpg` (portrait, ~1080×1920). Un voile sombre garantit la lisibilité du texte.
- **Couleurs, espacements, typographie, animations** : `src/theme/tokens.ts`.
- **Composants partagés** : `src/components/ui.tsx` (cartes, boutons, sections repliables, tuiles de chiffres…).

## Structure

```
src/
  app/          écrans (Expo Router) — (tabs)/ pour les 5 onglets
  components/   ui.tsx, AuthScreen, NotificationGate, brand (emblème + chargeur), toast, EventCard
  lib/          api, auth, biometric, notifications, session, drafts, format, types
  theme/        tokens.ts
assets/         icônes, splash, image de fond de la connexion
```

## Vérifications

```bash
npm run typecheck
npm run lint
```
