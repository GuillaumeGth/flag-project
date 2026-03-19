# Spec — SearchUsersScreen

**Route** : tab `Search` (bottom tab)
**Fichier** : `src/screens/SearchUsersScreen.tsx`

---

## 1. Layout

```
┌─────────────────────────────────────┐
│  [🔍 Rechercher un utilisateur...]  │  ← search bar avec clear ✕
├─────────────────────────────────────┤
│  POPULAIRES  ← section header       │  ← visible si query vide
│  [Avatar] Nom                >      │
│  [Avatar] Nom                >      │
│  ...                                │
│                                     │
│  (ou résultats de recherche)        │
└─────────────────────────────────────┘
```

---

## 2. Deux états de la liste

| État | Condition | Source |
|------|-----------|--------|
| **Top users** (populaires) | `query.trim().length === 0` | `get_top_users_by_followers` RPC (10 utilisateurs max) |
| **Résultats de recherche** | `query.trim().length > 0` | `users` table (filtre `ilike` sur `display_name`, limit 20) |

---

## 3. Recherche par nom

- Filtre : `display_name ILIKE '%{query}%'` (insensible à la casse)
- Exclusions : l'utilisateur courant (`neq('id', currentUserId)`) + utilisateurs non-searchables (`eq('is_searchable', true)`)
- Tri : `display_name ASC`
- **Debounce** : 300ms (`setTimeout` + cleanup dans `useEffect([query])`)

---

## 4. Top users

- RPC Supabase : `get_top_users_by_followers({ limit_count: 10, exclude_user_id })`
- Chargée au montage, une seule fois (`useEffect([currentUserId])`)
- Exclut l'utilisateur courant

---

## 5. Navigation

Tap sur un utilisateur → `navigation.navigate('UserProfile', { userId: item.id })`

---

## 6. Champs affichés

- Avatar (image ou icône `person` si absent)
- Nom (`display_name || 'Utilisateur'`)
- Identifiant secondaire (`phone` ou `email`) si disponible

---

## 7. États vides

| Situation | Affichage |
|-----------|-----------|
| Recherche active, aucun résultat, non-chargement | `[🔍] Aucun utilisateur trouvé` |
| Chargement des résultats | `ActivityIndicator` (seulement si `results.length === 0`) |
| Query vide, top users chargés | Section header "POPULAIRES" |

---

## 8. Ce que cet écran ne fait PAS

- Ne permet pas de suivre directement depuis cet écran (action dans `UserProfileScreen`)
- Ne cherche pas dans les emails/téléphones (uniquement `display_name`)
- N'a pas de pagination (limit 20 pour la recherche, 10 pour les populaires)
