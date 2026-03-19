# Spec — AuthScreen & PermissionsScreen

## 1. AuthScreen

**Route** : `Auth` (root stack)
**Fichier** : `src/screens/AuthScreen.tsx`
**Condition d'affichage** : aucune session active dans Supabase

### 1.1 Layout

```
┌─────────────────────────────────────┐
│                                     │
│           [Logo Fläag]              │
│                                     │
│   [ G  Continuer avec Google ]      │
│                                     │
│   [message d'erreur si échec]       │
│                                     │
└─────────────────────────────────────┘
```

### 1.2 Flux d'authentification

```
Tap "Continuer avec Google"
  → setLoading(true)
  → signInWithGoogle()                    ← AuthContext
      → WebBrowser.openAuthSessionAsync()
      → Supabase OAuth Google
  ← Succès : session créée
      → App.tsx détecte session → navigation vers Main
  ← Échec : error.message affiché sous le bouton
      → setLoading(false), bouton réactivé
```

### 1.3 Règles

- **Un seul provider** : Google OAuth uniquement (pas d'OTP téléphone en prod)
- **Désactivation bouton** : pendant le chargement (`disabled={loading}`)
- **Erreur** : affichée en rouge sous le bouton, disparaît au prochain tap
- **Navigation** : entièrement gérée par `App.tsx` (écoute `session` depuis `AuthContext`) — `AuthScreen` ne navigue jamais elle-même
- **Compte** : la création de profil utilisateur dans `public.users` est déclenchée par un trigger Supabase `on auth.users insert`

---

## 2. PermissionsScreen

**Route** : composant inline dans `App.tsx` — affiché par-dessus la navigation si les permissions ne sont pas accordées après login
**Fichier** : `src/screens/PermissionsScreen.tsx`
**Condition d'affichage** : appelé avec `onComplete` callback depuis `App.tsx`

### 2.1 Layout

```
┌─────────────────────────────────────┐
│  ● ● ● ● ●   ← dots de progression │
│                                     │
│        [Icône grande]               │
│                                     │
│         Titre de la permission      │
│     Description en 1-2 lignes       │
│                                     │
│         [ Autoriser ]               │
│           Plus tard                 │
│                                     │
│              N / 5                  │
└─────────────────────────────────────┘
```

### 2.2 Liste des permissions (dans l'ordre)

| # | Clé | Label | Raison |
|---|-----|-------|--------|
| 1 | `location` | Localisation | Afficher les messages autour de l'utilisateur |
| 2 | `locationBackground` | Localisation en arrière-plan | Notifier quand proche d'un message (seuil 300m) |
| 3 | `camera` | Caméra | Prendre des photos dans les messages |
| 4 | `microphone` | Microphone | Enregistrer des messages audio |
| 5 | `notifications` | Notifications | Alertes nouveaux messages et proximit |

### 2.3 Règles de progression

- Au montage : `checkExistingPermissions()` vérifie l'état réel de chaque permission via les API Expo
- **Auto-skip** : si la permission courante est déjà `granted` → `currentIndex + 1` automatiquement (via `useEffect` sur `currentIndex`)
- **"Autoriser"** : appelle `requestPermission(key)` → OS dialog → met à jour le statut → avance au suivant
- **"Plus tard"** : `skipPermission()` → avance au suivant sans demander
- **Fin de liste** : `currentIndex === permissions.length - 1` → appelle `onComplete()` → `App.tsx` révèle la navigation principale

### 2.4 Cas spécial : notifications sur Android

Quand la permission `notifications` est accordée sur Android, crée un canal de notification :
```ts
Notifications.setNotificationChannelAsync('messages', {
  name: 'Messages',
  importance: HIGH,
  vibrationPattern: [0, 250, 250, 250],
  lightColor: '#4A90D9',
})
```

### 2.5 Règles visuelles

- Dot de progression actif : cyan allongé (24px wide vs 10px)
- Dots passés : cyan plein
- Dots à venir : couleur `background.tertiary`
- Si `isAlreadyGranted` au rendu : retourne `null` (le composant est invisible pendant l'auto-skip)

### 2.6 Ce que cet écran ne fait PAS

- Ne bloque pas l'app si les permissions sont refusées (tout est skippable)
- Ne renvoie pas vers les réglages OS si `denied` — recommande simplement d'autoriser
- Ne revient pas en arrière dans la liste (progression unidirectionnelle)
