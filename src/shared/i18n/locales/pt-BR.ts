export default {
  app: {
    name: 'Química 9º Ano',
    tagline: 'Estude química respondendo quizzes',
  },
  nav: {
    subjects: 'Matérias',
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
    login: 'E-mail ou usuário',
    password: 'Senha',
    submit: 'Entrar',
    signedOut: 'Sua sessão expirou. Entre novamente.',
  },
  subjects: {
    title: 'Matérias',
    empty: 'Nenhuma matéria disponível ainda.',
    inactive: 'Inativa',
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
      idempotency_conflict: 'Esta operação conflita com uma anterior. Recarregue a página e tente de novo.',
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
      different: 'A nova senha precisa ser diferente da atual.',
    },
    content: {
      subject: {
        name_already_taken: 'Já existe uma matéria com esse nome.',
      },
      subject_not_found: 'Matéria não encontrada.',
    },
    identity: {
      invalid_credentials: 'E-mail/usuário ou senha incorretos.',
      account_deactivated: 'Esta conta foi desativada. Fale com a escola.',
      current_password_invalid: 'A senha atual está incorreta.',
      email_already_taken: 'Este e-mail já está em uso.',
      password_change_required: 'Você precisa trocar sua senha antes de continuar.',
      student_not_found: 'Aluno não encontrado.',
      teacher_not_found: 'Professor não encontrado.',
      classroom_not_found: 'Turma não encontrada.',
      classroom: {
        enrolment_requires_active_student: 'Só é possível matricular alunos ativos.',
        name_already_taken: 'Já existe uma turma com esse nome.',
        subject_inactive: 'A matéria desta turma está inativa.',
      },
    },
  },
}
