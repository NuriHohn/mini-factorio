import { analyticsSnapshot } from './analytics'
import { purchaseTechnology, researchRate } from './research'
import { releasePete } from '../simulation/police'
import { shootWeb } from './webSystem'
import { configureFactoryState } from '../core/factoryState'

export function installFactoryState(): void {
  configureFactoryState({ analytics: analyticsSnapshot, researchRate, purchase: purchaseTechnology, release: releasePete, web: shootWeb })
}
