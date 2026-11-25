import { describe, expect, it } from 'vitest'
import { clusterGraph } from './memoryGraphLayout'
import type { MemoryGraphEdge, MemoryGraphNode } from './api'

describe('clusterGraph', () => {
  it('clusters only nodes connected by verified edges and is deterministic', () => {
    const nodes: MemoryGraphNode[] = [
      { id: 'm1', kind: 'memory', label: 'One' }, { id: 'm2', kind: 'memory', label: 'Two' },
      { id: 't1', kind: 'topic', label: 'Design' }, { id: 'm3', kind: 'memory', label: 'Isolated' },
    ]
    const edges: MemoryGraphEdge[] = [
      { id: 'e1', source: 'm1', target: 't1', kind: 'explicit-tag', evidence: { field: 'tags', value: 'Design' } },
      { id: 'e2', source: 'm2', target: 't1', kind: 'explicit-tag', evidence: { field: 'tags', value: 'Design' } },
    ]
    const first = clusterGraph(nodes, edges); const second = clusterGraph(nodes, edges)
    expect(first).toEqual(second)
    expect(new Set(first.filter((node) => ['m1', 'm2', 't1'].includes(node.id)).map((node) => node.clusterId)).size).toBe(1)
    expect(first.find((node) => node.id === 'm3')?.clusterId).not.toBe(first.find((node) => node.id === 'm1')?.clusterId)
  })
})
