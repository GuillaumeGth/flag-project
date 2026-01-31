# Flag

Application de messagerie géolocalisée - Laissez des messages ancrés dans le monde réel.

## Fonctionnalités

- **Messages géolocalisés** : Les messages sont ancrés à une position GPS
- **Découverte** : Carte interactive affichant les messages à découvrir
- **Proximité** : Lecture possible uniquement dans un rayon de 30m
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
