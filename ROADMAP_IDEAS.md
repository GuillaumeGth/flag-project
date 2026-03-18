# Fläag — Roadmap & Idées d'Évolution

> Document de référence pour les futures évolutions de l'app. Classé par horizon temporel et priorité.

---

## 1. QUICK WINS VIRAUX (1-2 sprints)

### Capsules Temporelles — P0
- Message programmé pour se "déverrouiller" à une date future + un lieu précis
- Ex : un couple laisse un message à l'endroit de leur premier rendez-vous, lisible dans 1 an
- **Viralité** : les gens partagent l'attente sur les réseaux ("J'ai une capsule qui s'ouvre dans 47 jours...")
- **Technique** : ajouter `unlock_at TIMESTAMPTZ` sur la table `messages`, filtrer côté RLS et côté client

### Streaks de Découverte — P0
- Compteur de jours consécutifs où l'utilisateur découvre au moins 1 flag
- Badges visuels sur le profil (flamme 7j, 30j, 100j...)
- **Viralité** : même mécanique addictive que Snapchat Streaks, mais liée au monde réel
- **Technique** : table `user_streaks` ou colonnes sur `users` (`current_streak`, `longest_streak`, `last_discovery_date`)

### Partage "Mystère" sur les réseaux — P0
- Bouton "Partager ce flag" → génère une image teaser floue avec les coordonnées GPS
- Le destinataire doit installer Fläag et se déplacer physiquement pour lire
- **Viralité** : boucle d'acquisition organique à chaque partage
- **Technique** : deep linking + génération d'image preview côté client ou via Edge Function Supabase

### Réactions Chaînées — P1
- Quand un flag reçoit X réactions, il "brille" sur la carte (marqueur animé doré)
- Crée un effet FOMO : les gens se déplacent pour voir les flags populaires
- **Technique** : compteur `reaction_count` dénormalisé sur `messages`, seuil configurable dans `app_config`

---

## 2. FEATURES DIFFÉRENCIANTES (1-3 mois)

### Chasses au Trésor (Flag Trails) — P1
- Un utilisateur crée une série de flags formant un parcours
- Chaque flag donne un indice vers le suivant
- Classement par temps de complétion
- **Use cases** : tourisme, team building, enterrements de vie, dates originaux
- **Viralité** : les marques et les villes voudront créer leurs propres trails
- **Technique** : table `trails` (id, creator_id, title, description, created_at) + `trail_steps` (trail_id, message_id, step_order) + `trail_completions` (trail_id, user_id, started_at, completed_at)

### Zones Vivantes (Living Zones) — P1
- Certaines zones géographiques deviennent des "forums éphémères" où tous les messages sont visibles 24h
- Ex : un festival, un campus, un quartier le samedi soir
- Les zones populaires apparaissent sur une carte "heatmap"
- **Viralité** : effet réseau local — plus il y a de monde, plus c'est intéressant
- **Technique** : table `living_zones` avec polygon PostGIS, TTL 24h, messages auto-publics dans la zone

### Audio Ambiant / Soundscapes — P2
- Message audio qui se joue automatiquement quand quelqu'un passe à proximité (opt-in)
- Imagine : un musicien laisse un morceau dans la rue, un guide laisse une anecdote devant un monument
- **Différenciation** : aucune app ne fait ça, c'est de la réalité augmentée sonore
- **Technique** : flag `auto_play_audio BOOLEAN` sur messages audio, détection de proximité via background location task

### Flag Collaboratif — P1
- Un flag auquel plusieurs personnes peuvent contribuer (mur collaboratif géolocalisé)
- Chacun ajoute un texte, une photo, un audio
- Ex : un mémorial communautaire, un livre d'or de quartier, un mur d'expression libre
- **Technique** : table `collaborative_flags` + `collaborative_contributions` (flag_id, user_id, content, media_url, created_at)

### Mode Fantôme / Incognito — P2
- Poster un flag totalement anonyme (pas de profil visible)
- Le lecteur peut répondre, mais ne sait pas qui a écrit
- **Viralité** : mystère + intrigue = engagement
- **Technique** : flag `is_anonymous BOOLEAN` sur `messages`, masquer `sender_id` dans les queries RLS pour les lecteurs

---

## 3. VISION LONG TERME (3-6 mois)

### Fläag for Business — P2
- Dashboard web pour les commerces/marques/villes
- Créer des flags sponsorisés (offres, événements, jeux)
- Analytics : combien de personnes ont découvert le flag, taux de réaction
- **Monétisation** : abonnement B2B (seule source de revenus, l'app reste gratuite)
- Ex : un restaurant dépose un flag "Menu secret -30%" → les gens affluent
- **Technique** : app web séparée (Next.js), rôle `business` dans `users`, table `business_analytics`

### Système de Niveaux & Achievements — P2
- XP gagné en déposant, découvrant, réagissant
- Niveaux débloquent des cosmétiques (skins de marqueurs, couleurs de bulles, effets spéciaux)
- Achievements géographiques : "Explorateur de Paris", "Flag dans 5 pays"
- **Monétisation** : cosmétiques premium payants (marqueurs custom, thèmes de profil)
- **Technique** : tables `user_xp`, `achievements`, `user_achievements`, `cosmetics`, `user_cosmetics`

### AR Preview (Réalité Augmentée) — P3
- Pointer la caméra pour voir les flags flotter dans le monde réel
- Phase 1 : simple overlay avec direction + distance
- Phase 2 : rendu 3D du "drapeau" planté dans l'espace
- **Différenciation** : transforme la découverte en expérience immersive
- **Technique** : expo-three ou ViroReact, boussole + gyroscope pour le placement

### API Publique & Intégrations — P3
- API pour que des apps tierces puissent déposer/lire des flags
- Intégration Spotify : partager une chanson géolocalisée
- Intégration événementielle : flags auto-générés pour les événements Eventbrite/Meetup
- **Technique** : Supabase Edge Functions exposées en API REST publique, OAuth2 pour les partenaires

### Fläag Stories (Feed Géo) — P2
- Feed vertical à la TikTok mais filtré par proximité
- On scrolle les flags autour de soi comme des stories
- Algorithme de recommandation basé sur la distance + les réactions + les follows
- **Technique** : nouvel écran `StoriesScreen`, query PostGIS triée par score (distance * recency * reactions)

---

## MATRICE IMPACT / EFFORT

| Feature                | Impact Viral | Effort     | Priorité |
|------------------------|-------------|------------|----------|
| Partage Mystère        | ★★★★★       | Faible     | **P0**   |
| Capsules Temporelles   | ★★★★★       | Moyen      | **P0**   |
| Streaks                | ★★★★        | Faible     | **P0**   |
| Chasses au Trésor      | ★★★★★       | Élevé      | **P1**   |
| Zones Vivantes         | ★★★★        | Moyen      | **P1**   |
| Flags Collaboratifs    | ★★★         | Moyen      | **P1**   |
| Réactions Chaînées     | ★★★         | Faible     | **P1**   |
| Audio Ambiant          | ★★★★        | Moyen      | **P2**   |
| Fläag for Business     | ★★★★★       | Élevé      | **P2**   |
| Niveaux & Achievements | ★★★         | Moyen      | **P2**   |
| Fläag Stories          | ★★★★        | Élevé      | **P2**   |
| Mode Fantôme           | ★★★         | Faible     | **P2**   |
| AR Preview             | ★★★★        | Très élevé | **P3**   |
| API Publique           | ★★★         | Élevé      | **P3**   |

---

## STRATÉGIE RECOMMANDÉE

### Phase 1 — Boucle virale (Sprint immédiat)
**Partage Mystère + Capsules Temporelles + Streaks**

Ces 3 features combinées créent une boucle virale complète :
1. L'utilisateur **crée** (capsule) → motivation émotionnelle
2. L'utilisateur **revient** (streaks) → rétention quotidienne
3. L'utilisateur **invite** (partage mystère) → acquisition organique

### Phase 2 — Engagement & rétention (Mois 2-3)
**Chasses au Trésor + Zones Vivantes + Flags Collaboratifs + Réactions Chaînées**

Diversifier les usages au-delà du messaging 1-to-1, créer des raisons de revenir et d'explorer.

### Phase 3 — Monétisation & scale (Mois 3-6)
**Fläag for Business + Niveaux/Cosmétiques + Stories + Audio Ambiant**

Ouvrir la porte aux revenus B2B et aux achats cosmétiques, tout en gardant l'app 100% gratuite pour les utilisateurs.

### Phase 4 — Innovation (6 mois+)
**AR Preview + API Publique**

Se positionner comme plateforme de réalité augmentée géolocalisée.

---

## MÉTRIQUES CLÉS À SUIVRE

| Métrique | Objectif | Feature liée |
|----------|----------|--------------|
| DAU / MAU ratio | > 40% | Streaks |
| Invitations envoyées / jour | Croissance organique | Partage Mystère |
| Flags créés / utilisateur / semaine | > 3 | Capsules, Collabs |
| Distance moyenne parcourue pour un flag | Engagement physique | Chasses au Trésor |
| Temps moyen dans l'app | > 8 min / session | Stories, Zones Vivantes |
| Taux de conversion install → 1er flag | > 60% | Onboarding |
| Revenue B2B MRR | Viabilité | Fläag for Business |
