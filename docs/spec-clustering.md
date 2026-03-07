# Spec — Clustering dynamique des marqueurs carte

## Contexte

La carte peut afficher un grand nombre de marqueurs proches les uns des autres. Sans regroupement, les marqueurs se chevauchent et la carte devient illisible. Le clustering résout ce problème en fusionnant les marqueurs proches en un seul avec une pastille de comptage.

---

## Algorithme

**Greedy single-linkage clustering** — complexité O(n²), suffisant pour les volumes attendus (quelques centaines de marqueurs max).

```
Pour chaque message non encore assigné (seed) :
  1. Créer un nouveau cluster dont le représentant est le seed
  2. Parcourir les messages restants
  3. Si distance(seed, message) ≤ clusterRadius → ajouter au cluster
  4. Sinon → garder dans la liste des non-assignés
  5. Répéter jusqu'à épuisement de la liste
```

**Propriétés du cluster produit** :
- `id` = ID du message seed (premier message non assigné de l'itération)
- `location` = coordonnées du seed
- `senderAvatarUrl` = avatar du sender du seed
- `isPublic` = `true` si au moins un message du cluster est public

---

## Rayon dynamique selon le zoom

Le rayon de regroupement s'adapte au niveau de zoom courant de la carte afin que les clusters restent visuellement cohérents quelle que soit l'échelle.

**Formule** :
```
clusterRadius = clamp(latitudeDelta × 111 000 × 0.10, 20, 15 000)
```

| `latitudeDelta` | Rayon effectif |
|---|---|
| 0.002 (très zoomé) | 20 m (minimum) |
| 0.009 (zoom défaut) | ~100 m |
| 0.05 | ~555 m |
| 0.4 (vue régionale) | ~4 400 m |
| 3.0 (vue nationale) | ~15 000 m (maximum) |

**Source** : `onRegionChangeComplete` de `MapView` — déclenché quand l'utilisateur arrête de zoomer/dézoomer. Met à jour `latDelta` dans `MapScreen`, qui recalcule `clusterRadius` via `useMemo`, qui à son tour recompute les clusters.

**Constantes** (`MapScreen.tsx`) :
```ts
const LAT_DEG_TO_METERS = 111_000;
const CLUSTER_RATIO     = 0.10;
const MIN_CLUSTER_RADIUS = 20;
const MAX_CLUSTER_RADIUS = 15_000;
```

---

## Modes de regroupement

`useClusteredMarkers` / `clusterMessages` acceptent un paramètre `groupBySender: boolean`.

### `groupBySender: false` — mode Explorer (défaut)

Clustering **purement spatial** : des messages de senders différents peuvent être fusionnés s'ils sont géographiquement proches.

Usage : affichage des messages à découvrir sur la carte (`otherMessages`).

### `groupBySender: true` — mode Mes Flaags

Les messages sont d'abord **partitionnés par `sender.id`**, puis chaque groupe subit un clustering spatial indépendant. Deux messages de senders (= destinataires) différents ne sont jamais fusionnés.

Usage : affichage des flags envoyés par l'utilisateur courant (`myFlagsAsMapMeta`), où l'on veut que chaque destinataire reste visuellement distinct.

---

## Pipeline de capture des marqueurs

Les marqueurs de la carte sont des images PNG capturées hors-écran via `react-native-view-shot`. Ce mécanisme est nécessaire car `react-native-maps` n'accepte que des URIs d'images pour les marqueurs personnalisés (`Marker image={{ uri }}`).

### Clé de cache

```
captureKey = `${cluster.id}:${cluster.messages.length}`
```

La clé inclut le nombre de messages pour forcer une nouvelle capture lorsque le cluster grossit ou rétrécit suite à un changement de zoom. Sans ce suffixe, la pastille de comptage affichée serait stale.

### Séquence

```
1. clusters recompute (zoom change ou nouvelles données)
2. CaptureContainer render :
   - si avatarImages[captureKey] existe → skip (déjà capturé)
   - sinon → montre <View ref> hors-écran avec avatar + badge
3. Image.onLoad → setTimeout(100ms) → captureAvatar(captureKey)
4. captureRef() → URI tmpfile → setAvatarImages({ ...prev, [captureKey]: uri })
5. Re-render → MessageMarker reçoit avatarUri → marqueur visible sur la carte
```

### Contrainte LinearGradient

En mode Mes Flaags, la pastille de comptage utilise un `<View>` avec `backgroundColor: colors.primary.violet` **et non** un `LinearGradient`. `LinearGradient` ne rend pas à temps pour la capture `captureRef`, produisant une pastille transparente.

---

## API publique

### `clusterMessages` (fonction pure)

```ts
function clusterMessages(
  messages: UndiscoveredMessageMapMeta[],
  clusterRadius?: number,   // défaut : CLUSTER_RADIUS_M (50)
  groupBySender?: boolean,  // défaut : false
): MessageCluster[]
```

Fonction pure exportée, testable sans contexte React.

### `useClusteredMarkers` (hook)

```ts
function useClusteredMarkers(
  messages: UndiscoveredMessageMapMeta[],
  clusterRadius?: number,
  groupBySender?: boolean,
): MessageCluster[]
```

Wrapper `useMemo` autour de `clusterMessages`. Se recalcule quand `messages`, `clusterRadius` ou `groupBySender` changent.

### `MessageCluster`

```ts
interface MessageCluster {
  id: string;                  // ID du message seed
  messages: UndiscoveredMessageMapMeta[];
  location: Coordinates;       // coordonnées du seed
  senderAvatarUrl: string;     // avatar du sender du seed
  senderId: string;
  isPublic: boolean;           // true si au moins un message est public
}
```

---

## Tests

Fichier : `__tests__/hooks/useClusteredMarkers.test.ts`

21 cas couverts :

| Groupe | Cas |
|---|---|
| Edge cases | entrée vide, sender.id manquant, avatar_url manquant, location null |
| Message unique | produit exactement 1 cluster |
| Spatial (Explorer) | fusion même sender, fusion senders différents, séparation distance, seed id/avatar, badge public, limite de rayon, rayon custom |
| Zoom-aware | séparation à petit rayon, fusion à grand rayon, villes distantes résistantes |
| groupBySender (Mes Flaags) | pas de fusion cross-sender, fusion même sender, isolation totale même position, 3 messages même sender |
| Location | location du cluster = location du seed |

---

## Fichiers concernés

| Fichier | Rôle |
|---|---|
| `src/hooks/useClusteredMarkers.ts` | Algorithme, `clusterMessages`, `useClusteredMarkers` |
| `src/screens/MapScreen.tsx` | Rayon dynamique (`latDelta` → `clusterRadius`), appels avec `groupBySender` |
| `__tests__/hooks/useClusteredMarkers.test.ts` | Tests unitaires |
