# Spec — MapScreen

**Route** : tab `Map` (bottom tab)
**Fichier** : `src/screens/MapScreen.tsx`

---

## 1. Vue d'ensemble

La carte est l'écran central de l'app. Elle a trois modes : `explore` (messages des autres), `mine` (propres flags envoyés), et un sous-mode admin de placement de flag.

```
┌─────────────────────────────────────┐
│  [mode pill: Explore | Mine]        │  ← top-center
│                                     │
│   [Marqueurs clusterisés]           │  ← react-native-maps
│                                     │
│         [User dot bleu]             │  ← position GPS
│                                     │
│  [★ FAB admin]   [✈ FAB créer]     │  ← bottom-left / bottom-right
│  [⊕ tracking]                      │  ← bottom-left (en-dessous de ★)
│                                     │
│  [SelectedMessageCard]              │  ← slide depuis le bas si sélectionné
└─────────────────────────────────────┘
```

---

## 2. Modes de carte

### 2.1 Mode `explore` (défaut)

- Affiche les messages **non-découverts** des autres utilisateurs (`fetchUndiscoveredMessagesForMap`)
- Les marqueurs n'exposent **pas** le contenu (privacy : uniquement métadonnées pour affichage)
- Les propres messages de l'utilisateur sont exclus (`sender.id !== user.id`)

### 2.2 Mode `mine`

- Affiche les propres flags envoyés (`useMyFlags`)
- Chaque marqueur montre : identité du destinataire (compte privé) ou "Public"
- Les flags admin sont dorés (`ADMIN_GOLD_GRADIENT`)
- Le marqueur montre l'état lu/non-lu via `ownFlagReadMap`

### 2.3 Changement de mode

```
Tap pill "Explore" → setMapMode('explore') → reset sélections + route
Tap pill "Mine"    → setMapMode('mine')    → loadFlags() + reset sélections + route
```

---

## 3. Clustering dynamique (zoom-aware)

Formule du rayon de cluster :
```
clusterRadius = clamp(latDelta × 111000 × 0.06, 20, 15000)
```
- `latDelta` : niveau de zoom courant de la carte (mis à jour par `onRegionChangeComplete`)
- `111000` : mètres par degré de latitude
- `0.06` : fraction de hauteur visible utilisée comme rayon
- Clamp : minimum 20m, maximum 15 000m

Les clusters sont calculés par `useClusteredMarkers(messages, clusterRadius, isOwn)`.

Si un cluster contient **plusieurs** messages : tap → `ClusterPickerModal` (liste des messages dans le cluster). Sélectionner un item → selectionne ce message.

Si un cluster contient **un seul** message : tap → sélectionne directement ce message.

---

## 4. Tracking mode

Le tracking fait suivre la carte à la position GPS de l'utilisateur.

| Action | Effet |
|--------|-------|
| Montage de l'écran | `isTracking = true` → la carte suit le GPS |
| L'utilisateur déplace la carte manuellement | `onPanDrag` → `setIsTracking(false)` → la carte ne suit plus |
| Tap sur le bouton de re-centrage | `centerOnUser()` → `setIsTracking(true)` → la carte re-suit |

**Anti-rebond** : `isProgrammaticMove` (ref) est mis à `true` pendant 1500ms lors de chaque animation programmatique (`animateToRegion`, `fitToCoordinates`), pour empêcher que le déplacement programmatique ne déclenche le `onPanDrag` et n'éteigne le tracking.

**Animation du bouton tracking** : deux anneaux radar animés en boucle (ping staggeré de 1400ms) quand `isTracking = true`. Arrêtés quand `isTracking = false`.

---

## 5. Sélection d'un message (mode explore)

```
Tap marqueur
  → setSelectedMessage(message)
  → Animated.spring : SelectedMessageCard slide depuis le bas (translateY 200→0, opacity 0→1)
  → La carte s'anime vers la position du message si centeredMessageId est défini

SelectedMessageCard affiche :
  - Avatar + nom de l'expéditeur
  - Distance formatée (ex. "120m", "1.2km")
  - Indicateur "Vous êtes à portée" si distance < 100m
  - Bouton "Lire ce fläag" (si à portée) → ReadMessageScreen
  - Bouton "Itinéraire" → fetchRoute() → Polyline sur la carte
  - Bouton fermer → reset selectedMessage + route
```

**Condition de lecture** (`canReadMessage`) : `distance <= 100m`. Vérifié en temps réel via le GPS.

---

## 6. Sélection d'un flag (mode mine)

```
Tap marqueur
  → setSelectedOwnFlag(flag)
  → OwnFlagCard slide depuis le bas

OwnFlagCard affiche :
  - Destinataire ou "Public"
  - Statut : ouvert (is_read=true) ou fermé (is_read=false)
  - Bouton "Voir la conversation" (flags privés uniquement) → ConversationScreen (scrollToMessageId: flagId)
  - Bouton fermer
```

---

## 7. Itinéraire (routing)

```
Tap "Itinéraire" sur SelectedMessageCard
  → fetchRoute(destination, messageId)
  → Appel OSRM : https://router.project-osrm.org/route/v1/walking/...
  → Timeout 10s (AbortController)
  → setRouteCoordinates(coords) → Polyline dessinée sur la carte
  → mapRef.fitToCoordinates() pour afficher le tracé complet
  → selectedMessage = null (la card disparaît)

Tap "×" sur le bouton route → clearRoute()
```

Erreurs : toast affiché en bas (`'Impossible de calculer l\'itinéraire'` ou timeout).

---

## 8. Mode placement admin (★)

Visible uniquement si `user?.is_admin === true`.

```
État idle :
  FAB ★ (gradient sombre) en bas à gauche

Tap FAB ★
  → isAdminPlacementMode = true
  → Banner "Placer ici" visible au-dessus de la carte
  → Pin fixe au centre de l'écran (la carte se déplace en dessous)
  → FAB ★ devient doré (ADMIN_FAB_GRADIENT_ACTIVE)
  → FAB "Envoyer" remplace le FAB créer

Tap "Envoyer" (FAB principal en mode placement)
  → handleAdminSend()
  → mapCenterCoords récupéré (ou userLocation en fallback)
  → isAdminPlacementMode = false
  → navigation.navigate('CreateMessage', { adminLocation: coords })
```

`mapCenterCoords` est mis à jour par `onRegionChangeComplete` — il suit donc le centre géographique de la carte en temps réel pendant que l'utilisateur fait glisser la carte.

---

## 9. Navigation params entrants

| Paramètre | Effet |
|-----------|-------|
| `toast: { message, type }` | Affiche un toast, puis `setParams({ toast: undefined })` |
| `refresh: true` | `loadMessages()`, puis `setParams({ refresh: undefined })` |
| `messageId` (sans `mine`) | Mode explore : centre sur ce message, le sélectionne |
| `messageId` + `mine: true` | Mode mine : centre sur ce flag, le sélectionne |
| `focusLocation: Coordinates` | Centre la carte sur ces coordonnées, affiche un marqueur "focus" violet |
| `mine: true` (sans messageId) | Bascule en mode mine |

---

## 10. Permissions GPS

Au montage, si `permission !== 'granted'` → `requestPermission()`.

Si la permission est refusée définitivement :
- Un overlay de demande est affiché (`PermissionsScreen`-like)
- Bouton "Activer" → `Linking.openSettings()`

---

## 11. Marqueurs

### Marqueurs explore

Composant `MessageMarker` (wrapper natif `react-native-maps Marker` avec `image={{ uri }}`).

- Avatar circulaire capturé via `ViewShot` (`captureAvatar()`)
- Couleur fallback : `colorForUserId(userId)` (couleur déterministe)
- Initiales : `initialsForName(displayName)`
- Badge doré ★ si `isAdminCluster && count === 1`
- Badge de compteur si cluster > 1

### Marqueurs mine

Même rendu, mais le "sender" est remappé : pour les flags privés, l'identité affichée est celle du **destinataire** (pas de l'expéditeur).

---

## 12. Hooks impliqués

| Hook | Fichier | Usage |
|------|---------|-------|
| `useMapMessages` | `src/hooks/useMapMessages.ts` | Fetch + cache des messages non-découverts |
| `useMapMarkers` | `src/hooks/useMapMarkers.ts` | Avatars capturés, `canReadMessage`, `formatDistance` |
| `useMyFlags` | `src/hooks/useMyFlags.ts` | Propres flags envoyés |
| `useClusteredMarkers` | `src/hooks/useClusteredMarkers.ts` | Clustering spatial |
| `useLocation` | `src/contexts/LocationContext` | GPS temps réel |

---

## 13. Ce que cet écran ne fait PAS

- Ne charge pas le **contenu** des messages (texte, photo, audio) — uniquement la métadonnée carte
- Ne filtre pas les messages par découverte pour les afficher sur la carte (tous les non-découverts sont affichés)
- N'applique pas la RLS côté client — elle est gérée par Supabase
