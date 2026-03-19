# Spec — ConversationScreen

**Route** : `Conversation` (stack)
**Fichier** : `src/screens/ConversationScreen.tsx`
**Params** : `{ otherUserId, otherUserName, otherUserAvatarUrl?, scrollToMessageId? }`

---

## 1. Layout

```
┌─────────────────────────────────────┐
│ ← | [Avatar] Nom                    │  ← header (glassmorphisme léger)
├─────────────────────────────────────┤
│                    Bulle msg reçu   │
│  Bulle msg envoyé                   │
│    [réaction 😂×2]                 │  ← ReactionBadge flottant
│   ── 14 mars ──                     │  ← date separator
│                    Bulle msg reçu   │
│  [Répondre à: ...]                  │  ← bandeau reply (optionnel)
│ [📎] [✉ Écrire...]           [🎤] │  ← MessageInput
└─────────────────────────────────────┘
```

---

## 2. Chargement des messages

Service : `useMessageLoader(otherUserId)` — retourne `{ messages, loading, loadMessages }`.

- `loadMessages()` est appelé au montage et à chaque `useFocusEffect`
- La liste est **inversée** (`reversedMessages = [...messages].reverse()`) pour afficher les plus récents en bas avec `FlatList inverted`
- Scroll initial vers `scrollToMessageId` si fourni dans les params (après 200ms)

---

## 3. Envoi de messages

### 3.1 Types de contenu

| Type | Déclencheur | Upload |
|------|-------------|--------|
| `text` | Saisie dans l'input | Non |
| `photo` | Galerie (`ImagePicker`) ou caméra | `uploadMedia(uri, 'photo')` |
| `audio` | Non disponible (résidu UI) | `uploadMedia(uri, 'audio')` |

### 3.2 Validation avant envoi

```
if (!hasText && !hasMedia) → ne pas envoyer
if (sending) → ne pas envoyer (dédoublonnage)
if (isBot) → ne pas envoyer
```

### 3.3 Flux d'envoi

```
handleSend()
  → setSending(true)
  → uploadMedia(uri, type) si media présent
  → sendMessage(otherUserId, contentType, null, text, mediaUrl, false, replyId)
  → setReplyToMessage(null)
  → loadMessages()
  → setSending(false)
```

---

## 4. Condition d'envoi (`canSendMessages`)

Au montage : `isEitherFollowing(otherUserId)` — retourne `true` si **au moins l'un** des deux suit l'autre.

Si `canSendMessages = false` : l'input affiche `"Suivez-vous mutuellement pour écrire"`, le bouton envoi est désactivé.

**Cas bot** : `isBot = otherUserId === FLAG_BOT_ID` → `canSendMessages = false` immédiatement, sans appel réseau.

---

## 5. Réponse (reply)

```
Appui long sur un message non-supprimé
  → setSelectedMessageId(message.id)
  → setPickerMessageId(message.id) — ouvre ReactionPicker

Dans le header (si selectedMessageId) :
  Tap 🔄 (reply) → handleReplySelected()
    → setReplyToMessage(message)
    → setSelectedMessageId(null)

MessageInput affiche un bandeau "Réponse à: [aperçu]"
Tap × → setReplyToMessage(null)

L'ID de la réponse est passé à sendMessage() comme replyId
```

---

## 6. Suppression

```
Appui long → selectedMessageId défini
Dans le header → Tap 🗑
  → handleDeleteSelected()
  → deleteMessage(messageId, otherUserId, isSender)
  → loadMessages()
```

Le marqueur `deleted_by_sender` ou `deleted_by_recipient` est mis à jour en base. Le contenu du message est remplacé visuellement par `"Message supprimé"`.

---

## 7. Réactions emoji

### 7.1 Pattern `generationRef` (réactions stables)

```ts
// reactionsMap : état React (les composants l'utilisent pour le rendu)
const [reactionsMap, setReactionsMap] = useState<Record<string, ReactionSummary[]>>({});
// reactionsMapRef : ref qui suit toujours la valeur courante
const reactionsMapRef = useRef({});
useEffect(() => { reactionsMapRef.current = reactionsMap; }, [reactionsMap]);
```

`handleReactionToggle` est un `useCallback([user])` — **ne se recrée jamais** quand `reactionsMap` change. Il lit la valeur courante via `reactionsMapRef.current` au lieu de dépendre de l'état directement.

### 7.2 Flux de réaction

```
Appui long → setPickerMessageId(message.id) → ReactionPicker visible (ancré à la position Y du tap)

Tap emoji dans ReactionPicker :
  → handleReactionToggle(messageId, emoji)
    → lecture de l'état courant via reactionsMapRef.current
    → calcul de hasReacted
    → mise à jour optimiste de reactionsMap
    → toggleReaction(messageId, emoji, userId, hasReacted) (appel Supabase en arrière-plan)

Tap ailleurs (onPress message) → setPickerMessageId(null)
Début de scroll → setPickerMessageId(null)
```

### 7.3 Chargement des réactions

`fetchReactionsForMessages(ids, userId)` est appelé à chaque fois que `messages` change.

---

## 8. Lecture audio

```
Tap sur une bulle audio → handleAudioPress(message)
  → Si même message déjà en lecture : pause
  → Si autre message : unload l'ancien, crée un nouveau Audio.Sound
  → playAsync() + setOnPlaybackStatusUpdate → reset à la fin
```

Un seul son peut être en lecture à la fois. `playingMessageId` + `isPlayingAudio` trackent l'état.

---

## 9. Affichage pleine image

Tap sur une image → `setFullImageMessage(message)` → Modal noir transparent avec l'image en `resizeMode="contain"` + bouton ✕.

---

## 10. Séparateurs de date

Un séparateur `── 14 mars ──` est affiché entre deux messages de jours différents. La comparaison est faite sur `toDateString()`. Le dernier message de la liste (le plus ancien) affiche toujours un séparateur.

---

## 11. Navigation depuis une bulle

Les bulles contenant un flag géolocalisé affichent un bouton `📍`. Tap :
```
navigation.navigate('Main', {
  screen: 'Map',
  params: { messageId: item.is_read ? undefined : item.id, focusLocation: location }
})
```

---

## 12. Keyboard handling

```
KeyboardAvoidingView behavior='padding'
  iOS : toujours actif (keyboardVerticalOffset = insets.top + 60)
  Android : actif seulement si keyboardVisible (évite le double-décalage)
```

---

## 13. Ce que cet écran ne fait PAS

- Ne gère pas les conversations de groupe (1-to-1 uniquement)
- Ne pagine pas les messages (tous chargés d'un coup)
- Ne fait pas de realtime en temps réel (rechargement sur focus uniquement)
