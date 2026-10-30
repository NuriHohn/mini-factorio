// Expensive raw-start/progression scenarios stay intact and run before every release.
// The complement is deliberately computed from the complete ownership inventory.
export const longTests = new Set([
  'rebuilding', 'peaceSave', 'chickenCoop', 'chickenFeeding', 'ecoFactory',
  'ecoProjects', 'experiment', 'gearPress', 'peteDevelopments', 'peteLeisure', 'workshop',
  'campfire', 'campfireVisuals', 'constructionPriorities', 'gardenGate', 'homesteadDaily',
  'personality', 'poultry', 'projectSelection', 'yard', 'homestead', 'homesteadExpansion', 'homesteadPaths', 'industrial',
  'infrastructure', 'infrastructurePaths', 'inventorIndependence', 'laterInfrastructure',
  'laterPaths', 'nextProgression', 'pavilion', 'peteBalance', 'peteExpansion48',
  'petePaths48', 'productionLogistics', 'productionPaths', 'ecoLogistics',
  'craftsman', 'inventor', 'developmentAcceptance', 'priorityAcceptance',
])
export function testTier(path: string): 'long' | 'quick' {
  return longTests.has(path.split('/').at(-1)!.replace(/\.test\.tsx?$/, '')) ? 'long' : 'quick'
}
