import { useEffect, useMemo, useState } from 'react'
import { ReactFlow, Background, Controls, type Edge, type Node, type NodeMouseHandler, useEdgesState, useNodesState } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { ApiClient, MemoryGraph, MemoryGraphNode } from './api'
import { clusterGraph } from './memoryGraphLayout'
import { useT } from './i18n'

type Props = { client: ApiClient; onReview: (id?: string) => void; onImport: () => void }

export default function MemoryGraphPage({ client, onReview, onImport }: Props) {
  const t = useT()
  const [graph, setGraph] = useState<MemoryGraph | null>(null)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [selected, setSelected] = useState<MemoryGraphNode | null>(null)
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])

  useEffect(() => {
    const controller = new AbortController()
    client.memoryGraph(controller.signal).then(setGraph).catch((reason: Error) => { if (!controller.signal.aborted) setError(reason.message) })
    return () => controller.abort()
  }, [client])

  const visible = useMemo(() => {
    if (!graph) return []
    const needle = query.trim().toLocaleLowerCase()
    return graph.nodes.filter((item) => (status === 'all' || item.kind === 'topic' || item.status === status) && (!needle || `${item.label} ${item.preview ?? ''} ${(item.tags ?? []).join(' ')}`.toLocaleLowerCase().includes(needle)))
  }, [graph, query, status])

  useEffect(() => {
    if (!graph) return
    const visibleIds = new Set(visible.map((item) => item.id))
    const visibleEdges = graph.edges.filter((item) => visibleIds.has(item.source) && visibleIds.has(item.target))
    const positioned = clusterGraph(visible, visibleEdges)
    const nextNodes: Node[] = positioned.map((item) => ({ id: item.id, data: { label: item.kind === 'topic' ? `${item.label} · ${item.memberCount ?? 0}` : item.label }, position: { x: item.x, y: item.y }, className: `memory-node ${item.kind === 'topic' ? 'topic' : item.status ?? ''}` }))
    const ids = new Set(nextNodes.map((item) => item.id))
    setNodes(nextNodes)
    setEdges(visibleEdges.filter((item) => ids.has(item.source) && ids.has(item.target)).map((item) => ({ id: item.id, source: item.source, target: item.target, className: 'memory-edge', ariaLabel: `Explicit tag relationship: ${item.evidence.value}` })))
  }, [graph, visible, setEdges, setNodes])

  const byId = useMemo(() => new Map(graph?.nodes.map((item) => [item.id, item]) ?? []), [graph])
  if (error) return <section className="memory-state error" role="alert"><h2>{t('memory.graph.unavailable')}</h2><p>{error}</p><button onClick={() => location.reload()}>{t('memory.graph.retry')}</button></section>
  if (!graph) return <section className="memory-state"><span className="state-spinner" /><h2>{t('memory.graph.loading')}</h2><p>{t('memory.graph.loadingHint')}</p></section>
  if (!graph.nodes.length) return <section className="memory-state"><h2>{t('memory.graph.empty')}</h2><p>{t('memory.graph.emptyHint')}</p><div><button onClick={onImport}>{t('memory.graph.import')}</button><button className="secondary" onClick={() => onReview()}>{t('memory.graph.openReview')}</button></div></section>

  return <section className="memory-space" aria-label={t('memory.graph.aria')}>
    <div className="graph-toolbar">
      <label><span className="sr-only">{t('memory.graph.search')}</span><input type="search" placeholder={t('memory.graph.search')} value={query} onChange={(event) => setQuery(event.target.value)} /></label>
      <select aria-label={t('memory.graph.filter')} value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">{t('memory.graph.all')}</option><option value="confirmed">{t('memory.graph.confirmed')}</option><option value="candidate">{t('memory.graph.pending')}</option></select>
      <div className="graph-legend"><span className="confirmed">{t('memory.graph.confirmed')}</span><span className="candidate">{t('memory.graph.pending')}</span><span className="topic">{t('memory.graph.topic')}</span></div>
    </div>
    <div className="graph-stage">
      <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onNodeClick={((_, node) => setSelected(byId.get(node.id) ?? null)) as NodeMouseHandler} fitView minZoom={0.25} maxZoom={1.8} proOptions={{ hideAttribution: true }}>
        <Background color="rgba(102, 126, 180, .14)" gap={28} /><Controls showInteractive={false} />
      </ReactFlow>
      <p className="relationship-proof">{t('memory.graph.proof')} · {graph.edges.length} {t('memory.graph.verified')}</p>
      {selected && <aside className="graph-inspector"><button className="inspector-close" aria-label={t('memory.graph.closeDetails')} onClick={() => setSelected(null)}>×</button><p className="eyebrow">{selected.kind === 'topic' ? t('memory.graph.topic') : selected.status}</p><h2>{selected.label}</h2>{selected.preview && <p>{selected.preview}</p>}{selected.tags?.length ? <div className="tag-row">{selected.tags.map((tag) => <span key={tag}>{tag}</span>)}</div> : null}<dl><dt>{t('memory.graph.source')}</dt><dd>{selected.sourceAgent || t('memory.graph.localVault')}</dd><dt>{t('memory.graph.updated')}</dt><dd>{selected.updated ? new Date(selected.updated).toLocaleString() : '—'}</dd></dl>{selected.reviewable && <button onClick={() => onReview(selected.id)}>{t('memory.graph.reviewCandidate')}</button>}</aside>}
    </div>
    <details className="graph-accessible-list"><summary>{t('memory.graph.accessibleList')} ({visible.length})</summary>{visible.map((item) => <button key={item.id} onClick={() => setSelected(item)}>{item.label} <small>{item.kind === 'topic' ? t('memory.graph.topic') : item.status}</small></button>)}</details>
  </section>
}
