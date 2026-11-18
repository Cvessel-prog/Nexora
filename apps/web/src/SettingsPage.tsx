import { useEffect, useState } from 'react'
import { Database, GithubLogo, HardDrives, LockKey, PlugsConnected, ShieldCheck } from '@phosphor-icons/react'
import type { ApiClient, GitHubStatus, ProviderAdaptersOverview, SecurityOverview, VaultBackup, VaultStatus } from './api'
import type { Language } from './i18n'
import { LANGUAGES, useT } from './i18n'
import { CONCEPTS } from './ConceptGuide'

type SettingsView = 'backup' | 'connections' | 'privacy'

type Props = {
  client: ApiClient
  language: Language
  onLanguage: (language: Language) => void
  highContrast: boolean
  onHighContrast: (value: boolean) => void
  onOpenConcepts: () => void
  onNavigate: (view: SettingsView) => void
}

type Summary = {
  vault: VaultStatus | null
  backups: VaultBackup[]
  providers: ProviderAdaptersOverview | null
  github: GitHubStatus | null
  security: SecurityOverview | null
}

const EMPTY: Summary = { vault: null, backups: [], providers: null, github: null, security: null }
const APP_VERSION = import.meta.env.VITE_APP_VERSION ?? '1.0.4'

function shortRevision(value: string) {
  return value ? value.slice(0, 12) : '—'
}

export default function SettingsPage({ client, language, onLanguage, highContrast, onHighContrast, onOpenConcepts, onNavigate }: Props) {
  const t = useT()
  const [summary, setSummary] = useState<Summary>(EMPTY)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([
      client.vaultStatus().catch(() => null),
      client.backups().catch(() => null),
      client.providerAdapters().catch(() => null),
      client.githubStatus().catch(() => null),
      client.securityOverview().catch(() => null),
    ]).then(([vault, backups, providers, github, security]) => {
      if (cancelled) return
      setSummary({ vault, backups: backups?.backups ?? [], providers, github, security })
    }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [client])

  const authorized = summary.security?.diagnostics.authorizedClients ?? 0
  const configuredProviders = summary.providers?.configured.length ?? 0
  const githubConnected = Boolean(summary.github?.connected)

  return <section className="settings-page" aria-label={t('settings.title')}>
    <header className="settings-heading">
      <div><p className="eyebrow">NEXORA / SETTINGS</p><h2>{t('settings.title')}</h2><p>{t('settings.intro')}</p></div>
      <button className="secondary-action" onClick={onOpenConcepts}>{t('settings.concepts')}</button>
    </header>

    <div className="settings-grid">
      <section className="settings-card" aria-label={t('settings.appearance')}>
        <header><h3>{t('settings.appearance')}</h3></header>
        <div className="settings-field">
          <label htmlFor="settings-language">{t('settings.language')}</label>
          <select id="settings-language" value={language} onChange={(event) => onLanguage(event.target.value as Language)}>
            {LANGUAGES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </div>
        <label className="settings-check">
          <input type="checkbox" checked={highContrast} onChange={(event) => onHighContrast(event.target.checked)} />
          <span><strong>{t('settings.contrast')}</strong><small>{t('settings.contrast.hint')}</small></span>
        </label>
      </section>

      <section className="settings-card" aria-label={t('settings.vault')}>
        <header><h3>{t('settings.vault')}</h3><Database size={20} /></header>
        {loading ? <p className="muted">{t('settings.loading')}</p> : <dl className="settings-list">
          <div><dt>{t('settings.vault.name')}</dt><dd>{summary.vault?.displayName ?? '—'}</dd></div>
          <div><dt>{t('settings.vault.schema')}</dt><dd>{summary.vault?.schemaVersion ?? '—'}</dd></div>
          <div><dt>{t('settings.vault.revision')}</dt><dd><code>{shortRevision(summary.vault?.revision ?? '')}</code></dd></div>
          <div><dt>{t('settings.vault.watcher')}</dt><dd className={summary.vault?.watched ? 'ok' : 'warn'}>{summary.vault?.watched ? t('settings.vault.watcher.on') : t('settings.vault.watcher.off')}</dd></div>
        </dl>}
      </section>

      <section className="settings-card" aria-label={t('settings.data')}>
        <header><h3>{t('settings.data')}</h3><HardDrives size={20} /></header>
        <dl className="settings-list">
          <div><dt>{t('settings.backups')}</dt><dd>{summary.backups.length}</dd></div>
          <div><dt>{t('settings.providers')}</dt><dd>{configuredProviders}</dd></div>
          <div><dt>{t('settings.github')}</dt><dd className={githubConnected ? 'ok' : ''}>{githubConnected ? t('settings.github.connected') : t('settings.github.notConnected')}</dd></div>
          <div><dt>{t('settings.authorizedClients')}</dt><dd>{authorized}</dd></div>
        </dl>
        <div className="settings-actions">
          <button className="secondary-action" onClick={() => onNavigate('backup')}>{t('settings.manageData')}</button>
          <button className="secondary-action" onClick={() => onNavigate('connections')}>{t('settings.manageConnections')}</button>
        </div>
      </section>

      <section className="settings-card" aria-label={t('settings.concepts')}>
        <header><h3>{t('settings.concepts')}</h3><PlugsConnected size={20} /></header>
        <p className="settings-hint">{t('settings.concepts.hint')}</p>
        <ul className="concept-chips">
          {CONCEPTS.map(({ key, Icon }) => <li key={key}><Icon size={16} /><span>{t(`concepts.${key}.title`)}</span></li>)}
        </ul>
        <button className="primary-action" onClick={onOpenConcepts}>{t('settings.openConcepts')}</button>
      </section>

      <section className="settings-card" aria-label={t('settings.privacy')}>
        <header><h3>{t('settings.privacy')}</h3><ShieldCheck size={20} /></header>
        <p className="settings-hint">{t('settings.privacy.hint')}</p>
        <button className="secondary-action" onClick={() => onNavigate('privacy')}>{t('settings.openPrivacy')}</button>
      </section>

      <section className="settings-card" aria-label={t('settings.about')}>
        <header><h3>{t('settings.about')}</h3><LockKey size={20} /></header>
        <p className="settings-hint">{t('settings.about.text')}</p>
        <dl className="settings-list">
          <div><dt>{t('settings.version')}</dt><dd>v{APP_VERSION}</dd></div>
          <div><dt>{t('settings.runtime')}</dt><dd>{t('settings.runtime.local')}</dd></div>
        </dl>
        {summary.github && <p className="settings-footnote"><GithubLogo size={15} />{summary.github.repository || t('settings.github.notConnected')}</p>}
      </section>
    </div>
  </section>
}
