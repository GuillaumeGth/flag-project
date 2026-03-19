# Spec — InboxScreen

**Route** : tab `Inbox` (bottom tab)
**Fichier** : `src/screens/InboxScreen.tsx`

---

## 1. Layout

```
┌─────────────────────────────────────┐
│  Messages              [✎ nouveau]  │  ← header
├─────────────────────────────────────┤
│  [Avatar]  Nom              12:30   │
│            Aperçu du dernier msg  👁 N│  ← GlassCard, badge si non-lu
│  [Avatar]  Nom              hier    │
│            Aperçu...                │
│  ...                                │
└─────────────────────────────────────┘
```

---

## 2. Source de données

Service : `fetchConversations()` — retourne une liste `Conversation[]` triée par `lastMessage.created_at DESC`.

Chaque `Conversation` contient :
- `id` : ID de l'autre utilisateur (clé de conversation)
- `otherUser` : `{ display_name, avatar_url }`
- `lastMessage` : `{ content_type, text_content, is_from_me, is_read, deleted_by_sender, deleted_by_recipient, created_at }`
- `unreadCount` : nombre de messages non-lus

---

## 3. Stratégie de chargement (cache + fresh)

```
1. Si conversations vides → getCachedConversations()
   → Si cache non-vide → affiche immédiatement le cache
2. fetchConversations() en parallèle (ou en séquence)
   → Met à jour l'état avec les données fraîches
```

Le chargement est déclenché :
- Au montage (`useEffect[user]`)
- À chaque `focus` de la tab (`navigation.addListener('focus')`)
- Lors d'un nouveau message reçu (realtime Supabase)
- Pull-to-refresh manuel

---

## 4. Realtime

```ts
supabase
  .channel(`inbox:${user.id}`)
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'messages',
    filter: `recipient_id=eq.${user.id}`,
  }, () => loadConversations())
  .subscribe()
```

- Canal créé à l'effet `useEffect[user.id]`
- Canal nettoyé au démontage (`supabase.removeChannel`)
- Déclenche `loadConversations()` à chaque nouveau message reçu

---

## 5. Aperçu du dernier message (`getMessagePreview`)

| Condition | Aperçu affiché |
|-----------|----------------|
| Message supprimé (sender ou recipient) | `"Message supprimé"` |
| Message reçu non-lu (`!is_from_me && !is_read`) | `"Nouveau message à découvrir"` |
| Type `photo` | `"Vous: Photo"` ou `"Photo"` |
| Type `audio` | `"Vous: Audio"` ou `"Audio"` |
| Type `text` | Texte tronqué à 40 chars + `"..."` si besoin |

Le préfixe `"Vous: "` est ajouté si `lastMessage.is_from_me`.

---

## 6. Visuel non-lu

Quand `unreadCount > 0` :
- Nom de l'utilisateur en **gras** (fontWeight 700)
- Date en cyan
- Aperçu en `colors.text.primary` (plus clair)
- Badge cyan `👁 N` (capped à "9+") en bas à droite
- `GlassCard` avec `withBorder` + `withGlow` (sauf bot → glow cyan au lieu de violet)

---

## 7. Bot Fläag

- `FLAG_BOT_ID` est une constante dans `messages.ts`
- La conversation avec le bot est identifiée par `item.id === FLAG_BOT_ID`
- L'avatar du bot a un anneau cyan et `withGlow`
- La card bot a `backgroundColor: 'rgba(0, 229, 255, 0.03)'`
- `canSend = false` dans ConversationScreen (la messagerie est désactivée avec le bot)

---

## 8. Navigation

```
Tap conversation → navigation.navigate('Conversation', {
  otherUserId: item.id,
  otherUserName: item.otherUser.display_name || 'Utilisateur',
  otherUserAvatarUrl: item.otherUser.avatar_url,
})

Tap [✎] (bouton créer) → navigation.navigate('SelectRecipient', { mode: 'chat' })
```

---

## 9. États vides

Si `conversations.length === 0` après chargement :
```
[✉ icône]
Aucune conversation
Commencez une conversation en appuyant sur le bouton +
[Nouvelle conversation]  ← action button
```

---

## 10. Animations

Chaque item de liste a un `Animated.Value` créé lors du chargement :
- `opacity: anim` (0 → 1)
- `translateY: anim.interpolate({ inputRange: [0,1], outputRange: [20,0] })`

Les animations sont dans `itemAnimations[]` synchronisé avec `data`. Elles sont déjà à `1` par défaut (pas d'animation au montage, prêtes pour usage futur).
