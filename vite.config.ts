import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), {
    name: 'verify-pete-build-boundary',
    generateBundle(_options, bundle) {
      const chunks = Object.values(bundle).filter(chunk => chunk.type === 'chunk')
      const roots = chunks.filter(chunk => chunk.isEntry || /\/src\/pete\/(application|scene)\./.test(chunk.facadeModuleId?.replaceAll('\\', '/') ?? ''))
      const visited = new Set<string>()
      const pending = roots.map(chunk => chunk.fileName)
      while (pending.length) {
        const name = pending.pop()!
        if (visited.has(name)) continue
        visited.add(name)
        const chunk = bundle[name]
        if (chunk?.type === 'chunk') pending.push(...chunk.imports)
      }
      const forbidden = chunks.filter(chunk => visited.has(chunk.fileName)).flatMap(chunk => Object.keys(chunk.modules)).filter(path => {
        const name = path.replaceAll('\\', '/')
        return name.includes('/src/factory/') || /\/src\/game\/(ResearchPanel|AnalyticsPanel|RevengeHUD|RevengeVisuals|policeVisuals|FactoryOverview)\./.test(name)
      })
      if (forbidden.length) this.error(`Pete startup loads Factory modules: ${forbidden.join(', ')}`)
      this.emitFile({ type: 'asset', fileName: 'pete-build-boundary.json', source: JSON.stringify({
        roots: roots.map(chunk => chunk.fileName),
        staticChunks: [...visited],
        staticBytes: chunks.filter(chunk => visited.has(chunk.fileName)).reduce((sum, chunk) => sum + Buffer.byteLength(chunk.code), 0),
        factoryChunks: chunks.filter(chunk => Object.keys(chunk.modules).some(path => path.replaceAll('\\', '/').includes('/src/factory/'))).map(chunk => chunk.fileName),
        forbidden,
      }, null, 2) })
    },
  }],
  build: { manifest: true },
})
