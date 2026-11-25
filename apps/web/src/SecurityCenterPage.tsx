import { useEffect, useMemo, useState } from 'react'
import { CheckCircle, Clock, Fingerprint, Key, LockKey, MagnifyingGlass, Plus, Pulse, ShieldWarning, UserCircle, XCircle } from '@phosphor-icons/react'
import type { AuditEvent, SecurityCenter } from './api'
import { ErrorState, LoadingState } from './components/StateBlocks'
import { formatDate, getLanguage, useT } from './i18n'

type Filters = { clientId: string; eventType: string; result: string; since: string; until: string; page: number; pageSize: number }
type Props = {
  value: SecurityCenter | null
  loading: boolean
  saving: boolean
  credential: string
  onAuthorize: (name: string, scopes: string[]) => Promise<string | null>
  onScopes: (id: string, scopes: string[]) => Promise<boolean>
  onRevoke: (id: string) => Promise<boolean>
  onQuery: (filters: Filters) => Promise<boolean>
  onClearCredential: () => void
}

function scopeDescriptions(t: (key: string) => string): Record<string, string> {
  return {
    'profile:read': t('connections.scope.profile:read'), 'context:read': t('connections.scope.context:read'),
    'memory:search': t('connections.scope.memory:search'), 'memory:propose': t('connections.scope.memory:propose'),
    'memory:pending': t('connections.scope.memory:pending'), 'project:read': t('connections.scope.project:read'),
    'assessment:read': t('connections.scope.assessment:read'),
  }
}

export default function SecurityCenterPage(props: Props) {
  const t = useT()
  const { value, loading, saving } = props
  const [name, setName] = useState('')
  const [grantScopes, setGrantScopes] = useState<string[]>([])
  const [selectedClient, setSelectedClient] = useState<string>('')
  const [editedScopes, setEditedScopes] = useState<string[]>([])
  const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null)
  const [filters, setFilters] = useState<Filters>({ clientId: '', eventType: '', result: '', since: '', until: '', page: 1, pageSize: 25 })
  const descriptions = scopeDescriptions(t)
  const client = value?.clients.find((item) => item.id === selectedClient) ?? null
  const displayTime = (raw: string) => (raw ? formatDate(getLanguage(), raw) : t('security.never'))
  useEffect(() => { setEditedScopes(client?.scopes ?? []) }, [client])
  useEffect(() => {
    const selected = value?.clients.find((item) => item.id === selectedClient)
    if (!selected || selected.authorization === 'deleted') {
      const next = value?.clients.find((item) => item.authorization === 'authorized')
        ?? value?.clients.find((item) => item.authorization !== 'deleted')
        ?? value?.clients[0]
      setSelectedClient(next?.id ?? '')
    }
  }, [value, selectedClient])
  const eventTypes = useMemo(() => [...new Set(value?.audit.items.map((item) => item.eventType) ?? [])].sort(), [value])
  if (loading) return <LoadingState label={t('security.loading')} />
  if (!value) return <ErrorState title={t('security.errorTitle')} description={t('security.errorDetail')} />
  const diagnostics = value.overview.diagnostics
  const integrity = diagnostics.audit.status

  function toggle(list: string[], scope: string, set: (next: string[]) => void) { set(list.includes(scope) ? list.filter((item) => item !== scope) : [...list, scope]) }
  async function authorize() {
    const clientId = await props.onAuthorize(name, grantScopes)
    if (clientId) { setSelectedClient(clientId); setName(''); setGrantScopes([]) }
  }
  async function applyFilters(next = filters) { await props.onQuery(next) }

  return <section className="security-page">
    <header className="security-heading compact-heading"><div><p className="eyebrow">PRIVACY AUDIT / SECURITY CENTER</p><h2 className="sr-only">Security Center</h2><p>{t('security.heading')}</p></div><span className={`integrity-badge ${integrity}`}><Fingerprint size={19} /><span><small>AUDIT INTEGRITY</small><strong>{integrity === 'verified' ? t('security.auditVerified') : integrity === 'missing' ? t('security.auditMissing') : t('security.auditFailed')}</strong></span></span></header>

    <section className="security-overview" aria-label="Security Overview">
      <Status label="Local Service" value={diagnostics.localService} good={diagnostics.localService === 'ok'} />
      <Status label="Vault" value={diagnostics.vault} good={diagnostics.vault === 'ready'} />
      <Status label="MCP Server" value={diagnostics.mcp} good={diagnostics.mcp === 'configured'} />
      <Status label="Authorized Clients" value={String(diagnostics.authorizedClients)} good={diagnostics.authorizedClients > 0} neutral={diagnostics.authorizedClients === 0} />
      <Status label="Recent Denied" value={String(diagnostics.recentDenied)} good={diagnostics.recentDenied === 0} neutral={diagnostics.audit.status === 'missing'} />
      <Status label="Audit Events" value={diagnostics.audit.status === 'missing' ? 'missing' : String(diagnostics.audit.events)} good={diagnostics.audit.status === 'verified'} neutral={diagnostics.audit.status === 'missing'} />
    </section>

    {props.credential && <section className="credential-once" role="status"><div><Key /><span><strong>{t('security.credentialTitle')}</strong><small>{t('security.credentialHint')}</small></span></div><code>{props.credential}</code><button onClick={props.onClearCredential}>{t('security.credentialSaved')}</button></section>}

    <div className="security-grid">
      <section className="security-panel access-management"><header><div><p className="eyebrow">AI ACCESS MANAGEMENT</p><h3>{t('security.accessTitle')}</h3></div><span>{value.clients.length} records</span></header>
        <div className="authorize-form"><label>{t('security.clientName')}<input aria-label={t('security.clientNameAria')} value={name} onChange={(e) => setName(e.target.value)} placeholder={t('security.clientNamePlaceholder')} /></label><fieldset><legend>{t('security.initialScopes')}</legend>{value.overview.scopes.map((scope) => <label key={scope}><input type="checkbox" checked={grantScopes.includes(scope)} onChange={() => toggle(grantScopes, scope, setGrantScopes)} /><span><strong>{scope}</strong><small>{descriptions[scope]}</small></span></label>)}</fieldset><button className="primary-action" onClick={() => void authorize()} disabled={saving || !name.trim() || grantScopes.length === 0}><Plus />{t('security.authorizeClient')}</button></div>
        <div className="client-list">{value.clients.map((item) => <button key={item.id} className={item.id === selectedClient ? 'active' : ''} onClick={() => setSelectedClient(item.id)}><span className={`client-state ${item.authorization}`}><UserCircle /></span><span><strong>{item.name}</strong><small>{item.id}</small><em>{item.authorization === 'revoked' ? t('security.revokedAt', { time: displayTime(item.revokedAt) }) : `${item.activity === 'recently_active' ? t('security.lastAccess') : t('security.neverConnected')} · ${displayTime(item.lastAccessAt)}`}</em></span></button>)}{value.clients.length === 0 && <p className="security-empty">{t('security.noClients')}</p>}</div>
      </section>

      <section className="security-panel permission-management"><header><div><p className="eyebrow">LEAST PRIVILEGE</p><h3>{t('security.permissionTitle')}</h3></div></header>{client ? <><div className="client-identity"><Fingerprint /><div><strong>{client.name}</strong><small>{client.id}</small></div><span className={client.authorization}>{client.authorization}</span></div><div className="scope-editor">{value.overview.scopes.map((scope) => <label key={scope}><input type="checkbox" checked={editedScopes.includes(scope)} disabled={client.authorization !== 'authorized'} onChange={() => toggle(editedScopes, scope, setEditedScopes)} /><span><strong>{scope}</strong><small>{descriptions[scope]}</small></span></label>)}</div><footer><button className="secondary-action" onClick={() => void props.onScopes(client.id, editedScopes)} disabled={saving || client.authorization !== 'authorized' || editedScopes.length === 0 || editedScopes.join() === client.scopes.join()}>{t('security.saveScopes')}</button><button className="danger" onClick={() => { if (window.confirm(t('security.revokeConfirm', { name: client.name }))) void props.onRevoke(client.id) }} disabled={saving || client.authorization !== 'authorized'}>{t('security.revoke')}</button></footer><p className="confirmation-boundary"><LockKey />{t('security.confirmationBoundary')}</p></> : <p className="security-empty">{t('security.selectClient')}</p>}</section>
    </div>

    <section className="security-panel access-timeline"><header><div><p className="eyebrow">ACCESS TIMELINE</p><h3>{t('security.timelineTitle')}</h3></div><span>{value.audit.total} events</span></header><div className="audit-filters"><select aria-label={t('security.filterClient')} value={filters.clientId} onChange={(e) => setFilters({ ...filters, clientId: e.target.value, page: 1 })}><option value="">{t('security.allClients')}</option>{value.clients.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><select aria-label={t('security.filterEvent')} value={filters.eventType} onChange={(e) => setFilters({ ...filters, eventType: e.target.value, page: 1 })}><option value="">{t('security.allEventTypes')}</option>{eventTypes.map((item) => <option key={item} value={item}>{item}</option>)}</select><select aria-label={t('security.filterResult')} value={filters.result} onChange={(e) => setFilters({ ...filters, result: e.target.value, page: 1 })}><option value="">{t('security.allResults')}</option><option value="allowed">Allowed</option><option value="denied">Denied</option></select><input aria-label={t('security.startAria')} type="datetime-local" value={filters.since} onChange={(e) => setFilters({ ...filters, since: e.target.value, page: 1 })} /><input aria-label={t('security.endAria')} type="datetime-local" value={filters.until} onChange={(e) => setFilters({ ...filters, until: e.target.value, page: 1 })} /><button onClick={() => void applyFilters()}><MagnifyingGlass />{t('security.query')}</button></div>
      {value.audit.integrity.status === 'invalid' ? <div className="audit-invalid"><ShieldWarning />{t('security.auditInvalid')}</div> : value.audit.integrity.status === 'missing' ? <div className="security-empty">{t('security.auditNotCreated')}</div> : <><div className="event-table"><div className="event-head"><span>{t('security.colTime')}</span><span>{t('security.colClient')}</span><span>{t('security.colEvent')}</span><span>{t('security.colScope')}</span><span>{t('security.colResult')}</span></div>{value.audit.items.map((item) => <button key={item.eventId} onClick={() => setSelectedEvent(item)}><span>{displayTime(item.timestamp)}</span><span>{item.clientId}</span><strong>{item.eventType}</strong><code>{item.scope}</code><em className={item.result}>{item.result}</em></button>)}</div><div className="pagination"><button disabled={value.audit.page <= 1} onClick={() => { const next = { ...filters, page: filters.page - 1 }; setFilters(next); void applyFilters(next) }}>{t('security.prev')}</button><span>{t('security.pageInfo', { page: value.audit.page, total: value.audit.total })}</span><button disabled={value.audit.page * value.audit.pageSize >= value.audit.total} onClick={() => { const next = { ...filters, page: filters.page + 1 }; setFilters(next); void applyFilters(next) }}>{t('security.next')}</button></div></>}
    </section>

    <div className="security-grid lower"><section className="security-panel lifecycle-audit"><header><div><p className="eyebrow">MEMORY LIFECYCLE AUDIT</p><h3>{t('security.lifecycleTitle')}</h3></div></header>{value.lifecycle.items.length ? <div className="lifecycle-events">{value.lifecycle.items.map((item) => <article key={item.eventId}><span className={item.eventType.split('.').pop()}><Pulse /></span><div><strong>{item.eventType.replace('memory.', '')}</strong><small>{displayTime(item.timestamp)} · {String(item.details.resourceId ?? t('security.protectedRecord'))}</small></div></article>)}</div> : <p className="security-empty">{t('security.lifecycleEmpty')}</p>}</section>
      <section className="security-panel diagnostics"><header><div><p className="eyebrow">SECURITY DIAGNOSTICS</p><h3>{t('security.diagnosticsTitle')}</h3></div></header><ul><li><CheckCircle />{t('security.diagBearer')}</li><li><CheckCircle />{t('security.diagHash')}</li><li><CheckCircle />{t('security.diagAudit')}</li><li className={integrity === 'verified' ? 'good' : integrity === 'missing' ? 'neutral' : 'bad'}>{integrity === 'verified' ? <CheckCircle /> : integrity === 'missing' ? <Clock /> : <XCircle />}{t('security.diagChain', { status: integrity })}</li><li><CheckCircle />{t('security.diagEnforced')}</li></ul></section></div>

    {selectedEvent && <div className="event-detail" role="dialog" aria-modal="true" aria-label={t('security.eventDetailLabel')}><button className="event-scrim" aria-label={t('security.eventDetailLabel')} onClick={() => setSelectedEvent(null)} /><article><header><div><p className="eyebrow">AUDIT EVENT DETAIL</p><h3>{selectedEvent.eventType}</h3></div><button onClick={() => setSelectedEvent(null)}>{t('security.close')}</button></header><dl>{Object.entries(selectedEvent).filter(([key]) => key !== 'details').map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{String(value)}</dd></div>)}</dl><pre>{JSON.stringify(selectedEvent.details, null, 2)}</pre></article></div>}
  </section>
}

function Status({ label, value, good, neutral = false }: { label: string; value: string; good: boolean; neutral?: boolean }) { return <article className={good ? 'good' : neutral ? 'neutral' : 'warning'}><span>{good ? <CheckCircle /> : neutral ? <Clock /> : <ShieldWarning />}</span><div><small>{label}</small><strong>{value}</strong></div></article> }
