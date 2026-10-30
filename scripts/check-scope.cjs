// Fail closed: only an explicit set of presentation/documentation changes can
// omit long simulations. Simulation, commands, state, persistence and tooling
// (including this policy and workflow) always require them.
const presentation = new Set([
  'src/index.css', 'src/pete/text.ts', 'src/pete/application.tsx',
  'src/game/PeteInspection.tsx', 'src/game/MaterialStore.tsx',
  'src/pete/application.test.tsx',
])
module.exports = function needsLong(files) {
  return files.length === 0 || files.some(file => !presentation.has(file) &&
    file !== 'README.md' && file !== 'AGENTS.md' && !/^docs\/.+\.md$/.test(file))
}
