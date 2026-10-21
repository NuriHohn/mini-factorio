"""Optional development-only Canvas profiler; requires Python Playwright + Chromium.

Usage: python scripts/profile-browser.py LABEL http://127.0.0.1:5173 [energy-saving]
Metrics and CPU profiles go to /tmp, never into game saves. Run revisions
sequentially without builds, tests or source edits during the measurement.
"""
import argparse
import json
from pathlib import Path

from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('label')
parser.add_argument('url')
parser.add_argument('mode', nargs='?', choices=['energy-saving'])
args = parser.parse_args()

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(
        executable_path='/usr/bin/chromium', headless=True,
        args=['--no-sandbox', '--disable-webgl'],
    )
    page = browser.new_page(viewport={'width': 1440, 'height': 1000})
    page.goto(args.url)
    page.wait_for_selector('canvas')
    # Observe the existing scene; do not create another running simulation.
    page.evaluate('''async () => {
      const { FactoryScene } = await import('/src/game/FactoryScene.ts')
      const proto = Object.getPrototypeOf(new FactoryScene().sys), original = proto.step
      proto.step = function (...args) {
        window.scene = this.scene
        return original.apply(this, args)
      }
    }''')
    page.wait_for_function('!!window.scene')
    page.evaluate('''async () => {
      const { createWorld, placeBuilding } = await import('/src/simulation/world.ts')
      const { createResearch } = await import('/src/simulation/research.ts')
      const world = createWorld(() => .42)
      world.research = createResearch(true)
      world.timeMs = 300000
      for (let y = 11; y < 30; y++) for (let x = 11; x < 30; x++) {
        if (x === 20 && y === 20) continue
        placeBuilding(world, x, y, y % 4 === 0 ? 'storage' : 'belt', 'east')
      }
      const scene = window.scene
      scene.restore({ world, view: {
        scrollX: 656 - scene.cameras.main.width / 2,
        scrollY: 656 - scene.cameras.main.height / 2,
        zoom: 2.5, direction: 'east', powerOverlay: false,
      }, savedAt: '2026-10-21T00:00:00.000Z' })
      window.samples = []; window.publications = []
      const update = scene.sys.sceneUpdate.bind(scene)
      scene.sys.sceneUpdate = (...args) => {
        const start = performance.now()
        update(...args)
        window.samples.push(performance.now() - start)
      }
      const { useGameStore } = await import('/src/state/gameStore.ts')
      const publish = useGameStore.getState().publish
      useGameStore.setState({ publish: world => {
        const start = performance.now()
        publish(world)
        window.publications.push(performance.now() - start)
      } })
    }''')
    if args.mode == 'energy-saving':
        page.get_by_role('button', name='Game menu', exact=True).click()
        page.get_by_label('Graphics mode', exact=True).select_option(args.mode)
        page.get_by_role('button', name='Close game menu', exact=True).click()
    page.wait_for_timeout(2000)
    page.evaluate('window.samples = []; window.publications = []')
    cdp = page.context.new_cdp_session(page)
    cdp.send('Performance.enable')
    before = cdp.send('Performance.getMetrics')
    cdp.send('Profiler.enable')
    cdp.send('Profiler.start')
    page.wait_for_timeout(8000)
    profile = cdp.send('Profiler.stop')['profile']
    after = cdp.send('Performance.getMetrics')
    result = page.evaluate('''() => {
      const mean = values => values.length ? values.reduce((a, b) => a + b, 0) / values.length : null
      const samples = window.samples, scene = window.scene
      return {
        frames: samples.length, updateMeanMs: mean(samples),
        updateP95Ms: samples.sort((a, b) => a - b)[Math.floor(samples.length * .95)] ?? null,
        publishMeanMs: mean(window.publications), publishes: window.publications.length,
        simulationMs: scene.world.timeMs, graphicsCommands: scene.machines.commandBuffer.length,
        drawnBuildings: scene.drawnBuildings ?? null,
        buildings: scene.world.buildings.filter(Boolean).length,
      }
    }''')
    start = {metric['name']: metric['value'] for metric in before['metrics']}
    end = {metric['name']: metric['value'] for metric in after['metrics']}
    result['elapsedSeconds'] = end['Timestamp'] - start['Timestamp']
    result['fps'] = result['frames'] / result['elapsedSeconds']
    for metric in ['TaskDuration', 'ScriptDuration']:
        result[metric[0].lower() + metric[1:] + 'Seconds'] = end[metric] - start[metric]
    counts = {}
    nodes = {node['id']: node for node in profile['nodes']}
    for sample in profile.get('samples', []):
        frame = nodes[sample]['callFrame']
        name = frame['functionName'] + ' ' + frame['url'].split('/')[-1].split('?')[0]
        counts[name] = counts.get(name, 0) + 1
    result['cpuTopSamples'] = sorted(counts.items(), key=lambda entry: -entry[1])[:15]
    output = Path('/tmp') / ('perf151-' + Path(args.label).name)
    output.with_suffix('.json').write_text(json.dumps(result, indent=2))
    output.with_name(output.name + '-cpu.json').write_text(json.dumps(profile))
    print(json.dumps(result, indent=2))
    browser.close()
