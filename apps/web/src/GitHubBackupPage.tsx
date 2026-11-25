import { useEffect, useState } from 'react'
import { CheckCircle, Eye, ShieldCheck, Trash, Warning } from '@phosphor-icons/react'
import type { ApiClient, GitHubConnection, GitHubDeviceCode, GitHubRepository, GitHubStatus } from './api'
import { useT } from './i18n'

type Props = { client: ApiClient }

export default function GitHubBackupPage({ client }: Props) {
  const t = useT()
  const [status, setStatus] = useState<GitHubStatus | null>(null)
  const [repos, setRepos] = useState<GitHubRepository[]>([])
  const [clientId, setClientId] = useState('')
  const [code, setCode] = useState<GitHubDeviceCode | null>(null)
  const [selected, setSelected] = useState('')
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)

  async function load() {
    try {
      const next = await client.githubStatus()
      setStatus(next)
      setRepos(await client.githubRepositories().catch(() => []))
    } catch (error) { setMessage({ kind: 'error', text: error instanceof Error ? error.message : t('github.loadFailed') }) }
  }

  useEffect(() => { void load() }, [client, t])

  async function saveClientId() {
    setBusy('client'); setMessage(null)
    try { await client.githubConfigureClientId(clientId.trim()); setMessage({ kind: 'success', text: t('github.clientIdSaved') }); await load() }
    catch (error) { setMessage({ kind: 'error', text: error instanceof Error ? error.message : t('github.saveFailed') }) }
    finally { setBusy('') }
  }

  async function startDevice() {
    setBusy('device'); setMessage(null)
    try {
      const next = await client.githubDeviceCode()
      setCode(next)
      setMessage({ kind: 'success', text: t('github.deviceCodeHint', { uri: next.verificationUri, code: next.userCode }) })
    } catch (error) { setMessage({ kind: 'error', text: error instanceof Error ? error.message : t('github.deviceFailed') }) }
    finally { setBusy('') }
  }

  async function poll() {
    setBusy('poll'); setMessage(null)
    try {
      const result = await client.githubDevicePoll()
      if (result.status === 'authorized') { setCode(null); setMessage({ kind: 'success', text: t('github.authorized') }); await load() }
      else if (result.status === 'expired') { setCode(null); setMessage({ kind: 'error', text: t('github.expired') }) }
      else setMessage({ kind: 'success', text: t('github.pending') })
    } catch (error) { setMessage({ kind: 'error', text: error instanceof Error ? error.message : t('github.pollFailed') }) }
    finally { setBusy('') }
  }

  async function verify(repository: string) {
    if (!repository) return
    setBusy('verify'); setMessage(null)
    try {
      const result = await client.githubVerify(repository)
      setMessage({ kind: result.private ? 'success' : 'error', text: result.private ? t('github.privateConfirmed', { name: result.fullName }) : t('github.publicRejected', { name: result.fullName }) })
    } catch (error) { setMessage({ kind: 'error', text: error instanceof Error ? error.message : t('github.verifyFailed') }) }
    finally { setBusy('') }
  }

  async function connect(repository: string) {
    if (!repository) return
    setBusy('connect'); setMessage(null)
    try {
      const result: GitHubConnection = await client.githubConnect(repository)
      setMessage({ kind: 'success', text: t('github.connected', { remote: result.remoteName, repo: result.repository }) })
      await load()
    } catch (error) { setMessage({ kind: 'error', text: error instanceof Error ? error.message : t('github.connectFailed') }) }
    finally { setBusy('') }
  }

  async function disconnect() {
    setBusy('disconnect'); setMessage(null)
    try { await client.githubDisconnect(); setMessage({ kind: 'success', text: t('github.disconnected') }); await load() }
    catch (error) { setMessage({ kind: 'error', text: error instanceof Error ? error.message : t('github.disconnectFailed') }) }
    finally { setBusy('') }
  }

  return <section className="github-page">
    <header className="backup-heading compact-heading">
      <div><p className="eyebrow">GITHUB PRIVATE BACKUP / ONBOARDING</p><p>{t('github.heading')}</p></div>
      <span className="boundary-badge"><ShieldCheck size={18} />{t('github.noToken')}</span>
    </header>

    {message && <div className={`backup-message ${message.kind}`} role="status">{message.kind === 'success' ? <CheckCircle /> : <Warning />}<span>{message.text}</span></div>}

    <section className="github-panel">
      <header><p className="eyebrow">STATUS</p><h3>{t('github.statusTitle')}</h3></header>
      <dl className="github-status">
        <div><dt>Client ID</dt><dd>{status?.configured ? t('github.configured') : t('github.notConfigured')}</dd></div>
        <div><dt>{t('github.sessionLabel')}</dt><dd>{status?.sessionActive ? t('github.sessionActive') : t('github.notAuthorized')}</dd></div>
        <div><dt>Remote</dt><dd>{status?.connected ? status.repository : t('github.notConnected')}</dd></div>
        <div><dt>Privacy check</dt><dd>{status?.visibilityVerified || '—'}</dd></div>
      </dl>
      {status?.connected && <button className="secondary-action" onClick={() => void disconnect()} disabled={Boolean(busy)}><Trash size={16} />{t('github.disconnect')}</button>}
    </section>

    <section className="github-panel">
      <header><p className="eyebrow">STEP 1 / OAUTH APP</p><h3>{t('github.step1')}</h3></header>
      <label className="provider-field">Client ID<input aria-label="GitHub OAuth Client ID" value={clientId} onChange={(event) => setClientId(event.target.value)} placeholder="Iv1.xxxxxxxx" /></label>
      <button className="secondary-action" onClick={() => void saveClientId()} disabled={Boolean(busy) || !clientId.trim()}>{t('github.saveClientId')}</button>
      <small>{t('github.clientIdHint')}</small>
    </section>

    <section className="github-panel">
      <header><p className="eyebrow">STEP 2 / DEVICE FLOW</p><h3>{t('github.step2')}</h3></header>
      {code ? <div className="github-code"><strong>{code.userCode}</strong><span>{t('github.codeHint', { seconds: code.expiresIn, uri: code.verificationUri })}</span><button className="primary-action" onClick={() => void poll()} disabled={Boolean(busy)}>{busy === 'poll' ? t('github.confirming') : t('github.authorizedContinue')}</button></div> : <button className="primary-action" onClick={() => void startDevice()} disabled={Boolean(busy) || !status?.configured}>{t('github.startDevice')}</button>}
    </section>

    <section className="github-panel">
      <header><p className="eyebrow">STEP 3 / VERIFY &amp; CONNECT</p><h3>{t('github.step3')}</h3></header>
      {!status?.sessionActive ? <p className="muted">{t('github.needAuth')}</p> : <>
        <label className="provider-field">{t('github.repository')}<select aria-label={t('github.repository')} value={selected} onChange={(event) => setSelected(event.target.value)}><option value="">{t('github.selectRepo')}</option>{repos.map((item) => <option key={item.fullName} value={item.fullName}>{item.fullName}{item.private ? t('github.privateTag') : t('github.publicTag')}</option>)}</select></label>
        <div className="github-actions">
          <button className="secondary-action" onClick={() => void verify(selected)} disabled={Boolean(busy) || !selected}><Eye size={16} />{t('github.verify')}</button>
          <button className="primary-action" onClick={() => void connect(selected)} disabled={Boolean(busy) || !selected}>{t('github.configureRemote')}</button>
        </div>
        <small>{t('github.repoHint')}</small>
      </>}
    </section>
  </section>
}
