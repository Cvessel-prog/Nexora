import { useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { ArrowRight, CheckCircle, Circle, Clock, LockKey, ShieldCheck, Sparkle, UserCircle } from '@phosphor-icons/react'
import type { OnboardingState, OnboardingTopic } from './api'
import { ErrorState, LoadingState } from './components/StateBlocks'
import { useT } from './i18n'

type Props = {
  value: OnboardingState | null
  loading: boolean
  saving: boolean
  onSave: (topic: string, content: string) => Promise<boolean>
  onReview: () => void
}

export default function ConversationalOnboardingPage({ value, loading, saving, onSave, onReview }: Props) {
  const t = useT()
  const [answer, setAnswer] = useState('')
  const [skipped, setSkipped] = useState<string[]>([])
  const [consent, setConsent] = useState(false)
  const available = useMemo(() => value?.topics.filter((item) => item.status === 'available' && !skipped.includes(item.key)) ?? [], [value, skipped])

  if (loading) return <LoadingState label={t('onboarding.loading')} />
  if (!value) return <ErrorState title={t('onboarding.errorTitle')} description={t('onboarding.errorDetail')} />

  const topic = available[0]
  const pending = value.topics.filter((item) => item.status === 'pending').length
  const confirmed = value.topics.filter((item) => item.status === 'confirmed').length
  const answered = confirmed + pending
  const percent = value.topics.length ? Math.round((answered / value.topics.length) * 100) : 0

  async function submit(item: OnboardingTopic) {
    if (!answer.trim() || !consent) return
    if (await onSave(item.key, answer.trim())) {
      setAnswer('')
      setConsent(false)
    }
  }

  function skip(item: OnboardingTopic) {
    setSkipped((items) => [...items, item.key])
    setAnswer('')
    setConsent(false)
  }

  return <section className="onboarding-page">
    <header className="onboarding-heading compact-heading">
      <div><p className="eyebrow">CONVERSATIONAL ONBOARDING / LOCAL ONLY</p><p>{t('onboarding.heading')}</p></div>
      <div className="onboarding-boundary"><ShieldCheck size={20} /><span><strong>Human confirmation required</strong><small>{t('onboarding.confirmNote')}</small></span></div>
    </header>

    <div className="onboarding-layout">
      <aside className="onboarding-progress-panel" aria-label={t('onboarding.progressLabel')}>
        <div className="progress-orbit" style={{ '--progress': `${percent * 3.6}deg` } as CSSProperties}><span><strong>{percent}%</strong><small>PROFILE SIGNAL</small></span></div>
        <div className="progress-copy"><p className="eyebrow">PROFILE CALIBRATION</p><h3>{t('onboarding.answered', { answered, total: value.topics.length })}</h3><p>{value.notice}</p><div className="progress-line"><i style={{ width: `${percent}%` }} /></div></div>
        <dl><div><dt>{t('onboarding.confirmed')}</dt><dd>{confirmed}</dd></div><div><dt>{t('onboarding.pending')}</dt><dd>{pending}</dd></div><div><dt>{t('onboarding.available')}</dt><dd>{available.length}</dd></div></dl>
      </aside>
      <main className="dialogue-space" aria-live="polite">
        <div className="dialogue-top"><div><span className="agent-avatar"><Sparkle size={20} weight="duotone" /></span><div><strong>Profile Guide</strong><small><i /> LOCAL SESSION</small></div></div><span>{t('onboarding.sessionNote')}</span></div>
        {!topic ? <div className="onboarding-empty"><CheckCircle size={38} /><h3>{value.completed ? t('onboarding.completed') : t('onboarding.skippedAll')}</h3><p>{pending ? t('onboarding.pendingAnswers', { count: pending }) : t('onboarding.returnNote')}</p>{pending > 0 && <button className="primary-action" onClick={onReview}>{t('onboarding.goReview')} <ArrowRight size={17} /></button>}</div> : <>
          <div className="dialogue-thread">
            <div className="guide-message"><span className="agent-avatar"><Sparkle size={18} /></span><div><small>PROFILE GUIDE · {topic.title}</small><p>{topic.prompt}</p><em>{t('onboarding.guideHint')}</em></div></div>
            <div className="user-composer">
              <div className="composer-label"><span><UserCircle size={17} />{t('onboarding.yourAnswer')}</span><small>{answer.length} / 1000</small></div>
              <textarea aria-label={t('onboarding.yourAnswer')} value={answer} onChange={(event) => setAnswer(event.target.value)} maxLength={1000} placeholder={t('onboarding.answerPlaceholder')} disabled={saving} />
              <label className="consent-check"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} disabled={saving} /><span>{t('onboarding.consent')}</span></label>
              <div className="composer-actions"><button className="secondary" onClick={() => skip(topic)} disabled={saving}>{t('onboarding.skip')}</button><button className="primary-action" onClick={() => void submit(topic)} disabled={saving || !answer.trim() || !consent}>{saving ? t('onboarding.saving') : <>{t('onboarding.saveAndContinue')} <ArrowRight size={17} /></>}</button></div>
            </div>
          </div>
          <div className="privacy-rail"><LockKey size={16} /><p><strong>{t('onboarding.privacyTitle')}</strong>{t('onboarding.privacyDetail')}</p></div>
        </>}
      </main>

      <aside className="topic-map" aria-label={t('onboarding.topicsLabel')}>
        <div><p className="eyebrow">PROFILE SIGNALS</p><h3>{t('onboarding.topicsTitle')}</h3><p>{t('onboarding.topicsHint')}</p></div>
        <div className="topic-list">{value.topics.map((item, index) => {
          const isSkipped = skipped.includes(item.key)
          const isActive = item.key === topic?.key
          const state = item.status === 'confirmed' ? t('onboarding.stateConfirmed') : item.status === 'pending' ? t('onboarding.statePending') : isSkipped ? t('onboarding.stateSkipped') : isActive ? t('onboarding.stateActive') : t('onboarding.stateAvailable')
          return <article key={item.key} className={`${item.status} ${isActive ? 'active' : ''}`}><span className="topic-index">{String(index + 1).padStart(2, '0')}</span><span className="topic-state">{item.status === 'confirmed' ? <CheckCircle /> : item.status === 'pending' ? <Clock /> : <Circle />}</span><div><strong>{item.title}</strong><small>{state}</small></div></article>
        })}</div>
        {pending > 0 && <button className="review-link" onClick={onReview}><span><Clock size={18} /><b>{t('onboarding.pendingReview', { count: pending })}</b></span><ArrowRight size={18} /></button>}
      </aside>
    </div>
  </section>
}
