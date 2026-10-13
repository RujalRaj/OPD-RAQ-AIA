import { useState } from 'react'
import { ArrowLeft, ArrowRight, HeartPulse, ShieldAlert } from 'lucide-react'
import { post } from './api'
import {
  missingVitalKeys,
  registrationVitalsComplete,
  VitalEditor,
  vitalLabels,
  vitalLabelsHi,
} from './components'
import type { Staff, Vitals } from './types'

export default function RegistrationVitals({
  hi,
  name,
  age,
  staff,
  onLogin,
  vitals,
  onVitals,
  needsDoctor,
  onNeedsDoctor,
  reason,
  onReason,
  busy,
  locked,
  onBack,
  onContinue,
  onEmergency,
}: {
  hi: boolean
  name: string
  age: string
  staff: Staff | null
  onLogin: (staff: Staff) => void
  vitals: Vitals
  onVitals: (v: Vitals) => void
  needsDoctor: boolean
  onNeedsDoctor: (value: boolean) => void
  reason: string
  onReason: (value: string) => void
  busy: boolean
  locked: boolean
  onBack: () => void
  onContinue: () => void
  onEmergency: () => void
}) {
  const t = (en: string, hindi: string) => (hi ? hindi : en)
  const [role, setRole] = useState('nurse')
  const [password, setPassword] = useState('')
  const [signingIn, setSigningIn] = useState(false)
  const [error, setError] = useState('')
  const missing = missingVitalKeys(vitals)
  const labels = hi ? vitalLabelsHi : vitalLabels
  const ready = !!staff && registrationVitalsComplete(vitals) && (!needsDoctor || !!reason.trim())
  async function signIn(event: React.FormEvent) {
    event.preventDefault()
    setSigningIn(true)
    setError('')
    try {
      onLogin(await post<Staff>('/auth/login', { username: role, password }))
      setPassword('')
    } catch {
      setError(
        t(
          'Sign-in failed. Check the demo credentials and backend connection.',
          'लॉगिन नहीं हुआ। डेमो पासवर्ड और सर्वर कनेक्शन जाँचें।',
        ),
      )
    } finally {
      setSigningIn(false)
    }
  }
  return (
    <section className="panel intake-form registration-vitals-step">
      <h1 tabIndex={-1} data-step-heading>
        <HeartPulse size={24} />
        {t('Record available vitals', 'उपलब्ध शारीरिक माप दर्ज करें')}
      </h1>
      <p>
        <strong>{name}</strong> · {age} {t('years', 'वर्ष')}
      </p>
      <p>
        {t(
          'Staff: complete Temperature, SpO₂ and Pulse before continuing. The other vitals are optional.',
          'कर्मचारी: आगे बढ़ने से पहले तापमान, ऑक्सीजन स्तर और नाड़ी भरें। बाकी माप वैकल्पिक हैं।',
        )}
      </p>
      <p className="alert info">
        {t(
          'For Temperature and Pulse, select High, Low, or enter a numeric value. SpO₂ requires a numeric percentage. High / Low records your observation without inventing a measurement.',
          'तापमान और नाड़ी के लिए ज़्यादा, कम या संख्यात्मक माप चुनें। ऑक्सीजन स्तर का प्रतिशत दर्ज करें। ज़्यादा / कम से आपका आकलन दर्ज होगा, कोई काल्पनिक संख्या नहीं।',
        )}
      </p>
      {!staff ? (
        <form className="intake-staff-login" onSubmit={signIn}>
          <h2>{t('Staff sign-in for measurements', 'माप दर्ज करने के लिए कर्मचारी लॉगिन')}</h2>
          <p>
            {t(
              'Your answers stay here while staff signs in.',
              'कर्मचारी के लॉगिन करने पर आपकी जानकारी यहीं सुरक्षित रहेगी।',
            )}
          </p>
          <fieldset disabled={signingIn || busy || locked}>
            <label htmlFor="intake-staff-role">
              {t('Demo staff role', 'डेमो कर्मचारी की भूमिका')}
            </label>
            <select id="intake-staff-role" value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="nurse">{t('Nurse', 'नर्स')}</option>
              <option value="intern">{t('Intern', 'इंटर्न')}</option>
              <option value="jr">{t('Junior Resident', 'जूनियर रेज़िडेंट')}</option>
              <option value="doctor">{t('Doctor', 'डॉक्टर')}</option>
            </select>
            <label htmlFor="intake-staff-password">{t('Password', 'पासवर्ड')}</label>
            <input
              id="intake-staff-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <div className="intake-staff-actions">
              <button
                type="button"
                className="secondary"
                onClick={() => setPassword('DemoOnly!2026')}
              >
                {t('Fill credentials', 'डेमो पासवर्ड भरें')}
              </button>
              <button type="submit" className="primary">
                {signingIn
                  ? t('Signing in…', 'लॉगिन हो रहा है…')
                  : t('Sign in here', 'यहीं लॉगिन करें')}
              </button>
            </div>
          </fieldset>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
        </form>
      ) : (
        <p className="muted">
          {t('Signed in as', 'लॉगिन')}: {staff.name}
        </p>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (!ready) return
          if ((e.nativeEvent as SubmitEvent).submitter?.getAttribute('data-emergency') === 'true')
            onEmergency()
          else onContinue()
        }}
      >
        <fieldset disabled={busy || locked || signingIn}>
          {staff && (
            <>
              <VitalEditor
                value={vitals}
                onChange={onVitals}
                idPrefix="registration-vital"
                hi={hi}
                registration
              />
              <div className="intake-doctor-review">
                <label className="check-row">
                  <input
                    type="checkbox"
                    checked={needsDoctor}
                    onChange={(e) => onNeedsDoctor(e.target.checked)}
                  />
                  {t('Request doctor review', 'डॉक्टर की समीक्षा का अनुरोध करें')}
                </label>
                <p>
                  {t(
                    'Use this if staff needs doctor assistance. After registration, the case appears as Unresolved on the doctor’s dashboard. Enter a reason. This request alone does not change priority.',
                    'डॉक्टर की मदद चाहिए तो यह चुनें। पंजीकरण के बाद मामला डॉक्टर के डैशबोर्ड पर अनसुलझा दिखेगा। कारण दर्ज करें। केवल इस अनुरोध से प्राथमिकता नहीं बदलती।',
                  )}
                </p>
                {needsDoctor && (
                  <label>
                    {t('Reason for doctor review', 'डॉक्टर की समीक्षा का कारण')}
                    <textarea
                      value={reason}
                      onChange={(e) => onReason(e.target.value)}
                      required
                      maxLength={2000}
                      rows={3}
                    />
                  </label>
                )}
              </div>
            </>
          )}
        </fieldset>
        <div className="missing-vitals" aria-live="polite">
          <strong>
            {missing.length
              ? t('Missing measurements remain unknown', 'बिना माप के मान अज्ञात रहेंगे')
              : t('All measurement fields have recorded values', 'सभी शारीरिक माप दर्ज हैं')}
          </strong>
          {missing.length > 0 && <p>{missing.map((key) => labels[key]).join(', ')}.</p>}
          <p>
            {t(
              'High / Low observations have no numeric value. Optional measurements left blank remain unknown.',
              'ज़्यादा / कम आकलन का कोई संख्यात्मक मान नहीं है। खाली छोड़े गए वैकल्पिक माप अज्ञात रहेंगे।',
            )}
          </p>
        </div>
        <div className="registration-emergency">
          <h2>{t('Staff assessed emergency', 'कर्मचारी के आकलन में आपात स्थिति')}</h2>
          <p>
            {t(
              'After completing the three required vitals, staff can assign Immediate priority and issue a token now. This records a staff decision and skips symptom entry.',
              'तीनों ज़रूरी माप भरने के बाद कर्मचारी तुरंत प्राथमिकता देकर अभी टोकन जारी कर सकते हैं। कर्मचारी का निर्णय दर्ज होगा और लक्षण भरने का चरण नहीं आएगा।',
            )}
          </p>
          <button
            type="submit"
            className="emergency-button"
            data-emergency="true"
            disabled={!ready || busy || signingIn}
          >
            <ShieldAlert size={20} aria-hidden="true" />
            {busy
              ? t('Registering…', 'पंजीकरण हो रहा है…')
              : locked
                ? t('Retry emergency registration', 'आपात पंजीकरण फिर भेजें')
                : t(
                    'Staff assessed emergency — issue token',
                    'कर्मचारी के आकलन में आपात स्थिति — टोकन दें',
                  )}
          </button>
        </div>
        {locked && !busy && (
          <p role="status">
            {t(
              'The response was interrupted. Retry the same registration to recover its token without creating a duplicate.',
              'जवाब नहीं मिल पाया। उसी पंजीकरण को फिर भेजें ताकि बिना दूसरा पंजीकरण बनाए टोकन मिल सके।',
            )}
          </p>
        )}
        <footer className="form-footer">
          <button
            type="button"
            className="secondary"
            onClick={onBack}
            disabled={busy || locked || signingIn}
          >
            <ArrowLeft size={17} />
            {t('Back', 'वापस')}
          </button>
          <button
            type="submit"
            className="primary"
            disabled={!ready || busy || locked || signingIn}
          >
            {t('Continue to symptoms', 'लक्षणों के लिए आगे बढ़ें')}
            <ArrowRight size={18} />
          </button>
        </footer>
      </form>
    </section>
  )
}
