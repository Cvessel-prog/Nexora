import { useEffect, useMemo, useState } from 'react'
import type { ApiClient, GrowthAssessment, GrowthAssociation, GrowthDimensionContent, GrowthDimensionKey, GrowthDimensions, GrowthGoal, GrowthTimeline } from './api'
import { ErrorState, LoadingState } from './components/StateBlocks'
import { useT } from './i18n'

const DIMENSION_KEYS: GrowthDimensionKey[] = ['mind', 'body', 'spirit', 'vocation']
const HORIZONS: GrowthGoal['horizon'][] = ['long-term', 'quarterly', 'monthly']
const RELATION_TYPES: GrowthAssociation['relationType'][] = ['correlation', 'causation']

type Tab = 'overview' | 'dimensions' | 'assessment' | 'timeline' | 'map' | 'goals'

function tabs(t: (key: string) => string): { key: Tab; label: string }[] {
  return [
    { key: 'overview', label: t('growth.tab.overview') },
    { key: 'dimensions', label: t('growth.tab.dimensions') },
    { key: 'assessment', label: t('growth.tab.assessment') },
    { key: 'timeline', label: t('growth.tab.timeline') },
    { key: 'map', label: t('growth.tab.map') },
    { key: 'goals', label: t('growth.tab.goals') },
  ]
}

const emptyDimension = (): GrowthDimensionContent => ({ current: '', evidence: '', challenges: '', direction: '' })

export default function GrowthDashboard({ client }: { client: ApiClient }) {
  const t = useT()
  const [tab, setTab] = useState<Tab>('overview')
  const [dimensions, setDimensions] = useState<GrowthDimensions | null>(null)
  const [assessments, setAssessments] = useState<GrowthAssessment[]>([])
  const [timeline, setTimeline] = useState<GrowthTimeline | null>(null)
  const [associations, setAssociations] = useState<GrowthAssociation[]>([])
  const [goals, setGoals] = useState<GrowthGoal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    Promise.all([
      client.growthDimensions(),
      client.growthAssessments(),
      client.growthTimeline(),
      client.growthAssociations(),
      client.growthGoals(),
    ]).then(([dim, ov, tl, assoc, gl]) => {
      if (cancelled) return
      setDimensions(dim); setAssessments(ov.assessments); setTimeline(tl); setAssociations(assoc); setGoals(gl)
    }).catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : t('growth.loadFailed')) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [client, t])

  const stats = useMemo(() => ({
    assessments: assessments.length,
    confirmed: assessments.filter((a) => a.status === 'confirmed').length,
    goals: goals.length,
    goalDone: goals.filter((g) => g.completed).length,
    associations: associations.length,
    months: timeline?.months.length ?? 0,
  }), [assessments, goals, associations, timeline])

  async function refreshDerivedViews() {
    const [dim, tl] = await Promise.all([client.growthDimensions(), client.growthTimeline()])
    setDimensions(dim)
    setTimeline(tl)
  }

  if (loading) return <LoadingState label={t('growth.loading')} />
  if (error) return <ErrorState title={t('growth.loadError')} description={error} />

  return <section className="growth-dashboard" aria-label={t('growth.ariaLabel')}>
    <header className="growth-head compact-heading">
      <div><p className="eyebrow">HUMAN 3.0 / GROWTH</p><h2 className="sr-only">Personal Growth Intelligence</h2><p>{t('growth.heading')}</p></div>
      <div className="growth-stats" aria-label={t('growth.statsLabel')}>
        <article><span>Assessments</span><strong>{stats.confirmed}/{stats.assessments}</strong></article>
        <article><span>Goals</span><strong>{stats.goalDone}/{stats.goals}</strong></article>
        <article><span>Associations</span><strong>{stats.associations}</strong></article>
      </div>
    </header>

    <div className="growth-tabs" role="tablist" aria-label={t('growth.viewsLabel')}>
      {tabs(t).map((item) => <button key={item.key} role="tab" aria-selected={tab === item.key} className={tab === item.key ? 'active' : ''} onClick={() => setTab(item.key)}>{item.label}</button>)}
    </div>

    {tab === 'overview' && <OverviewPane timeline={timeline} dimensions={dimensions} />}
    {tab === 'dimensions' && <DimensionsPane dimensions={dimensions} />}
    {tab === 'assessment' && <AssessmentPane client={client} assessments={assessments} setAssessments={setAssessments} onConfirmed={refreshDerivedViews} />}
    {tab === 'timeline' && <TimelinePane timeline={timeline} />}
    {tab === 'map' && <MapPane client={client} associations={associations} setAssociations={setAssociations} />}
    {tab === 'goals' && <GoalsPane client={client} goals={goals} setGoals={setGoals} />}
  </section>
}

function OverviewPane({ timeline, dimensions }: { timeline: GrowthTimeline | null; dimensions: GrowthDimensions | null }) {
  const t = useT()
  const months = timeline?.months ?? []
  const latest = months[months.length - 1]
  return <div className="growth-pane">
    <p className="growth-disclaimer">{dimensions?.disclaimer ?? t('growth.disclaimer')}</p>
    {latest ? <div className="overview-latest">
      <p className="eyebrow">LATEST MONTH</p><h3>{latest.month}</h3>
      <p>{t('growth.latestStatus', { assessment: latest.assessment ? t('growth.recorded') : t('growth.notRecorded'), human3: latest.human3 ? t('growth.recorded') : t('growth.notRecorded'), monthly: latest.monthly ? t('growth.recorded') : t('growth.notRecorded') })}</p>
    </div> : <p className="muted">{t('growth.noRecords')}</p>}
  </div>
}

function DimensionsPane({ dimensions }: { dimensions: GrowthDimensions | null }) {
  const t = useT()
  const list = dimensions?.dimensions ?? []
  return <div className="growth-pane"><div className="dimension-grid">
    {list.map((dim) => <article key={dim.key} className="dimension-card">
      <header><h3>{dim.title}</h3><span>{dim.subtitle}</span></header>
      <ul className="dimension-areas">{dim.areas.map((area) => <li key={area}>{area}</li>)}</ul>
      {dim.score !== null && <p className="dimension-score">{t('growth.latestSelfAssessment')} <strong>{dim.score}</strong></p>}
      {dim.monthlyText ? <p className="dimension-monthly">{dim.monthlyText}</p> : <p className="muted">{t('growth.noMonthly')}</p>}
    </article>)}
  </div></div>
}

function TimelinePane({ timeline }: { timeline: GrowthTimeline | null }) {
  const t = useT()
  const months = timeline?.months ?? []
  if (months.length === 0) return <div className="growth-pane"><p className="muted">{t('growth.noTimeline')}</p></div>
  return <div className="growth-pane"><div className="timeline-list">
    {months.map((point) => <article key={point.month} className="timeline-point">
      <header><h3>{point.month}</h3></header>
      {point.assessment && <p><span className="tl-label">{t('growth.selfAssessment')}</span>{point.assessment.level ? ` Level ${point.assessment.level}` : ''} · {t('growth.completedDimensions', { done: point.assessment.completedDimensions })}</p>}
      {point.human3 && <p><span className="tl-label">Human 3.0</span>{DIMENSION_KEYS.map((k) => `${k.toUpperCase()} ${point.human3!.scores[k] ?? '-'}`).join(' · ')}</p>}
      {point.monthly && <p><span className="tl-label">{t('growth.monthlyReflection')}</span>{t('growth.events', { count: point.monthly.events.length })} · {t('growth.goalsCount', { count: point.monthly.goals.length })}</p>}
    </article>)}
  </div></div>
}

function MapPane({ client, associations, setAssociations }: { client: ApiClient; associations: GrowthAssociation[]; setAssociations: (value: GrowthAssociation[]) => void }) {
  const t = useT()
  const [from, setFrom] = useState<GrowthDimensionKey>('mind')
  const [to, setTo] = useState<GrowthDimensionKey>('body')
  const [type, setType] = useState<GrowthAssociation['relationType']>('correlation')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')

  async function add() {
    if (type === 'causation' && !note.trim()) { setError(t('growth.causationRequired')); return }
    setError('')
    try {
      const record = await client.addGrowthAssociation({ from_dimension: from, from_event_id: '', to_dimension: to, to_event_id: '', relation_type: type, note: note.trim() })
      setAssociations([...associations, record]); setNote('')
    } catch (err) { setError(err instanceof Error ? err.message : t('growth.addFailed')) }
  }
  async function remove(record: GrowthAssociation) {
    setError('')
    try {
      await client.deleteGrowthAssociation(record.id, record.revision)
      setAssociations(associations.filter((a) => a.id !== record.id))
    } catch (err) { setError(err instanceof Error ? err.message : t('growth.deleteFailed')) }
  }

  return <div className="growth-pane">
    <div className="assoc-form">
      <label>{t('growth.from')} <select aria-label={t('growth.fromAria')} value={from} onChange={(e) => setFrom(e.target.value as GrowthDimensionKey)}>{DIMENSION_KEYS.map((k) => <option key={k} value={k}>{k}</option>)}</select></label>
      <label>{t('growth.to')} <select aria-label={t('growth.toAria')} value={to} onChange={(e) => setTo(e.target.value as GrowthDimensionKey)}>{DIMENSION_KEYS.map((k) => <option key={k} value={k}>{k}</option>)}</select></label>
      <label>{t('growth.type')} <select aria-label={t('growth.typeAria')} value={type} onChange={(e) => setType(e.target.value as GrowthAssociation['relationType'])}>{RELATION_TYPES.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
      <input aria-label={t('growth.noteAria')} placeholder={t('growth.notePlaceholder')} value={note} onChange={(e) => setNote(e.target.value)} />
      <button className="primary-action" onClick={() => void add()}>{t('growth.addAssociation')}</button>
    </div>
    {error && <p className="field-error" role="alert">{error}</p>}
    {associations.length === 0 ? <p className="muted">{t('growth.noAssociations')}</p> : <ul className="assoc-list">
      {associations.map((a) => <li key={a.id}><span className={`assoc-type ${a.relationType}`}>{a.relationType}</span>{a.fromDimension.toUpperCase()} → {a.toDimension.toUpperCase()}{a.note && <em>：{a.note}</em>}<button className="text-button danger-link" onClick={() => void remove(a)}>{t('growth.delete')}</button></li>)}
    </ul>}
  </div>
}

function GoalsPane({ client, goals, setGoals }: { client: ApiClient; goals: GrowthGoal[]; setGoals: (value: GrowthGoal[]) => void }) {
  const t = useT()
  const [horizon, setHorizon] = useState<GrowthGoal['horizon']>('monthly')
  const [title, setTitle] = useState('')
  const [action, setAction] = useState('')
  const [priority, setPriority] = useState<GrowthGoal['priority']>('medium')
  const [due, setDue] = useState('')
  const [error, setError] = useState('')

  async function add() {
    if (!title.trim()) { setError(t('growth.titleRequired')); return }
    setError('')
    try {
      const record = await client.addGrowthGoal({ horizon, title: title.trim(), action: action.trim(), priority, due, previous_goal_id: '' })
      setGoals([...goals, record]); setTitle(''); setAction(''); setDue('')
    } catch (err) { setError(err instanceof Error ? err.message : t('growth.addFailed')) }
  }
  async function toggle(goal: GrowthGoal) {
    setError('')
    try {
      const record = await client.updateGrowthGoal(goal.id, { title: goal.title, action: goal.action, priority: goal.priority, due: goal.due, completed: !goal.completed, previous_goal_id: goal.previousGoalId, expected_revision: goal.revision })
      setGoals(goals.map((g) => (g.id === goal.id ? record : g)))
    } catch (err) { setError(err instanceof Error ? err.message : t('growth.updateFailed')) }
  }
  async function remove(goal: GrowthGoal) {
    setError('')
    try {
      await client.deleteGrowthGoal(goal.id, goal.revision)
      setGoals(goals.filter((g) => g.id !== goal.id))
    } catch (err) { setError(err instanceof Error ? err.message : t('growth.deleteFailed')) }
  }

  const visible = goals.filter((g) => g.horizon === horizon)

  return <div className="growth-pane">
    <div className="goal-form">
      <select aria-label={t('growth.goalLevel')} value={horizon} onChange={(e) => setHorizon(e.target.value as GrowthGoal['horizon'])}>{HORIZONS.map((h) => <option key={h} value={h}>{h}</option>)}</select>
      <input aria-label={t('growth.goalTitleAria')} placeholder={t('growth.goalTitlePlaceholder')} value={title} onChange={(e) => setTitle(e.target.value)} />
      <input aria-label={t('growth.actionAria')} placeholder={t('growth.actionPlaceholder')} value={action} onChange={(e) => setAction(e.target.value)} />
      <select aria-label={t('growth.priorityAria')} value={priority} onChange={(e) => setPriority(e.target.value as GrowthGoal['priority'])}><option value="low">low</option><option value="medium">medium</option><option value="high">high</option></select>
      <input aria-label={t('growth.dueAria')} placeholder={t('growth.duePlaceholder')} value={due} onChange={(e) => setDue(e.target.value)} />
      <button className="primary-action" onClick={() => void add()}>{t('growth.addGoal')}</button>
    </div>
    {error && <p className="field-error" role="alert">{error}</p>}
    <div className="goal-list">
      {visible.length === 0 ? <p className="muted">{t('growth.noGoals')}</p> : visible.map((g) => <article key={g.id} className={`goal-item ${g.completed ? 'done' : ''}`}>
        <button className="goal-check" aria-label={g.completed ? t('growth.markUndone') : t('growth.markDone')} onClick={() => void toggle(g)}>{g.completed ? '✓' : '○'}</button>
        <div><strong>{g.title}</strong>{g.action && <p>{g.action}</p>}</div>
        <span className="goal-meta">{g.priority}{g.due ? ` · ${g.due}` : ''}</span>
        <button className="text-button danger-link" onClick={() => void remove(g)}>{t('growth.delete')}</button>
      </article>)}
    </div>
  </div>
}

function AssessmentPane({ client, assessments, setAssessments, onConfirmed }: { client: ApiClient; assessments: GrowthAssessment[]; setAssessments: (value: GrowthAssessment[]) => void; onConfirmed: () => Promise<void> }) {
  const t = useT()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [month, setMonth] = useState('')
  const [draft, setDraft] = useState<Record<GrowthDimensionKey, GrowthDimensionContent>>({ mind: emptyDimension(), body: emptyDimension(), spirit: emptyDimension(), vocation: emptyDimension() })
  const [level, setLevel] = useState('')
  const [error, setError] = useState('')

  const selected = assessments.find((a) => a.id === selectedId) ?? null

  function select(assessment: GrowthAssessment) {
    setSelectedId(assessment.id)
    setDraft(assessment.dimensions)
    setLevel(assessment.level)
  }
  async function create() {
    if (!month) { setError(t('growth.monthRequired')); return }
    setError('')
    try {
      const record = await client.createGrowthAssessment(month)
      setAssessments([...assessments, record]); select(record); setMonth('')
    } catch (err) { setError(err instanceof Error ? err.message : t('growth.createFailed')) }
  }
  async function saveDimension(key: GrowthDimensionKey) {
    if (!selected) return
    try {
      const record = await client.saveGrowthDimension(selected.id, key, draft[key], selected.revision)
      setAssessments(assessments.map((a) => (a.id === selected.id ? record : a))); setDraft(record.dimensions); setSelectedId(record.id); setLevel(record.level)
    } catch (err) { setError(err instanceof Error ? err.message : t('growth.saveFailed')) }
  }
  async function saveLevel() {
    if (!selected) return
    try {
      const record = await client.saveGrowthLevel(selected.id, level, selected.revision)
      setAssessments(assessments.map((a) => (a.id === selected.id ? record : a))); setLevel(record.level); setSelectedId(record.id)
    } catch (err) { setError(err instanceof Error ? err.message : t('growth.saveFailed')) }
  }
  async function confirm() {
    if (!selected) return
    try {
      const record = await client.confirmGrowthAssessment(selected.id, selected.revision)
      setAssessments(assessments.map((a) => (a.id === selected.id ? record : a))); setSelectedId(record.id)
      await onConfirmed()
    } catch (err) { setError(err instanceof Error ? err.message : t('growth.confirmFailed')) }
  }
  async function remove(record: GrowthAssessment) {
    setError('')
    try {
      await client.deleteGrowthAssessment(record.id, record.revision)
      setAssessments(assessments.filter((a) => a.id !== record.id)); if (selectedId === record.id) setSelectedId(null)
    } catch (err) { setError(err instanceof Error ? err.message : t('growth.deleteFailed')) }
  }

  return <div className="growth-pane assessment-pane">
    <div className="assess-create"><input aria-label={t('growth.newAssessmentAria')} placeholder={t('growth.monthPlaceholder')} value={month} onChange={(e) => setMonth(e.target.value)} /><button className="primary-action" onClick={() => void create()}>{t('growth.newAssessment')}</button></div>
    {error && <p className="field-error" role="alert">{error}</p>}
    {assessments.length === 0 ? <p className="muted">{t('growth.noAssessments')}</p> : <div className="assess-layout">
      <aside className="assess-list" aria-label={t('growth.assessmentList')}>
        {assessments.map((a) => <button key={a.id} className={a.id === selectedId ? 'selected' : ''} onClick={() => select(a)}><span>{a.month}</span><strong>{a.status}</strong><em>{t('growth.dimensionsCount', { done: a.completedDimensions })}{a.level ? ` · L${a.level}` : ''}</em></button>)}
      </aside>
      {selected && <section className="assess-editor" aria-label={t('growth.assessmentEditor')}>
        <header><h3>{selected.month}</h3><span className="status">{selected.status}</span></header>
        {DIMENSION_KEYS.map((key) => <fieldset key={key} className="assess-dim">
          <legend>{key.toUpperCase()}</legend>
          <label>{t('growth.dimension.current')}<textarea value={draft[key].current} onChange={(e) => setDraft({ ...draft, [key]: { ...draft[key], current: e.target.value } })} /></label>
          <label>{t('growth.dimension.evidence')}<textarea value={draft[key].evidence} onChange={(e) => setDraft({ ...draft, [key]: { ...draft[key], evidence: e.target.value } })} /></label>
          <label>{t('growth.dimension.challenges')}<textarea value={draft[key].challenges} onChange={(e) => setDraft({ ...draft, [key]: { ...draft[key], challenges: e.target.value } })} /></label>
          <label>{t('growth.dimension.direction')}<textarea value={draft[key].direction} onChange={(e) => setDraft({ ...draft, [key]: { ...draft[key], direction: e.target.value } })} /></label>
          <button className="secondary" onClick={() => void saveDimension(key)}>{t('growth.saveDimension', { name: key.toUpperCase() })}</button>
        </fieldset>)}
        <div className="assess-level"><label>{t('growth.levelLabel')}<select aria-label={t('growth.levelAria')} value={level} onChange={(e) => setLevel(e.target.value)}><option value="">{t('growth.levelNone')}</option><option value="1.0">1.0</option><option value="2.0">2.0</option><option value="3.0">3.0</option></select></label><button className="secondary" onClick={() => void saveLevel()}>{t('growth.saveLevel')}</button></div>
        <footer className="assess-actions"><p>{t('growth.writeNote')}</p><div><button className="danger" onClick={() => void remove(selected)}>{t('growth.delete')}</button>{selected.status === 'draft' && <button className="confirm" onClick={() => void confirm()} disabled={!selected.readyToConfirm}>{t('growth.confirmAssessment')}</button>}</div></footer>
      </section>}
    </div>}
  </div>
}
