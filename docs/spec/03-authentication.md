# 03 — Authentification

## Vue d'ensemble

L'authentification est gérée par Supabase Auth via `AuthContext` (`src/contexts/AuthContext.tsx`). Deux méthodes sont supportées :

1. **OTP téléphone** — SMS via Supabase (Twilio)
2. **Google OAuth** — Flux WebBrowser avec deep link callback

## Flux OTP téléphone

```
1. Utilisateur saisit son numéro de téléphone
2. signInWithPhone(phone) → supabase.auth.signInWithOtp({ phone })
3. SMS reçu avec code à 6 chiffres
4. verifyOtp(phone, token) → supabase.auth.verifyOtp({ phone, token, type: 'sms' })
5. onAuthStateChange déclenché → état mis à jour
6. Post-login setup (tokens, cache) en fire-and-forget
```

## Flux Google OAuth

```
1. signInWithGoogle() → supabase.auth.signInWithOAuth({ provider: 'google', skipBrowserRedirect: true })
2. googleAuthActiveRef = true — bloque le listener deep link pendant que signInWithGoogle gère
3. URL OAuth retournée → ouverture dans WebBrowser.openAuthSessionAsync(url, 'flag://')
4. Utilisateur s'authentifie sur Google
5. Redirect vers flag://auth/callback (implicit: tokens dans le hash, ou PKCE: code en query param)

Cas A — openAuthSessionAsync retourne { type: 'success', url }
  → processCallbackUrl() extrait tokens ou code
  → setSessionAndUpdateState() ou exchangeCodeForSession()
  → applySession() met à jour l'état React

Cas B — openAuthSessionAsync retourne { type: 'dismiss' } (courant sur Android)
  → polling 25×200ms : vérifie stateRef.current.user + supabase.auth.getSession()
  → si session trouvée : applySession() immédiat

Dans les deux cas :
  → applySession() est aussi appelé en redondance depuis onAuthStateChange('SIGNED_IN')
  → Post-login setup (tokens push, sync profil, public.users) en fire-and-forget
6. googleAuthActiveRef = false (bloc finally)
```

**Deep link configuré** : `flag://auth/callback`

**Robustesse** :
- `googleAuthActiveRef` empêche la race condition entre le listener Linking et `signInWithGoogle`
- `applySession()` est appelé par plusieurs chemins (belt & suspenders) — `onAuthStateChange` n'est plus le seul déclencheur
- Après `exchangeCodeForSession`, session explicitement récupérée via `getSession()` en safety net

## Déconnexion

```
1. signOut()
2. unregisterPushToken(userId) — supprime tous les tokens de l'appareil
3. clearAllCache() — vide l'AsyncStorage entièrement
4. supabase.auth.signOut()
5. État réinitialisé → écran Auth affiché
```

## Initialisation du client Supabase

**Problème connu** : Supabase peut bloquer si `getSession()` est appelé de façon synchrone depuis `onAuthStateChange` (lock interne tenu).

**Solution** (`src/services/supabase.ts`) :
- `getCachedUserId()` : Retourne l'ID utilisateur depuis `_cachedUserId` (pas d'appel à `getSession`)
- `_cachedUserId` mis à jour par un listener `onAuthStateChange` léger (sans async)
- `onAuthStateChange` principal dans AuthContext ne fait **plus** `await supabaseReady` — les opérations Supabase dans le handler sont toutes en fire-and-forget pour éviter tout deadlock
- `getSession()` déclenché au démarrage du module pour amorcer `_initializePromise` interne

## Récupération de session au foreground

Un listener `AppState` dans `AuthProvider` vérifie à chaque passage en `active` si une session est stockée mais l'état React ne la reflète pas (`user === null` avec `loading === false`). Si c'est le cas, `applySession()` restaure immédiatement la session.

Couvre les cas : app tuée en background, race condition au retour d'OAuth, désynchronisation état/storage.

## Post-login setup

Après connexion, un bloc `async` en fire-and-forget exécute :
1. `registerPushToken(userId)` — enregistre le token Expo pour cet appareil
2. Sync profil (display_name, avatar_url depuis metadata Google si OAuth)
3. Vérification que `public.users` contient bien un enregistrement (fallback si trigger rate)

Ce bloc est fire-and-forget pour ne pas bloquer le rendu de l'interface.

## Création du profil utilisateur

À la création d'un compte :
1. Le trigger `handle_new_user()` crée automatiquement l'entrée `public.users`
2. Le trigger `send_welcome_message()` envoie le message Flag Bot
3. Si le trigger échoue, `AuthContext` insère manuellement l'entrée en fallback

## Stockage sécurisé

- Tokens Supabase stockés dans `expo-secure-store` (pas AsyncStorage)
- Adapter custom implémenté dans `src/services/supabase.ts`
- Jamais de secrets en clair dans AsyncStorage ou state React

## Contexte auth (API publique)

```typescript
const {
  user,       // User | null
  session,    // Session | null
  loading,    // boolean — true pendant l'initialisation

  signInWithPhone,    // (phone: string) => Promise<{ error }>
  verifyOtp,          // (phone, token) => Promise<{ error }>
  signInWithGoogle,   // () => Promise<{ error }>
  signOut,            // () => Promise<void>
  updateAvatar,       // (imageUri: string) => Promise<{ error }>
  updateDisplayName,  // (displayName: string) => Promise<{ error }>
} = useAuth();
```

## Upload d'avatar

```
1. Sélection image depuis bibliothèque (Expo Image Picker)
2. Lecture fichier en base64 (expo-file-system)
3. Conversion base64 → ArrayBuffer (base64-arraybuffer)
4. Upload vers Supabase Storage bucket 'avatars'
5. Récupération URL publique
6. Mise à jour auth metadata + public.users.avatar_url
```

## Mise à jour du display_name

```
1. updateDisplayName(newName)
2. supabase.auth.updateUser({ data: { display_name: newName } })
3. UPDATE public.users SET display_name = newName WHERE id = auth.uid()
```

## Sécurité

- `user_id` / `sender_id` toujours depuis `auth.uid()` côté Supabase — jamais depuis le payload client
- RLS empêche les insertions avec un sender_id frauduleux
- OTP expire après un délai Supabase configurable
- OAuth state token géré par Supabase (PKCE)
