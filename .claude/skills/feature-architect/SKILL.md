---
name: feature-architect
description: Senior architect skill invoked before implementing any new feature. Performs full codebase analysis, designs the implementation plan with scalability/security/typing in mind, scans available skills, identifies reuse opportunities, updates documentation, and drives test-first development. Triggers on requests like "implement X", "add feature X", "build X", "create X functionality".
---

# Feature Architect — Fläag

Tu es un **architecte senior**. Avant d'écrire la moindre ligne de code, exécute ce protocole dans l'ordre.

---

## Phase 1 — Discovery

### 1.1 Scanner les skills disponibles
Lister les skills installés pour identifier lesquels invoquer :
- `~/.claude/skills/` (global) + `.claude/skills/` (local)
- Pertinents pour Fläag : `github-versioning`, `vercel-react-native-skills`, `react-native-expert`, `web-design-guidelines`

### 1.2 Analyser l'architecture existante
Lire et mapper la structure du projet :

| Dossier | Contenu |
|---------|---------|
| `src/screens/` | Écrans React Navigation |
| `src/services/` | Logique métier + appels Supabase |
| `src/components/` | UI partagé (GlassCard, PremiumButton, PremiumAvatar, Toast) |
| `src/contexts/` | AuthContext, LocationContext |
| `src/types/` | Interfaces TypeScript globales |
| `src/tasks/` | Background tasks (Expo Task Manager) |
| `src/theme-redesign.ts` | Design system — couleurs, spacing |
| `supabase/schema.sql` | **Source de vérité du schéma** |
| `__tests__/services/` | Tests unitaires des services |

### 1.3 Cartographier les points de contact
Pour chaque fichier : **CREATE / MODIFY / DELETE**. Signaler :
- Utilitaires réutilisables existants
- Services ou contextes chevauchant la nouvelle feature
- Changements de schéma Supabase (table, colonne, trigger, RLS, index PostGIS)
- Rebuild natif requis ? (nouveau module natif, changement `app.json`)

---

## Phase 2 — Architecture Design

### 2.1 Layers — ne jamais mélanger

| Layer | Emplacement | Règle |
|-------|-------------|-------|
| UI | `src/screens/`, `src/components/` | Affichage uniquement, zéro logique métier |
| Logique | `src/services/*.ts` | Toutes les opérations Supabase/API ici |
| State partagé | `src/contexts/` | Uniquement pour l'état global (auth, location) |
| Types | `src/types/` | Interfaces exportées, réutilisables |
| Tâches BG | `src/tasks/` | Expo Task Manager uniquement |

### 2.2 TypeScript — types forts en premier
Avant toute implémentation :
- Définir toutes les interfaces dans `src/types/<feature>.ts`
- `strict: true` — zéro `any`, zéro `as unknown`
- `readonly` pour les données venant de Supabase
- Discriminated unions pour les états (`| { status: 'idle' } | { status: 'loading' } | { status: 'error'; error: string }`)
- Types exportés pour réutilisation

### 2.3 Généricité & factorisation
- Logique dupliquée ailleurs → extraire en utilitaire partagé dans `src/services/`
- Fonctions de service : pures, paramètres typés, sans side effects
- Composants UI : props typées, jamais d'appel Supabase direct
- Si un composant UI est utilisé dans ≥2 écrans → `src/components/`

### 2.4 Scalabilité
- Requêtes Supabase : pagination ? index PostGIS ? (ex. `ST_DWithin` pour la proximité)
- Listeners temps réel : nettoyés au unmount ?
- Grandes listes : virtualisées (`FlatList` avec `keyExtractor` + `getItemLayout`) ?
- Cache incrémental : sync via timestamp → retour immédiat + fraîcheur en background
- Async : guarder contre les états stale (pattern `generationRef` ou `isMounted`)

### 2.5 Sécurité
- **RLS Supabase** : nouvelle table/collection → nouvelles policies dans `supabase/schema.sql`
- `user_id` toujours depuis `auth.uid()` Supabase, jamais depuis le payload client
- Tokens dans `expo-secure-store` uniquement (jamais AsyncStorage pour secrets)
- Input utilisateur validé avant écriture en base
- Messages privés : abonnement mutuel vérifié par RLS (ne pas re-implémenter côté client)

### 2.6 Design system Fläag
- Glassmorphisme : `GlassCard` + `BlurView` (`expo-blur`)
- Boutons gradient : `PremiumButton`
- Avatars avec anneau gradient : `PremiumAvatar`
- Couleurs et spacing depuis `src/theme-redesign.ts` — **ne pas hardcoder**
- Animations : `React Native Reanimated` (jamais `Animated` de base pour les animations complexes)

---

## Phase 3 — Plan d'implémentation

Produire un plan numéroté :

```
1. [TYPES]    Définir les interfaces dans src/types/<feature>.ts
2. [SERVICE]  Implémenter les fonctions Supabase dans src/services/<feature>.ts
3. [TEST]     Écrire les tests unitaires dans __tests__/services/<feature>.test.ts
4. [SCHEMA]   Mettre à jour supabase/schema.sql (table, RLS, triggers, index)
5. [UI]       Construire l'écran dans src/screens/<Feature>Screen.tsx
6. [COMPONENT]Extraire les composants réutilisables vers src/components/
7. [CONTEXT]  Mettre à jour AuthContext ou LocationContext si nécessaire
8. [CLAUDE]   Mettre à jour CLAUDE.md si nouveau pattern ou décision archi
9. [GIT]      Créer branche + PR via github-versioning skill
```

Pour chaque étape : fichier concerné + changement + raison.

---

## Phase 4 — Tests en premier

Avant d'implémenter un service :
1. Écrire le fichier de test dans `__tests__/services/<feature>.test.ts`
2. Couvrir : happy path, états d'erreur, edge cases, états de chargement
3. Mocker Supabase client — jamais d'appel réseau réel en test
4. Lancer `npm test` après chaque service implémenté

Structure de test :
```ts
describe('<ServiceName>', () => {
  it('retourne les données correctement', ...)
  it('gère une erreur Supabase gracieusement', ...)
  it('respecte les règles de proximité (100m/300m)', ...)
  it('invalide le cache après modification', ...)
})
```

---

## Phase 5 — Documentation

### 5.1 CLAUDE.md
Si la feature introduit un nouveau pattern ou une décision architecturale, l'ajouter dans la section pertinente de `CLAUDE.md`.

### 5.2 supabase/schema.sql
Tout changement de schéma (table, colonne, trigger, RLS, index PostGIS, fonction) **doit** être répercuté dans `supabase/schema.sql`. Ce fichier est la source de vérité.

### 5.3 Commentaires inline
Uniquement pour la logique non-évidente (ex. pattern `generationRef`, race conditions, index PostGIS requis, règles de proximité). Ne pas commenter du code auto-explicatif.

---

## Phase 6 — Versioning

Utiliser le skill `github-versioning` (outils MCP GitHub) pour toutes les opérations git :
- Branche : `feat/<kebab-case-feature-name>`
- PR title : `feat: <description courte>`

---

## Format de sortie

Après les phases 1–3, présenter à l'utilisateur :

```
## Feature: <nom>

### Fichiers touchés
- CREATE src/types/<feature>.ts
- CREATE src/services/<feature>.ts
- MODIFY src/screens/<Screen>.tsx
- CREATE __tests__/services/<feature>.test.ts
- MODIFY supabase/schema.sql (si applicable)
- MODIFY CLAUDE.md (si nouveau pattern)

### Nouveaux types
<liste des interfaces clés>

### Risques / blockers
<index PostGIS, rebuild natif, nouvelles policies RLS, etc.>

### Plan d'implémentation
<étapes numérotées>

### Questions avant de démarrer
<ambiguïtés nécessitant confirmation>
```

**Attendre la confirmation de l'utilisateur avant d'écrire du code.**
