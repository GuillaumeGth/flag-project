# Spec — CreateMessageScreen & SelectRecipientScreen

---

## 1. CreateMessageScreen

**Route** : `CreateMessage` (stack)
**Fichier** : `src/screens/CreateMessageScreen.tsx`
**Params** : `{ recipients?, adminLocation? }`

### 1.1 Layout

```
┌─────────────────────────────────────┐
│ ←  Nouveau flag                     │
│ ┌─────────────────────────────────┐ │
│ │ ★ Position admin                │ │  ← visible si adminLocation (admin only)
│ │ 48.85341, 2.34880               │ │
│ └─────────────────────────────────┘ │
│ 🌐 Public          [toggle]         │
│ À : Prénom        >                 │  ← visible si is_public = false
│                                     │
│ [Preview photo ou audio]            │  ← si media sélectionné
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ Votre message...                │ │  ← TextInput multiline
│ └─────────────────────────────────┘ │
│                                     │
│  [Galerie]  [Photo]  [Audio/Stop]   │
│                                     │
│  [        Envoyer        ]          │  ← gradient button
└─────────────────────────────────────┘
```

### 1.2 Modes d'envoi

| Mode | `isPublic` | Destinataire |
|------|-----------|--------------|
| Public | `true` | `null` (visible sur la carte par tous) |
| Privé | `false` | Liste de `recipients` (utilisateurs suivis) |

Le toggle Public/Privé est initialisé à `true` si aucun destinataire reçu en param, `false` sinon.

### 1.3 Localisation

- **Utilisateur standard** : `effectiveLocation = userLocation` (GPS du `LocationContext`)
- **Admin avec adminLocation** : `effectiveLocation = adminLocation` (capturé depuis `MapScreen`)

`adminLocation` est capturé **une seule fois au montage** via `useState(() => ...)` pour être immunisé contre les re-renders causés par les params de navigation (quand `SelectRecipientScreen` navigue en retour avec `{ recipients }`).

Validation au moment de l'envoi : si `effectiveLocation === null` → toast d'erreur `'Position GPS non disponible'`.

### 1.4 Types de contenu

| Type | Déclencheur |
|------|-------------|
| `text` | Saisie dans le TextInput |
| `photo` | Tap "Galerie" (`ImagePicker.launchImageLibraryAsync`) ou "Photo" (caméra, avec permission) |
| `audio` | Tap "Audio" → `startRecording()`. Tap "Stop" → `stopRecording()` → uri enregistré |

Un seul type de média à la fois. Sélectionner un nouveau type remplace l'ancien.

La preview est affichée au-dessus du TextInput :
- Photo : `Image` pleine largeur + bouton ✕ pour supprimer
- Audio : bandeau play/pause + "Audio enregistré" + bouton ✕

### 1.5 Validation avant envoi

```
1. effectiveLocation présent → sinon toast erreur
2. Si !isPublic → recipients.length > 0 → sinon toast "Sélectionnez au moins un destinataire"
3. Si contentType === 'text' → textContent.trim() non vide
4. Si contentType === 'photo' ou 'audio' → mediaUri non null
```

### 1.6 Flux d'envoi

```
handleSend()
  → setLoading(true)
  → uploadMedia(uri, type) si media présent
    → si échec : toast "Échec de l'upload" avec action Réessayer
  → isAdminPlaced = !!adminLocation
  → Si isPublic :
      sendMessage(null, type, location, text, mediaUrl, true, null, isAdminPlaced)
      → navigation.navigate('Main', { screen: 'Map', params: { toast: 'Flag déposé !', mine: true si isAdminPlaced } })
  → Si !isPublic :
      Promise.all(recipients.map(r => sendMessage(r.id, ...)))
      → Compte les succès
      → Toast partiel si successCount < recipients.length
      → navigation.navigate('Main', { screen: 'Map', params: { toast, mine: true si isAdminPlaced } })
```

### 1.7 Ajout de destinataires (mode privé)

Tap sur la ligne "À :" → `navigation.navigate('SelectRecipient', { mode: 'flag' })`.

Quand `SelectRecipientScreen` revient : `route.params.recipients` est mis à jour → `useEffect([route.params.recipients])` détecte le changement et met à jour `recipients` + passe en mode privé.

### 1.8 Enregistrement audio

```
startRecording()
  → requestPermissionsAsync() → si refusé : toast erreur
  → Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true })
  → Audio.Recording.createAsync(HIGH_QUALITY)
  → setIsRecording(true)

stopRecording()
  → recording.stopAndUnloadAsync()
  → recording.getURI() → setMediaUri(uri), setContentType('audio')
  → setIsRecording(false)
```

---

## 2. SelectRecipientScreen

**Route** : `SelectRecipient` (stack)
**Fichier** : `src/screens/SelectRecipientScreen.tsx`
**Params** : `{ mode: 'flag' | 'chat' }`

### 2.1 Modes

| Mode | Comportement |
|------|-------------|
| `'flag'` | Sélection multiple avec cases à cocher. Bouton "OK (N)" en header → `navigation.navigate('CreateMessage', { recipients })` |
| `'chat'` | Tap simple → `navigation.navigate('Conversation', { otherUserId, otherUserName, otherUserAvatarUrl })` |

### 2.2 Source de données

`fetchFollowedUsers()` — liste des utilisateurs que le courant **suit** (abonnements actifs). Inclut le bot Fläag.

### 2.3 Sélection multiple (mode `flag`)

- Toggle : si déjà sélectionné → dé-sélectionne, sinon → ajoute
- Highlight : fond `surface.elevated` + border cyan si sélectionné
- Bouton "OK (0)" → disabled si aucun sélectionné
- Retour : `navigation.navigate('CreateMessage', { recipients })` (liste `{ id, name }[]`)

### 2.4 État vide

Si aucun abonnement :
```
[👥 icône]
Aucun abonnement
Vous ne suivez personne pour le moment.
Abonnez-vous à des utilisateurs pour leur envoyer des messages !
```
