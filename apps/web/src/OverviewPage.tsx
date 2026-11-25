import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, Brain, CheckCircle, Clock, FolderOpen, Laptop, Stack, UserCircle } from '@phosphor-icons/react'
import type { ApiClient, OverviewSnapshot, TimelineItem, VaultBackup, VaultStatus } from './api'
import { EmptyState, ErrorState, LoadingState } from './components/StateBlocks'
import { formatDate, getLanguage, useT } from './i18n'
import intelligenceOrb from './assets/onboarding-intelligence-orb.webp'

type Props = {
  client: ApiClient
  onNavigate: (view: 'review' | 'profile' | 'privacy' | 'reflection' | 'growth' | 'connections' | 'backup') => void
  onConcepts: () => void
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
export default function OverviewPage({ client, onNavigate, onConcepts, refreshKey = 0 }: Props) {
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
  const { profile, memory, clients } = overview
  const recentItems = timeline.slice(0, 3)
  const hasRecentlyActiveClient = clients.active.some((client) => client.activity === 'recently_active')
  const sections = profile.sections.filter((section) => section.items.length > 0)
  const spaceName = vault?.displayName && vault.displayName !== 'vault' ? vault.displayName : t('overview.spaceName')
  const accessText = (access: string) => {
    const key = accessLabel(access)
    return key ? t(`overview.access.${key}`) : access
  }

  return <section className="overview-page overview-command" aria-label={t('overview.title')}>
    <header className="overview-hero">
      <div><p className="eyebrow">{t('overview.heroEyebrow')}</p><h1>{t('overview.heroTitle')}</h1><p>{t('overview.heroDetail')}</p></div>
      <img src={intelligenceOrb} alt="" aria-hidden="true" />
    </header>

    {next && <section className="priority-card" aria-label={t('overview.nextLabel')}>
      <span className="priority-icon">{next.icon}</span>
      <div><p>{t('overview.priority')}</p><h2>{next.label}</h2><span>{next.detail}</span></div>
      <button className="priority-action" onClick={() => onNavigate(next.view)}>{t('overview.startAction')}<ArrowRight size={20} /></button>
    </section>}

    <section className="vault-strip" aria-label={t('overview.vaultLabel')}>
      <div className="vault-strip-primary"><span className="vault-icon"><FolderOpen size={30} /></span><div><small>{t('overview.currentVault')}</small><strong>{spaceName}</strong></div><em><CheckCircle size={17} />{t('overview.localStored')}</em></div>
      <div className="vault-boundary"><Laptop size={32} /><div><strong>{t('overview.localControl')}</strong><span>{t('overview.localControlDetail')}</span></div></div>
    </section>

    <div className="overview-dashboard-grid">
      <section className="overview-surface activity-surface" aria-label={t('overview.activityLabel')}>
        <header><div><Clock size={25} /><span><h2>{t('overview.activityTitle')}</h2><p>{t('overview.activityDetail')}</p></span></div><button onClick={() => onNavigate('review')}>{t('overview.reviewAction')}<ArrowRight size={17} /></button></header>
        {recentItems.length === 0
          ? <EmptyState icon={<Clock size={24} />} title={t('overview.noConfirmedTitle')} description={t('overview.noConfirmedDetail', { candidate: memory.candidateMemories, pending: memory.pendingReview })} />
          : <ol className="overview-timeline">{recentItems.map((item) => <li key={item.id}><span /><div><strong>{item.subject || item.type}</strong><p>{item.type}</p></div><time>{displayTime(item.updated || item.created)}</time></li>)}</ol>}
      </section>

      <div className="overview-side-stack">
        <section className="overview-surface profile-surface" aria-label={t('overview.profileLabel')}>
          <header><div><UserCircle size={27} /><h2>{t('overview.profile')}</h2></div><button onClick={() => onNavigate('profile')}>{t('overview.enterProfile')}<ArrowRight size={17} /></button></header>
          <div className="profile-state"><i />{sections.length ? t('overview.profileActive') : t('overview.profileStarting')}</div>
          <p>{sections.length ? t('overview.profileProgress', { count: sections.length }) : t('overview.profileEmptyDetail', { level: accessText(profile.access) })}</p>
        </section>

        <section className="overview-surface health-surface" aria-label={t('overview.systemHealth')}>
          <header><div><Laptop size={27} /><span><h2>{t('overview.systemHealth')}</h2><p>{t('overview.systemHealthDetail')}</p></span></div></header>
          <ul>
            <li className="ok"><CheckCircle />{t('overview.localService')}</li>
            <li className={vault === null ? 'muted' : vault.externalChange ? 'warn' : 'ok'}>{vault === null ? <Clock /> : <CheckCircle />}{vault === null ? t('overview.vaultUnknown') : t('overview.vaultAccess')}</li>
            <li className={hasRecentlyActiveClient ? 'ok' : 'muted'}><CheckCircle />{hasRecentlyActiveClient ? t('overview.aiConnected') : t('overview.aiNotConnected')}</li>
            <li className={backups.length ? 'ok' : 'muted'}><CheckCircle />{backups.length ? t('overview.backupReady') : t('overview.backupNeeded')}</li>
          </ul>
        </section>
      </div>
    </div>
    <button className="overview-concept-link" onClick={onConcepts}>{t('overview.openConceptMap')}</button>
  </section>
}
