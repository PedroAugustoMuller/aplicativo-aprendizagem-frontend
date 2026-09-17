module.exports = {
  forbidden: [
    {
      name: 'domain-is-pure',
      severity: 'error',
      comment:
        'Domain code is plain TypeScript: it may import only its own module\'s domain/ folder - no ' +
        'npm package, no src/shared, no other layer. An allow-list, so a new framework or helper ' +
        'cannot slip in unnoticed. This is what lets the offline adapter be added later without ' +
        'touching the domain.',
      from: { path: '^src/modules/([^/]+)/domain/' },
      to: { pathNot: '^src/modules/$1/domain/' },
    },
    {
      name: 'no-cross-module-imports',
      severity: 'error',
      comment: 'A module may use src/shared, never another module. Contracts belong in shared.',
      from: { path: '^src/modules/([^/]+)/' },
      to: {
        path: '^src/modules/([^/]+)/',
        pathNot: '^src/modules/$1/',
      },
    },
    {
      name: 'presentation-does-not-reach-infrastructure',
      severity: 'error',
      comment: 'Components talk to stores and composables, never straight to a repository or request.',
      from: { path: '^src/modules/[^/]+/presentation/' },
      to: { path: '^src/modules/[^/]+/infrastructure/' },
    },
    {
      name: 'application-does-not-reach-presentation',
      severity: 'error',
      comment: 'Stores and use-cases are consumed by components, never the other way around.',
      from: { path: '^src/modules/[^/]+/application/' },
      to: { path: '^src/modules/[^/]+/presentation/' },
    },
    {
      name: 'only-infrastructure-reaches-the-api-client',
      severity: 'error',
      comment:
        'Only a module\'s infrastructure/ (repositories, requests) and the composition root ' +
        '(src/main.ts) may use the HTTP client, transport or adapters. A page or store calling ' +
        'api.get directly would bypass the repository - and with it the offline adapter. ' +
        'ApiError (shared/api/error) and shared/api/types stay importable everywhere.',
      from: { pathNot: ['^src/modules/[^/]+/infrastructure/', '^src/main\\.ts$', '^src/shared/api/'] },
      to: { path: '^src/shared/api/(client|http|transport|adapters)\\.ts$' },
    },
    {
      name: 'shared-does-not-depend-on-modules',
      severity: 'error',
      comment:
        'shared/api, shared/i18n and shared/theme must never import a module. (shared/router and ' +
        'shared/ui are the composition roots - see the next rule.)',
      from: { path: '^src/shared/', pathNot: '^src/shared/(router|ui)/' },
      to: { path: '^src/modules/' },
    },
    {
      name: 'composition-roots-use-only-module-surfaces',
      severity: 'error',
      comment:
        'The router and the app shell are composition roots, so they are the one place in shared/ ' +
        'allowed to know modules exist - but only a module\'s application/ (stores) and ' +
        'presentation/ (pages). Its domain/ and infrastructure/ stay behind those.',
      from: { path: '^src/shared/(router|ui)/' },
      to: {
        path: '^src/modules/',
        pathNot: '^src/modules/[^/]+/(application|presentation)/',
      },
    },
    {
      name: 'transport-does-not-know-routing',
      severity: 'error',
      comment:
        'The HTTP layer is constructed with an onUnauthorized callback precisely so it ' +
        'never needs the router. Importing one here would put navigation inside transport.',
      from: { path: '^src/shared/api/' },
      to: { path: ['^src/shared/router/', '^node_modules/vue-router/'] },
    },
    { name: 'no-circular', severity: 'error', from: {}, to: { circular: true } },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    // Keep type-only imports (`import type ...`) in the graph. Without this they
    // are erased before cruising, so a domain file could `import type` from vue
    // or shared/api and pass every rule above.
    tsPreCompilationDeps: true,
    // The scaffold's tsconfig.json is a project-references shell with no
    // compilerOptions of its own (see tsconfig.app.json / tsconfig.node.json).
    // dependency-cruiser needs the file that actually carries baseUrl/paths
    // to resolve the "@/*" alias, or every @/-import shows up as unresolved
    // and silently drops out of the dependency graph.
    tsConfig: { fileName: 'tsconfig.app.json' },
    enhancedResolveOptions: { extensions: ['.ts', '.js', '.vue'] },
  },
}
