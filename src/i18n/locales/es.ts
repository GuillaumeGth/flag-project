import type { Translations } from './fr';

const es: Translations = {
  auth: {
    continueWithGoogle: 'Continuar con Google',
  },

  permissions: {
    location: 'Ubicación',
    locationDescription: 'Para mostrar mensajes a tu alrededor',
    locationBackground: 'Ubicación en segundo plano',
    locationBackgroundDescription: 'Para notificarte cuando estés cerca de un mensaje',
    camera: 'Cámara',
    cameraDescription: 'Para tomar fotos y adjuntarlas a los mensajes',
    microphone: 'Micrófono',
    microphoneDescription: 'Para grabar mensajes de audio',
    notifications: 'Notificaciones',
    notificationsDescription: 'Para recibir alertas de nuevos mensajes',
    allow: 'Permitir',
    later: 'Más tarde',
  },

  map: {
    allowLocation: 'Permitir ubicación',
    explore: 'Explorar',
    myFlags: 'Mis Flaags',
    discoverMessage: 'Descubrir mensaje',
    public: 'Público',
  },

  inbox: {
    title: 'Mensajes',
    empty: 'Sin conversaciones',
    emptySubtitle: 'Inicia una conversación pulsando el botón +',
  },

  createMessage: {
    title: 'Nuevo Fläag',
    placeholder: 'Este mensaje estará vinculado a tu posición actual...',
    gallery: 'Galería',
    photo: 'Foto',
    next: 'Siguiente',
    abandonTitle: '¿Abandonar este fläag?',
    adminBadge: '★ Posición admin',
  },

  sendMessage: {
    title: 'Enviar Fläag',
    preview: 'Vista previa',
    audioTitle: 'Mensaje de audio',
    send: 'Enviar',
    to: 'Para:',
    adminBadge: '★ Posición admin',
  },

  readMessage: {
    notFound: 'Mensaje no encontrado',
    back: 'Volver',
    reply: 'Responder aquí',
  },

  profile: {
    noPublicMessages: 'Sin mensajes públicos',
    noPublicMessagesSubtitle: 'Comparte tu primer mensaje con el mundo',
  },

  userProfile: {
    noPublicMessages: 'Sin mensajes públicos',
    notifications: 'Notificaciones',
    privateFlags: 'Fläags privados',
    publicFlags: 'Fläags públicos',
    connections: 'Conexiones',
    noConnections: 'Sin conexiones por el momento',
    citiesVisited: 'Ciudades visitadas',
    user: 'Usuario',
  },

  search: {
    placeholder: 'Buscar un usuario...',
    suggested: 'Sugeridos para ti',
    popular: 'Populares',
    notFound: 'Ningún usuario encontrado',
  },

  settings: {
    title: 'Ajustes',
    editName: 'Editar nombre',
    notificationsMenu: 'Notificaciones',
    privacy: 'Privacidad',
    contact: 'Contactar',
    language: 'Idioma',
    signOut: 'Cerrar sesión',
    signOutTitle: '¿Cerrar sesión?',
    signOutMessage: 'Deberás iniciar sesión de nuevo para acceder a tus fläags.',
    signOutConfirm: 'Cerrar sesión',
    editNameTitle: 'Editar nombre',
    namePlaceholder: 'Tu nombre',
    cancel: 'Cancelar',
    save: 'Guardar',
  },

  selectRecipient: {
    chooseRecipients: 'Elegir destinatarios',
    newConversation: 'Nueva conversación',
    noSubscriptions: 'Sin suscripciones',
    officialBot: 'Bot oficial de Fläag',
    search: 'Buscar...',
    clear: 'Limpiar',
  },

  followRequests: {
    title: 'Solicitudes de seguimiento',
    noPending: 'Sin solicitudes pendientes',
    accept: 'Aceptar',
  },

  contact: {
    title: 'Contactar',
    subjectLabel: 'Asunto (opcional)',
    subjectPlaceholder: 'Ej: Error, Sugerencia, Pregunta...',
    messageLabel: 'Mensaje',
    messagePlaceholder: 'Describe tu solicitud...',
    send: 'Enviar',
  },

  mapFilter: {
    title: 'Filtros',
    visibility: 'Visibilidad',
    author: 'Autor',
    status: 'Estado',
    recipient: 'Destinatario',
    noNearby: 'Sin mensajes cercanos',
    all: 'Todos',
    public: 'Público',
    private: 'Privado',
    read: 'Leídos',
    unread: 'No leídos',
    searchFilter: 'Buscar...',
    clear: 'Limpiar',
  },

  comments: {
    placeholder: 'Escribe un comentario...',
    noComments: 'Sin comentarios',
    seeMore: 'Ver más',
    reply: 'Responder',
    deleteTitle: '¿Eliminar este comentario?',
  },

  conversation: {
    geolocated: 'Mensaje geolocaliado',
    deleted: 'Mensaje eliminado',
    tapToViewOnMap: 'Toca para ver en el mapa',
    audioRecorded: 'Audio grabado',
    messagePlaceholder: 'Mensaje no geolocalizado',
  },

  messageFeed: {
    undiscovered: 'Fläag no descubierto',
    undiscoveredHint: 'Acércate para leerlo',
  },

  common: {
    loading: 'Cargando...',
    error: 'Ha ocurrido un error',
    retry: 'Reintentar',
    ok: 'OK',
    cancel: 'Cancelar',
  },
};

export default es;
