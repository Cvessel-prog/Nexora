import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, Brain, Clock, ShieldCheck, Stack, UserCircle } from '@phosphor-icons/react'
import type { ApiClient, AuditEvent, OverviewSnapshot, TimelineItem, VaultBackup, VaultStatus } from './api'
import { EmptyState, ErrorState, LoadingState } from './components/StateBlocks'
import { formatDate, getLanguage, useT } from './i18n'

type Props = {
  client: ApiClient
  onNavigate: (view: 'review' | 'profile' | 'privacy' | 'reflection' | 'growth') => void
  refreshKey?: number
}

type Snapshot = {
  overview: OverviewSnapshot
  timeline: TimelineItem[]
  vault: VaultStatus | null
  backups: VaultBackup[]
}

function accessLabel(access: string) {
  return { allowed: 'allowed', 'summary-only': 'summaryOnly', 'local-only': 'localOnly', denied: 'denied' }[access] ?? ''
}

/**
 * 首页回答用户真正关心的四个问题：
 * 1. 我的个人档案目前是什么状态？      → 已确认的个人信息
 * 2. 最近有什么新记忆？                → 最近的记忆变化
 * 3. 我现在最值得处理的事情是什么？    → 下一步（唯一推荐）
 * 4. 哪些 AI 正在获得我的授权？        → 已授权的 AI 工具
 *
 * 减密原则（用户实测反馈：文字过于密集）：
 * - 面板只用一种语言的标题，不再叠加另一种语言说明同一件事。
 * - 不在面板底部重复状态行；补充信息并入正文或右侧面板。
 * - 正文行高放宽，字号提高，让每块内容只有一句话的读法。
 */
export default function OverviewPage({ client, onNavigate, refreshKey = 0 }: Props) {
  const t = useT()
  const [value, setValue] = useState<Snapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    Promise.all([
      client.overview(),
      client.timeline().catch(() => [] as TimelineItem[]),
      client.vaultStatus().catch(() => null),
      client.backups().catch(() => ({ currentRevision: '', backups: [] as VaultBackup[] })),
    ])
      .then(([overview, timeline, vault, backup]) => {
        if (cancelled) return
        setValue({ overview, timeline, vault, backups: backup.backups })
      })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : t('error.generic')) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [client, refreshKey, t])

  const displayTime = (raw: string) => formatDate(getLanguage(), raw) || t('overview.timeUnknown')

  const recentSummary = (events: AuditEvent[]) => {
    if (events.length === 0) return t('overview.noAiAccess')
    const latest = events[0]
    return `${latest.clientId} · ${latest.eventType}`
  }

  const next = useMemo(() => {
    if (!value) return null
    const { overview } = value
    const { memory, pending } = overview
    if (pending > 0) {
      return { label: t('overview.next.review'), detail: t('overview.next.reviewDetail', { count: pending }), view: 'review' as const, icon: <Stack size={22} /> }
    }
    if (memory.confirmedMemories === 0) {
      return { label: t('overview.next.profile'), detail: t('overview.next.profileEmptyDetail'), view: 'profile' as const, icon: <UserCircle size={22} /> }
    }
    if (overview.growth.latestMonth === null) {
      return { label: t('overview.next.reflection'), detail: t('overview.next.reflectionDetail'), view: 'reflection' as const, icon: <Brain size={22} /> }
    }
    return { label: t('overview.next.profile'), detail: t('overview.next.profileDetail'), view: 'profile' as const, icon: <UserCircle size={22} /> }
  }, [value, t])

  if (loading) return <LoadingState label={t('overview.loading')} />
  if (error) return <ErrorState title={t('overview.loadError')} description={error} />
  if (!value) return <EmptyState title={t('overview.title')} description={t('overview.reading')} />

  const { overview, timeline, vault, backups } = value
  const { profile, memory, clients, recentAccess, growth } = overview
  const confirmedItems = timeline.filter((item) => item.status === 'confirmed').slice(0, 5)
  const latestBackup = backups[0]
  const sections = profile.sections.filter((section) => section.items.length > 0)
  const spaceName = vault?.displayName && vault.displayName !== 'vault' ? vault.displayName : t('overview.spaceName')
  const accessText = (access: string) => {
    const key = accessLabel(access)
    return key ? t(`overview.access.${key}`) : access
  }

  return <section className="overview-page" aria-label={t('overview.title')}>
    <header className="home-welcome">
      <div>
        <h1>{t('overview.welcome')}</h1>
        <p>{t('overview.welcomeDetail')}</p>
      </div>
      <div className="welcome-identity"><span className="welcome-identity-icon"><UserCircle size={22} weight="duotone" /></span><div><strong>{spaceName}</strong></div></div>
    </header>

    {next && <section className="home-next" aria-label={t('overview.nextLabel')}>
      <h2>{t('overview.nextTitle')}</h2>
      <button className="home-next-card" onClick={() => onNavigate(next.view)}>
        <span className="home-next-icon">{next.icon}</span>
        <span className="home-next-copy"><strong>{next.label}</strong><em>{next.detail}</em></span>
        <ArrowRight size={20} />
      </button>
    </section>}

    <div className="home-grid">
      <section className="home-panel home-profile" aria-label={t('overview.profileLabel')}>
        <header><h2>{t('overview.profileTitle')}</h2><button className="text-button" onClick={() => onNavigate('profile')}>{t('overview.viewProfile')}</button></header>
        {sections.length === 0
          ? <EmptyState icon={<UserCircle size={24} />} title={t('overview.profileEmptyTitle')} description={t('overview.profileEmptyDetail', { level: accessText(profile.access) })} action={<button className="primary-action" onClick={() => onNavigate('profile')}>{t('overview.viewProfileAction')}</button>} />
          : <div className="home-sections">{sections.map((section) => <article key={section.title}><h3>{section.title}</h3><ul>{section.items.map((item) => <li key={item}>{item}</li>)}</ul></article>)}</div>}
      </section>

      <section className="home-panel home-activity" aria-label={t('overview.activityLabel')}>
        <header><h2>{t('overview.activityTitle')}</h2><button className="text-button" onClick={() => onNavigate('review')}>{t('overview.reviewAction')}</button></header>
        {confirmedItems.length === 0
          ? <EmptyState icon={<Clock size={24} />} title={t('overview.noConfirmedTitle')} description={t('overview.noConfirmedDetail', { candidate: memory.candidateMemories, pending: memory.pendingReview })} />
          : <ul className="home-activity-list">{confirmedItems.map((item) => <li key={item.id}><span className="home-activity-dot" /><div><strong>{item.subject || item.type}</strong><small>{item.type} · {displayTime(item.updated || item.created)}</small></div></li>)}</ul>}
      </section>

      <section className="home-panel home-connections" aria-label={t('overview.clientsLabel')}>
        <header><h2>{t('overview.clientsTitle')}</h2><button className="text-button" onClick={() => onNavigate('privacy')}>{t('overview.manageAccess')}</button></header>
        {clients.total === 0
          ? <EmptyState icon={<ShieldCheck size={24} />} title={t('overview.noClientsTitle')} description={t('overview.noClientsDetail') + (recentSummary(recentAccess) === t('overview.noAiAccess') ? '' : ' ' + t('overview.recentAccess', { summary: recentSummary(recentAccess) }))} action={<button className="primary-action" onClick={() => onNavigate('privacy')}>{t('overview.viewConnections')}</button>} />
          : <ul className="home-client-list">{clients.active.map((client) => <li key={client.id}><ShieldCheck size={17} /><div><strong>{client.name}</strong><small>{t('overview.scopesAndActivity', { count: client.scopes.length, activity: client.activity === 'recently_active' ? t('overview.recentlyActive') : t('overview.notConnected') })}</small></div></li>)}</ul>}
      </section>

      <section className="home-panel home-vault" aria-label={t('overview.vaultLabel')}>
        <header><h2>{t('overview.vaultTitle')}</h2></header>
        <dl className="home-vault-list">
          <div><dt>{t('overview.backupCount')}</dt><dd>{backups.length}</dd></div>
          <div><dt>{t('overview.latestBackup')}</dt><dd>{latestBackup ? displayTime(latestBackup.created) : t('overview.noBackup')}</dd></div>
          <div><dt>{t('overview.externalChangeLabel')}</dt><dd className={vault?.externalChange ? 'warn' : 'ok'}>{vault?.externalChange ? t('overview.externalDetected') : t('overview.externalNone')}</dd></div>
        </dl>
        {growth.latestMonth && <p className="home-growth">{t('overview.latestReflection', { month: growth.latestMonth.month })}</p>}
      </section>
    </div>
  </section>
}
