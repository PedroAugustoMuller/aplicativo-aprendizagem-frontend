import { mdiDiamondStone, mdiShieldStar } from '@mdi/js'
import type { Tier } from '@/modules/quiz/domain/Progress'

// Vuetify palette colours dark enough for white text in both themes (RNF06: check on a phone).
const COLORS: Record<Tier, string> = {
  iron: 'blue-grey-darken-1',
  bronze: 'brown',
  silver: 'grey-darken-1',
  gold: 'amber-darken-4',
  emerald: 'green-darken-2',
  diamond: 'cyan-darken-3',
}

export function tierLook(tier: Tier): { color: string; icon: string } {
  return { color: COLORS[tier], icon: tier === 'diamond' ? mdiDiamondStone : mdiShieldStar }
}
