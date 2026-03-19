# Spec — Paramètres & Comptes

Couvre trois écrans : `SettingsScreen`, `PrivacyScreen`, `FollowRequestsScreen`.

---

## 1. SettingsScreen

**Route** : `Settings` (stack)
**Fichier** : `src/screens/SettingsScreen.tsx`
**Accès** : bouton ⚙ sur `ProfileScreen` (top-right)

### 1.1 Layout

```
┌─────────────────────────────────────┐
│ ←          Paramètres               │
├─────────────────────────────────────┤
│  👤  Modifier le profil          >  │  ← placeholder (non implémenté)
│  🔔  Notifications               >  │  ← placeholder (non implémenté)
│  🛡  Confidentialité             >  │  → PrivacyScreen
│  ❓  Aide                        >  │  ← placeholder (non implémenté)
├─────────────────────────────────────┤
│  ⎋  Se déconnecter                  │  ← destructive, rouge
│                              v1.x.x │  ← version
└─────────────────────────────────────┘
```

### 1.2 Déconnexion

Tap "Se déconnecter" → `Alert.alert` de confirmation :
```
Annuler (cancel)
Déconnexion (destructive) → signOut() [AuthContext]
```

`signOut()` vide le cache, invalide la session Supabase, et `App.tsx` détecte la perte de session → navigation vers `AuthScreen`.

### 1.3 Navigation

- "Confidentialité" → `navigation.navigate('Privacy')`
- Les autres items sont des placeholders sans action (onPress absent)

### 1.4 Version

Affichée en bas d'écran via `Constants.expoConfig?.version` (Expo Constants).

---

## 2. PrivacyScreen

**Route** : `Privacy` (stack)
**Fichier** : `src/screens/PrivacyScreen.tsx`

### 2.1 Paramètres gérés

| Clé | Label | Description |
|-----|-------|-------------|
| `is_private` | Compte privé | Seuls les abonnés voient les messages publics sur la carte |
| `is_searchable` | Apparaître dans les recherches | Visible dans `SearchUsersScreen` |

### 2.2 Flux de modification

```
Tap toggle
  → setSaving(field)
  → setSettings({ ...settings, [field]: value })  ← optimistic update
  → updatePrivacySetting(userId, field, value)
    → Si ok : setSaving(null)
    → Si échec : revert → setSettings({ ...settings, [field]: !value })
  → setSaving(null)
```

Pendant la sauvegarde : le `Switch` est remplacé par un `ActivityIndicator` pour ce champ.

### 2.3 Effet de `is_private`

Quand `is_private = true` :
- Les messages publics sur la carte ne sont visibles que par les abonnés (RLS Supabase)
- Les demandes d'abonnement passent par `sendFollowRequest` (confirmation manuelle requise)
- Les non-abonnés voient le bouton "Demander" au lieu de "S'abonner"

---

## 3. FollowRequestsScreen

**Route** : `FollowRequests` (stack)
**Fichier** : `src/screens/FollowRequestsScreen.tsx`
**Accès** : bouton "Demandes en attente" sur `ProfileScreen` (top-right, visible si compte privé)

### 3.1 Layout

```
┌─────────────────────────────────────┐
│ ←    Demandes d'abonnement          │
├─────────────────────────────────────┤
│  [Avatar] Nom                [✕][Accepter] │
│  [Avatar] Nom                [✕][Accepter] │
│  ...                                │
│                                     │
│  (vide si aucune demande)           │
└─────────────────────────────────────┘
```

### 3.2 Source de données

`fetchReceivedRequests()` — demandes d'abonnement reçues en attente (`status = 'pending'`).

Rechargement : au montage + pull-to-refresh.

### 3.3 Accepter / Refuser

```
Tap [Accepter] → acceptFollowRequest(request)
  → Si ok : retire la demande de la liste (setRequests(prev.filter(...)))
  → Si échec : aucune action (la demande reste)

Tap [✕] → rejectFollowRequest(request.id)
  → Si ok : retire la demande de la liste
```

Pendant l'action : le bouton est remplacé par `ActivityIndicator` pour cette demande uniquement (`actionLoading === request.id`).

### 3.4 Navigation depuis la liste

Tap sur le nom / avatar → `navigation.navigate('UserProfile', { userId: request.requester_id })`.

### 3.5 État vide

```
[👥 icône]
Aucune demande en attente
```
