# Spec — Placement de flags admin n'importe où sur la carte

## Contexte

Les utilisateurs normaux ne peuvent placer un message qu'à leur position GPS réelle.
Les administrateurs peuvent placer des messages publics ou privés à **n'importe quelle coordonnée** sur la carte.

---

## Acteurs

| Rôle | Condition | Comportement |
|------|-----------|--------------|
| Utilisateur normal | `is_admin = false` | Placement GPS uniquement (comportement existant) |
| Administrateur | `is_admin = true` | Accès au mode placement + coordonnées custom |

La valeur `is_admin` est lue depuis `public.users` au login (chargée dans `AuthContext`) et exposée via `useAuth().user.is_admin`.

---

## Flux UX

```
MapScreen (admin)
  └─ FAB ★ (bas gauche, admin uniquement)
       │ tap
       ▼
  Mode placement actif
  ├─ Banner : "★ Appuyez sur la carte pour placer le flag"
  ├─ [optionnel] Marqueur de prévisualisation au point tapé
  │
  │ tap sur la carte → { coordinate: { latitude, longitude } }
  ▼
  CreateMessageScreen
  ├─ Badge doré "★ Position admin" + coordonnées affichées
  ├─ Composeur de message (texte / photo / audio)
  │   - Public : sendMessage(null, type, adminLocation, ...)
  │   - Privé  : sendMessage(recipientId, type, adminLocation, ...)
  └─ Retour carte avec toast succès
```

### Annulation du mode placement
- Tap à nouveau sur le FAB ★ → mode désactivé (toggle)
- Navigation vers un autre écran → mode réinitialisé au retour

---

## Marqueur spécial admin

Les messages placés par un admin sont visuellement distincts sur la carte.

### Visuel

| Élément | Valeur |
|---------|--------|
| Bordure | `LinearGradient` doré : `['#FFF9C4', '#FFD700', '#F5A623', '#FFD700']` |
| Taille bordure | 66×66 px (vs 62×62 pour les marqueurs publics) |
| Badge | ★ jaune (#FFD700) en haut à droite, fond doré, bordure blanche |
| Avatar | En mode "Mes Flaags" : avatar du destinataire (déjà géré par `myFlagsAsMapMeta`) |

### Détection

- **Mode explore** : `cluster.isAdminPlaced === true` (propagé depuis `sender.is_admin` DB)
- **Mode mes flaags** : `user?.is_admin === true` (tous les flags de l'admin sont dorés)

### Cascade de styles du marqueur (capture container)

```
isAdminPlaced ?
  → LinearGradient doré + badge ★
  : cluster.isPublic ?
      → LinearGradient violet→bleu
      : → View avec bordure solide (couleur selon état lu/non-lu)
```

---

## FAB admin (★)

Positionné en **bas à gauche** de la carte pour éviter toute confusion avec le FAB régulier (papier avion, bas droite).

| État | Gradient | Glow |
|------|----------|------|
| Idle | `['#3D2B00', '#7A5700', '#4A3500']` (or sombre) | Faible, doré sombre |
| Actif (mode placement) | `['#F5A623', '#FFD700', '#FFF0A0']` (or brillant) | Fort, jaune vif |

Icône : `★` idle → `✕` quand actif.

---

## Données

### Champs impactés

| Fichier | Changement |
|---------|-----------|
| `src/types/index.ts` | `UndiscoveredMessageMapMeta.sender` inclut `is_admin?: boolean` |
| `src/types/navigation.ts` | `CreateMessage` params : `adminLocation?: Coordinates` |
| `src/hooks/useClusteredMarkers.ts` | `MessageCluster.isAdminPlaced: boolean` |
| `src/services/messages.ts` | Requête `fetchUndiscoveredMessagesForMap` — sélectionne `is_admin` du sender |
| `src/contexts/AuthContext.tsx` | `fetchUserProfile()` charge `is_admin` depuis `public.users` |

### Sécurité

- `adminLocation` est **ignoré** si `user.is_admin !== true` dans `CreateMessageScreen`
- La RLS Supabase n'est **pas modifiée** : les messages privés admin passent par la policy existante (abonnement mutuel requis)
- `is_admin` est toujours lu depuis la base de données (jamais depuis un paramètre de navigation)

---

## Tests

| Fichier | Couverture |
|---------|-----------|
| `__tests__/hooks/useClusteredMarkers.test.ts` | 7 cas : `isAdminPlaced` vrai/faux selon le seed, legacy data, clusters mixtes |
| `__tests__/services/messages.test.ts` | 6 cas : `fetchUndiscoveredMessagesForMap` — champ `is_admin` préservé, pruning des lus, fallback cache, merge cache |

---

## Contraintes

- Pas de rebuild natif nécessaire : `MapView.onPress` est disponible nativement
- Le marqueur doré utilise la même technique ViewShot que les marqueurs existants (pas d'animation Reanimated — viewport statique)
- La restriction de proximité pour la **lecture** (100m) s'applique toujours aux destinataires
