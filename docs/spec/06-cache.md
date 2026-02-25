# 06 — Cache & synchronisation

## Vue d'ensemble

Le cache garantit une UX fluide (affichage immédiat) tout en maintenant des données fraîches via synchronisation incrémentale en arrière-plan.

Service : `src/services/cache.ts`

## Stratégie globale

```
1. Instant UI  → retourner les données depuis AsyncStorage immédiatement
2. Background  → fetch Supabase depuis le dernier timestamp de sync
3. Merge       → fusionner nouvelles données dans le cache par ID
4. Update      → écrire le cache fusionné + mettre à jour le timestamp
5. Logout      → clearAllCache() vide tout
```

## Clés de cache

```typescript
export const CACHE_KEYS = {
  CONVERSATIONS_MESSAGES: 'conversations_messages',
  MAP_MESSAGES: 'map_messages',
  CONVERSATION: (otherUserId: string) => `conversation_${otherUserId}`,
  USERS: 'users',
};
```

## API du service

```typescript
getCachedData<T>(key: string): Promise<T | null>
// Lecture AsyncStorage, retourne l'objet parsé ou null

setCachedData<T>(key: string, data: T): Promise<void>
// Sérialise en JSON et écrit dans AsyncStorage

removeCachedData(key: string): Promise<void>
// Supprime une entrée de cache

clearAllCache(): Promise<void>
// Supprime toutes les entrées (appelé au logout)

getLastSyncTimestamp(key: string): Promise<string | null>
// Timestamp ISO de la dernière synchronisation pour ce cache

setLastSyncTimestamp(key: string, timestamp: string): Promise<void>
// Met à jour le timestamp de sync
```

**Préfixes AsyncStorage** :
- Cache : `flag_cache_<key>`
- Timestamps : `flag_sync_<key>`

## Sync incrémentale

Implémentée dans `fetchConversations()` et `fetchUndiscoveredMessagesForMap()` :

```
1. getLastSyncTimestamp(cacheKey)
2. Si pas de timestamp → fetch complet depuis Supabase
3. Si timestamp → fetch uniquement les éléments modifiés après ce timestamp
   (WHERE updated_at > lastSync OU created_at > lastSync)
4. Merge : { ...cachedItems, ...newItemsById }
5. setLastSyncTimestamp(cacheKey, now.toISOString())
6. setCachedData(cacheKey, mergedItems)
```

## Lecture immédiate + fraîcheur en background

```typescript
// Pattern utilisé dans les screens
const cached = await getCachedConversations();  // Retour immédiat
if (cached) setConversations(cached);           // Affiche le cache

fetchConversations().then(fresh => {            // En background
  if (fresh) setConversations(fresh);           // Met à jour l'UI
});
```

## Invalidation du cache messages lus

Lorsque `markMessageAsRead()` est appelé, le cache est mis à jour immédiatement :

1. Cache carte (`MAP_MESSAGES`) → retire l'entrée avec l'ID concerné
2. Cache conversations (`CONVERSATIONS_MESSAGES`) → met à jour `is_read` + `unreadCount`
3. Cache conversation individuelle (`conversation_<userId>`) → met à jour `is_read`

Ceci évite qu'un message marqué lu réapparaisse en cache obsolète.

## Logout

```typescript
clearAllCache()
// Supprime toutes les clés AsyncStorage avec le préfixe 'flag_cache_' et 'flag_sync_'
// Appelé dans AuthContext.signOut() avant supabase.auth.signOut()
```

## Limitations connues

- Le cache est par appareil (pas de sync cross-device)
- Pas de TTL (Time-To-Live) sur les entrées — la sync incrémentale assure la fraîcheur
- En cas d'erreur réseau, le cache stale est affiché (acceptable — meilleur qu'un écran vide)
- Le Set `notifiedMessages` de la tâche background n'est pas persisté en cache
