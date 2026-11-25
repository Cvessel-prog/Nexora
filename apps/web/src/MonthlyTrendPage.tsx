import type { MonthlyTrend } from './api'
import { EmptyState, LoadingState } from './components/StateBlocks'
import { useT } from './i18n'

export default function MonthlyTrendPage({ value, loading }: { value: MonthlyTrend | null; loading: boolean }) {
  const t = useT()
  if (loading) return <LoadingState label={t('trend.loading')} />
  if (!value) return <EmptyState title={t('trend.title')} description={t('trend.reading')} />
  if (value.points.length === 0) return <EmptyState title={t('trend.emptyTitle')} description={t('trend.emptyDetail')} />

  return <section className="monthly-trend" aria-label={t('trend.ariaLabel')}>
    <p className="trend-disclaimer">{value.disclaimer}</p>

    <div className="dimension-compare" aria-label={t('trend.dimensionsLabel')}>
      {value.dimensions.map((dimension) => <div key={dimension.key} className="dimension-column">
        <h3>{dimension.title}</h3>
        {value.points.map((point) => <div key={point.month} className="dimension-cell">
          <span className="cell-month">{point.month}</span>
          <p>{point.dimensions[dimension.key] || t('trend.notFilled')}</p>
        </div>)}
      </div>)}
    </div>

    <div className="trend-timeline" aria-label={t('trend.timelineLabel')}>
      {value.points.map((point) => <article key={point.month} className="trend-card">
        <header><h3>{point.month}</h3><span className="trend-stats">{t('trend.stats', { done: point.completedDimensions, events: point.eventCount, goalsDone: point.goalCompleted, goalsTotal: point.goalTotal })}</span></header>
        {point.summary && <p className="trend-summary">{point.summary}</p>}
        {point.events.length > 0 && <ul className="trend-list">{point.events.map((event) => <li key={event.id}><span>{event.date}</span>{event.title}</li>)}</ul>}
        {point.goals.length > 0 && <ul className="trend-list">{point.goals.map((goal) => <li key={goal.id} className={goal.completed ? 'done' : ''}><span>{goal.completed ? t('trend.done') : t('trend.doing')}</span>{goal.title}</li>)}</ul>}
      </article>)}
    </div>
  </section>
}
