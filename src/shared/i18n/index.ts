import { createI18n } from 'vue-i18n'
import ptBR from '@/shared/i18n/locales/pt-BR'
import en from '@/shared/i18n/locales/en'

export const i18n = createI18n({
  legacy: false,
  locale: 'pt-BR',
  fallbackLocale: 'en',
  messages: { 'pt-BR': ptBR, en },
})
