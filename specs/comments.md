# Specs — Commentaires sur les Fläags publics

## 1. Vue d'ensemble

Permettre aux utilisateurs de commenter les fläags publics qu'ils ont **découverts**. Les commentaires sont visibles par tous les utilisateurs ayant découvert le flag. L'accès aux commentaires se fait **uniquement depuis les écrans de profil** (ProfileScreen et UserProfileScreen), via une nouvelle vue pleine page de type "feed".

---

## 2. Règles métier

| Règle | Détail |
|-------|--------|
| Qui peut commenter | Tout utilisateur authentifié ayant **découvert** le flag public |
| Proximité requise | **Non** — une fois découvert, on peut commenter de n'importe où |
| Contenu | Texte uniquement, pas de limite de saisie |
| Affichage long | Troncature avec "voir plus" si le commentaire dépasse 3 lignes |
| Réponses | **1 niveau max** — on peut répondre à un commentaire, mais pas répondre à une réponse |
| Likes | Cœur (❤️) toggle sur chaque commentaire, avec compteur |
| Limite par user/flag | **50 commentaires max** par utilisateur sur un même flag |
| Suppression | Chaque utilisateur peut supprimer ses propres commentaires uniquement |
| Signalement | Reporté — pas dans cette version |
| Flags privés | **Pas de commentaires** — les flags privés n'ont jamais de commentaires |

---

## 3. Modèle de données

### Table `message_comments`

```sql
CREATE TABLE message_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_comment_id UUID REFERENCES message_comments(id) ON DELETE CASCADE,
  text_content TEXT NOT NULL CHECK (char_length(text_content) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index pour les requêtes principales
CREATE INDEX idx_message_comments_message_id ON message_comments(message_id);
CREATE INDEX idx_message_comments_parent ON message_comments(parent_comment_id);
CREATE INDEX idx_message_comments_user_message ON message_comments(user_id, message_id);
```

### Table `comment_likes`

```sql
CREATE TABLE comment_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID NOT NULL REFERENCES message_comments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT unique_comment_like UNIQUE (comment_id, user_id)
);

CREATE INDEX idx_comment_likes_comment_id ON comment_likes(comment_id);
```

### RLS Policies

```sql
-- message_comments
ALTER TABLE message_comments ENABLE ROW LEVEL SECURITY;

-- SELECT : visible si le message parent est public ET découvert par l'utilisateur
CREATE POLICY "comments_select" ON message_comments FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM messages m
    WHERE m.id = message_id
      AND m.is_public = true
      AND (
        m.sender_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM discovered_public_messages d
          WHERE d.message_id = m.id AND d.user_id = auth.uid()
        )
      )
  )
);

-- INSERT : même condition + user_id = auth.uid() + limite 50 commentaires par user/flag
CREATE POLICY "comments_insert" ON message_comments FOR INSERT WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM messages m
    WHERE m.id = message_id
      AND m.is_public = true
      AND (
        m.sender_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM discovered_public_messages d
          WHERE d.message_id = m.id AND d.user_id = auth.uid()
        )
      )
  )
  AND (SELECT count(*) FROM message_comments mc
       WHERE mc.message_id = message_comments.message_id
         AND mc.user_id = auth.uid()) < 50
);

-- DELETE : uniquement ses propres commentaires
CREATE POLICY "comments_delete" ON message_comments FOR DELETE USING (
  user_id = auth.uid()
);

-- comment_likes
ALTER TABLE comment_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "comment_likes_select" ON comment_likes FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM message_comments mc
    JOIN messages m ON m.id = mc.message_id
    WHERE mc.id = comment_id
      AND m.is_public = true
  )
);

CREATE POLICY "comment_likes_insert" ON comment_likes FOR INSERT WITH CHECK (
  user_id = auth.uid()
);

CREATE POLICY "comment_likes_delete" ON comment_likes FOR DELETE USING (
  user_id = auth.uid()
);
```

### Trigger — Empêcher les réponses imbriquées

```sql
CREATE OR REPLACE FUNCTION check_no_nested_reply()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.parent_comment_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM message_comments
      WHERE id = NEW.parent_comment_id AND parent_comment_id IS NOT NULL
    ) THEN
      RAISE EXCEPTION 'Cannot reply to a reply (max 1 level)';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_no_nested_reply
  BEFORE INSERT ON message_comments
  FOR EACH ROW EXECUTE FUNCTION check_no_nested_reply();
```

### Trigger — Notification push au propriétaire du flag

```sql
CREATE OR REPLACE FUNCTION notify_comment_on_flag()
RETURNS TRIGGER AS $$
DECLARE
  flag_owner_id UUID;
  commenter_name TEXT;
  push_token TEXT;
BEGIN
  -- Récupérer le propriétaire du flag
  SELECT sender_id INTO flag_owner_id FROM messages WHERE id = NEW.message_id;

  -- Ne pas notifier si l'auteur commente son propre flag
  IF flag_owner_id = NEW.user_id THEN RETURN NEW; END IF;

  -- Nom du commentateur
  SELECT display_name INTO commenter_name FROM users WHERE id = NEW.user_id;

  -- Envoyer la notification push (même pattern que les autres triggers)
  FOR push_token IN
    SELECT token FROM user_push_tokens WHERE user_id = flag_owner_id
  LOOP
    PERFORM net.http_post(
      'https://exp.host/--/api/v2/push/send',
      jsonb_build_object(
        'to', push_token,
        'title', COALESCE(commenter_name, 'Quelqu''un') || ' a commenté votre fläag',
        'body', LEFT(NEW.text_content, 100),
        'data', jsonb_build_object('type', 'comment', 'messageId', NEW.message_id)
      ),
      '{"Content-Type": "application/json"}'
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_notify_comment
  AFTER INSERT ON message_comments
  FOR EACH ROW EXECUTE FUNCTION notify_comment_on_flag();
```

---

## 4. Types TypeScript

### `src/types/comments.ts`

```typescript
export interface Comment {
  id: string;
  message_id: string;
  user_id: string;
  parent_comment_id: string | null;
  text_content: string;
  created_at: string;
}

export interface CommentWithUser extends Comment {
  user: {
    id: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

export interface CommentWithReplies extends CommentWithUser {
  replies: CommentWithUser[];
  like_count: number;
  has_liked: boolean;
}
```

---

## 5. Service — `src/services/comments.ts`

### Fonctions exportées

```typescript
// Récupérer les commentaires d'un flag (avec replies, likes, user info)
fetchCommentsForMessage(messageId: string, currentUserId: string): Promise<CommentWithReplies[]>

// Récupérer le nombre de commentaires pour plusieurs flags (batch)
fetchCommentCounts(messageIds: string[]): Promise<Record<string, number>>

// Créer un commentaire
createComment(messageId: string, textContent: string, parentCommentId?: string): Promise<Comment | null>

// Supprimer un commentaire
deleteComment(commentId: string): Promise<boolean>

// Toggle like sur un commentaire
toggleCommentLike(commentId: string, hasLiked: boolean): Promise<boolean>
```

### Détail `fetchCommentsForMessage`

1. Query `message_comments` WHERE `message_id = X` avec join sur `users` (display_name, avatar_url)
2. Query `comment_likes` pour tous les comment_ids récupérés
3. Regrouper les réponses sous leur parent (1 niveau)
4. Trier les parents : **plus récents en haut** (antéchronologique)
5. Trier les réponses : **chronologique** (anciens en haut, naturel pour un thread)
6. Retourner `CommentWithReplies[]`

### Détail `fetchCommentCounts`

1. Query `message_comments` avec `GROUP BY message_id` + `count(*)`
2. Filtrer par `messageIds` passés en paramètre
3. Retourner `Record<string, number>` (messageId → count)
4. Utilisé pour les badges sur la mosaïque et la vue pleine page

---

## 6. Factorisation — Code partagé

### 6.1 Suppression de la modale de visualisation

Actuellement `ProfileScreen` et `UserProfileScreen` ont chacun une modale quasi identique pour afficher un flag (photo plein écran / texte centré + bouton "Voir sur la carte"). Cette modale sera **supprimée** des deux écrans : le clic sur une vignette naviguera désormais vers `MessageFeedScreen`.

**Avant** : clic vignette → modale inline (photo viewer / text viewer)
**Après** : clic vignette → `navigation.navigate('MessageFeed', { userId, initialMessageId })`

### 6.2 `GridCell` — Ajout du badge compteur (partagé)

`GridCell` est déjà un composant partagé utilisé par `ProfileScreen`. On va :
1. Ajouter une prop optionnelle `commentCount?: number`
2. Afficher `CommentCountBadge` si `commentCount > 0`
3. Réutiliser `GridCell` dans `UserProfileScreen` aussi (actuellement `UserProfileScreen` a son propre `renderCell` inline — on le remplace)

### 6.3 `GridCell` étendu pour l'état "non découvert"

`UserProfileScreen` a une variante "undiscovered" de la cell (blur + lock). On ajoute une prop `discovered?: boolean` (défaut `true`) à `GridCell` pour gérer ce cas, plutôt que de dupliquer le rendu.

**Nouvelle interface `GridCell`** :
```typescript
interface GridCellProps {
  item: Message;
  index: number;
  onPress: (message: Message) => void;
  commentCount?: number;      // nouveau — badge commentaires
  discovered?: boolean;       // nouveau — état découvert (défaut true)
  onUndiscoveredPress?: (message: Message) => void; // nouveau — action pour cell non découverte
}
```

### 6.4 `ProfileStatsRow` — Composant extrait

La stats row (fläags count, followers count, locations count) est dupliquée entre `ProfileScreen` et `UserProfileScreen` avec le même layout. On extrait un composant :

```typescript
// src/components/profile/ProfileStatsRow.tsx
interface ProfileStatsRowProps {
  messagesCount: number;
  followerCount: number;
  locationsCount: number;
}
```

### 6.5 `MessageContentDisplay` — Rendu de contenu factorisé

Le rendu du contenu d'un message (photo / texte / audio) sera nécessaire dans `MessageFeedItem`. Plutôt que de le re-coder, on crée un composant réutilisable :

```typescript
// src/components/shared/MessageContentDisplay.tsx
interface MessageContentDisplayProps {
  message: Message;
  variant: 'feed' | 'fullscreen';  // feed = dans le feed, fullscreen = plein écran
}
```

Ce composant remplace aussi la logique de rendu dans la modale de visualisation supprimée.

### Résumé des factorisations

| Duplication actuelle | Solution |
|---------------------|----------|
| Modale photo/texte viewer (ProfileScreen + UserProfileScreen) | Supprimée → navigation vers `MessageFeedScreen` |
| `renderCell` inline dans UserProfileScreen | Remplacé par `GridCell` étendu (props `discovered`, `onUndiscoveredPress`) |
| Stats row dupliquée | Extrait en `ProfileStatsRow` |
| Rendu contenu message (modale + futur feed) | Extrait en `MessageContentDisplay` |

---

## 7. UX & Navigation

### 7.1 Mosaïque de profil (ProfileScreen + UserProfileScreen)

- **Badge compteur** `💬 N` en bas à droite de chaque vignette de la mosaïque
- Affiché uniquement si `count > 0`
- Le badge est semi-transparent (glassmorphism) pour ne pas gêner l'image
- Clic sur une vignette → navigation vers `MessageFeedScreen` (remplace la modale actuelle)

### 7.2 Nouvelle vue pleine page — `MessageFeedScreen`

**Navigation** : clic sur une vignette de la mosaïque → navigate vers `MessageFeedScreen`

**Paramètres de route** :
```typescript
MessageFeed: {
  userId: string;          // propriétaire des flags
  initialMessageId: string; // flag cliqué (pour scroll initial)
}
```

**Layout** :
- FlatList verticale, pleine largeur
- Chaque item = 1 flag en pleine page + ses commentaires en dessous
- Scroll ancré sur le flag correspondant à `initialMessageId`
- Header : bouton retour + nom de l'utilisateur

**Structure d'un item du feed** :
```
┌─────────────────────────────────┐
│ [Avatar] NomUser · 12 mars      │  ← Header du flag
├─────────────────────────────────┤
│                                 │
│   [Contenu du flag]             │  ← MessageContentDisplay (photo / texte / audio)
│   (photo, texte ou audio)       │
│                                 │
├─────────────────────────────────┤
│ ❤️ 12   💬 5                    │  ← Barre d'actions (réactions existantes + compteur commentaires)
├─────────────────────────────────┤
│ ┌─ Commentaire 1 (récent)       │
│ │  [Avatar] User · 2h           │
│ │  "Super endroit !"    ❤️ 3    │
│ │  └─ Réponse 1.1               │  ← Indenté
│ │     [Avatar] User · 1h        │
│ │     "Merci !"          ❤️ 1   │
│ ├─ Commentaire 2                │
│ │  [Avatar] User · 5h           │
│ │  "J'y étais hier"     ❤️ 0    │
│ └───────────────────────────────│
│ [Écrire un commentaire...]      │  ← Input fixe en bas de la section
└─────────────────────────────────┘
```

### 7.3 Compteur commentaires sur la carte (SelectedMessageCard)

- Ajout d'un petit compteur `💬 N` dans le header de la `SelectedMessageCard`
- Affiché à côté de la date, uniquement si le flag est public et `count > 0`
- Purement informatif (pas de navigation vers les commentaires depuis la carte)

### 7.4 Input de commentaire

- Barre en bas de chaque section de commentaires (pas un input global flottant)
- Placeholder : "Écrire un commentaire..."
- Bouton d'envoi (icône `send`) apparaît quand le texte n'est pas vide
- Quand on répond à un commentaire : un bandeau "Réponse à @NomUser" apparaît au-dessus de l'input avec un bouton ✕ pour annuler

### 7.5 Interactions sur un commentaire

- **Tap sur ❤️** : toggle like + mise à jour optimiste du compteur
- **Tap sur "Répondre"** : focus l'input avec le contexte de réponse
- **Long press / swipe** : option "Supprimer" (uniquement si c'est son propre commentaire)
- **"Voir plus"** : expand le commentaire tronqué (> 3 lignes)

---

## 8. Composants à créer

| Composant | Fichier | Rôle |
|-----------|---------|------|
| `MessageFeedScreen` | `src/screens/MessageFeedScreen.tsx` | Vue pleine page scrollable des flags + commentaires |
| `MessageFeedItem` | `src/components/comments/MessageFeedItem.tsx` | Un flag + sa section commentaires |
| `CommentList` | `src/components/comments/CommentList.tsx` | Liste des commentaires d'un flag |
| `CommentItem` | `src/components/comments/CommentItem.tsx` | Un commentaire (avec replies indentées) |
| `CommentInput` | `src/components/comments/CommentInput.tsx` | Input de saisie + bouton envoyer |
| `CommentCountBadge` | `src/components/comments/CommentCountBadge.tsx` | Badge `💬 N` pour la mosaïque et le feed |
| `ProfileStatsRow` | `src/components/profile/ProfileStatsRow.tsx` | Stats row factorisée (messages, followers, locations) |
| `MessageContentDisplay` | `src/components/shared/MessageContentDisplay.tsx` | Rendu contenu message (photo/texte/audio) réutilisable |

### Composants existants à modifier

| Composant | Modification |
|-----------|-------------|
| `GridCell` | Ajouter props `commentCount`, `discovered`, `onUndiscoveredPress` |
| `SelectedMessageCard` | Ajouter compteur commentaires dans le header |
| `ProfileScreen` | Supprimer modale viewer, naviguer vers `MessageFeedScreen`, utiliser `ProfileStatsRow`, charger comment counts |
| `UserProfileScreen` | Supprimer modale viewer, remplacer `renderCell` inline par `GridCell`, utiliser `ProfileStatsRow`, naviguer vers `MessageFeedScreen` |

---

## 9. Navigation — Modifications

### `RootStackParamList` (src/types/navigation.ts)

Ajouter :
```typescript
MessageFeed: { userId: string; initialMessageId: string };
```

### Stack Navigator

Ajouter `MessageFeedScreen` dans le `RootStack`.

---

## 10. Notifications

| Événement | Destinataire | Titre | Body |
|-----------|-------------|-------|------|
| Nouveau commentaire | Propriétaire du flag | `"{user}" a commenté votre fläag` | Premiers 100 caractères du commentaire |
| Réponse à un commentaire | Auteur du commentaire parent | `"{user}" a répondu à votre commentaire` | Premiers 100 caractères de la réponse |

> Les notifications sont envoyées via trigger Supabase (même pattern que les notifs existantes).

---

## 11. Plan d'implémentation

### Phase 1 — Base de données
1. Ajouter les tables `message_comments` et `comment_likes` dans `schema.sql`
2. Ajouter les policies RLS
3. Ajouter les triggers (validation 1 niveau + notifications)
4. Appliquer la migration sur Supabase

### Phase 2 — Types & Service
5. Créer `src/types/comments.ts`
6. Créer `src/services/comments.ts`
7. Tests unitaires du service

### Phase 3 — Factorisation
8. Créer `ProfileStatsRow` — extraire depuis ProfileScreen + UserProfileScreen
9. Créer `MessageContentDisplay` — rendu contenu message réutilisable
10. Étendre `GridCell` — props `commentCount`, `discovered`, `onUndiscoveredPress`
11. Refactorer `UserProfileScreen` — remplacer `renderCell` inline par `GridCell`
12. Refactorer `ProfileScreen` + `UserProfileScreen` — utiliser `ProfileStatsRow`

### Phase 4 — Composants commentaires
13. Créer `CommentCountBadge`
14. Créer `CommentItem` (avec like, réponse, troncature)
15. Créer `CommentInput`
16. Créer `CommentList`
17. Créer `MessageFeedItem` (utilise `MessageContentDisplay` + `CommentList` + `CommentInput`)

### Phase 5 — Écrans & Navigation
18. Créer `MessageFeedScreen`
19. Ajouter la route `MessageFeed` dans la navigation
20. Modifier `ProfileScreen` — supprimer modale, naviguer vers `MessageFeedScreen`, charger comment counts
21. Modifier `UserProfileScreen` — supprimer modale, naviguer vers `MessageFeedScreen`, charger comment counts
22. Modifier `SelectedMessageCard` — ajouter compteur commentaires

### Phase 6 — Tests
23. Tests unitaires du service comments
24. Tests des composants commentaires
25. Tests des composants factorisés (ProfileStatsRow, MessageContentDisplay, GridCell étendu)
26. Tests de la navigation
27. Tests end-to-end du flow complet

---

## 12. Plan de tests

### Tests unitaires — Service (`__tests__/services/comments.test.ts`)

| Test | Description |
|------|-------------|
| `fetchCommentsForMessage` | Retourne les commentaires avec replies groupées et triées |
| `fetchCommentsForMessage` — vide | Retourne `[]` pour un flag sans commentaires |
| `fetchCommentCounts` | Retourne les bons compteurs pour plusieurs flags |
| `fetchCommentCounts` — aucun commentaire | Retourne `{}` |
| `createComment` | Crée un commentaire racine |
| `createComment` — réponse | Crée une réponse à un commentaire existant |
| `createComment` — texte vide | Retourne `null` / ne crée rien |
| `deleteComment` | Supprime un commentaire existant |
| `toggleCommentLike` — like | Ajoute un like |
| `toggleCommentLike` — unlike | Retire un like |

### Tests unitaires — Composants

| Test | Description |
|------|-------------|
| `CommentItem` — render | Affiche avatar, nom, texte, date, compteur likes |
| `CommentItem` — troncature | Tronque à 3 lignes avec "voir plus" |
| `CommentItem` — like toggle | Appelle `onLike` au tap sur le cœur |
| `CommentItem` — répondre | Appelle `onReply` au tap sur "Répondre" |
| `CommentItem` — supprimer | Affiche l'option supprimer uniquement pour ses propres commentaires |
| `CommentInput` — saisie | Affiche le bouton envoyer quand le texte n'est pas vide |
| `CommentInput` — envoi | Appelle `onSubmit` avec le texte, reset l'input |
| `CommentInput` — mode réponse | Affiche le bandeau "Réponse à @User" |
| `CommentCountBadge` — affiché | Affiche le compteur quand `count > 0` |
| `CommentCountBadge` — masqué | Ne rend rien quand `count === 0` |
| `CommentList` — tri | Les commentaires racines sont triés antéchronologiquement |
| `CommentList` — replies | Les réponses sont triées chronologiquement sous leur parent |
| `MessageFeedItem` — render | Affiche le contenu du flag + section commentaires |

### Tests unitaires — Composants factorisés

| Test | Description |
|------|-------------|
| `GridCell` — badge commentaires | Affiche `CommentCountBadge` quand `commentCount > 0` |
| `GridCell` — pas de badge | Pas de badge quand `commentCount` absent ou 0 |
| `GridCell` — état non découvert | Affiche le blur + lock quand `discovered === false` |
| `GridCell` — état découvert | Affiche le contenu normal quand `discovered !== false` |
| `ProfileStatsRow` — render | Affiche les 3 stats avec les bonnes valeurs |
| `MessageContentDisplay` — photo | Affiche l'image en pleine largeur |
| `MessageContentDisplay` — texte | Affiche le texte centré |
| `MessageContentDisplay` — audio | Affiche le player audio |

### Tests d'intégration

| Test | Description |
|------|-------------|
| Flow complet — commenter | Naviguer vers le feed, écrire un commentaire, voir qu'il apparaît |
| Flow complet — répondre | Répondre à un commentaire, voir la réponse indentée |
| Flow complet — like | Liker un commentaire, voir le compteur s'incrémenter |
| Flow complet — supprimer | Supprimer son commentaire, voir qu'il disparaît |
| Navigation — profil → feed | Clic vignette mosaïque → MessageFeedScreen ancré sur le bon flag |
| Limite 50 | Vérifier qu'on ne peut pas poster un 51e commentaire |
| RLS — non découvert | Un utilisateur qui n'a pas découvert le flag ne voit pas les commentaires |
| Factorisation — ProfileScreen | Vérifie que le profil fonctionne après suppression de la modale |
| Factorisation — UserProfileScreen | Vérifie que le profil autre user fonctionne avec GridCell partagé |

---

## 13. Hors périmètre (v1)

- Signalement de commentaires
- Modération par le propriétaire du flag
- Commentaires sur les flags privés
- Commentaires avec médias (photo, audio)
- Mentions (@user) dans les commentaires
- Notifications aux autres commentateurs (seul le propriétaire du flag et l'auteur du commentaire parent sont notifiés)
- Édition d'un commentaire après publication
- Cache incrémental des commentaires (à ajouter en v2 si nécessaire)
- Blocage d'utilisateurs
