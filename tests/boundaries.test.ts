import { testTier } from '../testTiers.ts'
import { readdirSync, readFileSync } from 'node:fs'
import { resolve, dirname, relative } from 'node:path'
import ts from 'typescript'
import { expect, it } from 'vitest'
import { testSuites } from '../testSuites.ts'

function files(folder: string): string[] {
  return readdirSync(folder, { withFileTypes: true }).flatMap(entry => {
    const path = `${folder}/${entry.name}`
    return entry.isDirectory() ? files(path) : [path]
  })
}
function imports(path: string): string[] {
  const source = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest)
  return source.statements.flatMap(statement => {
    if (!ts.isImportDeclaration(statement) && !ts.isExportDeclaration(statement)) return []
    if (!statement.moduleSpecifier || !ts.isStringLiteral(statement.moduleSpecifier)) return []
    if (ts.isImportDeclaration(statement)) {
      const clause = statement.importClause
      if (clause?.isTypeOnly || clause?.namedBindings && ts.isNamedImports(clause.namedBindings) && !clause.name && clause.namedBindings.elements.every(element => element.isTypeOnly)) return []
    } else if (statement.isTypeOnly || statement.exportClause && ts.isNamedExports(statement.exportClause) && statement.exportClause.elements.every(element => element.isTypeOnly)) return []
    const specifier = statement.moduleSpecifier.text
    if (!specifier.startsWith('.')) return []
    const target = resolve(dirname(path), specifier)
    return [target, target + '.ts', target + '.tsx'].filter(file => allSources.has(file))
  })
}
const allSources = new Set(files('src').filter(file => /\.tsx?$/.test(file)).map(file => resolve(file)))

it('assigns every test to exactly one runnable suite, without exclusions or missing files', () => {
  const assigned = Object.values(testSuites).flat()
  const actual = [...files('src'), ...files('tests')].filter(file => /\.test\.tsx?$/.test(file))
  expect(new Set(assigned).size).toBe(assigned.length)
  expect([...assigned].sort()).toEqual(actual.sort())
})

it('keeps Factory runtime and panels outside Pete and common startup static imports', () => {
  const visited = new Set<string>()
  const pending = ['src/main.tsx', 'src/pete/application.tsx', 'src/pete/scene.ts'].map(file => resolve(file))
  while (pending.length) {
    const path = pending.pop()!
    if (visited.has(path)) continue
    visited.add(path)
    pending.push(...imports(path))
  }
  expect(visited.has(resolve('src/App.tsx'))).toBe(true)
  expect(visited.has(resolve('src/core/GameScene.ts'))).toBe(true)
  const forbidden = [...visited].map(path => relative(resolve('src'), path).replaceAll('\\', '/')).filter(path =>
    path.startsWith('factory/') || /game\/(ResearchPanel|AnalyticsPanel|RevengeHUD|RevengeVisuals|policeVisuals|FactoryOverview)\./.test(path) || path === 'simulation/step.ts')
  expect(forbidden).toEqual([])
})

it('partitions the full inventory into disjoint quick and intact long runs', () => {
  const all = Object.values(testSuites).flat()
  const quick = all.filter(path => testTier(path) === 'quick')
  const long = all.filter(path => testTier(path) === 'long')
  expect(quick.length).toBeGreaterThan(0); expect(long.length).toBeGreaterThan(0)
  expect([...quick, ...long].sort()).toEqual([...all].sort())
  expect(quick.some(path => long.includes(path))).toBe(false)
  for (const path of ['priorityAcceptance', 'infrastructurePaths', 'inventorIndependence', 'productionPaths', 'homesteadDaily']) expect(testTier(`src/simulation/${path}.test.ts`)).toBe('long')
})
