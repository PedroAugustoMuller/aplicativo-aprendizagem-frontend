export default {
  app: {
    name: 'Química 9º Ano',
    tagline: 'Estude química respondendo quizzes',
  },
  nav: {
    topics: 'Conteúdos',
    signOut: 'Sair',
    theme: 'Tema',
  },
  common: {
    retry: 'Tentar novamente',
    loading: 'Carregando…',
    empty: 'Nada por aqui ainda.',
  },
  auth: {
    title: 'Entrar',
    email: 'E-mail',
    password: 'Senha',
    submit: 'Entrar',
    signedOut: 'Sua sessão expirou. Entre novamente.',
  },
  topics: {
    title: 'Conteúdos de Química',
    empty: 'Nenhum conteúdo cadastrado ainda.',
  },
  errors: {
    api: {
      network_unavailable: 'Sem conexão com a internet. Verifique sua rede e tente de novo.',
      request_timeout: 'O servidor demorou demais para responder. Tente de novo.',
      unexpected_response: 'Resposta inesperada do servidor. Tente de novo em instantes.',
    },
    system: {
      unexpected_error: 'Algo deu errado do nosso lado. Tente de novo em instantes.',
    },
    auth: {
      unauthenticated: 'Você precisa entrar para continuar.',
      forbidden: 'Você não tem permissão para isso.',
    },
    http: {
      error: 'Não foi possível completar a operação. Tente de novo.',
      not_found: 'Não encontramos o que você procura.',
      method_not_allowed: 'Essa operação não é permitida aqui.',
      too_many_requests: 'Muitas tentativas seguidas. Espere um minuto e tente de novo.',
    },
    validation: {
      failed: 'Confira os campos destacados.',
      invalid: 'Valor inválido.',
      required: 'Campo obrigatório.',
      email: 'Informe um e-mail válido.',
      max: 'Máximo de {arg0} caracteres.',
      min: 'Mínimo de {arg0} caracteres.',
      string: 'Valor inválido.',
    },
    identity: {
      invalid_credentials: 'E-mail ou senha incorretos.',
    },
  },
}
