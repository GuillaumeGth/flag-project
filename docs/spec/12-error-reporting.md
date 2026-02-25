# 12 — Gestion des erreurs

## Vue d'ensemble

Le reporting d'erreurs en production est géré par `src/services/errorReporting.ts`. Il est désactivé en développement et throttlé pour éviter le flood de logs.

## `reportError()`

```typescript
reportError(
  error: unknown,
  context: string,
  metadata?: Record<string, unknown>
): Promise<void>
```

**Comportement :**
- Inactif si `__DEV__ === true`
- Throttlé : max 1 erreur par contexte par 60 secondes (Map en mémoire)
- Insère dans `public.error_logs` (Supabase)
- Failure silencieuse — ne throw jamais

**Données enregistrées :**
- `error_message` : message d'erreur extrait
- `error_context` : contexte fonctionnel passé en paramètre (ex: `"fetchConversations"`)
- `error_stack` : stack trace si disponible
- `user_id` : depuis `getCachedUserId()` (non bloquant)
- `metadata` : données JSONB libres (ex: `{ messageId, userId }`)
- Platform, version app via `expo-constants`

## Utilisation

```typescript
import { reportError } from './errorReporting';

try {
  await fetchConversations();
} catch (error) {
  reportError(error, 'fetchConversations', { userId: currentUserId });
}
```

## Throttling

Le throttle empêche plusieurs erreurs identiques en rafale d'inonder la table :

```typescript
const throttleMap = new Map<string, number>(); // context → last error timestamp
const THROTTLE_MS = 60_000;

if (Date.now() - (throttleMap.get(context) ?? 0) < THROTTLE_MS) return;
throttleMap.set(context, Date.now());
// → insert
```

## Table `public.error_logs`

Les logs sont consultables directement dans la dashboard Supabase pour le debugging production.

Un trigger email peut être configuré pour alerter en cas d'erreur critique (mentionné dans CLAUDE.md).

## Pattern recommandé

Dans les services, wrapper les appels Supabase critiques :

```typescript
const { data, error } = await supabase.from('messages').select('*');
if (error) {
  reportError(error, 'fetchMessages', { context: 'map' });
  return null;
}
```

Ne pas reporter les erreurs attendues (réseau coupé, token expiré) — uniquement les erreurs inattendues.
