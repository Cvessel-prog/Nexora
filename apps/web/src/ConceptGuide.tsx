import { useEffect, useRef } from 'react'
import { ArrowRight, Database, GithubLogo, HardDrives, LockKey, Note, PlugsConnected, ShieldCheck, X } from '@phosphor-icons/react'
import { useT } from './i18n'

export const CONCEPTS = [
  { key: 'vault', Icon: Database },
  { key: 'obsidian', Icon: Note },
  { key: 'snapshots', Icon: HardDrives },
  { key: 'github', Icon: GithubLogo },
  { key: 'mcp', Icon: PlugsConnected },
  { key: 'provider', Icon: LockKey },
] as const

type Props = { open: boolean; onClose: () => void }

/**
 * The workspace used to explain Vault and Obsidian only during onboarding.  This
 * guide is available from every surface so the six moving parts keep a stable,
 * explicit relationship after the wizard is gone.
 */
export default function ConceptGuide({ open, onClose }: Props) {
  const t = useT()
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    closeRef.current?.focus()
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      previous?.focus?.()
    }
  }, [open, onClose])

  if (!open) return null

  return <div className="concept-overlay">
    <button className="concept-scrim" aria-label={t('concepts.close')} onClick={onClose} />
    <section className="concept-dialog" role="dialog" aria-modal="true" aria-labelledby="concept-title">
      <header>
        <div><p className="eyebrow">NEXORA / LOCAL-FIRST</p><h2 id="concept-title">{t('concepts.title')}</h2><p>{t('concepts.intro')}</p></div>
        <button ref={closeRef} className="icon-button" aria-label={t('concepts.close')} onClick={onClose}><X size={20} /></button>
      </header>

      <div className="concept-grid">
        {CONCEPTS.map(({ key, Icon }) => <article key={key}>
          <span className="concept-icon"><Icon size={22} weight="duotone" /></span>
          <div><h3>{t(`concepts.${key}.title`)}</h3><p>{t(`concepts.${key}.desc`)}</p></div>
        </article>)}
      </div>

      <section className="concept-rules" aria-label={t('concepts.rules')}>
        <h3>{t('concepts.rules')}</h3>
        <div><ShieldCheck size={19} /><p><strong>{t('concepts.rule.connections')}</strong>{t('concepts.rule.connections.desc')}</p></div>
        <div><LockKey size={19} /><p><strong>{t('concepts.rule.provider')}</strong>{t('concepts.rule.provider.desc')}</p></div>
        <div><HardDrives size={19} /><p><strong>{t('concepts.rule.backup')}</strong>{t('concepts.rule.backup.desc')}</p></div>
      </section>

      <section className="concept-flow" aria-label={t('concepts.flow')}>
        <h3>{t('concepts.flow')}</h3>
        <ol>
          <li><span>{t('concepts.flow.editor')}</span><ArrowRight size={15} /><span>{t('concepts.flow.vault')}</span><em>{t('concepts.flow.editor.note')}</em></li>
          <li><span>{t('concepts.flow.vault')}</span><ArrowRight size={15} /><span>{t('concepts.flow.snapshot')}</span><em>{t('concepts.flow.snapshot.note')}</em></li>
          <li><span>{t('concepts.flow.vault')}</span><ArrowRight size={15} /><span>Git</span><ArrowRight size={15} /><span>{t('concepts.flow.github')}</span><em>{t('concepts.flow.github.note')}</em></li>
          <li><span>{t('concepts.flow.mcp')}</span><ArrowRight size={15} /><span>{t('concepts.flow.scope')}</span><ArrowRight size={15} /><span>{t('concepts.flow.vault')}</span><em>{t('concepts.flow.mcp.note')}</em></li>
          <li><span>{t('concepts.flow.vault')}</span><ArrowRight size={15} /><span>{t('concepts.flow.approval')}</span><ArrowRight size={15} /><span>{t('concepts.flow.provider')}</span><em>{t('concepts.flow.provider.note')}</em></li>
          <li><span>{t('concepts.flow.all')}</span><ArrowRight size={15} /><span>{t('concepts.flow.audit')}</span><em>{t('concepts.flow.audit.note')}</em></li>
        </ol>
      </section>
    </section>
  </div>
}
