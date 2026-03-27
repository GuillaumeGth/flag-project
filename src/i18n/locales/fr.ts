const fr = {
  // Auth
  auth: {
    continueWithGoogle: 'Continuer avec Google',
  },

  // Permissions
  permissions: {
    location: 'Localisation',
    locationDescription: 'Pour afficher les messages autour de vous',
    locationBackground: 'Localisation en arrière-plan',
    locationBackgroundDescription: "Pour vous notifier quand vous êtes proche d'un message",
    camera: 'Caméra',
    cameraDescription: 'Pour prendre des photos à joindre aux messages',
    microphone: 'Microphone',
    microphoneDescription: 'Pour enregistrer des messages audio',
    notifications: 'Notifications',
    notificationsDescription: 'Pour être alerté des nouveaux messages',
    allow: 'Autoriser',
    later: 'Plus tard',
  },

  // Map
  map: {
    allowLocation: 'Autoriser la localisation',
    explore: 'Explorer',
    myFlags: 'Mes Flaags',
    discoverMessage: 'Découvrir le message',
    public: 'Public',
  },

  // Inbox
  inbox: {
    title: 'Messages',
    empty: 'Aucune conversation',
    emptySubtitle: 'Commencez une conversation en appuyant sur le bouton +',
  },

  // Create message
  createMessage: {
    title: 'Nouveau Fläag',
    placeholder: 'Ce message sera lié à votre position actuelle...',
    gallery: 'Galerie',
    photo: 'Photo',
    next: 'Suivant',
    abandonTitle: 'Abandonner ce fläag ?',
    adminBadge: '★ Position admin',
  },

  // Send message
  sendMessage: {
    title: 'Envoyer le Fläag',
    preview: 'Aperçu',
    audioTitle: 'Message audio',
    send: 'Envoyer',
    to: 'À :',
    adminBadge: '★ Position admin',
  },

  // Read message
  readMessage: {
    notFound: 'Message introuvable',
    back: 'Retour',
    reply: 'Répondre ici',
  },

  // Profile
  profile: {
    noPublicMessages: 'Aucun message public',
    noPublicMessagesSubtitle: 'Partagez votre premier message avec le monde',
  },

  // User profile
  userProfile: {
    noPublicMessages: 'Aucun message public',
    notifications: 'Notifications',
    privateFlags: 'Fläags privés',
    publicFlags: 'Fläags publics',
    connections: 'Connexions',
    noConnections: 'Aucune connexion pour le moment',
    citiesVisited: 'Villes visitées',
    user: 'Utilisateur',
  },

  // Search
  search: {
    placeholder: 'Rechercher un utilisateur...',
    suggested: 'Suggérés pour vous',
    popular: 'Populaires',
    notFound: 'Aucun utilisateur trouvé',
  },

  // Settings
  settings: {
    title: 'Paramètres',
    editName: 'Modifier le nom',
    notificationsMenu: 'Notifications',
    privacy: 'Confidentialité',
    contact: 'Nous contacter',
    language: 'Langue',
    signOut: 'Se déconnecter',
    signOutTitle: 'Se déconnecter ?',
    signOutMessage: 'Tu devras te reconnecter pour accéder à tes fläags.',
    signOutConfirm: 'Déconnexion',
    editNameTitle: 'Modifier le nom',
    namePlaceholder: 'Votre nom',
    cancel: 'Annuler',
    save: 'Enregistrer',
  },

  // Select recipient
  selectRecipient: {
    chooseRecipients: 'Choisir les destinataires',
    newConversation: 'Nouvelle conversation',
    noSubscriptions: 'Aucun abonnement',
    officialBot: 'Bot officiel Fläag',
    search: 'Rechercher...',
    clear: 'Effacer',
  },

  // Follow requests
  followRequests: {
    title: "Demandes d'abonnement",
    noPending: 'Aucune demande en attente',
    accept: 'Accepter',
  },

  // Contact
  contact: {
    title: 'Nous contacter',
    subjectLabel: 'Sujet (optionnel)',
    subjectPlaceholder: 'Ex : Bug, Suggestion, Question...',
    messageLabel: 'Message',
    messagePlaceholder: 'Décrivez votre demande...',
    send: 'Envoyer',
  },

  // Map filter
  mapFilter: {
    title: 'Filtres',
    visibility: 'Visibilité',
    author: 'Auteur',
    status: 'Statut',
    recipient: 'Destinataire',
    noNearby: 'Aucun message à proximité',
    all: 'Tous',
    public: 'Public',
    private: 'Privé',
    read: 'Lus',
    unread: 'Non lus',
    searchFilter: 'Rechercher...',
    clear: 'Effacer',
  },

  // Comments
  comments: {
    placeholder: 'Écrire un commentaire...',
    noComments: 'Aucun commentaire',
    seeMore: 'Voir plus',
    reply: 'Répondre',
    deleteTitle: 'Supprimer ce commentaire ?',
  },

  // Message bubble / conversation
  conversation: {
    geolocated: 'Message géolocalisé',
    deleted: 'Message supprimé',
    tapToViewOnMap: 'Tap to view on map',
    audioRecorded: 'Audio enregistré',
    messagePlaceholder: 'Message non géolocalisé',
  },

  // Message feed
  messageFeed: {
    undiscovered: 'Fläag non découvert',
    undiscoveredHint: 'Approche-toi pour le lire',
  },

  // Common
  common: {
    loading: 'Chargement...',
    error: 'Une erreur est survenue',
    retry: 'Réessayer',
    ok: 'OK',
    cancel: 'Annuler',
  },
};

export default fr;
export type Translations = typeof fr;
