# Fläag

Application de messagerie géolocalisée - Laissez des messages ancrés dans le monde réel.

## Fonctionnalités

- **Messages géolocalisés** : Les messages sont ancrés à une position GPS
- **Découverte** : Carte interactive affichant les messages à découvrir
- **Proximité** : Lecture possible uniquement dans un rayon défini autour du point de dépôt
- **Multimédia** : Texte, photos et audio
- **Notifications** : Alertes quand vous approchez d'un message

## Installation

```bash
# Installer les dépendances
npm install

# Copier la configuration
cp .env.example .env
# Remplir les variables SUPABASE_URL et SUPABASE_ANON_KEY

# Lancer l'app
npx expo start
```

## Configuration Supabase

1. Créer un projet sur [supabase.com](https://supabase.com)
2. Exécuter le script `supabase/schema.sql` dans l'éditeur SQL
3. Activer l'authentification par téléphone et Google dans Authentication > Providers
4. Copier l'URL et la clé anon dans `.env`

## Configuration Google Maps (Android)

1. Créer un projet sur [Google Cloud Console](https://console.cloud.google.com)
2. Activer l'API "Maps SDK for Android"
3. Créer une clé API (Identifiants > Créer des identifiants > Clé API)
4. Ajouter la clé dans `app.json` :
   ```json
   "android": {
     "config": {
       "googleMaps": {
         "apiKey": "VOTRE_CLE_API"
       }
     }
   }
   ```
5. Régénérer le projet natif et relancer :
   ```bash
   npx expo prebuild --clean
   npx expo start
   ```

## Configuration Google OAuth

### Google Cloud Console

1. Aller sur [Google Cloud Console](https://console.cloud.google.com)
2. APIs & Services > Identifiants > Créer des identifiants > ID client OAuth
3. Créer deux clients OAuth :
   - **Web** : pour Supabase (noter le Client ID et Client Secret)
   - **Android** :
     - Nom du package : `com.flagapp.app`
     - Empreinte SHA-1 : obtenir avec `keytool -keystore android/app/debug.keystore -list -v` (mot de passe : `android`)

### Supabase

1. Authentication > Providers > Google
2. Activer Google et renseigner :
   - Client ID (Web)
   - Client Secret (Web)
3. Copier l'URL de callback Supabase

### Application

Ajouter dans `app.json` :
```json
"expo": {
  "scheme": "com.flagapp.app",
  "plugins": [
    [
      "@react-native-google-signin/google-signin",
      {
        "iosUrlScheme": "com.googleusercontent.apps.VOTRE_IOS_CLIENT_ID"
      }
    ]
  ]
}
```

Ajouter dans `.env` :
```
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=votre_web_client_id
```

## Structure du projet

```
src/
├── components/     # Composants réutilisables
├── contexts/       # Contextes React (Auth, Location)
├── hooks/          # Hooks personnalisés
├── screens/        # Écrans de l'application
├── services/       # Services (Supabase, Location, Notifications)
├── tasks/          # Tâches en arrière-plan
├── types/          # Types TypeScript
└── utils/          # Utilitaires
```

## Technologies

- **Expo** - Framework React Native
- **Supabase** - Backend (Auth + Database + Storage)
- **React Navigation** - Navigation
- **React Native Maps** - Carte interactive
- **Expo Location** - Géolocalisation
- **Expo Notifications** - Notifications push
