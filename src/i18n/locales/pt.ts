import type { Translations } from './fr';

const pt: Translations = {
  auth: {
    continueWithGoogle: 'Continuar com o Google',
  },

  permissions: {
    location: 'Localização',
    locationDescription: 'Para exibir mensagens ao seu redor',
    locationBackground: 'Localização em segundo plano',
    locationBackgroundDescription: 'Para notificá-lo quando estiver perto de uma mensagem',
    camera: 'Câmera',
    cameraDescription: 'Para tirar fotos e anexá-las às mensagens',
    microphone: 'Microfone',
    microphoneDescription: 'Para gravar mensagens de áudio',
    notifications: 'Notificações',
    notificationsDescription: 'Para ser alertado sobre novas mensagens',
    allow: 'Permitir',
    later: 'Mais tarde',
  },

  map: {
    allowLocation: 'Permitir localização',
    explore: 'Explorar',
    myFlags: 'Meus Flaags',
    discoverMessage: 'Descobrir mensagem',
    public: 'Público',
  },

  inbox: {
    title: 'Mensagens',
    empty: 'Nenhuma conversa',
    emptySubtitle: 'Inicie uma conversa tocando no botão +',
  },

  createMessage: {
    title: 'Novo Fläag',
    placeholder: 'Esta mensagem estará vinculada à sua posição atual...',
    gallery: 'Galeria',
    photo: 'Foto',
    next: 'Próximo',
    abandonTitle: 'Abandonar este fläag?',
    adminBadge: '★ Posição admin',
  },

  sendMessage: {
    title: 'Enviar Fläag',
    preview: 'Prévia',
    audioTitle: 'Mensagem de áudio',
    send: 'Enviar',
    to: 'Para:',
    adminBadge: '★ Posição admin',
  },

  readMessage: {
    notFound: 'Mensagem não encontrada',
    back: 'Voltar',
    reply: 'Responder aqui',
  },

  profile: {
    noPublicMessages: 'Nenhuma mensagem pública',
    noPublicMessagesSubtitle: 'Compartilhe sua primeira mensagem com o mundo',
  },

  userProfile: {
    noPublicMessages: 'Nenhuma mensagem pública',
    notifications: 'Notificações',
    privateFlags: 'Fläags privados',
    publicFlags: 'Fläags públicos',
    connections: 'Conexões',
    noConnections: 'Nenhuma conexão por enquanto',
    citiesVisited: 'Cidades visitadas',
    user: 'Usuário',
  },

  search: {
    placeholder: 'Buscar um usuário...',
    suggested: 'Sugeridos para você',
    popular: 'Populares',
    notFound: 'Nenhum usuário encontrado',
  },

  settings: {
    title: 'Configurações',
    editName: 'Editar nome',
    notificationsMenu: 'Notificações',
    privacy: 'Privacidade',
    contact: 'Fale conosco',
    language: 'Idioma',
    signOut: 'Sair',
    signOutTitle: 'Sair?',
    signOutMessage: 'Você precisará entrar novamente para acessar seus fläags.',
    signOutConfirm: 'Sair',
    editNameTitle: 'Editar nome',
    namePlaceholder: 'Seu nome',
    cancel: 'Cancelar',
    save: 'Salvar',
  },

  selectRecipient: {
    chooseRecipients: 'Escolher destinatários',
    newConversation: 'Nova conversa',
    noSubscriptions: 'Nenhuma assinatura',
    officialBot: 'Bot oficial do Fläag',
    search: 'Buscar...',
    clear: 'Limpar',
  },

  followRequests: {
    title: 'Solicitações de seguimento',
    noPending: 'Nenhuma solicitação pendente',
    accept: 'Aceitar',
  },

  contact: {
    title: 'Fale conosco',
    subjectLabel: 'Assunto (opcional)',
    subjectPlaceholder: 'Ex: Bug, Sugestão, Pergunta...',
    messageLabel: 'Mensagem',
    messagePlaceholder: 'Descreva sua solicitação...',
    send: 'Enviar',
  },

  mapFilter: {
    title: 'Filtros',
    visibility: 'Visibilidade',
    author: 'Autor',
    status: 'Status',
    recipient: 'Destinatário',
    noNearby: 'Nenhuma mensagem nas proximidades',
    all: 'Todos',
    public: 'Público',
    private: 'Privado',
    read: 'Lidos',
    unread: 'Não lidos',
    searchFilter: 'Buscar...',
    clear: 'Limpar',
  },

  comments: {
    placeholder: 'Escrever um comentário...',
    noComments: 'Nenhum comentário',
    seeMore: 'Ver mais',
    reply: 'Responder',
    deleteTitle: 'Excluir este comentário?',
  },

  conversation: {
    geolocated: 'Mensagem geolocalizada',
    deleted: 'Mensagem excluída',
    tapToViewOnMap: 'Toque para ver no mapa',
    audioRecorded: 'Áudio gravado',
    messagePlaceholder: 'Mensagem não geolocalizada',
  },

  messageFeed: {
    undiscovered: 'Fläag não descoberto',
    undiscoveredHint: 'Chegue mais perto para ler',
  },

  common: {
    loading: 'Carregando...',
    error: 'Ocorreu um erro',
    retry: 'Tentar novamente',
    ok: 'OK',
    cancel: 'Cancelar',
  },
};

export default pt;
