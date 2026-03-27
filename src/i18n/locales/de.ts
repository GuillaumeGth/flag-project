import type { Translations } from './fr';

const de: Translations = {
  auth: {
    continueWithGoogle: 'Mit Google fortfahren',
  },

  permissions: {
    location: 'Standort',
    locationDescription: 'Um Nachrichten in deiner Umgebung anzuzeigen',
    locationBackground: 'Standort im Hintergrund',
    locationBackgroundDescription: 'Um dich zu benachrichtigen, wenn du in der Nähe einer Nachricht bist',
    camera: 'Kamera',
    cameraDescription: 'Um Fotos aufzunehmen und an Nachrichten anzuhängen',
    microphone: 'Mikrofon',
    microphoneDescription: 'Um Sprachnachrichten aufzunehmen',
    notifications: 'Benachrichtigungen',
    notificationsDescription: 'Um bei neuen Nachrichten benachrichtigt zu werden',
    allow: 'Erlauben',
    later: 'Später',
  },

  map: {
    allowLocation: 'Standort erlauben',
    explore: 'Erkunden',
    myFlags: 'Meine Fläags',
    discoverMessage: 'Nachricht entdecken',
    public: 'Öffentlich',
  },

  inbox: {
    title: 'Nachrichten',
    empty: 'Keine Gespräche',
    emptySubtitle: 'Starte ein Gespräch, indem du auf die +-Schaltfläche tippst',
  },

  createMessage: {
    title: 'Neuer Fläag',
    placeholder: 'Diese Nachricht wird mit deinem aktuellen Standort verknüpft...',
    gallery: 'Galerie',
    photo: 'Foto',
    next: 'Weiter',
    abandonTitle: 'Diesen Fläag verwerfen?',
    adminBadge: '★ Admin-Position',
  },

  sendMessage: {
    title: 'Fläag senden',
    preview: 'Vorschau',
    audioTitle: 'Sprachnachricht',
    send: 'Senden',
    to: 'An:',
    adminBadge: '★ Admin-Position',
  },

  readMessage: {
    notFound: 'Nachricht nicht gefunden',
    back: 'Zurück',
    reply: 'Hier antworten',
  },

  profile: {
    noPublicMessages: 'Keine öffentlichen Nachrichten',
    noPublicMessagesSubtitle: 'Teile deine erste Nachricht mit der Welt',
  },

  userProfile: {
    noPublicMessages: 'Keine öffentlichen Nachrichten',
    notifications: 'Benachrichtigungen',
    privateFlags: 'Private Fläags',
    publicFlags: 'Öffentliche Fläags',
    connections: 'Verbindungen',
    noConnections: 'Noch keine Verbindungen',
    citiesVisited: 'Besuchte Städte',
    user: 'Benutzer',
  },

  search: {
    placeholder: 'Benutzer suchen...',
    suggested: 'Für dich vorgeschlagen',
    popular: 'Beliebt',
    notFound: 'Kein Benutzer gefunden',
  },

  settings: {
    title: 'Einstellungen',
    editName: 'Name bearbeiten',
    notificationsMenu: 'Benachrichtigungen',
    privacy: 'Datenschutz',
    contact: 'Kontakt',
    language: 'Sprache',
    signOut: 'Abmelden',
    signOutTitle: 'Abmelden?',
    signOutMessage: 'Du musst dich erneut anmelden, um auf deine Fläags zuzugreifen.',
    signOutConfirm: 'Abmelden',
    editNameTitle: 'Name bearbeiten',
    namePlaceholder: 'Dein Name',
    cancel: 'Abbrechen',
    save: 'Speichern',
  },

  selectRecipient: {
    chooseRecipients: 'Empfänger auswählen',
    newConversation: 'Neues Gespräch',
    noSubscriptions: 'Keine Abonnements',
    officialBot: 'Offizieller Fläag-Bot',
    search: 'Suchen...',
    clear: 'Löschen',
  },

  followRequests: {
    title: 'Follower-Anfragen',
    noPending: 'Keine ausstehenden Anfragen',
    accept: 'Akzeptieren',
  },

  contact: {
    title: 'Kontakt',
    subjectLabel: 'Betreff (optional)',
    subjectPlaceholder: 'Z.B. Fehler, Vorschlag, Frage...',
    messageLabel: 'Nachricht',
    messagePlaceholder: 'Beschreibe dein Anliegen...',
    send: 'Senden',
  },

  mapFilter: {
    title: 'Filter',
    visibility: 'Sichtbarkeit',
    author: 'Autor',
    status: 'Status',
    recipient: 'Empfänger',
    noNearby: 'Keine Nachrichten in der Nähe',
    all: 'Alle',
    public: 'Öffentlich',
    private: 'Privat',
    read: 'Gelesen',
    unread: 'Ungelesen',
    searchFilter: 'Suchen...',
    clear: 'Löschen',
  },

  comments: {
    placeholder: 'Kommentar schreiben...',
    noComments: 'Keine Kommentare',
    seeMore: 'Mehr anzeigen',
    reply: 'Antworten',
    deleteTitle: 'Diesen Kommentar löschen?',
  },

  conversation: {
    geolocated: 'Geolocated Nachricht',
    deleted: 'Nachricht gelöscht',
    tapToViewOnMap: 'Tippen, um auf der Karte anzuzeigen',
    audioRecorded: 'Audio aufgenommen',
    messagePlaceholder: 'Nicht geolocated Nachricht',
  },

  messageFeed: {
    undiscovered: 'Unentdeckter Fläag',
    undiscoveredHint: 'Komm näher, um ihn zu lesen',
  },

  common: {
    loading: 'Laden...',
    error: 'Ein Fehler ist aufgetreten',
    retry: 'Erneut versuchen',
    ok: 'OK',
    cancel: 'Abbrechen',
  },
};

export default de;
