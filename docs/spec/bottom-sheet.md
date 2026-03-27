# BottomSheet — Composant partagé

## Rôle

`BottomSheet` est le composant générique d'overlay en bas d'écran utilisé dans toute l'app. Il factorise le pattern récurrent : overlay absolu + backdrop semi-transparent + sheet animée depuis le bas.

**Fichier** : `src/components/BottomSheet.tsx`

## Principe clé : pas de `Modal`

Le composant utilise une `View` en position absolue (`absoluteFillObject`) au lieu d'une `Modal` React Native. Cela permet à la sheet de rester **à l'intérieur du conteneur parent** et donc de ne pas recouvrir la tab bar de navigation.

> **Règle** : toujours rendre `<BottomSheet>` (ou le résultat de `renderOverlay()`) en tant qu'enfant direct du conteneur principal de l'écran (`flex: 1`), jamais à l'intérieur d'un `FlatList` ou `ScrollView`.

## Props

| Prop | Type | Défaut | Description |
|------|------|--------|-------------|
| `visible` | `boolean` | — | Contrôle l'affichage (avec animation) |
| `onClose` | `() => void` | — | Callback au tap sur le backdrop |
| `children` | `ReactNode` | — | Contenu de la sheet |
| `maxHeight` | `ViewStyle['maxHeight']` | `'60%'` | Hauteur max (ignoré si `height` fourni) |
| `height` | `ViewStyle['height']` | — | Hauteur fixe |
| `sheetStyle` | `StyleProp<ViewStyle>` | — | Styles additionnels sur la sheet |
| `hideHandle` | `boolean` | `false` | Masque la barre de handle |

## Animation

- **Ouverture** : `Animated.spring` (damping 20, stiffness 200) — `translateY` de `SCREEN_HEIGHT` vers `0`
- **Fermeture** : `Animated.timing` (280ms) — `translateY` de `0` vers `SCREEN_HEIGHT`, puis démontage (`setRendered(false)`)
- Le composant n'est pas rendu du tout quand `rendered === false` (performance)

## Utilisations

### Profil — Villes visitées & Connexions

Composant : `ProfileStatsRow` + hook `useProfileSheets`

```tsx
// Dans l'écran (ProfileScreen, UserProfileScreen)
const { openCities, openFollowers, renderOverlay } = useProfileSheets({
  cityNames,
  userId: user?.id,
  onPressFollower: (id) => navigation.navigate('UserProfile', { userId: id }),
});

// Dans le JSX — enfant direct du conteneur
<View style={styles.container}>
  {/* ... FlatList ... */}
  {renderOverlay()}
</View>
```

### Carte — Filtres

Composant : `MapFilterModal`

```tsx
<BottomSheet
  visible={visible}
  onClose={onClose}
  height="80%"
  hideHandle
  sheetStyle={styles.sheet}
>
  {/* Contenu des filtres */}
</BottomSheet>
```

Le `MapFilterModal` utilise `hideHandle` car il gère son propre handle dans `sheetBlur`, et `height="80%"` pour occuper plus de place.

## Structure interne

```
overlay (absoluteFillObject, zIndex 100)
├── backdrop (Pressable, absoluteFillObject, rgba noir 0.5)
└── sheetContainer (absoluteFillObject, justifyContent flex-end)
    └── Animated.View (sheet, translateY animé)
        ├── handle (optionnel)
        └── children
```
