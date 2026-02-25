# 05 — Localisation

## Vue d'ensemble

La localisation est un pilier central de Fläag. Elle couvre :
- Géolocalisation foreground (carte, découverte)
- Tracking background (notifications de proximité)
- Calcul de distance (lecture des messages, notifications)

Services : `src/services/location.ts`, `src/tasks/backgroundLocation.ts`
Contexte : `src/contexts/LocationContext.tsx`

## Règles de proximité

| Rayon | Rôle | Défini dans |
|-------|------|-------------|
| **100m** | Lecture d'un message | `isWithinRadius()` (défaut), `MapScreen.canReadMessage()` |
| **300m** | Notification de proximité (background) | `PROXIMITY_RADIUS` dans `backgroundLocation.ts` |

> La notification à 300m anticipe l'arrivée à portée de lecture (100m), laissant le temps à l'utilisateur de s'approcher.

## Permissions

```typescript
requestForegroundPermission(): Promise<boolean>
// expo-location foreground permission

requestBackgroundPermission(): Promise<boolean>
// expo-location background permission (Android: accès permanent)
```

L'onboarding `PermissionsScreen` guide l'utilisateur à accorder les deux permissions.

## Localisation foreground

```typescript
getCurrentLocation(): Promise<Coordinates | null>
// Lecture GPS ponctuelle (HIGH_ACCURACY)

watchForegroundLocation(onLocationUpdate: (coords: Coordinates) => void): Promise<LocationSubscription | null>
// Flux continu d'updates (seuil: 10m OU ≥ 10m de déplacement)
```

**LocationContext** appelle `watchForegroundLocation` au montage si la permission est accordée. Les mises à jour sont synchronisées dans `state.current`.

## Tracking background

```typescript
startBackgroundLocationTracking(): Promise<boolean>
// Démarre la tâche Expo Task Manager
// Notification foreground-service affichée (Android)
// Updates: 10m minimum, 1000ms minimum

stopBackgroundLocationTracking(): Promise<void>
// Arrête la tâche
```

## Tâche background (`src/tasks/backgroundLocation.ts`)

```
Pour chaque mise à jour de position :
1. Récupère les messages non lus de l'utilisateur courant
2. Pour chaque message avec une location :
   a. Parse le format PostGIS "POINT(lon lat)" → Coordinates
   b. Calcule la distance avec calculateDistance()
   c. Si distance ≤ 300m ET pas encore notifié (Set en mémoire) :
      → notifyNearbyMessage(messageId, senderName)
      → Ajoute l'ID au Set des messages notifiés
3. Gestion d'erreur silencieuse (log uniquement)
```

**Contrainte** : Le Set `notifiedMessages` est en mémoire — il se réinitialise à chaque kill de l'app. Les messages peuvent re-notifier après redémarrage (comportement acceptable).

## Calcul de distance

```typescript
calculateDistance(point1: Coordinates, point2: Coordinates): number
// Formule Haversine — retourne la distance en mètres

isWithinRadius(
  userLocation: Coordinates,
  targetLocation: Coordinates,
  radiusMeters: number = 100  // 100m par défaut
): boolean
```

## Parsing de localisation PostGIS

Les coordonnées peuvent être stockées sous deux formats :

```typescript
parseLocation(location: any): Coordinates | null

// Format 1 : chaîne PostGIS
"POINT(2.3488 48.8534)" → { longitude: 2.3488, latitude: 48.8534 }

// Format 2 : objet
{ latitude: 48.8534, longitude: 2.3488 } → { latitude: 48.8534, longitude: 2.3488 }
```

> **Note** : Dans le format POINT, l'ordre est `POINT(longitude latitude)` — l'inverse de l'objet Coordinates.

## Contexte location (API publique)

```typescript
const {
  current,     // Coordinates | null — position actuelle
  permission,  // 'granted' | 'denied' | 'undetermined'
  loading,     // boolean

  requestPermission, // () => Promise<boolean>
  startTracking,     // () => Promise<boolean> — background
  refreshLocation,   // () => Promise<void> — forcer une lecture GPS
} = useLocation();
```

## Flux d'initialisation

```
1. LocationProvider monte
2. Vérification permission foreground (expo-location)
3. Si granted → watchForegroundLocation() démarre
4. Updates propagés vers state.current
5. PermissionsScreen propose requestPermission() si needed
6. L'utilisateur peut appeler startTracking() pour le background
```
