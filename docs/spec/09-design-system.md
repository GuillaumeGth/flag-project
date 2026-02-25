# 09 — Design system

## Vue d'ensemble

Le design system de Fläag est basé sur le **glassmorphisme** — surfaces semi-transparentes, flou de fond, dégradés violets et effets lumineux.

Source de vérité : `src/theme-redesign.ts`

> **Règle** : Toutes les valeurs visuelles (couleurs, spacing, radius, typographie) doivent venir de ce fichier. Zéro valeur hardcodée dans les composants.

## Palette de couleurs

### Arrière-plans
| Token | Valeur | Usage |
|-------|--------|-------|
| `colors.bg.primary` | `#0A0A12` | Fond principal (deep space) |
| `colors.bg.secondary` | `#12121D` | Fond secondaire |
| `colors.bg.tertiary` | `#1A1A28` | Fond tertiaire |
| `colors.bg.elevated` | `#1E1E2D` | Surfaces élevées (cards sans blur) |

### Surfaces glassmorphiques
| Token | Valeur | Usage |
|-------|--------|-------|
| `colors.surface.glass` | `rgba(30,30,45,0.7)` | GlassCard standard |
| `colors.surface.glassLight` | `rgba(42,42,60,0.5)` | Surface légère |
| `colors.surface.glassDark` | `rgba(20,20,32,0.85)` | Surface sombre |

### Palette primaire (violet)
| Token | Valeur |
|-------|--------|
| `colors.primary.violet` | `#A78BFA` |
| `colors.primary.violetLight` | `#C4B5FD` |
| `colors.primary.violetDark` | `#7C3AED` |

### Couleurs sémantiques
| Token | Valeur | Usage |
|-------|--------|-------|
| `colors.semantic.success` | `#5FD68A` | Confirmations |
| `colors.semantic.warning` | `#FFA94D` | Avertissements |
| `colors.semantic.error` | `#FF5C7C` | Erreurs |
| `colors.semantic.info` | `#A78BFA` | Informations |

### Hiérarchie de texte
| Token | Valeur | Usage |
|-------|--------|-------|
| `colors.text.primary` | `#FFFFFF` | Texte principal |
| `colors.text.secondary` | `#B8B8D0` | Texte secondaire |
| `colors.text.tertiary` | `#7A7A95` | Texte tertiaire / labels |
| `colors.text.disabled` | `#4A4A5C` | Texte désactivé |
| `colors.text.accent` | `#A78BFA` | Texte mis en valeur |

### Dégradés
| Token | Couleurs |
|-------|----------|
| `colors.gradients.primary` | `['#A78BFA', '#7C3AED']` |
| `colors.gradients.discovery` | `['#D8B4FE', '#A78BFA', '#7C3AED']` |
| `colors.gradients.heroButton` | Cascade 7 tons violet |
| `colors.gradients.glow` | Violet glow radial |

## Spacing

| Token | Valeur |
|-------|--------|
| `spacing.xs` | 4px |
| `spacing.sm` | 8px |
| `spacing.md` | 12px |
| `spacing.lg` | 16px |
| `spacing.xl` | 20px |
| `spacing.xxl` | 24px |
| `spacing.xxxl` | 32px |

## Border radius

| Token | Valeur |
|-------|--------|
| `radius.xs` | 4px |
| `radius.sm` | 8px |
| `radius.md` | 12px |
| `radius.lg` | 16px |
| `radius.xl` | 24px |
| `radius.xxl` | 32px |
| `radius.full` | 9999px (cercle) |

## Typographie

Famille : SF Pro Display (iOS) / Google Sans (Android) — font système.

| Token | Taille | Poids | Usage |
|-------|--------|-------|-------|
| `typography.xs` | 11px | 400 | Labels micro |
| `typography.sm` | 13px | 400 | Captions |
| `typography.md` | 15px | 400 | Corps de texte |
| `typography.lg` | 17px | 600 | Sous-titres |
| `typography.xl` | 20px | 600 | Titres secondaires |
| `typography.xxl` | 24px | 700 | Titres principaux |
| `typography.display` | 40px | 700 | Hero / onboarding |

## Ombres

| Token | Description |
|-------|-------------|
| `shadows.small` | Légère élévation |
| `shadows.medium` | Élévation standard (0.3 opacité) |
| `shadows.large` | Forte élévation |
| `shadows.glow` | Lueur violette douce |
| `shadows.glowViolet` | Lueur violette intense |

## Durées d'animation

| Token | Valeur | Usage |
|-------|--------|-------|
| `animation.fast` | 150ms | Feedbacks immédiats |
| `animation.normal` | 250ms | Transitions standard |
| `animation.slow` | 350ms | Animations expressives |
| `animation.verySlow` | 500ms | Transitions d'écran |

## Composants UI

### `GlassCard` (`src/components/redesign/GlassCard.tsx`)

Conteneur glassmorphique avec BlurView.

```typescript
<GlassCard
  intensity={15}       // Intensité du flou (défaut: 15)
  withBorder={true}    // Bordure accent violet (défaut: true)
  withGlow={false}     // Ombre lumineuse (défaut: false)
  glowColor="violet"   // 'violet' | 'cyan' | 'magenta'
  style={...}
>
  {children}
</GlassCard>
```

Rendu : `BlurView` (expo-blur) + fond `colors.surface.glass` + bordure `colors.primary.violet` à 0.3 opacité.

---

### `PremiumButton` (`src/components/redesign/PremiumButton.tsx`)

Bouton avec 4 variantes et support icône.

```typescript
<PremiumButton
  title="Envoyer"
  onPress={handlePress}
  variant="gradient"          // 'primary' | 'secondary' | 'ghost' | 'gradient'
  size="medium"               // 'small' | 'medium' | 'large'
  icon="send-outline"         // Ionicons glyph
  iconPosition="right"        // 'left' | 'right'
  loading={false}
  disabled={false}
  fullWidth={false}
  withGlow={true}
/>
```

| Variante | Fond | Texte |
|----------|------|-------|
| `primary` | `colors.primary.violet` solide | Blanc |
| `secondary` | Glass + bordure accent | Violet |
| `ghost` | Transparent + bordure légère | Blanc |
| `gradient` | Dégradé `gradients.primary` | Blanc |

---

### `PremiumAvatar` (`src/components/redesign/PremiumAvatar.tsx`)

Avatar circulaire avec anneau dégradé optionnel.

```typescript
<PremiumAvatar
  uri="https://..."           // URL image (optionnel)
  name="Guillaume"            // Pour initiales si pas d'image
  size="medium"               // 'small'(32) | 'medium'(48) | 'large'(64) | 'xlarge'(96)
  withRing={true}             // Anneau dégradé
  ringColor="gradient"        // 'gradient' | 'cyan' | 'violet'
  withGlow={false}
  isBot={false}               // Affiche l'icône flag au lieu des initiales
/>
```

Fallback : 2 initiales extraites de `name` sur fond violet.

---

### `Toast` (`src/components/Toast.tsx`)

Notification in-app animée (slide depuis le haut).

```typescript
<Toast
  visible={showToast}
  message="Message envoyé !"
  type="success"              // 'success' | 'error' | 'warning'
  duration={2500}             // Auto-dismiss en ms (défaut: 2500)
  action={{ label: "Voir", onPress: handleAction }}  // Optionnel
  onHide={() => setShowToast(false)}
/>
```

Animations : `Reanimated` — translateY + opacity. Z-index 9999 (au-dessus de tout).
