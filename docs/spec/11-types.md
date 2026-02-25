# 11 — Types TypeScript

> Tous les types sont dans `src/types/index.ts`. Ils sont exportés et réutilisés dans tous les services et écrans.

## Types de base

### `Coordinates`
```typescript
interface Coordinates {
  latitude: number;
  longitude: number;
}
```

### `User`
```typescript
interface User {
  id: string;               // UUID
  phone?: string;
  email?: string;
  display_name?: string;
  avatar_url?: string;
  created_at: string;       // ISO timestamp
}
```

### `AuthState`
```typescript
interface AuthState {
  user: User | null;
  session: any | null;
  loading: boolean;
}
```

### `LocationState`
```typescript
interface LocationState {
  current: Coordinates | null;
  permission: 'granted' | 'denied' | 'undetermined';
  loading: boolean;
}
```

## Types messages

### `Message`
```typescript
interface Message {
  id: string;
  sender_id: string;
  recipient_id: string;
  content_type: 'text' | 'photo' | 'audio';
  text_content?: string;
  media_url?: string;
  location: Coordinates;
  created_at: string;
  read_at?: string;
  is_read: boolean;
  is_public?: boolean;
}
```

### `MessageWithSender`
```typescript
interface MessageWithSender extends Message {
  sender: Pick<User, 'id' | 'display_name' | 'avatar_url'>;
}
```

### `MessageWithUsers`
```typescript
interface MessageWithUsers extends Message {
  sender: Pick<User, 'id' | 'display_name' | 'avatar_url'>;
  recipient: Pick<User, 'id' | 'display_name' | 'avatar_url'>;
}
```

### `UndiscoveredMessageMeta`
Métadonnées minimales — utilisées pour les listes de messages non découverts (sans contenu).
```typescript
interface UndiscoveredMessageMeta {
  id: string;
  created_at: string;
  is_read: boolean;
}
```

### `UndiscoveredMessageMapMeta`
Métadonnées pour les marqueurs carte — jamais de contenu.
```typescript
interface UndiscoveredMessageMapMeta {
  id: string;
  location: string | Coordinates;  // "POINT(lon lat)" ou objet
  created_at: string;
  is_public?: boolean;
  sender?: Pick<User, 'id' | 'display_name' | 'avatar_url'>;
}
```

### `MapMarker`
Marqueur carte résolu (après parsing de la location).
```typescript
interface MapMarker {
  id: string;
  coordinate: Coordinates;
  is_readable: boolean;    // Distance ≤ 100m
  sender_name?: string;
}
```

## Types conversation

### `Conversation`
```typescript
interface Conversation {
  id: string;              // ID de l'autre utilisateur
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

## Types abonnements

### `NotificationPrefs`
Défini dans `src/services/subscriptions.ts` :
```typescript
interface NotificationPrefs {
  notifyPrivateFlags: boolean;
  notifyPublicFlags: boolean;
}
```

## Conventions de typage

| Convention | Règle |
|-----------|-------|
| `strict: true` | Zéro `any`, zéro `as unknown` |
| `readonly` | Pour les données Supabase (lecture seule) |
| Discriminated unions | Pour les états machine (idle/loading/error) |
| `Pick<T, keys>` | Pour les sous-sélections de User (éviter de passer l'objet complet) |
| Types exportés | Toujours exportés pour réutilisation cross-service |
| Timestamp | `string` au format ISO 8601 (venant de Supabase) |
| UUID | `string` (pas de type UUID dédié) |

## Pattern état machine recommandé

Pour les hooks et composants à états complexes :
```typescript
type ScreenState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: Message[] }
  | { status: 'error'; error: string };
```
