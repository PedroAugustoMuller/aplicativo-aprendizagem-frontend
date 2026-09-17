// A single regex pass, not a reduce over replaceAll: replacing `:id` before
// `:idExtra` would otherwise corrupt the latter (`:idExtra` -> `7Extra`) because
// `:id` is a literal prefix of `:idExtra`. Matching `:name` as one atomic token
// makes that collision impossible.
export const interpolateUrl = (url: string, params: Record<string, string> = {}): string =>
  url.replace(/:([A-Za-z0-9_]+)/g, (match: string, key: string) => {
    const value = params[key]
    return value === undefined ? match : encodeURIComponent(value)
  })
