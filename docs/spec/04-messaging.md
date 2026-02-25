# 04 — Messagerie

## Vue d'ensemble

Le système de messagerie couvre :
- Messages privés (texte, photo, audio) entre utilisateurs qui se suivent mutuellement
- Messages publics géolocalisés découvrables par tous sur la carte
- Conversations (threads entre deux utilisateurs)
- Upload de médias vers Supabase Storage

Service principal : `src/services/messages.ts`

## Types de messages

| Type | `is_public` | `recipient_id` | Qui peut lire |
|------|-------------|----------------|---------------|
| Privé avec loc | false | UUID | Destinataire, à portée de 100m |
| Privé sans loc | false | UUID | Destinataire, immédiatement |
| Public | true | null | Tous les utilisateurs, à portée de 100m |

## Envoi d'un message

```typescript
sendMessage(
  recipientId: string | null,  // null = public
  contentType: 'text' | 'photo' | 'audio',
  location: Coordinates | null, // null = lisible immédiatement
  textContent?: string,
  mediaUrl?: string,
  isPublic?: boolean
): Promise<Message | null>
```

**Règles métier :**
- Si `location = null` → `is_read = true` immédiatement (pas de contrainte géographique)
- Si `location` fournie → `is_read = false` jusqu'à ce que le destinataire soit à portée
- Messages privés : abonnement mutuel requis (vérifié par RLS, pas côté client)
- Messages publics : `recipient_id = null`, `is_public = true`

**Flux d'envoi :**
```
1. Upload média si présent → URL retournée
2. INSERT dans public.messages avec sender_id = auth.uid()
3. RLS vérifie les droits d'envoi
4. Trigger send_push_on_new_message() déclenché → notif push au destinataire
5. Message retourné ou null si erreur
```

## Lecture d'un message

Un message devient lisible lorsque :
- Il n'a pas de location (`is_read` déjà true)
- OU l'utilisateur est à moins de 100m de `location`

```typescript
markMessageAsRead(messageId: string, senderId?: string): Promise<boolean>
```

**Actions :**
1. UPDATE `public.messages` SET `is_read = true`, `read_at = now()` WHERE `id = messageId`
2. Mise à jour du cache carte (retire le message de la liste des non-lus)
3. Mise à jour du cache conversations
4. Mise à jour du cache conversation individuelle
5. Trigger `send_push_on_message_discovered()` notifie l'expéditeur

## Conversations (InboxScreen)

Une "conversation" est un regroupement des messages échangés entre deux utilisateurs.

```typescript
// Structure retournée
interface Conversation {
  id: string;                    // ID de l'autre utilisateur
  otherUser: Pick<User, 'id' | 'display_name' | 'avatar_url'>;
  lastMessage: {
    id: string;
    content_type: 'text' | 'photo' | 'audio';
    text_content?: string;
    created_at: string;
    is_read: boolean;
    is_from_me: boolean;
  };
  unreadCount: number;
}
```

**Fetch** : `fetchConversations()` — requête Supabase agrégée + cache incrémental

## Messages carte (MapScreen)

```typescript
// Métadonnées uniquement — pas de contenu (privacy)
interface UndiscoveredMessageMapMeta {
  id: string;
  location: string | Coordinates;  // Format PostGIS: "POINT(lon lat)" ou objet
  created_at: string;
  is_public?: boolean;
  sender?: Pick<User, 'id' | 'display_name' | 'avatar_url'>;
}
```

**Fetch** : `fetchUndiscoveredMessagesForMap()` — retourne les messages non lus + publics non découverts dans la zone

> **Privacy** : La requête carte ne retourne jamais `text_content`, `media_url`, ni aucun contenu de message.

## Upload de médias

```typescript
uploadMedia(uri: string, type: 'photo' | 'audio'): Promise<string | null>
```

**Flux :**
```
1. Lecture fichier local en base64 (expo-file-system)
2. Décodage base64 → ArrayBuffer (base64-arraybuffer)
3. Upload vers Supabase Storage
   - Photos : bucket 'message-photos', content-type 'image/jpeg'
   - Audio  : bucket 'message-audio', content-type 'audio/m4a'
4. Retourne l'URL publique du fichier
```

**Formats :**
- Photo : JPEG, qualité 0.8 (compressée par Expo Image Picker)
- Audio : M4A (enregistré via Expo AV)

## Fonctions de fetch

| Fonction | Description |
|----------|-------------|
| `fetchConversations()` | Toutes les conversations (cache incrémental) |
| `fetchConversationMessages(otherUserId)` | Messages d'une conversation |
| `fetchUndiscoveredMessagesForMap()` | Marqueurs carte (cache incrémental) |
| `fetchMessageById(messageId)` | Un message par ID |
| `fetchMyPublicMessages()` | Messages publics de l'utilisateur courant |
| `fetchUserPublicMessages(userId)` | Messages publics d'un autre utilisateur |
| `fetchFollowingPublicMessages()` | Messages publics des utilisateurs suivis |
| `fetchFollowedUsers()` | Utilisateurs suivis (pour SelectRecipientScreen) |

## Messages publics et découverte

Un message public peut être "découvert" (vu) par n'importe quel utilisateur dans le rayon de 100m.

```typescript
markPublicMessageDiscovered(messageId: string): Promise<boolean>
// INSERT dans discovered_public_messages

fetchDiscoveredPublicMessageIds(messageIds: string[]): Promise<Set<string>>
// Vérifie quels IDs ont déjà été découverts par l'utilisateur courant
```

## Acteur spécial : Flag Bot

- ID : `FLAG_BOT_ID = '00000000-0000-0000-0000-000000000001'`
- Envoie le message de bienvenue à chaque nouvel utilisateur via trigger
- L'UI reconnaît cet ID et affiche un avatar spécial (flag icon)

## Sécurité

- RLS empêche la lecture du contenu sans être destinataire ou expéditeur
- Les marqueurs carte ne révèlent jamais le contenu
- Les messages privés nécessitent un abonnement mutuel (RLS, pas client)
- `sender_id` = `auth.uid()` forcé par RLS — jamais depuis le payload
