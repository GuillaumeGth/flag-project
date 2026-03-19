# Spec — ReadMessageScreen

**Route** : `ReadMessage` (stack)
**Fichier** : `src/screens/ReadMessageScreen.tsx`
**Params** : `{ messageId: string }`

---

## 1. Layout

```
┌─────────────────────────────────────┐
│ ←  Nom de l'expéditeur              │  ← header
│    14 mars 2025 · 18h42             │
├─────────────────────────────────────┤
│                                     │
│   [Photo pleine largeur]            │  ← si content_type = 'photo'
│                                     │
│   [⏸ En lecture... / ▶ Écouter]    │  ← si content_type = 'audio'
│                                     │
│   Texte du message                  │  ← si text_content présent
│                                     │
│   📍 Message découvert à cet endroit│  ← badge bas de page
│                                     │
├─────────────────────────────────────┤
│  [↩ Répondre ici]                   │  ← footer
└─────────────────────────────────────┘
```

---

## 2. Chargement et actions au montage

```
loadAndMarkAsRead()
  → fetchMessageById(messageId)
  → if message.is_public → markPublicMessageDiscovered(message.id)
  → markMessageAsRead(message.id, message.sender_id)
  → setMessage(currentMessage)
  → setLoading(false)
```

**Ordre garanti** : `markPublicMessageDiscovered` est appelé avant `markMessageAsRead`.
Ces deux appels se produisent à **chaque ouverture** de l'écran — ils sont idempotents.

---

## 3. Règle de découverte

Si le message est public (`is_public = true`), son ouverture via cet écran l'inscrit dans `discovered_public_messages`. Cela le rend "découvert" dans :
- La mosaïque `UserProfileScreen` (vignette claire)
- Le feed `MessageFeedScreen` (contenu visible)

---

## 4. Lecture audio

```
Tap sur le bouton ▶/⏸ → playAudio()
  → Audio.setAudioModeAsync({ playsInSilentModeIOS: true })
  → Si en lecture : pauseAsync → setIsPlaying(false)
  → Sinon : Audio.Sound.createAsync({ uri }) → playAsync
  → onPlaybackStatusUpdate → setIsPlaying(false) à la fin
```

Un seul son géré. Pas de barre de progression (simple toggle play/pause).

---

## 5. Navigation

```
Tap [↩ Répondre ici]
  → navigation.navigate('Conversation', {
      otherUserId: message.sender_id,
      otherUserName: message.sender?.display_name ?? '',
      otherUserAvatarUrl: message.sender?.avatar_url ?? undefined,
    })
```

---

## 6. Erreurs

Si `fetchMessageById` retourne `null` :
```
[⚠ icône]
Message introuvable
[Retour]
```

---

## 7. Nettoyage

Au démontage : `sound.unloadAsync()` si un son a été créé.

---

## 8. Ce que cet écran ne fait PAS

- N'affiche pas les réactions (réservé à ConversationScreen)
- N'affiche pas les commentaires (réservé à MessageFeedScreen)
- Ne vérifie pas la proximité (la vérification est faite en amont, dans MapScreen via `canReadMessage` avant de naviguer)
