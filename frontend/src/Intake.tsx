import { useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ClipboardCheck,
  HeartPulse,
  Languages,
  ListChecks,
  Mic,
  PenLine,
  Square,
  UserRound,
} from 'lucide-react'
import { APIError, post } from './api'
import { registrationVitalsComplete } from './components'
import { recognitionConstructor, stopSpeaking } from './speech'
import type { Recognition } from './speech'
import type { Catalog, Receipt, Staff, Vitals } from './types'
import RegistrationVitals from './RegistrationVitals'
import SpokenPrompt from './SpokenPrompt'
import SymptomPicker from './SymptomPicker'
import { useFadeStep } from './useFadeStep'

type Step = 'language' | 'details' | 'method' | 'symptoms' | 'review' | 'vitals'
type Method = 'VOICE' | 'TEXT' | 'CHECKBOX'
export default function Intake({
  catalog,
  onExit,
  staff = null,
  onStaffLogin,
}: {
  catalog: Catalog
  onExit: () => void
  staff?: Staff | null
  onStaffLogin?: (staff: Staff | null) => void
}) {
  const [language, setLanguage] = useState('hi-IN'),
    hi = language === 'hi-IN'
  const t = (en: string, hindi: string) => (hi ? hindi : en)
  const [step, changeStep, leaving] = useFadeStep<Step>('language')
  const [registration, changeRegistration, registrationLeaving] = useFadeStep<'MANUAL' | 'ABHA'>(
    'MANUAL',
  )
  const [registrationChoice, setRegistrationChoice] = useState('MANUAL')
  const [method, setMethod] = useState<Method>('TEXT')
  const [muted, setMuted] = useState(false)
  const [typed, setTyped] = useState(false)
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false)
  const [name, setName] = useState(''),
    [age, setAge] = useState(''),
    [sex, setSex] = useState('NOT_STATED'),
    [pregnancy, setPregnancy] = useState('UNKNOWN'),
    [abha, setAbha] = useState('')
  const [raw, setRaw] = useState(''),
    [confirmed, setConfirmed] = useState(''),
    [symptoms, setSymptoms] = useState<string[]>([])
  const [historyStatus, setHistoryStatus] = useState('NOT_PROVIDED'),
    [history, setHistory] = useState(''),
    [medStatus, setMedStatus] = useState('NOT_PROVIDED'),
    [medications, setMedications] = useState('')
  const [voiceOriginal, setVoiceOriginal] = useState(''),
    [interim, setInterim] = useState(''),
    [listening, setListening] = useState(false),
    [speechMessage, setSpeechMessage] = useState('')
  const [vitals, setVitals] = useState<Vitals>({})
  const [needsDoctor, setNeedsDoctor] = useState(false)
  const [reviewReason, setReviewReason] = useState('')
  const [locked, setLocked] = useState(false)
  const saving = useRef(false)
  const resumeReview = useRef(false)
  const submission = useRef<{ path: string; payload: unknown } | null>(null)
  const [receipt, setReceipt] = useState<Receipt | null>(null)
  const [receiptError, setReceiptError] = useState('')
  const [receiptRetry, setReceiptRetry] = useState(0)
  const recognition = useRef<Recognition | null>(null),
    voiceRef = useRef(''),
    requestId = useRef(crypto.randomUUID())

  const container = useRef<HTMLDivElement>(null)
  const previousStep = useRef<Step>('language')
  const originalText = voiceOriginal
    ? `Original speech transcript:\n${voiceOriginal}\nTyped/edited intake:\n${raw}`
    : raw
  useEffect(() => {
    document.documentElement.lang = hi ? 'hi' : 'en'
    return () => {
      document.documentElement.lang = 'en'
    }
  }, [hi])
  useEffect(() => {
    if (previousStep.current !== step) {
      container.current
        ?.querySelector<HTMLElement>('[data-step-heading]')
        ?.focus({ preventScroll: true })
      window.scrollTo(0, 0)
      previousStep.current = step
    }
  }, [step])
  useEffect(
    () => () => {
      const engine = recognition.current
      if (engine) {
        engine.onresult = engine.onerror = engine.onend = null
        engine.abort()
      }
      stopSpeaking()
    },
    [],
  )
  useEffect(() => {
    if (receipt?.ai_status !== 'PENDING') return
    let cancelled = false
    let attempts = 0
    let timer: ReturnType<typeof setTimeout>
    async function check() {
      try {
        const updated = await post<Receipt>('/registration-status', {
          request_id: requestId.current,
        })
        if (cancelled) return
        setReceipt(updated)
        setReceiptError('')
        if (updated.ai_status !== 'PENDING') return
      } catch {
        if (cancelled) return
        setReceiptError('unavailable')
      }
      if (++attempts < 30) timer = setTimeout(() => void check(), 2000)
      else setReceiptError('unavailable')
    }
    void check()
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [receipt?.ai_status, receiptRetry])
  function stopRecognition() {
    const engine = recognition.current
    recognition.current = null
    if (engine) {
      engine.onresult = engine.onerror = engine.onend = null
      engine.abort()
    }
    setListening(false)
    setInterim('')
  }
  function go(next: Step) {
    if (leaving || busy || locked) return
    stopRecognition()
    stopSpeaking()
    setSpeechMessage('')
    setError('')
    changeStep(next)
  }
  function chooseLanguage(next: string) {
    setLanguage(next)
    go('details')
  }
  function manualRegistration() {
    setAbha('')
    setRegistrationChoice('MANUAL')
    changeRegistration('MANUAL')
  }
  function startVoice() {
    stopSpeaking()
    const Constructor = recognitionConstructor()
    if (!Constructor) {
      setSpeechMessage(
        t(
          'Voice input is unavailable. Please type or choose symptoms.',
          'आवाज़ से जानकारी देना उपलब्ध नहीं है। लिखें या विकल्प चुनें।',
        ),
      )
      return
    }
    stopRecognition()
    const engine = new Constructor()
    recognition.current = engine
    engine.lang = language
    engine.interimResults = true
    engine.continuous = false
    engine.onresult = (event) => {
      if (recognition.current !== engine) return
      let preview = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const part = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          voiceRef.current = (voiceRef.current + ' ' + part).trim()
          setVoiceOriginal(voiceRef.current)
          setRaw((old) => (old + ' ' + part).trim())
        } else preview += part
      }
      setInterim(preview)
    }
    engine.onerror = () => {
      if (recognition.current !== engine) return
      setListening(false)
      setSpeechMessage(
        t(
          'Voice input could not continue. Please try again or choose text input.',
          'आवाज़ से जानकारी नहीं मिल पाई। फिर कोशिश करें या लिखकर बताएँ।',
        ),
      )
    }
    engine.onend = () => {
      if (recognition.current !== engine) return
      setListening(false)
      setInterim('')
    }
    try {
      engine.start()
      setListening(true)
      setSpeechMessage('')
    } catch {
      setSpeechMessage(
        t(
          'Microphone could not start. Use text or checkboxes.',
          'माइक्रोफ़ोन शुरू नहीं हुआ। लिखें या विकल्प चुनें।',
        ),
      )
    }
  }
  async function submit(emergency = false) {
    if (saving.current) return
    if (!staff || !registrationVitalsComplete(vitals)) {
      changeStep('vitals')
      setError(
        t(
          'Staff sign-in and all three required vitals are needed.',
          'कर्मचारी लॉगिन और तीनों ज़रूरी माप भरना आवश्यक है।',
        ),
      )
      return
    }
    saving.current = true
    stopRecognition()
    stopSpeaking()
    setBusy(true)
    setError('')
    try {
      const payload = {
        request_id: requestId.current,
        name,
        age_years: Number(age),
        sex,
        pregnancy_status: pregnancy,
        registration_type: 'MANUAL',
        language,
        input_methods: [
          ...(typed && raw.trim() ? ['TEXT'] : []),
          ...(voiceOriginal ? ['VOICE'] : []),
          ...(symptoms.length ? ['CHECKBOX'] : []),
        ],
        original_text: originalText,
        confirmed_text: confirmed,
        symptoms,
        facts: {},
        history_status: historyStatus,
        history,
        medication_status: medStatus,
        medications,
        vitals,
        doctor_review_reason: needsDoctor ? reviewReason.trim() : null,
        staff_assessed_emergency: emergency,
      }
      if (!submission.current) submission.current = { path: '/staff/encounters', payload }
      setLocked(true)
      const result = await post<Receipt>(submission.current.path, submission.current.payload)
      setReceipt(result)
    } catch (e) {
      if (e instanceof APIError && [401, 403, 422].includes(e.status)) {
        submission.current = null
        setLocked(false)
        if (e.status === 401) {
          resumeReview.current = step === 'review'
          onStaffLogin?.(null)
          changeStep('vitals')
        }
      }
      setError((e as Error).message)
    } finally {
      saving.current = false
      setBusy(false)
    }
  }
  const demoBanner = (
    <div className="demo-banner">
      {step === 'language'
        ? 'SYNTHETIC DEMO · काल्पनिक डेटा · Not for real patient care'
        : t(
            'SYNTHETIC DEMO · Not for real patient care',
            'काल्पनिक डेटा · केवल डेमो · वास्तविक मरीज़ों के लिए नहीं',
          )}
    </div>
  )
  if (receipt)
    return (
      <>
        {demoBanner}
        <main className="intake-wrap">
          <section
            className={`receipt panel ${receipt.priority === 'IMMEDIATE' ? 'receipt-immediate' : receipt.ai_status === 'PENDING' ? 'receipt-pending' : 'receipt-standard'}`}
          >
            <span className="success-icon">
              <Check size={32} />
            </span>
            <p className="eyebrow">{t('REGISTRATION COMPLETE', 'पंजीकरण पूरा हुआ')}</p>
            <h1>{t('Your token', 'आपका टोकन')}</h1>
            <div className="receipt-token">{receipt.token}</div>
            <p className="receipt-priority" aria-live="polite">
              {receipt.ai_status === 'PENDING' && receipt.priority !== 'IMMEDIATE'
                ? t('Assessment pending', 'आकलन जारी है')
                : t('Priority: ', 'प्राथमिकता: ') +
                  (receipt.priority === 'IMMEDIATE'
                    ? t('Immediate', 'तुरंत')
                    : receipt.priority === 'SOON'
                      ? t('Soon', 'जल्द')
                      : t('Routine', 'सामान्य'))}
            </p>
            <p>
              {t(
                'Please keep this number. Staff will help you with the next step.',
                'यह नंबर संभालकर रखें। अगले चरण में कर्मचारी आपकी मदद करेंगे।',
              )}
            </p>
            <div role="status" aria-live="polite">
              {receipt.ai_status === 'PENDING' && (
                <p>
                  {t(
                    'Your assessment is being prepared. Contact staff if you need help now.',
                    'आपकी जानकारी की समीक्षा हो रही है। अभी मदद चाहिए तो कर्मचारी से संपर्क करें।',
                  )}
                </p>
              )}
              {receipt.ai_status === 'COMPLETE' && (
                <p>
                  {t(
                    'Your assessment has been sent to staff.',
                    'आपकी जानकारी की समीक्षा कर्मचारियों को भेज दी गई है।',
                  )}
                </p>
              )}
              {receipt.needs_staff_review && receipt.ai_status !== 'PENDING' && (
                <p>
                  {t(
                    'Please ask staff to review your information.',
                    'कृपया कर्मचारी से अपनी जानकारी की जाँच करवाएँ।',
                  )}
                </p>
              )}
            </div>
            {receiptError && (
              <div className="alert warning" role="alert">
                <p>
                  {t(
                    'Cannot confirm assessment status. Please contact staff.',
                    'समीक्षा की स्थिति नहीं मिल रही है। कृपया कर्मचारी से संपर्क करें।',
                  )}
                </p>
                <button className="secondary" onClick={() => setReceiptRetry((n) => n + 1)}>
                  {t('Check again', 'फिर से जाँचें')}
                </button>
              </div>
            )}
            {receipt.urgent_alert && (
              <div className="alert urgent" role="alert">
                {t(
                  'Please contact the nurse or doctor immediately for assessment.',
                  'कृपया जाँच के लिए तुरंत नर्स या डॉक्टर से संपर्क करें।',
                )}
              </div>
            )}
            {needsDoctor && staff && (
              <p className="alert info">
                {t(
                  'Doctor review has been requested. Staff can find this case under Unresolved on the dashboard.',
                  'डॉक्टर की समीक्षा का अनुरोध किया गया है। कर्मचारी इसे डैशबोर्ड पर अनसुलझे मामलों में देख सकते हैं।',
                )}
              </p>
            )}
            <button className="primary" onClick={() => window.location.assign('/intake')}>
              {t('Register another demo patient', 'दूसरा डेमो पंजीकरण')}
            </button>
            <button className="text-button" onClick={onExit}>
              {t('Staff area', 'कर्मचारी क्षेत्र')}
            </button>
          </section>
        </main>
      </>
    )

  const progress = step === 'details' ? 0 : step === 'vitals' ? 1 : step === 'review' ? 3 : 2
  const methods = [
    {
      id: 'VOICE' as Method,
      Icon: Mic,
      title: t('Through voice', 'बोलकर'),
      description: t('Speak at your own pace.', 'आराम से अपनी बात कहें।'),
    },
    {
      id: 'TEXT' as Method,
      Icon: PenLine,
      title: t('Through text', 'लिखकर'),
      description: t('Tell us in your own words.', 'अपने शब्दों में बताएँ।'),
    },
    {
      id: 'CHECKBOX' as Method,
      Icon: ListChecks,
      title: t('Through checkboxes', 'विकल्प चुनकर'),
      description: t('Choose the symptoms that fit.', 'मिलते-जुलते लक्षण चुनें।'),
    },
  ]
  return (
    <>
      {demoBanner}
      <main className={`intake-wrap guided-intake ${step === 'language' ? 'language-stage' : ''}`}>
        <header className="intake-header">
          <div className="intake-brand">
            <HeartPulse size={25} aria-hidden="true" />
            <strong>OPD RAQ AIA</strong>
          </div>
          <div className="intake-nav">
            {step !== 'language' && (
              <button
                type="button"
                className="text-button"
                disabled={leaving || busy || locked}
                onClick={() => go('language')}
              >
                <Languages size={18} aria-hidden="true" />
                {t('Change language', 'भाषा बदलें')}
              </button>
            )}
            <button
              type="button"
              className="text-button"
              disabled={busy || locked}
              onClick={onExit}
            >
              <ArrowLeft size={16} aria-hidden="true" />
              {step === 'language' ? 'कर्मचारी / Staff' : t('Staff area', 'कर्मचारी क्षेत्र')}
            </button>
          </div>
        </header>
        {step !== 'language' && (
          <ol
            className="intake-progress"
            aria-label={t('Registration progress', 'पंजीकरण की प्रगति')}
          >
            {[
              t('About you', 'आपकी जानकारी'),
              t('Vitals', 'शारीरिक माप'),
              t('Your symptoms', 'आपकी परेशानी'),
              t('Review', 'पुष्टि'),
            ].map((label, index) => (
              <li
                key={label}
                className={index === progress ? 'current' : index < progress ? 'complete' : ''}
                aria-current={index === progress ? 'step' : undefined}
              >
                <span>{index < progress ? <Check size={15} /> : index + 1}</span>
                {label}
              </li>
            ))}
          </ol>
        )}
        {error && (
          <div className="alert error" role="alert">
            {error}
          </div>
        )}
        <div
          ref={container}
          className={`flow-page ${leaving ? 'leaving' : ''}`}
          key={step}
          aria-busy={leaving}
          inert={leaving}
        >
          {step === 'language' && (
            <section className="language-welcome">
              <div className="welcome-symbol">
                <Languages size={33} aria-hidden="true" />
              </div>
              <p className="eyebrow">मरीज़ पंजीकरण · PATIENT REGISTRATION</p>
              <SpokenPrompt active={!leaving} id="welcome" muted={muted} onMute={setMuted} />
              <div className="language-options" role="group" aria-label="भाषा / Language">
                <button className="language-card" onClick={() => chooseLanguage('hi-IN')} lang="hi">
                  <span className="language-glyph" aria-hidden="true">
                    अ
                  </span>
                  <span>
                    <strong>हिन्दी</strong>
                    <small>हिन्दी में आगे बढ़ें</small>
                  </span>
                  <ArrowRight size={22} aria-hidden="true" />
                </button>
                <button className="language-card" onClick={() => chooseLanguage('en-IN')} lang="en">
                  <span className="language-glyph" aria-hidden="true">
                    A
                  </span>
                  <span>
                    <strong>English</strong>
                    <small>Continue in English</small>
                  </span>
                  <ArrowRight size={22} aria-hidden="true" />
                </button>
              </div>
              <p className="welcome-note">
                केवल डेमो के लिए काल्पनिक जानकारी दें।
                <br />
                <span lang="en">Please use made-up details for this demo.</span>
              </p>
            </section>
          )}
          {step === 'details' && (
            <form
              className="panel intake-form details-form"
              onSubmit={(event) => {
                event.preventDefault()
                if (registration !== 'MANUAL' || registrationLeaving) return
                if (!name.trim()) {
                  setError(t('Please enter a demo name.', 'कृपया काल्पनिक नाम लिखें।'))
                  return
                }
                go('vitals')
              }}
            >
              <div className="step-intro">
                <span className="step-icon">
                  <UserRound size={23} aria-hidden="true" />
                </span>
                <p className="eyebrow">{t('LET’S START HERE', 'यहाँ से शुरू करें')}</p>
                <h1 tabIndex={-1} data-step-heading>
                  {t('A little about you', 'आपके बारे में')}
                </h1>
                <p>
                  {t(
                    'Please use made-up patient details for this demo.',
                    'कृपया इस डेमो में काल्पनिक मरीज़ की जानकारी दें।',
                  )}
                </p>
              </div>
              <label className="registration-select">
                {t('Registration', 'पंजीकरण')}
                <select
                  value={registrationChoice}
                  onChange={(event) => {
                    const next = event.target.value as 'MANUAL' | 'ABHA'
                    setRegistrationChoice(next)
                    setAbha('')
                    changeRegistration(next)
                  }}
                >
                  <option value="MANUAL">{t('Enter details manually', 'जानकारी खुद भरें')}</option>
                  <option value="ABHA">{t('ABHA ID', 'आभा आईडी')}</option>
                </select>
              </label>
              <div
                className={`registration-fields flow-page ${registrationLeaving ? 'leaving' : ''}`}
                key={registration}
                inert={registrationLeaving}
              >
                {registration === 'MANUAL' ? (
                  <>
                    <div className="form-grid">
                      <label>
                        {t('Demo name', 'काल्पनिक नाम')}
                        <input
                          autoComplete="off"
                          required
                          maxLength={120}
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder={t('e.g. Demo Patient', 'जैसे: डेमो मरीज़')}
                        />
                      </label>
                      <label>
                        {t('Age in years', 'उम्र (वर्ष)')}
                        <input
                          required
                          type="number"
                          min="0"
                          max="130"
                          step="1"
                          value={age}
                          onChange={(e) => setAge(e.target.value)}
                        />
                      </label>
                      <label>
                        {t('Sex', 'लिंग')}
                        <select value={sex} onChange={(e) => setSex(e.target.value)}>
                          <option value="NOT_STATED">
                            {t('Prefer not to say', 'नहीं बताना चाहते')}
                          </option>
                          <option value="FEMALE">{t('Female', 'महिला')}</option>
                          <option value="MALE">{t('Male', 'पुरुष')}</option>
                          <option value="OTHER">{t('Other', 'अन्य')}</option>
                        </select>
                      </label>
                      <label>
                        {t('Pregnancy status', 'गर्भावस्था की स्थिति')}
                        <select value={pregnancy} onChange={(e) => setPregnancy(e.target.value)}>
                          <option value="UNKNOWN">
                            {t('Unknown / not provided', 'पता नहीं / नहीं बताया')}
                          </option>
                          <option value="NOT_PREGNANT">{t('Not pregnant', 'गर्भवती नहीं')}</option>
                          <option value="PREGNANT">{t('Pregnant', 'गर्भवती')}</option>
                          <option value="POSTPARTUM">{t('Postpartum', 'प्रसव के बाद')}</option>
                        </select>
                      </label>
                    </div>

                    <footer className="form-footer">
                      <button type="button" className="secondary" onClick={() => go('language')}>
                        <ArrowLeft size={17} />
                        {t('Back', 'वापस')}
                      </button>
                      <button type="submit" className="primary" disabled={registrationLeaving}>
                        {t('Next', 'आगे बढ़ें')}
                        <ArrowRight size={18} />
                      </button>
                    </footer>
                  </>
                ) : (
                  <div className="abha-fields">
                    <label htmlFor="demo-abha">
                      {t('ABHA ID (demo only)', 'आभा आईडी (केवल डेमो)')}
                    </label>
                    <input
                      id="demo-abha"
                      value={abha}
                      onChange={(event) => setAbha(event.target.value)}
                      autoComplete="off"
                      maxLength={40}
                      placeholder={t('Use a made-up ID', 'काल्पनिक आईडी लिखें')}
                      aria-describedby="abha-development"
                    />
                    <div className="development-note" id="abha-development">
                      <strong>
                        {t(
                          'ABHA lookup is in development',
                          'आभा से जानकारी लाने की सुविधा बन रही है',
                        )}
                      </strong>
                      <p>
                        {t(
                          'This demo is not connected to the ABDM sandbox yet. Automatic details will be available after integration. For now, continue by entering your details manually.',
                          'इस डेमो का एबीडीएम सैंडबॉक्स से जुड़ना अभी बाकी है। जुड़ने के बाद जानकारी अपने आप आ सकेगी। अभी अपनी जानकारी खुद भरकर आगे बढ़ें।',
                        )}
                      </p>
                      <small>
                        {t(
                          'This ID is not sent or saved.',
                          'यह आईडी भेजी या सुरक्षित नहीं की जाती है।',
                        )}
                      </small>
                    </div>
                    <button type="button" className="primary" onClick={manualRegistration}>
                      {t('Continue with manual registration', 'जानकारी खुद भरकर आगे बढ़ें')}
                      <ArrowRight size={18} />
                    </button>
                  </div>
                )}
              </div>
            </form>
          )}
          {step === 'method' && (
            <section className="method-stage">
              <p className="eyebrow">{t('YOUR WORDS, YOUR WAY', 'आपकी बात, आपका तरीका')}</p>
              <SpokenPrompt
                active={!leaving}
                id={hi ? 'method_hi' : 'method_en'}
                muted={muted}
                onMute={setMuted}
              />
              <div className="method-options">
                {methods.map(({ id, Icon, title, description }) => (
                  <button
                    key={id}
                    className="method-card"
                    onClick={() => {
                      setMethod(id)
                      go('symptoms')
                    }}
                  >
                    <span className="method-icon">
                      <Icon size={29} aria-hidden="true" />
                    </span>
                    <strong>{title}</strong>
                    <span>{description}</span>
                    <ArrowRight size={20} aria-hidden="true" />
                  </button>
                ))}
              </div>
              {(raw || symptoms.length > 0) && (
                <p className="saved-methods">
                  {t(
                    'Your previous answers are kept when you switch methods.',
                    'तरीका बदलने पर आपके पिछले जवाब सुरक्षित रहेंगे।',
                  )}
                </p>
              )}
              <button type="button" className="text-button back-link" onClick={() => go('vitals')}>
                <ArrowLeft size={17} />
                {t('Back to vitals', 'शारीरिक माप पर वापस जाएँ')}
              </button>
            </section>
          )}
          {step === 'symptoms' && (
            <form
              className={'panel intake-form' + (method === 'CHECKBOX' ? ' checkbox-intake' : '')}
              onSubmit={(event) => {
                event.preventDefault()
                if (listening) return
                if (!raw.trim() && !symptoms.length) {
                  setError(
                    t(
                      'Please describe a concern or choose an option.',
                      'कृपया अपनी परेशानी लिखें या विकल्प चुनें।',
                    ),
                  )
                  return
                }
                if (originalText.length > 4000) {
                  setError(
                    t(
                      'Your original input is too long to submit here. Please ask staff for help so your words can be kept in full.',
                      'आपकी मूल जानकारी यहाँ भेजने के लिए बहुत लंबी है। सभी शब्द सुरक्षित रखने के लिए कर्मचारी से मदद लें।',
                    ),
                  )
                  return
                }
                setConfirmed(raw)
                go('review')
              }}
            >
              <div className="step-intro">
                <p className="eyebrow">{methods.find((item) => item.id === method)?.title}</p>
                <h1 tabIndex={-1} data-step-heading>
                  {t('What is troubling you?', 'आपको क्या परेशानी है?')}
                </h1>
                {method !== 'CHECKBOX' && (
                  <p>
                    {t(
                      'Take your time. You can check everything before sending.',
                      'आराम से बताएँ। भेजने से पहले सारी जानकारी जाँच सकते हैं।',
                    )}
                  </p>
                )}
              </div>
              <button
                type="button"
                className="text-button change-method"
                onClick={() => go('method')}
              >
                <ArrowLeft size={17} />
                {t('Change input method', 'बताने का तरीका बदलें')}
              </button>
              <section className="symptom-entry">
                {method === 'VOICE' && (
                  <>
                    <div className="voice-entry">
                      <span className={listening ? 'voice-orb recording' : 'voice-orb'}>
                        <Mic size={36} aria-hidden="true" />
                      </span>
                      <button
                        type="button"
                        className={listening ? 'secondary recording' : 'primary'}
                        onClick={() => (listening ? recognition.current?.stop() : startVoice())}
                      >
                        {listening ? <Square size={18} /> : <Mic size={18} />}
                        {listening
                          ? t('Stop recording', 'रिकॉर्डिंग रोकें')
                          : t('Speak your symptoms', 'बोलकर बताएँ')}
                      </button>
                      <p>
                        {t(
                          'Tap to start, then speak at your own pace.',
                          'बटन दबाएँ और आराम से बोलना शुरू करें।',
                        )}
                      </p>
                      <small>
                        {t(
                          'Optional. Your browser may send audio to its speech service.',
                          'वैकल्पिक। ब्राउज़र आवाज़ अपनी स्पीच सेवा को भेज सकता है।',
                        )}
                      </small>
                    </div>
                    <p role="status" className="speech-status">
                      {speechMessage ||
                        interim ||
                        (listening ? t('Listening…', 'सुन रहे हैं…') : '')}
                    </p>
                    {voiceOriginal && (
                      <details>
                        <summary>
                          {t('Original speech transcript', 'मूल आवाज़ का लिखित रूप')}
                        </summary>
                        <p>{voiceOriginal}</p>
                      </details>
                    )}
                  </>
                )}
                {method !== 'CHECKBOX' ? (
                  <label>
                    {method === 'VOICE'
                      ? t('Your words — check or edit', 'आपकी बात — जाँचें या सुधारें')
                      : t('Describe your symptoms', 'अपनी परेशानी लिखें')}
                    <textarea
                      rows={6}
                      maxLength={4000}
                      value={raw}
                      disabled={listening}
                      onChange={(event) => {
                        setTyped(true)
                        setRaw(event.target.value)
                      }}
                      placeholder={t(
                        'What are you feeling, and when did it start?',
                        'क्या परेशानी है और कब से शुरू हुई?',
                      )}
                    />
                  </label>
                ) : (
                  <SymptomPicker
                    catalog={catalog}
                    hi={hi}
                    value={symptoms}
                    onChange={setSymptoms}
                  />
                )}
                {((method === 'CHECKBOX' && raw) ||
                  (method !== 'CHECKBOX' && symptoms.length > 0)) && (
                  <p className="saved-methods">
                    {t(
                      'Answers from your other input method are also saved. You can check them on the review page.',
                      'दूसरे तरीके से दिए आपके जवाब भी सुरक्षित हैं। अगले पेज पर उन्हें जाँच सकते हैं।',
                    )}
                  </p>
                )}
              </section>
              <section>
                <h2>{t('History & medicines', 'पुरानी बीमारी और दवाएँ')}</h2>
                <div className="form-grid">
                  {[
                    {
                      label: t('Relevant medical history', 'पुरानी बीमारी की जानकारी'),
                      status: historyStatus,
                      setStatus: setHistoryStatus,
                      value: history,
                      setValue: setHistory,
                    },
                    {
                      label: t('Current medicines', 'अभी ली जा रही दवाएँ'),
                      status: medStatus,
                      setStatus: setMedStatus,
                      value: medications,
                      setValue: setMedications,
                    },
                  ].map((item) => (
                    <div key={item.label}>
                      <label>
                        {item.label}
                        <select
                          value={item.status}
                          onChange={(e) => item.setStatus(e.target.value)}
                        >
                          <option value="NOT_PROVIDED">
                            {t('Not provided', 'जानकारी नहीं दी')}
                          </option>
                          <option value="NONE">{t('None', 'कोई नहीं')}</option>
                          <option value="PROVIDED">{t('Add details', 'जानकारी जोड़ें')}</option>
                        </select>
                      </label>
                      {item.status === 'PROVIDED' && (
                        <label>
                          {t('Details', 'विवरण')}
                          <textarea
                            required
                            maxLength={2000}
                            value={item.value}
                            onChange={(e) => item.setValue(e.target.value)}
                          />
                        </label>
                      )}
                    </div>
                  ))}
                </div>
              </section>

              <footer className="form-footer">
                <p>
                  {listening
                    ? t(
                        'Stop recording before continuing so the final words can be captured.',
                        'आगे बढ़ने से पहले रिकॉर्डिंग रोकें ताकि आखिरी शब्द भी आ सकें।',
                      )
                    : t(
                        'Staff has entered the required vitals.',
                        'कर्मचारी ने ज़रूरी माप दर्ज कर दिए हैं।',
                      )}
                </p>
                <button
                  className="primary"
                  type="submit"
                  disabled={listening || (!raw.trim() && !symptoms.length)}
                >
                  {t('Review details', 'जानकारी देखें')}
                  <ArrowRight size={18} />
                </button>
              </footer>
            </form>
          )}
          {step === 'review' && (
            <section className="panel intake-form">
              <h1 tabIndex={-1} data-step-heading>
                <ClipboardCheck size={24} />
                {t('Check before you send', 'भेजने से पहले जाँचें')}
              </h1>
              <p>
                <strong>{name}</strong> · {age} {t('years', 'वर्ष')}
              </p>
              <p className="saved-methods">
                {t(
                  'All selected options are included below, even if you changed input methods.',
                  'तरीका बदलने के बाद भी आपके सभी चुने हुए विकल्प नीचे शामिल हैं।',
                )}
              </p>
              <ul>
                {catalog.patient_options
                  .filter((o) => symptoms.includes(o.id))
                  .map((o) => (
                    <li key={o.id}>
                      {catalog.patient_groups?.find((group) => group.id === o.group) && (
                        <strong>
                          {hi
                            ? catalog.patient_groups.find((group) => group.id === o.group)?.hi
                            : catalog.patient_groups.find((group) => group.id === o.group)?.en}
                          :{' '}
                        </strong>
                      )}
                      {hi ? o.hi : o.en}
                    </li>
                  ))}
              </ul>
              <label>
                {t(
                  'Confirm or correct your symptom description',
                  'अपनी परेशानी की जानकारी जाँचें या सुधारें',
                )}
                <textarea
                  rows={5}
                  disabled={busy || locked}
                  value={confirmed}
                  maxLength={4000}
                  onChange={(e) => setConfirmed(e.target.value)}
                />
              </label>
              <p className="muted">
                {t(
                  'Your original words will be kept alongside any corrections.',
                  'आपके मूल शब्द सुधार के साथ सुरक्षित रखे जाएँगे।',
                )}
              </p>
              <div className="form-footer">
                <button
                  className="secondary"
                  disabled={busy || locked}
                  onClick={() => go('symptoms')}
                >
                  <ArrowLeft size={17} />
                  {t('Back', 'वापस')}
                </button>
                <button
                  className="primary"
                  disabled={busy || leaving || (!confirmed.trim() && !symptoms.length)}
                  onClick={() => void submit()}
                >
                  {busy
                    ? t('Registering…', 'पंजीकरण हो रहा है…')
                    : locked
                      ? t('Retry registration', 'पंजीकरण फिर भेजें')
                      : t('Confirm & register', 'पुष्टि करें और पंजीकरण करें')}
                  <Check size={18} />
                </button>
              </div>
            </section>
          )}
          {step === 'vitals' && (
            <RegistrationVitals
              hi={hi}
              name={name}
              age={age}
              staff={staff}
              onLogin={(s) => onStaffLogin?.(s)}
              vitals={vitals}
              onVitals={setVitals}
              needsDoctor={needsDoctor}
              onNeedsDoctor={setNeedsDoctor}
              reason={reviewReason}
              onReason={setReviewReason}
              busy={busy}
              locked={locked}
              onBack={() => go('details')}
              onContinue={() => {
                go(resumeReview.current ? 'review' : 'method')
                resumeReview.current = false
              }}
              onEmergency={() => void submit(true)}
            />
          )}
        </div>
      </main>
    </>
  )
}
