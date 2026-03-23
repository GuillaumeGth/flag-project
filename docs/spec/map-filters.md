# Filtres carte — MapScreen

## Vue d'ensemble

Un bouton de filtre permet à l'utilisateur d'affiner les marqueurs visibles sur la carte selon le mode actif. Les filtres sont propres à chaque mode et se réinitialisent automatiquement lors d'un changement de mode.

---

## Bouton filtre

- Icône `options-outline` (Ionicons), positionné en haut à droite, aligné verticalement avec la `MapModePill`
- Style glassmorphique (`colors.surface.glass`, bordure `colors.border.default`, ombre `shadows.small`)
- Un point violet (`colors.primary.violet`) apparaît sur le bouton dès qu'au moins un filtre est actif
- Appui → ouvre `MapFilterModal` (bottom sheet, `animationType="slide"`)

---

## Composants

| Fichier | Rôle |
|---------|------|
| `src/components/map/MapFilterModal.tsx` | Bottom sheet modal — logique + JSX |
| `src/components/map/MapFilterModal.styles.ts` | StyleSheet séparé (conventions `13-conventions.md`) |

---

## Filtres par mode

### Mode Explorer (`mapMode === 'explore'`)

**Filtre disponible : auteurs**

- Liste des auteurs uniques parmi les messages visibles sur la carte (`otherMessages`)
- Chaque auteur est représenté par un chip avec ses initiales et son nom
- Sélection multiple — les chips non sélectionnés restent affichés
- Si aucun auteur sélectionné → tous les messages sont affichés
- Si des auteurs sont sélectionnés → seuls leurs messages sont affichés

**État :**
```typescript
interface ExploreFilters {
  authorIds: string[]; // vide = tout afficher
}
const DEFAULT_EXPLORE_FILTERS: ExploreFilters = { authorIds: [] };
```

**Filtre actif quand :** `authorIds.length > 0`

---

### Mode Mes Flaags (`mapMode === 'mine'`)

**Filtres disponibles : statut lu/non lu + destinataire**

#### Statut (segmented control à 3 positions)

| Valeur | Comportement |
|--------|-------------|
| `'all'` | Tous les flaags (défaut) |
| `'read'` | Uniquement les flaags lus (`is_read === true`) |
| `'unread'` | Uniquement les flaags non lus (`is_read === false`) |

#### Destinataire (chips)

- Un chip par destinataire unique parmi les flaags privés
- Un chip `Public` si l'utilisateur a au moins un flaag public
- Sélection multiple — si vide, tous les destinataires sont affichés
- Le chip `Public` utilise l'identifiant interne `PUBLIC_FLAG_ID = '__public__'`

**État :**
```typescript
interface MineFilters {
  recipientIds: string[]; // vide = tout afficher ; '__public__' = flaags publics
  readStatus: 'all' | 'read' | 'unread';
}
const DEFAULT_MINE_FILTERS: MineFilters = { recipientIds: [], readStatus: 'all' };
```

**Filtre actif quand :** `recipientIds.length > 0 || readStatus !== 'all'`

---

## Flux de données

```
myFlags / messages (raw)
  └─ filteredMyFlags / filteredOtherMessages  (useMemo — applique les filtres)
        └─ myFlagsAsMapMeta                   (useMemo — conversion de shape)
              └─ useClusteredMarkers          (hook — clustering)
                    └─ ownClusters / clusters  (rendu carte)
```

Les hooks `useClusteredMarkers` reçoivent directement les données déjà filtrées. Le clustering s'adapte donc automatiquement aux filtres actifs.

Les memos `ownFlagLabelMap` et `ownFlagReadMap` (utilisés pour les badges cluster et les cartes de sélection) sont également calculés sur `filteredMyFlags`.

---

## Réinitialisation

- **Changement de mode** (`handleModeSwitch`) : les deux états de filtre sont réinitialisés à leurs valeurs par défaut
- **Bouton "Réinitialiser"** dans la modal : visible uniquement si au moins un filtre est actif — réinitialise le filtre du mode courant

---

## Exports publics de `MapFilterModal.tsx`

| Export | Type | Usage |
|--------|------|-------|
| `FilterPerson` | interface | `{ id, display_name? }` — auteur ou destinataire |
| `ExploreFilters` | interface | État des filtres explore |
| `MineFilters` | interface | État des filtres mine |
| `PUBLIC_FLAG_ID` | `'__public__'` | Identifiant du chip "Public" |
| `DEFAULT_EXPLORE_FILTERS` | constante | Valeur initiale explore |
| `DEFAULT_MINE_FILTERS` | constante | Valeur initiale mine |
| `isExploreFiltersActive` | fonction | `(f) => boolean` |
| `isMineFiltersActive` | fonction | `(f) => boolean` |
| `default` | composant | `MapFilterModal` |
