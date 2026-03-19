# Spec — Visualisation des propres Flaags sur la carte

## Contexte

Avant cette feature, la carte n'affichait que les flags des autres utilisateurs (mode découverte). L'utilisateur n'avait aucun moyen de visualiser ses propres flags envoyés directement sur la carte.

---

## Vue d'ensemble

Ajout d'un **mode carte "Mes Flaags"** accessible via un toggle pill en haut de la carte. Ce mode affiche les flags envoyés par l'utilisateur courant, avec visualisation du contenu et accès rapide à la conversation associée.

---

## Fonctionnalités

### 1. Toggle mode carte (MapModePill)

- **Position** : centré en haut de l'écran, sous la safe area
- **Design** : glassmorphism (BlurView + bordure subtile), deux segments pill
- **Mode Explorer** (défaut) : comportement carte inchangé, flags des autres à découvrir
- **Mode Mes Flaags** : affiche uniquement les flags envoyés par l'utilisateur courant

Switching de mode :
- Efface la sélection en cours (`selectedMessage`, `selectedOwnFlag`)
- Efface l'itinéraire actif
- Déclenche le chargement des flags (`loadFlags`) au premier switch vers "mine"

---

### 2. Chargement des données (fetchMyFlagsForMap)

Requête Supabase :
- `sender_id = currentUser`
- `location IS NOT NULL`
- Champs récupérés : `id`, `location`, `created_at`, `is_public`, `content_type`, `text_content`, `media_url`, `recipient_id`, join `recipient (id, display_name, avatar_url)`
- Tri : `created_at DESC`

Type : `OwnFlagMapMeta`

```ts
interface OwnFlagMapMeta {
  id: string;
  location: string | Coordinates;
  created_at: string;
  is_public: boolean;
  content_type: MessageContentType;
  text_content?: string | null;
  media_url?: string | null;
  recipient_id: string | null;
  recipient?: Pick<User, 'id' | 'display_name' | 'avatar_url'> | null;
}
```

---

### 3. Marqueurs sur la carte

**Clustering** : réutilise `useClusteredMarkers` (rayon 50m).

Tous les flags ont le même `sender.id` (utilisateur courant) → regroupement purement géographique, indépendant du destinataire.

**Avatar affiché sur le marqueur** :
- Flag privé → avatar du destinataire (`recipient.avatar_url`)
- Flag public → avatar de l'utilisateur courant
- Fallback : avatar de l'utilisateur courant si le destinataire n'a pas d'avatar

Le cluster utilise l'avatar du flag le plus récent dans la zone (seed = premier message, liste triée par `created_at DESC`).

**Style du marqueur** :
- Anneau amber (`#F59E0B`) — distingue visuellement les marqueurs "mine" des marqueurs "explore"
- Pastille violet solide avec le nombre de flags groupés (utilise `backgroundColor` au lieu de `LinearGradient` pour garantir le rendu lors de la capture via `react-native-view-shot`)

**Invalidation du cache d'avatars** : à chaque rechargement de `myFlags`, les entrées correspondantes dans `avatarImages` sont effacées via `clearAvatarImages`, forçant une nouvelle capture avec les avatars à jour.

---

### 4. Carte de détail (OwnFlagCard)

Affichée en bas à gauche lors du tap sur un marqueur "mine" (même position que `SelectedMessageCard`).

**Layout** :
```
[ Nom du destinataire › ]  [ date ]     [ Public ]  [ X ]
[ contenu : texte / photo / audio ]
```

- **Nom du destinataire** : cliquable (cyan + chevron) → navigue vers la conversation avec scroll sur le message
- **Badge "Public"** : affiché uniquement pour les flags publics (pas de badge "Privé")
- **Date** : sur la même ligne que le nom du destinataire
- **Contenu texte** : ScrollView, max 100px de hauteur
- **Contenu photo** : aperçu image pleine largeur, hauteur 140px, border radius
- **Contenu audio** : bouton play/pause (`AudioPlayerButton`) avec lecture inline via `expo-av`, arrêt automatique à la fermeture de la carte ou au changement de flag

---

### 5. Navigation vers la conversation (Option C)

#### Depuis la carte (OwnFlagCard)
- Tap sur le nom du destinataire → `navigation.navigate('Conversation', { otherUserId, otherUserName, scrollToMessageId: flagId })`
- Le `ConversationScreen` scrolle automatiquement vers le message ciblé après chargement

#### Depuis le profil (ProfileScreen)
- Bouton "Voir sur la carte" → `navigation.navigate('Map', { messageId: flag.id, mine: true })`
- La carte s'ouvre en mode "Mes Flaags", charge les flags, centre sur le flag ciblé et affiche l'`OwnFlagCard`

---

### 6. Modal de cluster (ClusterPickerModal)

Affiché quand plusieurs flags sont regroupés au même endroit (tap sur marqueur avec pastille).

En mode "Mes Flaags" :
- Le titre affiche le nom de l'utilisateur courant + "N Flaags au même endroit"
- Chaque ligne affiche le **nom du destinataire** (via `labelMap`) au lieu de "Flaag 1 / Flaag 2"
- `labelMap` : `Record<string, string>` mappant `flag.id → recipient.display_name` (ou "Public" si flag public)
- Padding bottom respecte la safe area (`spacing.xxl + insets.bottom`)

---

### 7. Scroll vers un message dans ConversationScreen

Nouveau param de navigation : `scrollToMessageId?: string`

Comportement : quand `scrollToMessageId` est fourni, le screen scrolle vers ce message via `handleScrollToMessage` (existant) après le chargement initial, au lieu de scroller vers le bas.

---

## Fichiers créés

| Fichier | Description |
|---|---|
| `src/hooks/useMyFlags.ts` | Charge et expose les flags de l'utilisateur courant |
| `src/components/map/MapModePill.tsx` | Toggle glassmorphism Explorer / Mes Flaags |
| `src/components/map/OwnFlagCard.tsx` | Carte de détail d'un flag personnel |

## Fichiers modifiés

| Fichier | Changement |
|---|---|
| `src/types/index.ts` | Ajout `OwnFlagMapMeta` |
| `src/types/navigation.ts` | `Map` params : `mine?: boolean` — `Conversation` params : `scrollToMessageId?: string` |
| `src/services/messages.ts` | Ajout `fetchMyFlagsForMap()` |
| `src/hooks/useMapMarkers.ts` | Ajout `clearAvatarImages(ids)` |
| `src/hooks/useClusteredMarkers.ts` | `CLUSTER_RADIUS_M` 30 → 50 |
| `src/screens/MapScreen.tsx` | Intégration complète du mode mine |
| `src/screens/ProfileScreen.tsx` | "Voir sur la carte" navigue avec `mine: true` + `messageId` |
| `src/screens/ConversationScreen.tsx` | Gestion du param `scrollToMessageId` |
| `src/components/map/ClusterPickerModal.tsx` | Prop `labelMap`, safe area bottom |
