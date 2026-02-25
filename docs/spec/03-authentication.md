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
1. signInWithGoogle() → supabase.auth.signInWithOAuth({ provider: 'google', ... })
2. URL OAuth retournée → ouverture dans WebBrowser.openAuthSessionAsync()
3. Utilisateur s'authentifie sur Google
4. Redirect vers deep link : flag://auth/callback?...
5. Listener deep link dans AuthContext reçoit l'URL
6. supabase.auth.setSession({ access_token, refresh_token })
7. onAuthStateChange déclenché → état mis à jour
8. Sync profil Google (nom, avatar) vers public.users
```

**Deep link configuré** : `flag://auth/callback`

## Déconnexion

```
1. signOut()
2. unregisterPushToken(userId) — supprime tous les tokens de l'appareil
3. clearAllCache() — vide l'AsyncStorage entièrement
4. supabase.auth.signOut()
5. État réinitialisé → écran Auth affiché
```

## Initialisation du client Supabase

**Problème connu** : Supabase peut créer un deadlock si `getSession()` est appelé depuis `onAuthStateChange`.

**Solution** (`src/services/supabase.ts`) :
- `supabaseReady` : Promise qui se résout après la première initialisation de session
- `getCachedUserId()` : Retourne l'ID utilisateur depuis le cache interne `_cachedUserId` (pas d'appel à getSession)
- `AuthContext` attend `supabaseReady` plutôt que d'appeler `getSession()` directement

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
