import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const source = process.env.BACKEND_ERROR_CODES
  ? resolve(process.env.BACKEND_ERROR_CODES)
  : resolve(here, '../../backend/docs/error-codes.json')
const target = resolve(here, '../src/shared/i18n/error-codes.json')

if (!existsSync(source)) {
  console.error(
    `Could not find ${source}.\n` +
      'The backend repository must sit beside this one. Generate the file with:\n' +
      '  docker compose exec app php artisan error-codes:dump\n' +
      'Or point at a different location with the BACKEND_ERROR_CODES environment variable ' +
      '(an absolute path to error-codes.json).',
  )
  process.exit(1)
}

mkdirSync(dirname(target), { recursive: true })
copyFileSync(source, target)
console.log(`Synced error codes -> ${target}`)
