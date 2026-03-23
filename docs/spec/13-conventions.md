# Conventions UI — Fläag

## Règle : pas d'`Alert` ni d'`ActionSheetIOS` natifs

**Interdits dans tout le codebase :**
```ts
// ❌ Ne jamais utiliser
Alert.alert(...)
ActionSheetIOS.showActionSheetWithOptions(...)
```

Ces composants natifs sont visuellement incohérents avec le design glassmorphism de l'app.

---

## Composant `OptionsModal`

**Pour toute action de type confirmation, menu contextuel ou choix destructif, utiliser `OptionsModal` :**

```tsx
import OptionsModal from '@/components/OptionsModal';

<OptionsModal
  visible={showOptions}
  onClose={() => setShowOptions(false)}
  options={[
    {
      label: 'Supprimer',
      icon: 'trash-outline',
      destructive: true,
      onPress: handleDelete,
    },
    {
      label: 'Modifier',
      icon: 'pencil-outline',
      onPress: handleEdit,
    },
  ]}
/>
```

### Props

| Prop | Type | Description |
|------|------|-------------|
| `visible` | `boolean` | Affiche ou masque la modale |
| `options` | `OptionsModalOption[]` | Liste des actions proposées |
| `onClose` | `() => void` | Fermeture (tap overlay ou "Annuler") |

### `OptionsModalOption`

| Champ | Type | Description |
|-------|------|-------------|
| `label` | `string` | Texte de l'option |
| `icon` | `Ionicons name` _(optionnel)_ | Icône à gauche du label |
| `destructive` | `boolean` _(optionnel)_ | Affiche le label en rouge |
| `onPress` | `() => void` | Action déclenchée |

> Le bouton "Annuler" est automatiquement ajouté en bas — ne pas l'inclure dans `options`.

---

## Composant `Toast`

**Pour les feedbacks non-bloquants (succès, erreur, avertissement), utiliser `Toast` :**

```tsx
import Toast from '@/components/Toast';

<Toast
  visible={!!toast}
  message={toast?.message ?? ''}
  type={toast?.type ?? 'success'} // 'success' | 'error' | 'warning'
  onHide={() => setToast(null)}
/>
```

Avec une action optionnelle (ex : "Annuler") :

```tsx
<Toast
  visible={!!toast}
  message="Message supprimé"
  type="success"
  action={{ label: 'Annuler', onPress: handleUndo }}
  onHide={() => setToast(null)}
/>
```

---

## Règle : séparer les styles du composant

Tout fichier écran ou composant non-trivial doit externaliser son `StyleSheet` dans un fichier dédié.

**Convention de nommage :**
```
MonComposant.tsx          → logique + JSX
MonComposant.styles.ts    → StyleSheet uniquement
```

**Structure du fichier `.styles.ts` :**
```ts
// ✅ MonComposant.styles.ts
import { StyleSheet, Dimensions } from 'react-native';
import { colors, spacing, radius, typography } from '@/theme-redesign';

export default StyleSheet.create({
  container: { ... },
});
```

**Import dans le composant :**
```tsx
// ✅ MonComposant.tsx
import styles from './MonComposant.styles';

// Les constantes dérivées (ex: CELL_SIZE) sont exportées depuis le fichier styles
import styles, { CELL_SIZE } from './MonComposant.styles';
```

**Règles :**
- `StyleSheet.create` n'apparaît **jamais** dans un fichier `.tsx`
- Les constantes liées au layout (`Dimensions`, tailles calculées) sont définies dans le fichier `.styles.ts`
- Seuls les styles **inline dynamiques** (dépendant du state ou de props) restent dans le `.tsx` — ex : `{ opacity: fadeAnim }`
- `colors` peut rester importé dans le `.tsx` uniquement pour les props de couleur inline (ex : `color={colors.primary.cyan}` sur une icône)

**Ce qui reste dans le `.tsx` :**
```tsx
// ✅ Style dynamique (dépend du state) — acceptable inline
<Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>

// ✅ Couleur inline sur une icône — acceptable
<Ionicons color={isActive ? colors.primary.violet : colors.text.tertiary} />

// ❌ Bloc StyleSheet dans un .tsx — interdit
const styles = StyleSheet.create({ ... });
```

---

## Règle : utiliser le thème systématiquement

Toute valeur de style doit référencer un token du design system (`@/theme-redesign`) dès qu'un équivalent existe. Les valeurs littérales sont interdites.

**Tokens disponibles :**

```ts
import { colors, spacing, radius, typography, shadows, duration, blur } from '@/theme-redesign';
```

### Couleurs — `colors`

```ts
// ❌ Interdit
backgroundColor: '#0A0A12'
color: '#FFFFFF'
backgroundColor: 'rgba(0,0,0,0.6)'
color: '#FF5C7C'

// ✅ Correct
backgroundColor: colors.background.primary
color: colors.text.primary
backgroundColor: colors.overlay.medium
color: colors.error
```

Référence rapide :

| Valeur | Token |
|--------|-------|
| Fonds principaux | `colors.background.primary/secondary/tertiary` |
| Surfaces glass | `colors.surface.glass/glassLight/glassDark/elevated` |
| Texte | `colors.text.primary/secondary/tertiary/disabled/accent` |
| Violet/cyan | `colors.primary.violet/violetLight/violetDark` |
| Bordures | `colors.border.default/light/accent/glow` |
| Overlays noirs | `colors.overlay.light/medium/dark` |
| États | `colors.success/warning/error/info` |

### Espacements — `spacing`

```ts
// ❌ Interdit
padding: 16
gap: 8
marginHorizontal: 24

// ✅ Correct
padding: spacing.lg      // 16
gap: spacing.sm          // 8
marginHorizontal: spacing.xxl  // 24
```

| Token | Valeur |
|-------|--------|
| `spacing.xs` | 4 |
| `spacing.sm` | 8 |
| `spacing.md` | 12 |
| `spacing.lg` | 16 |
| `spacing.xl` | 20 |
| `spacing.xxl` | 24 |
| `spacing.xxxl` | 32 |

### Rayons — `radius`

```ts
// ❌ Interdit
borderRadius: 9999
borderRadius: 16

// ✅ Correct
borderRadius: radius.full   // éléments circulaires (avatars, boutons icônes)
borderRadius: radius.lg     // cards, inputs
```

| Token | Valeur |
|-------|--------|
| `radius.xs` | 4 |
| `radius.sm` | 8 |
| `radius.md` | 12 |
| `radius.lg` | 16 |
| `radius.xl` | 24 |
| `radius.xxl` | 32 |
| `radius.full` | 9999 |

> Utiliser `radius.full` pour tous les éléments circulaires (avatars, boutons icône) plutôt qu'une valeur calculée comme `borderRadius: width / 2`.

### Typographie — `typography`

```ts
// ❌ Interdit
fontSize: 17
fontSize: 13

// ✅ Correct
fontSize: typography.sizes.lg   // 17
fontSize: typography.sizes.sm   // 13
```

| Token | Valeur |
|-------|--------|
| `typography.sizes.xs` | 11 |
| `typography.sizes.sm` | 13 |
| `typography.sizes.md` | 15 |
| `typography.sizes.lg` | 17 |
| `typography.sizes.xl` | 20 |
| `typography.sizes.xxl` | 24 |
| `typography.sizes.xxxl` | 32 |

### Ombres — `shadows`

```ts
// ❌ Interdit
shadowColor: '#000'
shadowOffset: { width: 0, height: 4 }
shadowOpacity: 0.3
elevation: 4

// ✅ Correct
...shadows.medium
```

| Token | Usage |
|-------|-------|
| `shadows.small` | Boutons, badges |
| `shadows.medium` | Cards, modales |
| `shadows.large` | Bottom sheets |
| `shadows.glow` / `shadows.glowViolet` | Éléments premium avec halo |

### Constantes de taille spécifiques

Les dimensions qui ne correspondent à aucun token (tailles d'avatars, boutons icônes) doivent être déclarées comme constantes nommées en haut du fichier `.styles.ts` — jamais en valeur littérale répétée :

```ts
// ✅ En haut du fichier .styles.ts
const AVATAR_SIZE = 52;
const ACTION_BUTTON_SIZE = 36;

// puis réutilisées
avatar: { width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: radius.full }
```

### Valeurs tolérées sans token

Certaines valeurs n'ont pas d'équivalent dans le thème et peuvent rester littérales :
- `lineHeight` non couverts par le scale
- Positions absolues contextuelles (`top: 50`, `bottom: 60`)
- `borderWidth: 1` et `borderWidth: 0.5`
- `flex: 1`, `width: '100%'`, `height: '100%'`
- `minWidth`, `minHeight` spécifiques à un composant

---

## Résumé

| Cas d'usage | Composant |
|-------------|-----------|
| Menu d'actions / confirmation | `OptionsModal` |
| Feedback succès / erreur | `Toast` |
| ~~Dialogue bloquant~~ | ~~`Alert.alert`~~ ❌ |
| ~~Menu natif iOS~~ | ~~`ActionSheetIOS`~~ ❌ |
