import { useEffect, useMemo, useState } from 'react'
import type { ApiClient, MemoryEvents } from './api'
import { formatDate, useLanguage, useT } from './i18n'

export default function MemoryTimelinePage({ client, onReview }: { client: ApiClient; onReview: (id?: string) => void }) {
  const t = useT(); const [language] = useLanguage()
  const [value, setValue] = useState<MemoryEvents | null>(null)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  useEffect(() => { const controller = new AbortController(); client.memoryEvents(controller.signal).then(setValue).catch((e: Error) => { if (!controller.signal.aborted) setError(e.message) }); return () => controller.abort() }, [client])
  const items = useMemo(() => value?.items.filter((item) => !query || `${item.subject} ${item.eventType} ${item.sourceAgent}`.toLowerCase().includes(query.toLowerCase())) ?? [], [query, value])
  if (error) return <section className="memory-state error" role="alert"><h2>{t('memory.timeline.unavailable')}</h2><p>{error}</p></section>
  if (!value) return <section className="memory-state"><span className="state-spinner" /><h2>{t('memory.timeline.loading')}</h2></section>
  return <section className="memory-timeline"><header><div><p className="eyebrow">{t('memory.timeline.eyebrow')}</p><h2>{t('memory.timeline.title')}</h2><p>{t('memory.timeline.description')}</p></div><input aria-label={t('memory.timeline.search')} type="search" placeholder={t('memory.timeline.search')} value={query} onChange={(e) => setQuery(e.target.value)} /></header>{items.length ? <ol>{items.map((item) => <li key={item.eventId}><time>{formatDate(language, item.timestamp)}</time><div><span className={`event-dot ${item.status}`} /><p className="event-title">{item.subject || item.type || t('nav.memory')}</p><p>{item.eventType.replaceAll('.', ' · ')}</p><small>{item.origin === 'audit' ? t('memory.timeline.audit') : t('memory.timeline.record')} · {item.sourceAgent || t('memory.graph.localVault')}</small>{item.status === 'candidate' && <button className="text-action" onClick={() => onReview(item.memoryId)}>{t('memory.timeline.review')}</button>}</div></li>)}</ol> : <div className="memory-state"><h3>{t('memory.timeline.empty')}</h3><p>{t('memory.timeline.emptyHint')}</p></div>}</section>
}
