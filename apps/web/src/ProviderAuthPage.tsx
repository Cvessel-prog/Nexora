import { useEffect, useState } from 'react'
import { CheckCircle, Eye, ShieldCheck, Warning } from '@phosphor-icons/react'
import type { ApiClient, PendingCall, ProviderAdapterInfo, ProviderAdaptersOverview, ProviderAuthorization, ProviderAudit, ProviderCallResult, ProviderOverview } from './api'
import { useT } from './i18n'

type Props = { client: ApiClient }

export default function ProviderAuthPage({ client }: Props) {
  const t = useT()
  const [overview, setOverview] = useState<ProviderOverview | null>(null)
  const [audit, setAudit] = useState<ProviderAudit | null>(null)
  const [provider, setProvider] = useState('')
  const [scopes, setScopes] = useState<string[]>([])
  const [previewProvider, setPreviewProvider] = useState('')
  const [previewScope, setPreviewScope] = useState('')
  const [context, setContext] = useState(() => t('provider.sampleContext'))
  const [pending, setPending] = useState<PendingCall[]>([])
  const [adapters, setAdapters] = useState<ProviderAdaptersOverview | null>(null)
  const [connector, setConnector] = useState({ provider: 'local-openai', baseUrl: '', model: '', apiKey: '', timeout: 30 })
  const [approved, setApproved] = useState<{ requestId: string; provider: string; scope: string; payload: Record<string, unknown> }[]>([])
  const [callResult, setCallResult] = useState<ProviderCallResult | null>(null)
  const [calling, setCalling] = useState('')
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)

  async function load() {
    try {
      const [next, log, adapterList] = await Promise.all([client.providers(), client.providerAudit(), client.providerAdapters()])
      setOverview(next); setAudit(log); setPending(next.pending); setAdapters(adapterList)
    } catch (error) { setMessage({ kind: 'error', text: error instanceof Error ? error.message : t('provider.loadFailed') }) }
  }

  useEffect(() => { void load() }, [client, t])

  function toggleScope(scope: string) {
    setScopes((current) => current.includes(scope) ? current.filter((item) => item !== scope) : [...current, scope])
  }

  async function authorize() {
    if (!provider.trim() || !scopes.length) return
    setBusy('authorize'); setMessage(null)
    try {
      await client.authorizeProvider(provider.trim(), scopes)
      setProvider(''); setScopes([])
      setMessage({ kind: 'success', text: t('provider.authorized') })
      await load()
    } catch (error) { setMessage({ kind: 'error', text: error instanceof Error ? error.message : t('provider.authorizeFailed') }) }
    finally { setBusy('') }
  }

  async function revoke(item: ProviderAuthorization) {
    if (!window.confirm(t('provider.revokeConfirm', { name: item.provider }))) return
    setBusy(`revoke:${item.provider}`); setMessage(null)
    try { await client.revokeProvider(item.provider); setMessage({ kind: 'success', text: t('provider.revoked') }); await load() }
    catch (error) { setMessage({ kind: 'error', text: error instanceof Error ? error.message : t('provider.revokeFailed') }) }
    finally { setBusy('') }
  }

  async function preview() {
    setBusy('preview'); setMessage(null)
    try {
      const parsed = JSON.parse(context)
      const result = await client.previewProviderCall(previewProvider.trim(), previewScope, parsed)
      setPending((current) => [result, ...current])
      setMessage({ kind: 'success', text: t('provider.previewDone', { count: result.droppedFields.length }) })
    } catch (error) { setMessage({ kind: 'error', text: error instanceof Error ? error.message : t('provider.previewFailed') }) }
    finally { setBusy('') }
  }

  async function decide(item: PendingCall, action: 'approve' | 'deny') {
    setBusy(`decide:${item.requestId}`); setMessage(null)
    try {
      const result = await client.decideProviderCall(item.requestId, action, action === 'deny' ? 'user-rejected' : '')
      setPending((current) => current.filter((call) => call.requestId !== item.requestId))
      if (result.decision === 'approved') setApproved((current) => [{ requestId: item.requestId, provider: item.provider, scope: item.scope, payload: item.preview }, ...current].slice(0, 10))
      setMessage({ kind: 'success', text: result.decision === 'approved' ? t('provider.approved') : t('provider.denied') })
      await load()
    } catch (error) { setMessage({ kind: 'error', text: error instanceof Error ? error.message : t('provider.decideFailed') }) }
    finally { setBusy('') }
  }

  async function configure() {
    if (!connector.baseUrl.trim() || !connector.model.trim()) return
    setBusy('configure'); setMessage(null); setCallResult(null)
    try {
      await client.configureProvider(connector.provider, connector.baseUrl.trim(), connector.model.trim(), connector.apiKey, connector.timeout)
      setConnector((current) => ({ ...current, baseUrl: '', model: '', apiKey: '' }))
      setMessage({ kind: 'success', text: t('provider.configured') })
      await load()
    } catch (error) { setMessage({ kind: 'error', text: error instanceof Error ? error.message : t('provider.configureFailed') }) }
    finally { setBusy('') }
  }

  async function removeConnector(item: ProviderAdapterInfo) {
    setBusy(`config:${item.provider}`); setMessage(null)
    try { await client.removeProviderConfig(item.provider); setMessage({ kind: 'success', text: t('provider.removed') }); await load() }
    catch (error) { setMessage({ kind: 'error', text: error instanceof Error ? error.message : t('provider.removeFailed') }) }
    finally { setBusy('') }
  }

  async function callApproved(item: { requestId: string; provider: string }) {
    setCalling(item.requestId); setMessage(null); setCallResult(null)
    try {
      const result = await client.callProvider(item.provider, item.requestId)
      setCallResult(result)
      if (!result.ok) setMessage({ kind: 'error', text: result.error ?? t('provider.callFailed') })
      await load()
    } catch (error) { setMessage({ kind: 'error', text: error instanceof Error ? error.message : t('provider.callFailed') }) }
    finally { setCalling('') }
  }

  const knownScopes = overview?.scopes ?? {}

  return <section className="provider-page">
    <header className="backup-heading compact-heading">
      <div><p className="eyebrow">AI PROVIDER / EXPLICIT AUTHORIZATION</p><p>{t('provider.heading')}</p></div>
      <span className="boundary-badge"><ShieldCheck size={18} />{t('provider.noAutoSend')}</span>
    </header>

    {message && <div className={`backup-message ${message.kind}`} role="status">{message.kind === 'success' ? <CheckCircle /> : <Warning />}<span>{message.text}</span></div>}

    <section className="provider-layout">
      <section className="provider-panel">
        <header><p className="eyebrow">AUTHORIZED PROVIDERS</p><h3>{t('provider.authorizedTitle')}</h3></header>
        {overview?.providers.length ? <ul className="provider-list">{overview.providers.map((item) => <li key={item.provider}>
          <div><strong>{item.provider}</strong><small>{item.scopes.join(' · ')}</small></div>
          <button className="text-button" onClick={() => revoke(item)} disabled={Boolean(busy)}>{t('provider.revoke')}</button>
        </li>)}</ul> : <p className="muted">{t('provider.noProviders')}</p>}

        <header><p className="eyebrow">AUTHORIZE</p><h3>{t('provider.addTitle')}</h3></header>
        <label className="provider-field">{t('provider.providerName')}<input aria-label={t('provider.providerNameAria')} value={provider} onChange={(event) => setProvider(event.target.value)} placeholder={t('provider.providerPlaceholder')} /></label>
        <div className="provider-scopes" role="group" aria-label={t('provider.scopeLabel')}>
          {Object.keys(knownScopes).map((scope) => <label key={scope} className="provider-scope"><input type="checkbox" checked={scopes.includes(scope)} onChange={() => toggleScope(scope)} /><span><strong>{scope}</strong><small>{knownScopes[scope].join(', ')}</small></span></label>)}
        </div>
        <button className="primary-action" onClick={() => void authorize()} disabled={Boolean(busy) || !provider.trim() || !scopes.length}>{t('provider.authorize')}</button>
      </section>

      <section className="provider-panel">
        <header><p className="eyebrow">CALL PREVIEW / DATA MINIMIZATION</p><h3>{t('provider.previewTitle')}</h3></header>
        <div className="provider-field-row">
          <label className="provider-field">Provider<input aria-label={t('provider.previewProviderAria')} value={previewProvider} onChange={(event) => setPreviewProvider(event.target.value)} placeholder={t('provider.providerPlaceholder')} /></label>
          <label className="provider-field">Scope<select aria-label={t('provider.previewScopeAria')} value={previewScope} onChange={(event) => setPreviewScope(event.target.value)}><option value="">{t('provider.selectScope')}</option>{Object.keys(knownScopes).map((scope) => <option key={scope} value={scope}>{scope}</option>)}</select></label>
        </div>
        <label className="provider-field">{t('provider.contentLabel')}<textarea aria-label={t('provider.contentAria')} value={context} onChange={(event) => setContext(event.target.value)} spellCheck={false} /></label>
        <button className="secondary-action" onClick={() => void preview()} disabled={Boolean(busy) || !previewProvider.trim() || !previewScope}><Eye size={16} />{t('provider.generatePreview')}</button>

        {pending.length > 0 && <div className="provider-pending">
          <p className="eyebrow">PENDING APPROVAL</p>
          {pending.map((item) => <div key={item.requestId} className="provider-pending-item">
            <div><strong>{item.provider}</strong><small>{item.scope} · {Object.keys(item.preview).join(', ') || t('provider.empty')}</small></div>
            <div className="provider-pending-actions">
              <button className="primary-action" onClick={() => void decide(item, 'approve')} disabled={Boolean(busy)}>{t('provider.approve')}</button>
              <button className="secondary-action" onClick={() => void decide(item, 'deny')} disabled={Boolean(busy)}>{t('provider.deny')}</button>
            </div>
          </div>)}
        </div>}
      </section>
    </section>

    <section className="provider-panel">
      <header><p className="eyebrow">CONNECTORS / REAL CALLS</p><h3>{t('provider.connectorsTitle')}</h3></header>
      <div className="provider-field-row">
        <label className="provider-field">{t('provider.providerType')}<select aria-label={t('provider.providerTypeAria')} value={connector.provider} onChange={(event) => setConnector((current) => ({ ...current, provider: event.target.value, baseUrl: adapters?.defaultBaseUrls[event.target.value] ?? '' }))}>{Object.entries(adapters?.providers ?? {}).map(([key, label]) => <option key={key} value={key}>{key} — {label}</option>)}</select></label>
        <label className="provider-field">{t('provider.model')}<input aria-label={t('provider.modelAria')} value={connector.model} onChange={(event) => setConnector((current) => ({ ...current, model: event.target.value }))} placeholder={t('provider.modelPlaceholder')} /></label>
      </div>
      <label className="provider-field">{t('provider.baseUrl')}<input aria-label={t('provider.baseUrlAria')} value={connector.baseUrl} onChange={(event) => setConnector((current) => ({ ...current, baseUrl: event.target.value }))} placeholder={t('provider.baseUrlPlaceholder')} /></label>
      <label className="provider-field">{t('provider.apiKey')}<input aria-label={t('provider.apiKeyAria')} type="password" value={connector.apiKey} onChange={(event) => setConnector((current) => ({ ...current, apiKey: event.target.value }))} placeholder={t('provider.apiKeyPlaceholder')} /></label>
      <button className="primary-action" onClick={() => void configure()} disabled={Boolean(busy) || !connector.baseUrl.trim() || !connector.model.trim()}>{t('provider.configure')}</button>
      {adapters?.configured.length ? <ul className="provider-list">{adapters.configured.map((item) => <li key={item.provider}>
        <div><strong>{item.provider}</strong><small>{item.baseUrl} · {item.model}{item.hasApiKey ? ` · ${t('provider.keyConfigured')}` : ` · ${t('provider.noKey')}`}</small></div>
        <button className="text-button" onClick={() => removeConnector(item)} disabled={Boolean(busy)}>{t('provider.remove')}</button>
      </li>)}</ul> : <p className="muted">{t('provider.noConnectors')}</p>}
    </section>

    <section className="provider-panel">
      <header><p className="eyebrow">APPROVED CALLS / SEND</p><h3>{t('provider.approvedTitle')}</h3></header>
      {!approved.length ? <p className="muted">{t('provider.approvedEmpty')}</p> : <ul className="provider-list">{approved.map((item) => <li key={item.requestId}>
        <div><strong>{item.provider}</strong><small>{item.scope} · {Object.keys(item.payload).join(', ') || t('provider.empty')}</small></div>
        <button className="primary-action" onClick={() => void callApproved(item)} disabled={Boolean(calling) || !adapters?.configured.some((config) => config.provider === item.provider)}>{calling === item.requestId ? t('provider.calling') : t('provider.call')}</button>
      </li>)}</ul>}
      {callResult && <div className={`backup-message ${callResult.ok ? 'success' : 'error'}`} role="status">{callResult.ok ? <CheckCircle /> : <Warning />}<span>{callResult.ok ? t('provider.callResult', { model: callResult.model ?? 'Provider', text: callResult.text ?? '' }) : t('provider.callError', { error: callResult.error ?? '' })}</span></div>}
      <small>{t('provider.callNote')}</small>
    </section>

    <section className="provider-audit">
      <header><div><p className="eyebrow">CALL AUDIT / APPEND ONLY</p><h3>{t('provider.auditTitle')}</h3></div><span>{audit?.integrity.status ?? '—'} · {audit?.integrity.events ?? 0} events</span></header>
      {audit?.items.length ? <ul className="provider-audit-list">{audit.items.map((item) => <li key={item.eventId}>
        <span className={`provider-result ${item.result}`}>{item.result}</span>
        <div><strong>{item.details.provider || '—'}</strong><small>{item.scope} · {item.details.fieldCount} fields · {item.details.droppedFields.length} dropped</small></div>
        <time>{item.timestamp}</time>
      </li>)}</ul> : <p className="muted">{t('provider.auditEmpty')}</p>}
    </section>
  </section>
}
