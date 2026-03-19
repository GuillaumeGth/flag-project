# Spec — Écrans Profil

Couvre trois écrans liés : `ProfileScreen`, `UserProfileScreen`, `MessageFeedScreen`.

---

## 1. ProfileScreen — Mon profil

**Route** : tab `Profile` (bottom tab)
**Fichier** : `src/screens/ProfileScreen.tsx`

### 1.1 Sections

```
┌─────────────────────────────────────┐
│  [Paramètres]  [Demandes en attente] │  ← boutons top-right
│                                     │
│        [Avatar]  Nom affiché  [✎]  │
│                 téléphone / email   │
│                                     │
│    N fläags    N followers    N lieux│  ← ProfileStatsRow
├─────────────────────────────────────┤
│ ┌──┐ ┌──┐ ┌──┐                     │
│ │  │ │  │ │  │  ← mosaïque 3 col   │
│ └──┘ └──┘ └──┘                     │
└─────────────────────────────────────┘
```

### 1.2 Règles de la mosaïque

- Source : `fetchMyPublicMessages()` — tous les propres messages publics, **sans filtre de découverte**
- Toutes les vignettes sont **toujours claires** (pas de floutage sur son propre profil)
- Tri : `created_at DESC`
- Badge commentaires `💬 N` affiché en bas à droite si `commentCount > 0`

### 1.3 Flux édition

| Action | Déclencheur | Service |
|--------|-------------|---------|
| Changer l'avatar | Tap sur l'avatar | `updateAvatar(uri)` → Image Picker |
| Changer le nom | Tap sur le nom → modal | `updateDisplayName(name)` |

### 1.4 Navigation depuis la mosaïque

```
Tap vignette → MessageFeedScreen { userId: user.id, initialMessageId: message.id }
```

---

## 2. UserProfileScreen — Profil d'un autre utilisateur

**Route** : `UserProfile` (stack) — params : `{ userId: string }`
**Fichier** : `src/screens/UserProfileScreen.tsx`

### 2.1 Sections

Même layout que `ProfileScreen` avec en plus :
- Bouton Follow / Demander / Demande envoyée / Abonné
- Bouton 🔔 (préférences de notification, visible uniquement si `following`)
- Bouton messagerie → `ConversationScreen`

### 2.2 Règles de la mosaïque

- Source : `fetchUserPublicMessages(userId)` — **tous** les messages publics de l'utilisateur, sans filtre de découverte
- Découverts vs non-découverts : déterminé par `fetchDiscoveredPublicMessageIds(messageIds)` → `Set<string>`
- Tri : `created_at DESC`

#### Rendu des vignettes

| État | Rendu |
|------|-------|
| `discovered = true` | Vignette normale (photo / texte / audio) + badge commentaires si > 0 |
| `discovered = false` | Fond sombre + contenu flouté (`blurRadius={150}` pour les photos, `••••` pour le texte) + icône `eye-off` centrée |

Composant : `GridCell` avec prop `discovered={discoveredIds.has(item.id)}`

#### Tap sur une vignette non-découverte

```
onUndiscoveredPress → navigation.navigate('Main', {
  screen: 'Map',
  params: { focusLocation: { latitude, longitude } }
})
```
→ Ouvre la carte centrée sur la position du flag pour que l'utilisateur aille le découvrir.

### 2.3 Navigation depuis la mosaïque

```
Tap vignette découverte → MessageFeedScreen { userId, initialMessageId: message.id }
Tap vignette non-découverte → MapScreen centré sur le flag
```

### 2.4 Flux follow

```
is_private = false :
  Tap "S'abonner" → follow(userId) → état "Abonné"

is_private = true :
  Tap "Demander" → sendFollowRequest(userId) → état "Demande envoyée"
  Tap "Demande envoyée" → cancelFollowRequest(requestId) → état initial

Tap "Abonné" → unfollow(userId) → état initial
```

### 2.5 Modal préférences de notification

Accessible via 🔔, uniquement si `following = true`.

| Toggle | Préférence |
|--------|-----------|
| Fläags privés | `notifyPrivateFlags` |
| Fläags publics | `notifyPublicFlags` |

Service : `fetchNotificationPrefs(userId)` / `updateNotificationPrefs(userId, prefs)`

---

## 3. MessageFeedScreen — Feed pleine page

**Route** : `MessageFeed` (stack) — params : `{ userId: string; initialMessageId: string }`
**Fichier** : `src/screens/MessageFeedScreen.tsx`

### 3.1 Layout

FlatList verticale, pleine largeur. Chaque item = un fläag public + sa section commentaires.

```
┌─────────────────────────────────────┐
│ ← Retour     Nom de l'utilisateur   │  ← header
├─────────────────────────────────────┤
│ [Avatar] NomUser · 12 mars          │
│                                     │
│   [Contenu du flag]                 │  ← photo / texte / audio
│                                     │
│ ❤️ 12   📍                          │  ← barre d'actions
├─────────────────────────────────────┤
│  Commentaire 1 · 2h       ❤️ 3      │
│    └─ Réponse 1.1 · 1h    ❤️ 1      │
│  Commentaire 2 · 5h       ❤️ 0      │
│ [Écrire un commentaire...]          │
├─────────────────────────────────────┤  ← séparateur 8px
│ ...flag suivant...                  │
└─────────────────────────────────────┘
```

### 3.2 Règles de découverte dans le feed

- **Propre profil** (`userId === currentUser.id`) : prop `isDiscovered` = `undefined` → tous les items sont clairs
- **Profil d'autrui** : `fetchDiscoveredPublicMessageIds(messageIds)` après le chargement → `isDiscovered = discoveredIds.has(item.id)`

#### Rendu d'un item non-découvert (`isDiscovered === false`)

```
┌─────────────────────────────────────┐
│ [Avatar] NomUser · 12 mars          │  ← header visible
├─────────────────────────────────────┤
│                                     │
│   [BlurView intensity=60]           │  ← contenu flouté
│   👁‍🗨  Fläag non découvert          │
│   Approche-toi pour le lire         │
│                                     │
└─────────────────────────────────────┘
```

- Tap sur le bloc → `onMapPress()` → `MapScreen` centré sur le flag
- Section commentaires et input **masqués** (non-accessibles avant découverte)

#### Rendu d'un item découvert (`isDiscovered === true` ou `undefined`)

Comportement normal : contenu complet + commentaires + input.

### 3.3 Scroll initial

Au chargement, si `initialMessageId` est fourni, la liste scrolle vers l'index correspondant (`flatListRef.scrollToIndex`).

---

## 4. Composants impliqués

| Composant | Fichier | Rôle |
|-----------|---------|------|
| `GridCell` | `src/components/profile/GridCell.tsx` | Vignette mosaïque (clair ou flouté) |
| `ProfileStatsRow` | `src/components/profile/ProfileStatsRow.tsx` | Ligne de stats (fläags, followers, lieux) |
| `MessageFeedItem` | `src/components/comments/MessageFeedItem.tsx` | Item du feed (flag + commentaires) |
| `MessageContentDisplay` | `src/components/shared/MessageContentDisplay.tsx` | Rendu contenu flag (photo/texte/audio) |
| `CommentList` | `src/components/comments/CommentList.tsx` | Liste des commentaires |
| `CommentInput` | `src/components/comments/CommentInput.tsx` | Input saisie commentaire |

---

## 5. Services impliqués

| Fonction | Fichier | Usage |
|----------|---------|-------|
| `fetchMyPublicMessages()` | `messages.ts` | Tous les messages publics de l'utilisateur courant |
| `fetchUserPublicMessages(userId)` | `messages.ts` | Tous les messages publics d'un autre utilisateur |
| `fetchDiscoveredPublicMessageIds(ids)` | `messages.ts` | Set des IDs découverts par l'utilisateur courant |
| `fetchCommentCounts(ids)` | `comments.ts` | Compteurs de commentaires pour les badges |
| `isFollowing(userId)` | `subscriptions.ts` | État du suivi |
| `follow / unfollow` | `subscriptions.ts` | Actions de suivi |
| `fetchNotificationPrefs / updateNotificationPrefs` | `subscriptions.ts` | Préférences de notif |
| `sendFollowRequest / cancelFollowRequest` | `followRequests.ts` | Demandes de suivi (comptes privés) |

---

## 6. Règle de découverte — résumé

```
fetchUserPublicMessages(userId)     → TOUS les messages publics (pas de filtre discovery)
fetchDiscoveredPublicMessageIds()   → IDs découverts physiquement (< 100m)

discovered = true   → contenu visible normalement
discovered = false  → contenu flouté + CTA vers la carte
```

Le floutage est **côté UI uniquement** — la RLS Supabase n'est pas impliquée dans ce filtre visuel. La RLS garantit uniquement que les messages privés ne sont pas accessibles.

---

## 7. Types navigation

```typescript
// src/types/navigation.ts
UserProfile: { userId: string };
MessageFeed: { userId: string; initialMessageId: string };
```
