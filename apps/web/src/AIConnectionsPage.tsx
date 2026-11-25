import { useEffect, useState } from 'react'
import { CheckCircle, Copy, Key, Link, PlugsConnected, ShieldCheck, Trash, Warning } from '@phosphor-icons/react'
import type { ApiClient, SecurityClient, SecurityOverview } from './api'
import { useT } from './i18n'

function scopeText(t: (key: string) => string): Record<string, string> {
  return {
    'profile:read': t('connections.scope.profile:read'), 'context:read': t('connections.scope.context:read'),
    'memory:search': t('connections.scope.memory:search'), 'memory:propose': t('connections.scope.memory:propose'),
    'memory:pending': t('connections.scope.memory:pending'), 'project:read': t('connections.scope.project:read'),
    'assessment:read': t('connections.scope.assessment:read'),
  }
}

export default function AIConnectionsPage({ client }: { client: ApiClient }) {
  const t = useT()
  const [overview, setOverview] = useState<SecurityOverview | null>(null)
  const [clients, setClients] = useState<SecurityClient[]>([])
  const [name, setName] = useState('')
  const [host, setHost] = useState('claude-desktop')
  const [scopes, setScopes] = useState<string[]>(['profile:read'])
  const [credential, setCredential] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const scopesCopy = scopeText(t)

  async function load() {
    try { const value = await client.securityCenter(); setOverview(value.overview); setClients(value.clients); setError('') }
    catch (reason) { setError(reason instanceof Error ? reason.message : t('connections.loadFailed')) }
  }
  useEffect(() => { void load() }, [client, t])
  function toggle(scope: string) { setScopes((value) => value.includes(scope) ? value.filter((item) => item !== scope) : [...value, scope]) }
  async function action(run: () => Promise<unknown>) { setBusy(true); setError(''); try { await run(); await load() } catch (reason) { setError(reason instanceof Error ? reason.message : t('connections.actionFailed')) } finally { setBusy(false) } }
  async function register() { await action(async () => { await client.registerSecurityClient(name.trim(), scopes); setName('') }) }
  async function authorize(item: SecurityClient) { await action(async () => { const value = await client.authorizeRegisteredClient(item.id); setCredential(value.credential) }) }
  async function reissue(item: SecurityClient) { if (!window.confirm(t('connections.reissueConfirm', { name: item.name }))) return; await action(async () => { const value = await client.reissueSecurityToken(item.id); setCredential(value.credential) }) }
  async function revoke(item: SecurityClient) { if (!window.confirm(t('connections.revokeConfirm', { name: item.name }))) return; await action(() => client.revokeSecurityClient(item.id)) }
  async function remove(item: SecurityClient) { if (!window.confirm(t('connections.deleteConfirm', { name: item.name }))) return; await action(() => client.deleteSecurityClient(item.id)) }
  const command = `python scripts/mcp_host_config.py --host ${host} --vault "<PRIVATE_VAULT>" --client-id "<CLIENT_ID>" --output "<PRIVATE_OUTPUT>.json"`

  return <section className="connections-page">
    <header className="connections-hero compact-heading"><div><p className="eyebrow">MODEL-AGNOSTIC / LOCAL STDIO</p><p>{t('connections.heading')}</p></div><span><PlugsConnected />{t('connections.authorizedCount', { count: overview?.diagnostics.authorizedClients ?? 0 })}</span></header>
    {error && <div className="notice error" role="alert"><Warning />{error}</div>}
    {credential && <section className="connection-credential" role="status"><Key /><div><strong>{t('connections.credentialTitle')}</strong><code>{credential}</code><small>{t('connections.credentialHint')}</small></div><button onClick={() => setCredential('')}>{t('connections.saved')}</button></section>}
    <div className="connections-grid">
      <section className="connection-panel"><p className="eyebrow">01 / REGISTER</p><h3>{t('connections.registerTitle')}</h3><label>{t('connections.clientName')}<input aria-label={t('connections.clientNameAria')} value={name} onChange={(event) => setName(event.target.value)} placeholder={t('connections.clientNamePlaceholder')} /></label><fieldset><legend>{t('connections.scopes')}</legend>{(overview?.scopes ?? []).map((scope) => <label key={scope}><input type="checkbox" checked={scopes.includes(scope)} onChange={() => toggle(scope)} /><span><strong>{scope}</strong><small>{scopesCopy[scope]}</small></span></label>)}</fieldset><button className="primary-action" disabled={busy || !name.trim() || !scopes.length} onClick={() => void register()}><Link />{t('connections.createPending')}</button></section>
      <section className="connection-panel"><p className="eyebrow">02 / HOST SETUP</p><h3>{t('connections.hostTitle')}</h3><label>{t('connections.hostLabel')}<select aria-label={t('connections.hostLabel')} value={host} onChange={(event) => setHost(event.target.value)}><option value="claude-desktop">Claude Desktop</option><option value="cursor">Cursor</option><option value="vscode">VS Code</option></select></label><ol><li>{t('connections.hostStep1')}</li><li>{t('connections.hostStep2')}</li><li>{t('connections.hostStep3')}</li><li>{t('connections.hostStep4')}</li></ol><pre>{command}</pre><button onClick={() => void navigator.clipboard.writeText(command)}><Copy />{t('connections.copyCommand')}</button><p className="connection-boundary"><ShieldCheck />{t('connections.boundary')}</p></section>
    </div>
    <section className="connection-panel connection-list"><header><div><p className="eyebrow">03 / MANAGE</p><h3>{t('connections.manageTitle')}</h3></div><button onClick={() => void load()} disabled={busy}>{t('connections.refresh')}</button></header>{clients.length === 0 ? <p className="security-empty">{t('connections.empty')}</p> : clients.map((item) => <article key={item.id} className={item.authorization}><div><PlugsConnected /><span><strong>{item.name}</strong><small>{item.id}</small></span></div><div className="connection-state"><span>{t(`connections.auth.${item.authorization}`)}</span><em>{t(`connections.activity.${item.activity}`)}</em></div><div className="connection-scopes">{item.scopes.map((scope) => <code key={scope}>{scope}</code>)}</div><div className="connection-actions">{item.authorization === 'pending_authorization' && <button className="primary-action" onClick={() => void authorize(item)} disabled={busy}><CheckCircle />{t('connections.authorize')}</button>}{item.authorization === 'authorized' && <><button onClick={() => void reissue(item)} disabled={busy}>{t('connections.reissue')}</button><button className="danger" onClick={() => void revoke(item)} disabled={busy}>{t('connections.revoke')}</button></>}{item.authorization !== 'deleted' && <button aria-label={t('connections.deleteAria', { name: item.name })} onClick={() => void remove(item)} disabled={busy}><Trash /></button>}</div></article>)}</section>
  </section>
}
