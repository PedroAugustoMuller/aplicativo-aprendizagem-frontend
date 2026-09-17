import { describe, expect, it } from 'vitest'
import catalogue from '@/shared/i18n/error-codes.json'
import ptBR from '@/shared/i18n/locales/pt-BR'
import en from '@/shared/i18n/locales/en'

const lookup = (messages: Record<string, unknown>, path: string): unknown =>
  path.split('.').reduce<unknown>(
    (node, segment) =>
      typeof node === 'object' && node !== null ? (node as Record<string, unknown>)[segment] : undefined,
    messages,
  )

describe('error catalogue', () => {
  const codes = catalogue.codes as string[]

  it('is not empty', () => {
    expect(codes.length).toBeGreaterThan(0)
  })

  it.each(['pt-BR', 'en'])('has a %s message for every backend error code', (locale) => {
    const messages = (locale === 'pt-BR' ? ptBR : en) as Record<string, unknown>
    const missing = codes.filter((code) => typeof lookup(messages, `errors.${code}`) !== 'string')

    expect(missing, `Missing ${locale} translations. Add them under "errors".`).toEqual([])
  })

  it.each(['pt-BR', 'en'])('has the %s transport-failure messages', (locale) => {
    const messages = (locale === 'pt-BR' ? ptBR : en) as Record<string, unknown>

    for (const code of ['api.network_unavailable', 'api.request_timeout', 'api.unexpected_response']) {
      expect(typeof lookup(messages, `errors.${code}`)).toBe('string')
    }
  })

  it.each(['pt-BR', 'en'])('has the %s validation fallback', (locale) => {
    const messages = (locale === 'pt-BR' ? ptBR : en) as Record<string, unknown>

    expect(typeof lookup(messages, `errors.${catalogue.validation_fallback}`)).toBe('string')
  })
})
