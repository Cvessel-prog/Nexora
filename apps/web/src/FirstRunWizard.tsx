import { useEffect, useState } from 'react'
import { ArrowRight, Check, FolderOpen, FolderPlus, Globe, Note, Sparkle, Trash } from '@phosphor-icons/react'
import type { ApiClient, OnboardingState, RegisteredVault } from './api'
import ConversationalOnboardingPage from './ConversationalOnboardingPage'
import { vaultHint } from './vaultHints'
import onboardingOrb from './assets/onboarding-intelligence-orb.webp'
import { useT } from './i18n'

function joinPath(base: string, name: string) {
  return `${base.replace(/[\\/]+$/, '')}/${name.replace(/^[\\/]+/, '')}`
}

type Props = { client: ApiClient; vaultName: string; onFinish: (destination: 'overview' | 'review') => void }

export default function FirstRunWizard({ client, vaultName, onFinish }: Props) {
  const t = useT()
  const [usage, setUsage] = useState<'web' | 'obsidian'>('web')
  const [mode, setMode] = useState<'create' | 'connect' | null>(null)
  const [path, setPath] = useState('')
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState('')
  const [interview, setInterview] = useState(false)
  const [interviewState, setInterviewState] = useState<OnboardingState | null>(null)
  const [interviewLoading, setInterviewLoading] = useState(false)
  const [registered, setRegistered] = useState<RegisteredVault[]>([])
  const [currentVaultId, setCurrentVaultId] = useState('')
  const [connecting, setConnecting] = useState('')
  const [defaultPath, setDefaultPath] = useState('')
  const [folderName, setFolderName] = useState('')

  useEffect(() => {
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0
    void client.vaultStatus().then((status) => setCurrentVaultId(status.vaultId)).catch(() => undefined)
    void client.registeredVaults().then(setRegistered).catch(() => undefined)
    void client.vaultDefaultPath().then((result) => {
      if (!result.path) return
      setDefaultPath(result.path)
      setPath((current) => current || joinPath(result.path, 'my-ai-profile'))
    }).catch(() => undefined)
  }, [client])

  async function run(action: 'create' | 'connect') {
    const target = path.trim()
    if (!target) { setError(t('wizard.pathRequired')); return }
    setBusy('run'); setError(''); setDone('')
    try {
      const result = action === 'create' ? await client.createVault(target) : await client.validateVault(target)
      setDone(t('wizard.spaceDone', { action: action === 'create' ? t('wizard.created') : t('wizard.connected'), name: result.displayName }))
    } catch (reason) {
      setError(vaultHint(reason instanceof Error ? reason.message : t('wizard.actionFailed')))
    } finally { setBusy('') }
  }

  async function browse() {
    setBusy('browse'); setError('')
    try {
      const result = await client.browseVault()
      setPath(result.path)
    } catch (reason) { setError(reason instanceof Error ? reason.message : t('wizard.browserFailed')) }
    finally { setBusy('') }
  }

  function useRecommended() {
    const name = folderName.trim() || 'my-ai-profile'
    setPath(joinPath(defaultPath || 'C:\\Nexora\\vault', name))
    setError('')
  }

  async function forget(item: RegisteredVault) {
    if (!window.confirm(t('wizard.forgetConfirm', { name: item.displayName }))) return
    setBusy(`forget:${item.vaultId}`); setError('')
    try {
      await client.forgetVault(item.vaultId)
      setRegistered((current) => current.filter((entry) => entry.vaultId !== item.vaultId))
      setDone(t('wizard.forgotten'))
    } catch (reason) { setError(reason instanceof Error ? reason.message : t('wizard.forgetFailed')) }
    finally { setBusy('') }
  }

  async function connect(item: RegisteredVault) {
    setConnecting(item.vaultId); setError(''); setDone('')
    try {
      await client.connectVault(item.vaultId)
      setDone(t('wizard.opening', { name: item.displayName }))
    } catch (reason) {
      setError(vaultHint(reason instanceof Error ? reason.message : t('wizard.connectFailed')))
    } finally { setConnecting('') }
  }

  async function finish(destination: 'overview' | 'review') {
    try { await client.markInitialized() } catch { /* The wizard reappears next time; that does not block usage. */ }
    onFinish(destination)
  }

  async function startInterview() {
    setInterview(true); setInterviewLoading(true); setError('')
    try { setInterviewState(await client.onboarding()) }
    catch (reason) { setError(reason instanceof Error ? reason.message : t('wizard.interviewFailed')) }
    finally { setInterviewLoading(false) }
  }

  async function saveInterview(topic: string, content: string) {
    setBusy('interview'); setError('')
    try { const result = await client.onboardingResponse(topic, content); setInterviewState(result.state); return true }
    catch (reason) { setError(reason instanceof Error ? reason.message : t('wizard.candidateFailed')); return false }
    finally { setBusy('') }
  }

  if (interview) return <main className="wizard wizard-interview" aria-label={t('wizard.interviewLabel')}>
    <header className="wizard-interview-header"><div><p className="wizard-badge"><Sparkle size={14} weight="fill" />{t('wizard.interviewLabel')} · Local only</p><h1>{t('wizard.interviewTitle')}</h1><p>{t('wizard.interviewHint')}</p></div><button className="text-button" onClick={() => void finish('overview')}>{t('wizard.finishAndEnter')}</button></header>
    {error && <p className="wizard-error" role="alert">{error}</p>}
    <ConversationalOnboardingPage value={interviewState} loading={interviewLoading} saving={Boolean(busy)} onSave={saveInterview} onReview={() => void finish('review')} />
  </main>

  return <main className="wizard" aria-label={t('wizard.label')}>
    <header className="wizard-intro">
      <p className="wizard-badge"><Sparkle size={14} weight="fill" />NEXORA 知序 · Onboarding</p>
      <h1>{t('wizard.welcome')}</h1>
      <p>{t('wizard.subtitle')}</p>
      <p className="wizard-note">{t('wizard.vaultNote')}</p>
    </header>

    <figure className="wizard-hero-image">
      <img src={onboardingOrb} alt={t('wizard.orbAlt')} />
      <figcaption><strong>Your Intelligence. Your Data. Your Control.</strong><span>Local-first personal intelligence platform</span></figcaption>
    </figure>

    <section className="wizard-section" aria-labelledby="wizard-space-title">
      <header><span>01</span><div><h2 id="wizard-space-title">{t('wizard.spaceTitle')}</h2><p>{t('wizard.currentSpace', { name: vaultName })}</p></div></header>
      <div className="wizard-space-grid">
        <button className={mode === 'create' ? 'selected' : ''} onClick={() => { setMode('create'); setError(''); setDone('') }}><FolderPlus size={25} /><span><strong>{t('wizard.createNew')}</strong><small>{t('wizard.createNewHint')}</small></span><ArrowRight size={18} /></button>
        <button className={mode === 'connect' ? 'selected' : ''} onClick={() => { setMode('connect'); setError(''); setDone('') }}><FolderOpen size={25} /><span><strong>{t('wizard.connectExisting')}</strong><small>{t('wizard.connectExistingHint')}</small></span><ArrowRight size={18} /></button>
      </div>
      {mode && <div className="wizard-path-row"><label><span>{mode === 'create' ? t('wizard.newVaultPath') : t('wizard.existingVaultPath')}</span><input aria-label={mode === 'create' ? t('wizard.newVaultAria') : t('wizard.existingVaultAria')} value={path} onChange={(event) => { setPath(event.target.value); setError('') }} placeholder={defaultPath || t('wizard.pathPlaceholder')} /></label><button className="secondary-action" onClick={() => void browse()} disabled={Boolean(busy)}>{busy === 'browse' ? t('wizard.openingPicker') : t('wizard.browse')}</button><button className="secondary-action" onClick={() => void run(mode)} disabled={Boolean(busy)}>{busy ? t('wizard.processing') : mode === 'create' ? t('wizard.createVault') : t('wizard.validateConnect')}</button></div>}
      {mode === 'create' && <div className="wizard-path-row"><label><span>{t('wizard.folderName')}</span><input aria-label={t('wizard.folderNameAria')} value={folderName} onChange={(event) => { setFolderName(event.target.value); setError('') }} placeholder="my-ai-profile" /></label><button className="secondary-action" onClick={useRecommended} disabled={Boolean(busy) || !defaultPath}>{t('wizard.useRecommended')}</button></div>}
      {mode === 'create' && folderName.trim() && <p className="wizard-hint">{t('wizard.willCreate', { path: joinPath(defaultPath || 'C:\\Nexora\\vault', folderName.trim()) })}</p>}
      {registered.length > 0 && <div className="wizard-registered">
        <p className="wizard-registered-title">{t('wizard.recentTitle')}</p>
        <div className="wizard-registered-list">
          {registered.map((item) => <div key={item.vaultId} className="wizard-registered-item">
            <button disabled={!item.available || connecting === item.vaultId} onClick={() => void connect(item)}>
              <FolderOpen size={20} />
              <span><strong>{item.displayName}</strong><small>{item.vaultId.slice(0, 18)}</small></span>
              <em>{item.vaultId === currentVaultId ? t('wizard.currentSpaceTag') : item.available ? (connecting === item.vaultId ? t('wizard.openingTag') : t('wizard.openTag')) : t('wizard.missingDir')}</em>
            </button>
            <button className="wizard-forget" onClick={() => void forget(item)} disabled={Boolean(busy)} aria-label={t('wizard.forgetAria', { id: item.vaultId.slice(0, 8) })} title={t('wizard.forgetTitle', { name: item.displayName })}><Trash size={16} /></button>
          </div>)}
        </div>
      </div>}
      {done && <p className="wizard-done" role="status"><Check size={17} />{done}</p>}
      {error && <p className="wizard-error" role="alert">{error}</p>}
    </section>

    <section className="wizard-section" aria-labelledby="wizard-usage-title">
      <header><span>02</span><div><h2 id="wizard-usage-title">{t('wizard.usageTitle')}</h2><p>{t('wizard.usageHint')}</p></div></header>
      <div className="wizard-options" role="radiogroup" aria-label={t('wizard.usageLabel')}>
        <button role="radio" aria-checked={usage === 'web'} className={usage === 'web' ? 'selected' : ''} onClick={() => setUsage('web')}><Globe size={23} /><span><strong>{t('wizard.webOnly')}</strong><small>{t('wizard.webOnlyHint')}</small></span><em>{t('wizard.webDefault')}</em></button>
        <button role="radio" aria-checked={usage === 'obsidian'} className={usage === 'obsidian' ? 'selected' : ''} onClick={() => setUsage('obsidian')}><Note size={23} /><span><strong>{t('wizard.withObsidian')}</strong><small>{t('wizard.withObsidianHint')}</small></span><em>{t('wizard.obsidianOptional')}</em></button>
      </div>
    </section>

    <section className="wizard-section wizard-profile-start" aria-labelledby="wizard-profile-title">
      <header><span>03</span><div><h2 id="wizard-profile-title">{t('wizard.profileTitle')}</h2><p>{t('wizard.profileHint')}</p></div></header>
      <div className="wizard-final-actions"><button className="primary-action" onClick={() => void startInterview()}>{t('wizard.startInterview')} <ArrowRight size={17} /></button><button className="text-button" onClick={() => void finish('overview')}>{t('wizard.enterOverview')}</button></div>
    </section>
  </main>
}
