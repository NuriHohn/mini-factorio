import type { Decoration, TreeSpecies } from '../simulation/nature'
export const NATURE_TOOLS = ['plantOak', 'plantPine', 'plantBirch', 'axe', 'flowers', 'grass', 'eraseDecoration'] as const
export type NatureTool = typeof NATURE_TOOLS[number]
export function natureTool(tool: string | null): tool is NatureTool { return NATURE_TOOLS.includes(tool as NatureTool) }
export function plantingSpecies(tool: NatureTool): TreeSpecies | null {
  return tool === 'plantOak' ? 'oak' : tool === 'plantPine' ? 'pine' : tool === 'plantBirch' ? 'birch' : null
}
export function brushMode(tool: string | null): Decoration | null | undefined {
  return tool === 'flowers' ? 'flowers' : tool === 'grass' ? 'grass' : tool === 'eraseDecoration' ? null : undefined
}
