import type { Translations } from './fr';

const en: Translations = {
  auth: {
    continueWithGoogle: 'Continue with Google',
  },

  permissions: {
    location: 'Location',
    locationDescription: 'To display messages around you',
    locationBackground: 'Background location',
    locationBackgroundDescription: 'To notify you when you are near a message',
    camera: 'Camera',
    cameraDescription: 'To take photos and attach them to messages',
    microphone: 'Microphone',
    microphoneDescription: 'To record audio messages',
    notifications: 'Notifications',
    notificationsDescription: 'To be alerted of new messages',
    allow: 'Allow',
    later: 'Later',
  },

  map: {
    allowLocation: 'Allow location',
    explore: 'Explore',
    myFlags: 'My Fläags',
    discoverMessage: 'Discover message',
    public: 'Public',
  },

  inbox: {
    title: 'Messages',
    empty: 'No conversations',
    emptySubtitle: 'Start a conversation by tapping the + button',
  },

  createMessage: {
    title: 'New Fläag',
    placeholder: 'This message will be tied to your current location...',
    gallery: 'Gallery',
    photo: 'Photo',
    next: 'Next',
    abandonTitle: 'Abandon this fläag?',
    adminBadge: '★ Admin location',
  },

  sendMessage: {
    title: 'Send Fläag',
    preview: 'Preview',
    audioTitle: 'Audio message',
    send: 'Send',
    to: 'To:',
    adminBadge: '★ Admin location',
  },

  readMessage: {
    notFound: 'Message not found',
    back: 'Back',
    reply: 'Reply here',
  },

  profile: {
    noPublicMessages: 'No public messages',
    noPublicMessagesSubtitle: 'Share your first message with the world',
  },

  userProfile: {
    noPublicMessages: 'No public messages',
    notifications: 'Notifications',
    privateFlags: 'Private Fläags',
    publicFlags: 'Public Fläags',
    connections: 'Connections',
    noConnections: 'No connections yet',
    citiesVisited: 'Cities visited',
    user: 'User',
  },

  search: {
    placeholder: 'Search for a user...',
    suggested: 'Suggested for you',
    popular: 'Popular',
    notFound: 'No user found',
  },

  settings: {
    title: 'Settings',
    editName: 'Edit name',
    notificationsMenu: 'Notifications',
    privacy: 'Privacy',
    contact: 'Contact us',
    language: 'Language',
    signOut: 'Sign out',
    signOutTitle: 'Sign out?',
    signOutMessage: 'You will need to sign in again to access your fläags.',
    signOutConfirm: 'Sign out',
    editNameTitle: 'Edit name',
    namePlaceholder: 'Your name',
    cancel: 'Cancel',
    save: 'Save',
  },

  selectRecipient: {
    chooseRecipients: 'Choose recipients',
    newConversation: 'New conversation',
    noSubscriptions: 'No subscriptions',
    officialBot: 'Official Fläag bot',
    search: 'Search...',
    clear: 'Clear',
  },

  followRequests: {
    title: 'Follow requests',
    noPending: 'No pending requests',
    accept: 'Accept',
  },

  contact: {
    title: 'Contact us',
    subjectLabel: 'Subject (optional)',
    subjectPlaceholder: 'E.g. Bug, Suggestion, Question...',
    messageLabel: 'Message',
    messagePlaceholder: 'Describe your request...',
    send: 'Send',
  },

  mapFilter: {
    title: 'Filters',
    visibility: 'Visibility',
    author: 'Author',
    status: 'Status',
    recipient: 'Recipient',
    noNearby: 'No messages nearby',
    all: 'All',
    public: 'Public',
    private: 'Private',
    read: 'Read',
    unread: 'Unread',
    searchFilter: 'Search...',
    clear: 'Clear',
  },

  comments: {
    placeholder: 'Write a comment...',
    noComments: 'No comments',
    seeMore: 'See more',
    reply: 'Reply',
    deleteTitle: 'Delete this comment?',
  },

  conversation: {
    geolocated: 'Geolocated message',
    deleted: 'Message deleted',
    tapToViewOnMap: 'Tap to view on map',
    audioRecorded: 'Audio recorded',
    messagePlaceholder: 'Non-geolocated message',
  },

  messageFeed: {
    undiscovered: 'Undiscovered Fläag',
    undiscoveredHint: 'Get closer to read it',
  },

  common: {
    loading: 'Loading...',
    error: 'An error occurred',
    retry: 'Retry',
    ok: 'OK',
    cancel: 'Cancel',
  },
};

export default en;
