import { useEffect, useMemo, useState } from 'react'
import { ArrowCounterClockwise, ArrowLeft, ArrowRight, CheckCircle, ClockCounterClockwise, Database, GitBranch, MagnifyingGlass, ShieldCheck, Warning } from '@phosphor-icons/react'
import type { ApiClient, BackupOverview, GitChanges, GitHistory, GitStatus, RegisteredVault, VaultBackup, VaultStatus } from './api'
import { LoadingState } from './components/StateBlocks'
import { vaultHint } from './vaultHints'
import { formatDate, getLanguage, useT } from './i18n'

function time(value: string) {
  return formatDate(getLanguage(), value)
}

function size(value: number) {
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / 1024 / 1024).toFixed(1)} MB`
}

type BackupFilter = 'all' | 'verified' | 'invalid'
type BackupSort = 'created' | 'size' | 'files'

function filterLabels(t: (key: string) => string): Record<BackupFilter, string> {
  return { all: t('backup.all'), verified: t('status.verified'), invalid: t('status.invalid') }
}

function sortLabels(t: (key: string) => string): Record<BackupSort, string> {
  return { created: t('backup.sortCreated'), size: t('backup.sortSize'), files: t('backup.sortFiles') }
}

function wizardSteps(t: (key: string) => string): string[] {
  return [t('backup.stepSelect'), t('backup.stepVerify'), t('backup.stepConfirm'), t('backup.stepDone')]
}

/**
 * 可复用的备份列表：筛选（完整性）、搜索（ID / 日期）和排序。
 * 主页历史面板与恢复向导的第一步共用同一份浏览能力。
 */
function BackupList({ backups, selectedId, onSelect }: { backups: VaultBackup[]; selectedId: string; onSelect: (id: string) => void }) {
  const t = useT()
  const [filter, setFilter] = useState<BackupFilter>('all')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<BackupSort>('created')
  const labels = filterLabels(t)
  const sorting = sortLabels(t)

  const counts = useMemo(() => ({
    all: backups.length,
    verified: backups.filter((item) => item.integrity === 'verified').length,
    invalid: backups.filter((item) => item.integrity === 'invalid').length,
  }), [backups])

  const visible = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    const items = backups.filter((item) => {
      if (filter !== 'all' && item.integrity !== filter) return false
      if (!keyword) return true
      return item.id.toLowerCase().includes(keyword) || item.created.toLowerCase().includes(keyword) || time(item.created).toLowerCase().includes(keyword)
    })
    return [...items].sort((a, b) => sort === 'size' ? b.sizeBytes - a.sizeBytes : sort === 'files' ? b.fileCount - a.fileCount : b.created.localeCompare(a.created))
  }, [backups, filter, query, sort])

  return <div className="backup-list-wrap">
    <div className="backup-filters" role="group" aria-label={t('backup.filterLabel')}>
      <div className="backup-filter-tabs">
        {(Object.keys(labels) as BackupFilter[]).map((key) => <button key={key} className={filter === key ? 'active' : ''} aria-pressed={filter === key} onClick={() => setFilter(key)}>{labels[key]} <span>{counts[key]}</span></button>)}
      </div>
      <div className="backup-filter-tools">
        <label className="backup-search"><MagnifyingGlass size={16} /><input aria-label={t('backup.searchLabel')} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('backup.searchPlaceholder')} /></label>
        <label className="backup-sort"><span>{t('backup.sort')}</span><select aria-label={t('backup.sortLabel')} value={sort} onChange={(event) => setSort(event.target.value as BackupSort)}>{(Object.keys(sorting) as BackupSort[]).map((key) => <option key={key} value={key}>{sorting[key]}</option>)}</select></label>
      </div>
    </div>

    {visible.length ? <div className="backup-list">{visible.map((item) => <button key={item.id} className={selectedId === item.id ? 'active' : ''} aria-pressed={selectedId === item.id} onClick={() => onSelect(item.id)}><span className="backup-icon"><Database /></span><span><strong>{time(item.created)}</strong><small>{item.fileCount} files · {size(item.sizeBytes)} · Schema {item.schemaVersion}</small><em className={item.integrity}><CheckCircle /> {item.integrity === 'verified' ? t('backup.hashVerified') : t('backup.integrityFailed')}</em></span></button>)}</div> : <div className="backup-empty compact"><Database /><h3>{t('backup.emptyTitle')}</h3><p>{t('backup.emptyDetail')}</p></div>}
  </div>
}

/**
 * 引导式恢复：把「选择 → 校验 → 确认 → 完成」拆成四个明确步骤，
 * 每步只要求一个动作，降低误操作概率。
 */
function RecoveryWizard({ client, backups, currentRevision, initialId, onExit }: { client: ApiClient; backups: VaultBackup[]; currentRevision: string; initialId?: string; onExit: () => void }) {
  const t = useT()
  const [step, setStep] = useState(0)
  const [selectedId, setSelectedId] = useState(initialId ?? backups[0]?.id ?? '')
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)
  const [verified, setVerified] = useState(false)
  const [result, setResult] = useState<{ restoredBackupId: string; safetyBackup: VaultBackup } | null>(null)
  const steps = wizardSteps(t)

  const selected = useMemo(() => backups.find((item) => item.id === selectedId) ?? null, [backups, selectedId])
  const phrase = selected ? `RESTORE ${selected.id}` : ''

  function selectBackup(id: string) {
    setSelectedId(id)
    setVerified(false)
    setConfirmation('')
    setMessage(null)
  }

  async function verifySelected() {
    if (!selected) return
    setBusy('verify'); setMessage(null)
    try {
      await client.verifyBackup(selected.id)
      setVerified(true)
      setMessage({ kind: 'success', text: t('backup.verifiedMessage') })
    } catch (error) {
      setVerified(false)
      setMessage({ kind: 'error', text: error instanceof Error ? error.message : t('backup.verifyFailed') })
    } finally { setBusy('') }
  }

  async function restore() {
    if (!selected || confirmation !== phrase) return
    setBusy('restore'); setMessage(null)
    try {
      const restored = await client.restoreBackup(selected.id, confirmation, currentRevision)
      setResult(restored)
      setStep(3)
      setMessage({ kind: 'success', text: t('backup.restoreDone', { id: restored.safetyBackup.id }) })
    } catch (error) {
      setMessage({ kind: 'error', text: error instanceof Error ? error.message : t('backup.restoreFailed') })
    } finally { setBusy('') }
  }

  return <div className="recovery-wizard">
    <ol className="wizard-steps" aria-label={t('backup.recoveryTitle')}>
      {steps.map((label, index) => <li key={label} className={index === step ? 'active' : index < step ? 'done' : ''} aria-current={index === step ? 'step' : undefined}>
        <span className="wizard-step-dot">{index < step ? <CheckCircle size={16} /> : index + 1}</span>
        <span className="wizard-step-label">{label}</span>
        {index < steps.length - 1 && <span className="wizard-step-connector" aria-hidden="true" />}
      </li>)}
    </ol>

    {message && <div className={`backup-message ${message.kind}`} role="status">{message.kind === 'success' ? <CheckCircle /> : <Warning />}<span>{message.text}</span></div>}

    {step === 0 && <div className="wizard-panel">
      <p className="eyebrow">STEP 1 / SELECT BACKUP</p>
      <h3>{t('backup.selectTitle')}</h3>
      <p className="wizard-hint">{t('backup.selectHint')}</p>
      {backups.length ? <BackupList backups={backups} selectedId={selectedId} onSelect={selectBackup} /> : <div className="backup-empty compact"><Database /><h3>{t('backup.noBackupTitle')}</h3><p>{t('backup.noBackupDetail')}</p></div>}
      <div className="wizard-actions">
        <button className="text-button" onClick={onExit}><ArrowLeft size={16} />{t('backup.backToList')}</button>
        <button className="primary-action" disabled={!selected || selected.integrity !== 'verified'} onClick={() => setStep(1)}>{t('common.next')}<ArrowRight size={16} /></button>
      </div>
    </div>}

    {step === 1 && selected && <div className="wizard-panel">
      <p className="eyebrow">STEP 2 / VERIFY BACKUP</p>
      <h3>{t('backup.verifyTitle')}</h3>
      <p className="wizard-hint">{t('backup.verifyHint')}</p>
      <dl className="backup-details"><div><dt>Created</dt><dd>{time(selected.created)}</dd></div><div><dt>Files</dt><dd>{selected.fileCount}</dd></div><div><dt>Size</dt><dd>{size(selected.sizeBytes)}</dd></div><div><dt>Integrity</dt><dd className={selected.integrity}>{selected.integrity}</dd></div></dl>
      <div className="wizard-actions">
        <button className="text-button" onClick={() => setStep(0)}><ArrowLeft size={16} />{t('common.back')}</button>
        <button className="secondary-action" onClick={() => void verifySelected()} disabled={Boolean(busy)}>{busy === 'verify' ? t('backup.verifying') : verified ? t('backup.reverify') : t('backup.verify')}</button>
        <button className="primary-action" disabled={!verified || Boolean(busy)} onClick={() => { setMessage(null); setStep(2) }}>{t('common.next')}<ArrowRight size={16} /></button>
      </div>
    </div>}

    {step === 2 && selected && <div className="wizard-panel">
      <p className="eyebrow">STEP 3 / CONFIRM RESTORE</p>
      <h3>{t('backup.confirmTitle')}</h3>
      <div className="restore-boundary"><Warning /><div><strong>{t('backup.restoreReplaces')}</strong><p>{t('backup.restoreBoundary')}</p></div></div>
      <label className="restore-confirm">{t('backup.confirmLabel')} <code>{phrase}</code><input aria-label={t('backup.confirmLabel')} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" /></label>
      <div className="wizard-actions">
        <button className="text-button" onClick={() => setStep(1)}><ArrowLeft size={16} />{t('common.back')}</button>
        <button className="danger restore-action" onClick={() => void restore()} disabled={Boolean(busy) || confirmation !== phrase}><ArrowCounterClockwise />{busy === 'restore' ? t('backup.restoring') : t('backup.restoreAction')}</button>
      </div>
    </div>}

    {step === 3 && result && <div className="wizard-panel wizard-done-panel">
      <p className="eyebrow">STEP 4 / COMPLETE</p>
      <h3><CheckCircle size={22} />{t('backup.doneTitle')}</h3>
      <p className="wizard-hint">{t('backup.doneHint')}</p>
      <dl className="backup-details"><div><dt>{t('backup.restoredLabel')}</dt><dd>{result.restoredBackupId}</dd></div><div><dt>{t('backup.safetyLabel')}</dt><dd>{result.safetyBackup.id}</dd></div></dl>
      <div className="wizard-actions">
        <button className="primary-action" onClick={onExit}>{t('backup.backToList')}<ArrowRight size={16} /></button>
      </div>
    </div>}
  </div>
}

export default function BackupRecoveryPage({ client, refreshKey = 0 }: { client: ApiClient; refreshKey?: number }) {
  const t = useT()
  const [value, setValue] = useState<BackupOverview | null>(null)
  const [selectedId, setSelectedId] = useState('')
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)
  const [vault, setVault] = useState<VaultStatus | null>(null)
  const [registered, setRegistered] = useState<RegisteredVault[]>([])
  const [git, setGit] = useState<GitStatus | null>(null)
  const [history, setHistory] = useState<GitHistory | null>(null)
  const [vaultPath, setVaultPath] = useState('')
  const [commitMessage, setCommitMessage] = useState('chore: update personal profile')
  const [changes, setChanges] = useState<GitChanges | null>(null)
  const [wizardOpen, setWizardOpen] = useState(false)

  async function load() {
    setMessage(null)
    try {
      const [next, status, vaults, gitStatus, gitHistory] = await Promise.all([client.backups(), client.vaultStatus(), client.registeredVaults(), client.gitStatus(), client.gitHistory()])
      setValue(next)
      setVault(status); setRegistered(vaults); setGit(gitStatus); setHistory(gitHistory)
      setSelectedId((current) => current && next.backups.some((item) => item.id === current) ? current : next.backups[0]?.id ?? '')
    } catch (error) { setMessage({ kind: 'error', text: error instanceof Error ? error.message : t('backup.loadError') }) }
  }

  useEffect(() => { void load() }, [client, refreshKey, t])
  const selected = useMemo(() => value?.backups.find((item) => item.id === selectedId) ?? null, [value, selectedId])
  const timeline = useMemo(() => {
    const backups = (value?.backups ?? []).map((item) => ({ kind: 'backup' as const, id: item.id, created: item.created, title: t('backup.localBackup'), detail: `${item.fileCount} files · ${size(item.sizeBytes)}` }))
    const commits = (history?.commits ?? []).map((item) => ({ kind: 'commit' as const, id: item.id, created: item.created, title: t('backup.gitCommit'), detail: item.subject || t('backup.noCommitSubject') }))
    return [...backups, ...commits].sort((a, b) => b.created.localeCompare(a.created)).slice(0, 50)
  }, [value, history, t])

  async function restoreCommit(item: { id: string }) {
    if (!value || !window.confirm(t('backup.restoreCommitConfirm'))) return
    setBusy(`restore:${item.id}`); setMessage(null)
    try {
      const result = await client.gitRestore(item.id, value.currentRevision)
      await load()
      setMessage({ kind: 'success', text: t('backup.restoreCommitDone', { commit: result.restoredCommit.slice(0, 8), backup: result.safetyBackup.id }) })
    } catch (error) { setMessage({ kind: 'error', text: error instanceof Error ? error.message : t('backup.restoreFailed') }) }
    finally { setBusy('') }
  }

  async function create() {
    setBusy('create'); setMessage(null)
    try {
      const result = await client.createBackup()
      const next = await client.backups()
      setValue(next); setSelectedId(result.backup.id)
      const pruned = result.backup.pruned?.length ? t('backup.pruned', { count: result.backup.pruned.length }) : ''
      setMessage({ kind: 'success', text: t('backup.createDone', { pruned }) })
    } catch (error) { setMessage({ kind: 'error', text: error instanceof Error ? error.message : t('backup.createFailed') }) }
    finally { setBusy('') }
  }

  async function vaultAction(action: 'validate' | 'create' | 'switch') {
    if (!vaultPath.trim()) return
    setBusy(action); setMessage(null)
    try {
      if (action === 'validate') await client.validateVault(vaultPath.trim())
      if (action === 'create') await client.createVault(vaultPath.trim())
      if (action === 'switch') { if (!window.confirm(t('backup.switchConfirm'))) return; await client.switchVault(vaultPath.trim()) }
      setMessage({ kind: 'success', text: action === 'switch' ? t('backup.switching') : action === 'create' ? t('backup.createVaultDone') : t('backup.validateDone') })
      if (action !== 'switch') await load()
    } catch (error) { setMessage({ kind: 'error', text: vaultHint(error instanceof Error ? error.message : t('backup.vaultOpFailed')) }) }
    finally { setBusy('') }
  }

  async function gitAction(action: 'commit' | 'pull' | 'push') {
    if (!window.confirm(`${action.toUpperCase()} ${t('backup.vaultOpConfirm')}`)) return
    setBusy(`git:${action}`); setMessage(null)
    try {
      if (action === 'commit') await client.gitCommit(commitMessage)
      if (action === 'pull') await client.gitPull()
      if (action === 'push') await client.gitPush()
      setGit(await client.gitStatus())
      setChanges(null)
      setMessage({ kind: 'success', text: `Git ${action} ${t('backup.gitDone')}` })
    } catch (error) { setMessage({ kind: 'error', text: error instanceof Error ? error.message : `Git ${action} ${t('backup.gitFailed')}` }) }
    finally { setBusy('') }
  }

  async function previewChanges() {
    setBusy('changes'); setMessage(null)
    try { setChanges(await client.gitChanges()) }
    catch (error) { setMessage({ kind: 'error', text: error instanceof Error ? error.message : t('backup.changesFailed') }) }
    finally { setBusy('') }
  }

  if (!value && !message) return <LoadingState label={t('backup.checking')} />

  if (wizardOpen) return <section className="backup-page">
    <header className="backup-heading compact-heading">
      <div><p className="eyebrow">VAULT RESILIENCE / LOCAL ONLY</p><p>{t('backup.wizardHeading')}</p></div>
      <span className="boundary-badge"><ShieldCheck size={18} />{t('backup.localBound')}</span>
    </header>
    <RecoveryWizard
      client={client}
      backups={value?.backups ?? []}
      currentRevision={value?.currentRevision ?? ''}
      initialId={selectedId}
      onExit={() => { setWizardOpen(false); setMessage(null); void load() }}
    />
  </section>

  return <section className="backup-page">
    <header className="backup-heading compact-heading">
      <div><p className="eyebrow">VAULT RESILIENCE / LOCAL ONLY</p><p>{t('backup.heading')}</p></div>
      <span className="boundary-badge"><ShieldCheck size={18} />{t('backup.localBound')}</span>
    </header>

    {message && <div className={`backup-message ${message.kind}`} role="status">{message.kind === 'success' ? <CheckCircle /> : <Warning />}<span>{message.text}</span></div>}

    <section className="vault-control" aria-label={t('backup.vaultLifecycle')}>
      <div><p className="eyebrow">CURRENT VAULT</p><h3>{vault?.displayName ?? t('backup.identifying')}</h3><p><code>{vault?.vaultId.slice(0, 18) ?? '—'}</code> · Schema {vault?.schemaVersion ?? '—'} · {vault?.externalChange ? t('backup.externalDetected') : t('backup.inSync')}</p></div>
      <div className="vault-path-actions"><label>{t('backup.vaultPathLabel')}<input aria-label={t('backup.vaultPathAria')} value={vaultPath} onChange={(event) => setVaultPath(event.target.value)} placeholder={t('backup.vaultPathPlaceholder')} /></label><div><button onClick={() => void vaultAction('validate')} disabled={Boolean(busy) || !vaultPath.trim()}>{t('backup.validate')}</button><button onClick={() => void vaultAction('create')} disabled={Boolean(busy) || !vaultPath.trim()}>{t('backup.create')}</button><button className="secondary-action" onClick={() => void vaultAction('switch')} disabled={Boolean(busy) || !vaultPath.trim()}>{t('backup.switch')}</button></div></div>
      <p className="vault-registry">{t('backup.registryNote', { count: registered.length })}</p>
    </section>

    <section className="backup-overview" aria-label={t('backup.overviewLabel')}>
      <article><Database /><span>Managed Backups</span><strong>{value?.backups.length ?? 0}</strong></article>
      <article><ShieldCheck /><span>Integrity</span><strong>{value?.backups.every((item) => item.integrity === 'verified') ? 'verified' : 'attention'}</strong></article>
      <article><ClockCounterClockwise /><span>Latest</span><strong>{value?.backups[0] ? time(value.backups[0].created) : t('backup.noBackupYet')}</strong></article>
      <button className="primary-action" onClick={() => void create()} disabled={Boolean(busy)}>{busy === 'create' ? t('backup.creating') : t('backup.createFull')}</button>
    </section>

    <section className="backup-timeline" aria-label={t('backup.historyLabel')}>
      <header><div><p className="eyebrow">VERSION HISTORY / LOCAL + GIT</p><h3>{t('backup.historyLabel')}</h3></div><span>{timeline.length} records</span></header>
      {history?.message && <div className="backup-message error" role="alert"><Warning /><span>{history.message}</span></div>}
      {timeline.length ? <ul className="timeline-list">{timeline.map((item) => <li key={`${item.kind}:${item.id}`} className={`timeline-${item.kind}`}>
        <span className="timeline-dot" aria-hidden="true" />
        <div><p className="timeline-meta">{time(item.created)} · {item.title}</p><strong>{item.detail}</strong><small>{item.kind === 'commit' ? item.id.slice(0, 8) : item.id}</small></div>
        {item.kind === 'commit' && <button className="text-button" onClick={() => void restoreCommit(item)} disabled={Boolean(busy)}>{busy === `restore:${item.id}` ? t('backup.restoring') : t('backup.restoreHere')}</button>}
      </li>)}</ul> : <p className="muted">{t('backup.noHistory')}</p>}
    </section>

    <div className="backup-layout">
      <section className="backup-panel backup-history"><header><div><p className="eyebrow">VERIFIED SNAPSHOTS</p><h3>{t('backup.historyTitle')}</h3></div><span>{value?.backups.length ?? 0} records</span></header>
        {value?.backups.length ? <BackupList backups={value.backups} selectedId={selectedId} onSelect={(id) => { setSelectedId(id); setMessage(null) }} /> : <div className="backup-empty"><Database /><h3>{t('backup.noBackupTitle')}</h3><p>{t('backup.noBackupHint')}</p></div>}
      </section>

      <section className="backup-panel recovery-panel"><header><div><p className="eyebrow">GUIDED RESTORE</p><h3>{t('backup.recoveryTitle')}</h3></div></header>
        {selected ? <>
          <p className="recovery-selected">{t('backup.selected')}<strong>{time(selected.created)}</strong><small>{selected.fileCount} files · {size(selected.sizeBytes)} · <span className={selected.integrity}>{selected.integrity}</span></small></p>
          <p className="wizard-hint">{t('backup.wizardHint')}</p>
        </> : <p className="wizard-hint">{t('backup.selectSnapshotHint')}</p>}
        <button className="primary-action" onClick={() => { setMessage(null); setWizardOpen(true) }} disabled={!value?.backups.length || Boolean(busy)}>{t('backup.startWizard')}<ArrowRight size={16} /></button>
        <div className="restore-boundary"><Warning /><div><strong>{t('backup.restoreReplaces')}</strong><p>{t('backup.restoreBoundary')}</p></div></div>
      </section>
    </div>

    <section className="git-backup" aria-label={t('backup.gitTitle')}>
      <header><div><p className="eyebrow">OPTIONAL PRIVATE VERSIONING</p><h3>{t('backup.gitTitle')}</h3></div><GitBranch size={26} /></header>
      {git?.configured === false ? <p>{git.message} {t('backup.gitNotConfigured')}</p> : <><dl><div><dt>Branch</dt><dd>{git?.branch || '—'}</dd></div><div><dt>Upstream</dt><dd>{git?.upstream || t('backup.upstreamNone')}</dd></div><div><dt>Ahead / Behind</dt><dd>{git?.ahead ?? 0} / {git?.behind ?? 0}</dd></div><div><dt>Changes</dt><dd>{changes ? changes.changes.length : (git?.dirty.length ?? 0)}</dd></div></dl><label>{t('backup.commitLabel')}<input aria-label={t('backup.commitAria')} value={commitMessage} onChange={(event) => setCommitMessage(event.target.value)} /></label><div className="git-actions"><button className="secondary-action" onClick={() => void previewChanges()} disabled={Boolean(busy)}>{busy === 'changes' ? t('backup.reading') : t('backup.preview')}</button><button onClick={() => void gitAction('commit')} disabled={Boolean(busy) || !commitMessage.trim() || (changes !== null && !changes.can_commit)}>Commit</button><button onClick={() => void gitAction('pull')} disabled={Boolean(busy)}>Pull</button><button onClick={() => void gitAction('push')} disabled={Boolean(busy)}>Push</button></div></>}
      {changes && <div className="git-changes" aria-label={t('backup.changesLabel')}>
        {changes.message && <div className="backup-message error" role="alert"><Warning /><span>{changes.message}</span></div>}
        {changes.sensitive.length > 0 && <div className="restore-boundary"><Warning /><div><strong>{t('backup.sensitiveTitle')}</strong><p>{t('backup.sensitiveDetail')}</p><ul className="git-sensitive-list">{changes.sensitive.map((item) => <li key={item.path}><code>{item.path}</code><span>{item.reason}</span></li>)}</ul></div></div>}
        {changes.unmerged.length > 0 && <div className="restore-boundary"><Warning /><div><strong>{t('backup.unmergedTitle')}</strong><p>{t('backup.unmergedDetail')}</p></div></div>}
        {changes.changes.length > 0 ? <ul className="git-change-list">{changes.changes.map((item) => <li key={`${item.code}:${item.path}`}><span className={`git-status git-status-${item.status}`}>{item.status}</span><code>{item.path}</code></li>)}</ul> : <p className="muted">{t('backup.noChanges')}</p>}
        <p className="git-changes-meta">{t('backup.changesMeta', { count: changes.changes.length, state: changes.can_commit ? t('backup.canCommit') : t('backup.cannotCommit') })}</p>
      </div>}
      <small>{t('backup.gitNote')}</small>
    </section>
  </section>
}
