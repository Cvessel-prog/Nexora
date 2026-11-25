import type { MemoryGraphEdge, MemoryGraphNode } from './api'

export type PositionedGraphNode = MemoryGraphNode & { x: number; y: number; clusterId: string }

/**
 * Deterministic connected-component clustering using verified graph edges only.
 * It never invents relationships: clusters are exactly the components formed by
 * explicit tag edges. Isolated nodes remain independent components.
 */
export function clusterGraph(nodes: MemoryGraphNode[], edges: MemoryGraphEdge[]): PositionedGraphNode[] {
  const parent = new Map(nodes.map((node) => [node.id, node.id]))
  const find = (id: string): string => {
    const current = parent.get(id) ?? id
    if (current === id) return id
    const root = find(current)
    parent.set(id, root)
    return root
  }
  const union = (left: string, right: string) => {
    const a = find(left); const b = find(right)
    if (a !== b) {
      const root = a.localeCompare(b) <= 0 ? a : b
      parent.set(a, root); parent.set(b, root)
    }
  }
  const ids = new Set(nodes.map((node) => node.id))
  edges.forEach((edge) => { if (ids.has(edge.source) && ids.has(edge.target)) union(edge.source, edge.target) })

  const groups = new Map<string, MemoryGraphNode[]>()
  nodes.forEach((node) => { const root = find(node.id); groups.set(root, [...(groups.get(root) ?? []), node]) })
  const components = [...groups.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
  const columns = Math.max(1, Math.ceil(Math.sqrt(components.length)))
  const cellWidth = 440; const cellHeight = 340

  return components.flatMap(([clusterId, members], clusterIndex) => {
    const cx = 220 + (clusterIndex % columns) * cellWidth
    const cy = 180 + Math.floor(clusterIndex / columns) * cellHeight
    const topics = members.filter((node) => node.kind === 'topic')
    const memories = members.filter((node) => node.kind === 'memory')
    if (members.length === 1) return [{ ...members[0], x: cx, y: cy, clusterId }]
    const topicRadius = Math.max(40, Math.min(100, topics.length * 22))
    const memoryRadius = Math.max(125, Math.min(220, 90 + memories.length * 8))
    return [
      ...topics.map((node, index) => ({ ...node, x: cx + Math.cos((index / Math.max(1, topics.length)) * Math.PI * 2) * topicRadius, y: cy + Math.sin((index / Math.max(1, topics.length)) * Math.PI * 2) * topicRadius, clusterId })),
      ...memories.map((node, index) => ({ ...node, x: cx + Math.cos((index / Math.max(1, memories.length)) * Math.PI * 2) * memoryRadius, y: cy + Math.sin((index / Math.max(1, memories.length)) * Math.PI * 2) * memoryRadius, clusterId })),
    ]
  })
}
