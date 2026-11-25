import { useMemo, useState } from 'react'
import { CheckCircle, Clock, FileText, Funnel, LockKey, MagnifyingGlass, NotePencil, Tag, UserCircle, XCircle } from '@phosphor-icons/react'
import type { Memory, MemoryStats } from './api'
import { EmptyState } from './components/StateBlocks'
import { formatDate, getLanguage, useT } from './i18n'

type Props = {
  memories: Memory[]
  stats: MemoryStats
  selected: Memory | null
  draft: string
  rejectionReason: string
  loading: boolean
  saving: boolean
  onSelect: (memory: Memory) => void
  onDraft: (value: string) => void
  onRejectionReason: (value: string) => void
  onSave: () => Promise<boolean>
  onAct: (action: 'confirm' | 'reject') => Promise<boolean>
  onOnboarding: () => void
}

export default function MemoryReviewPage(props: Props) {
  const t = useT()
  const { memories, stats, selected, draft, rejectionReason, loading, saving } = props
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [status, setStatus] = useState('all')
  const [editing, setEditing] = useState(false)
  const categories = useMemo(() => [...new Set(memories.map((memory) => memory.type))].sort(), [memories])
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase()
    return memories.filter((memory) =>
      (category === 'all' || memory.type === category) &&
      (status === 'all' || memory.status === status) &&
      (!needle || `${memory.subject} ${memory.content} ${memory.sourceAgent}`.toLocaleLowerCase().includes(needle)),
    )
  }, [memories, query, category, status])

  const displayTime = (raw: string) => {
    if (!raw) return t('review.timeUnknown')
    return formatDate(getLanguage(), raw)
  }

  function select(memory: Memory) {
    setEditing(false)
    props.onSelect(memory)
  }

  async function save() {
    if (await props.onSave()) setEditing(false)
  }

  return <section className="review-page">
    <header className="review-heading compact-heading">
      <div><p className="eyebrow">MEMORY LIFECYCLE / HUMAN REVIEW</p><p>{t('review.headingNote')}</p></div>
      <div className="review-stats" aria-label={t('review.statsLabel')}>
        <article><span>{t('review.statCandidate')}</span><strong>{stats.candidateMemories}</strong></article>
        <article><span>{t('review.statPending')}</span><strong>{stats.pendingReview}</strong></article>
        <article><span>{t('review.statConfirmed')}</span><strong>{stats.confirmedMemories}</strong></article>
      </div>
    </header>

    <div className="review-workspace">
      <aside className="review-filters" aria-label={t('review.filtersLabel')}>
        <div><p className="eyebrow">FILTERS</p><h3>{t('review.filtersTitle')}</h3></div>
        <label className="search-field"><MagnifyingGlass size={18} /><span className="sr-only">{t('review.search')}</span><input aria-label={t('review.search')} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('review.searchPlaceholder')} /></label>
        <label><Funnel size={17} /><span>{t('review.category')}</span><select aria-label={t('review.categoryLabel')} value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">{t('review.categoryAll')}</option>{categories.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
        <label><Clock size={17} /><span>{t('review.status')}</span><select aria-label={t('review.statusLabel')} value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">{t('review.statusAll')}</option><option value="candidate">Candidate</option><option value="disputed">Disputed</option></select></label>
        <div className="lifecycle-guide"><strong>{t('review.lifecycleCandidate')}</strong><span>{t('review.lifecycleJudgement')}</span><em>{t('review.lifecycleOutcome')}</em></div>
      </aside>
      <aside className="candidate-queue" aria-label={t('review.queueLabel')}>
        <div className="queue-heading"><div><p className="eyebrow">CANDIDATE QUEUE</p><h3>{t('review.queueTitle')}</h3></div><span>{filtered.length} / {memories.length}</span></div>
        {loading && <div className="skeletons" aria-label={t('review.loading')}><i /><i /><i /></div>}
        {!loading && memories.length === 0 && <EmptyState icon={<FileText size={26} />} title={t('review.emptyTitle')} description={t('review.emptyDetail')} action={<button className="primary-action" onClick={props.onOnboarding}>{t('review.viewProfile')}</button>} />}
        {!loading && memories.length > 0 && filtered.length === 0 && <EmptyState icon={<MagnifyingGlass size={26} />} title={t('review.noMatchTitle')} description={t('review.noMatchDetail')} />}
        {!loading && filtered.map((memory) => <button key={memory.id} className={`candidate-row ${memory.id === selected?.id ? 'selected' : ''}`} aria-pressed={memory.id === selected?.id} onClick={() => select(memory)}>
          <span className="candidate-icon"><FileText size={20} /></span><span className="candidate-copy"><small>{memory.type} · {memory.status}</small><strong>{memory.subject || t('review.unnamed')}</strong><span>{memory.content}</span><em>{memory.sourceAgent} · {displayTime(memory.created)}</em></span>
        </button>)}
      </aside>

      <section className="memory-inspector" aria-live="polite">
        {!selected && !loading && <EmptyState icon={<FileText size={30} />} title={memories.length ? t('review.selectPromptTitle') : t('review.waitingTitle')} description={memories.length ? t('review.selectPromptDetail') : t('review.waitingDetail')} action={memories.length === 0 ? <button className="secondary-action" onClick={props.onOnboarding}>{t('review.viewProfile')}</button> : undefined} />}
        {selected && <>
          <header className="inspector-heading"><div><p className="eyebrow">MEMORY INSPECTOR / {selected.status.toUpperCase()}</p><h3>{selected.subject || t('review.unnamed')}</h3></div><span className="lifecycle-badge">{t('review.lifecycleCandidate')}</span></header>
          <div className="lifecycle-track" aria-label={t('review.lifecycleLabel')}><strong>{t('review.lifecycleCandidate')}</strong><i /><span>{t('review.explicitConfirmation')}</span><i /><span>{t('review.formalMemory')}</span></div>
          <dl className="inspector-meta">
            <div><UserCircle size={17} /><dt>{t('review.source')}</dt><dd>{selected.sourceAgent}</dd></div>
            <div><Clock size={17} /><dt>{t('review.created')}</dt><dd>{displayTime(selected.created)}</dd></div>
            <div><Tag size={17} /><dt>{t('review.category')}</dt><dd>{selected.type}</dd></div>
            <div><LockKey size={17} /><dt>{t('review.aiAccess')}</dt><dd>{selected.aiAccess || 'denied'}</dd></div>
            <div><FileText size={17} /><dt>{t('review.visibility')}</dt><dd>{selected.visibility || 'private'}</dd></div>
            <div><NotePencil size={17} /><dt>{t('review.revision')}</dt><dd><code>{selected.revision.slice(0, 12)}…</code></dd></div>
          </dl>
          <section className="memory-content-panel"><div className="content-label"><span>{t('review.contentLabel')}</span>{selected.tags?.length ? <span>{selected.tags.join(' · ')}</span> : <span>{t('review.noTags')}</span>}</div>{editing ? <textarea aria-label={t('review.contentArea')} value={draft} onChange={(event) => props.onDraft(event.target.value)} maxLength={4000} disabled={saving} /> : <p>{selected.content}</p>}</section>
          <label className="rejection-field" htmlFor="rejection-reason">{t('review.rejectionLabel')}<input id="rejection-reason" value={rejectionReason} onChange={(event) => props.onRejectionReason(event.target.value)} maxLength={200} placeholder={t('review.rejectionPlaceholder')} disabled={saving} /></label>
          <footer className="inspector-actions">
            <p>{t('review.writeNote')}</p>
            <div>{editing ? <><button className="secondary" onClick={() => { props.onDraft(selected.content); setEditing(false) }} disabled={saving}>{t('review.cancelEdit')}</button><button className="secondary" onClick={() => void save()} disabled={saving || !draft.trim()}>{t('review.saveEdit')}</button></> : <button className="secondary" onClick={() => setEditing(true)} disabled={saving}><NotePencil size={18} />{t('review.editMemory')}</button>}<button className="danger" onClick={() => void props.onAct('reject')} disabled={saving}><XCircle size={18} />{t('review.rejectMemory')}</button><button className="confirm" onClick={() => void props.onAct('confirm')} disabled={saving}><CheckCircle size={18} />{t('review.confirmMemory')}</button></div>
          </footer>
        </>}
      </section>
    </div>
  </section>
}
