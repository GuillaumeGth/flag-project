# 10 — Écrans & flux utilisateur

## Vue d'ensemble

Les écrans sont dans `src/screens/`. Chaque écran est un composant React Navigation. Ils ne font aucun appel Supabase direct — tout passe par les services.

## Écrans

### `AuthScreen`

**Rôle** : Point d'entrée pour les utilisateurs non connectés.

**Flux OTP :**
```
1. Saisie du numéro de téléphone
2. Tap "Envoyer le code" → signInWithPhone()
3. Saisie du code OTP reçu par SMS
4. Tap "Vérifier" → verifyOtp()
5. Succès → navigation automatique vers MainTabs
```

**Flux Google OAuth :**
```
1. Tap "Continuer avec Google"
2. signInWithGoogle() → WebBrowser.openAuthSessionAsync()
3. Authentification dans le navigateur système
4. Redirect → flag://auth/callback → session créée
5. Navigation automatique vers MainTabs
```

---

### `PermissionsScreen`

**Rôle** : Onboarding permissions — affiché une fois après connexion si permissions non accordées.

**Flux :**
```
1. Affichage des cartes explicatives (localisation, notifications)
2. Tap "Autoriser la localisation" → requestForegroundPermission()
3. Tap "Autoriser les notifications" → requestNotificationPermission()
4. Tap "Commencer" → navigation vers MapScreen
```

---

### `MapScreen`

**Rôle** : Carte interactive. Écran principal de l'app (tab Map).

**Contenu de la carte :**
- Position de l'utilisateur (point bleu)
- Marqueurs de messages non découverts (avatar expéditeur ou icône)
- Marqueurs de messages publics des utilisateurs suivis

**Interactions :**
```
Tap sur marqueur → preview card (sender, distance, icône type)
├── Si dans le rayon 100m → bouton "Lire" actif → ReadMessageScreen
└── Si hors rayon → bouton "Trop loin" désactivé, distance affichée

FAB "+" → CreateMessageScreen (avec localisation courante pré-remplie)
```

**Chargement :**
```
1. Cache immédiat → getCachedMapMessages()
2. Background fetch → fetchUndiscoveredMessagesForMap()
3. Merge + mise à jour carte
4. Idem pour fetchFollowingPublicMessages()
```

**Logique de lisibilité :**
```typescript
canReadMessage(messageLocation: Coordinates): boolean
// isWithinRadius(userLocation, messageLocation, 100)
```

---

### `InboxScreen`

**Rôle** : Liste des conversations (threads). Tab Inbox.

**Affichage par conversation :**
- Avatar de l'interlocuteur (PremiumAvatar avec glow si non lus)
- Prévisualisation du dernier message
- Timestamp
- Badge de messages non lus (gradient violet)

**Interactions :**
```
Pull-to-refresh → fetchConversations(forceRefresh)
Tap conversation → ConversationScreen (otherUserId passé en param)
```

**Chargement :**
```
1. Cache immédiat → getCachedConversations()
2. Background fetch → fetchConversations()
```

---

### `ConversationScreen`

**Rôle** : Thread de messages entre deux utilisateurs.

**Paramètres de navigation :** `otherUserId`, `otherUser` (profil)

**Affichage :**
- Messages envoyés : bulle alignée à droite (violet)
- Messages reçus : bulle alignée à gauche (glass)
- Icône de type (texte/photo/audio)
- Timestamp par groupe de messages

**Input area :**
- Champ texte
- Bouton caméra → CreateMessageScreen (mode photo)
- Bouton galerie → image picker
- Bouton micro → enregistrement audio inline

**Chargement :**
```
1. Cache immédiat → getCachedConversationMessages(otherUserId)
2. Background fetch → fetchConversationMessages(otherUserId)
```

---

### `CreateMessageScreen`

**Rôle** : Composer et envoyer un nouveau message.

**Paramètres de navigation (optionnels) :** `recipientId`, `defaultLocation`

**Flux :**
```
1. Sélection destinataire → SelectRecipientScreen (ou pré-rempli)
2. Choix du type : texte / photo / audio
   - Texte : champ de saisie
   - Photo : Expo Camera ou Image Picker
   - Audio : Expo AV (enregistrement)
3. Toggle localisation : message géolocalisé ou non
4. Toggle visibilité : privé (défaut) ou public
5. Tap "Envoyer" :
   a. uploadMedia() si fichier présent
   b. sendMessage() avec tous les paramètres
   c. Retour écran précédent
```

---

### `ReadMessageScreen`

**Rôle** : Lecture complète d'un message (texte, photo, audio).

**Paramètres de navigation :** `messageId`

**Flux :**
```
1. fetchMessageById(messageId)
2. Affichage : avatar expéditeur, nom, timestamp, contenu
   - Texte : texte en clair
   - Photo : image plein écran (zoomable)
   - Audio : lecteur avec play/pause, barre de progression
3. markMessageAsRead(messageId) si pas encore lu
4. Bouton "Répondre ici" → CreateMessageScreen (recipientId pré-rempli)
```

---

### `ProfileScreen`

**Rôle** : Profil de l'utilisateur connecté. Tab Profile.

**Sections :**
- Avatar (tappable → édition)
- Nom affiché (tappable → édition)
- Compteur de followers
- Grille 3 colonnes des messages publics
- Bouton Paramètres
- Bouton Déconnexion

**Flux édition :**
```
Tap avatar ou nom → modal d'édition
├── Avatar : Image Picker → updateAvatar()
└── Nom : champ texte → updateDisplayName()
```

**Flux messages publics :**
```
fetchMyPublicMessages() → grille
Tap message → ReadMessageScreen
```

---

### `UserProfileScreen`

**Rôle** : Profil d'un autre utilisateur.

**Paramètres de navigation :** `userId`

**Sections :**
- Avatar, nom, compteur de followers
- Bouton Follow / Unfollow
- Icône engrenage → modal préférences de notification
- Grille 3 colonnes des messages publics

**Flux follow :**
```
Tap Follow → follow(userId)
Tap Unfollow → unfollow(userId)
État mis à jour via isFollowing()
```

**Modal préférences notification :**
```
fetchNotificationPrefs(userId) → toggles
Toggle → updateNotificationPrefs(userId, { notifyPrivateFlags })
```

---

### `SearchUsersScreen`

**Rôle** : Rechercher un utilisateur par son nom. Tab Search.

**Flux :**
```
1. Saisie dans le champ de recherche (debounce 300ms)
2. Requête Supabase : SELECT ... WHERE display_name ILIKE '%query%'
3. Filtre : exclure l'utilisateur courant
4. Affichage liste de résultats
5. Tap utilisateur → UserProfileScreen
```

---

### `SelectRecipientScreen`

**Rôle** : Sélectionner le(s) destinataire(s) d'un message.

**Flux :**
```
1. fetchFollowedUsers() → liste des utilisateurs suivis
2. Recherche / filtre dans la liste
3. Tap utilisateur → sélection (checkmark)
4. Tap "Confirmer" → retour à CreateMessageScreen avec recipientId
```

---

### `SettingsScreen`

**Rôle** : Paramètres de l'application.

Contenu : preferences, notifications globales, à compléter selon besoins.

## Paramètres de navigation (typage)

```typescript
// RootStackParamList (à documenter dans src/types/)
type RootStackParamList = {
  Auth: undefined;
  Permissions: undefined;
  MainTabs: undefined;
  ReadMessage: { messageId: string };
  CreateMessage: { recipientId?: string; defaultLocation?: Coordinates };
  SelectRecipient: undefined;
  Conversation: { otherUserId: string; otherUser: Pick<User, 'id' | 'display_name' | 'avatar_url'> };
  UserProfile: { userId: string };
  Settings: undefined;
};
```
