import { useCallback, useEffect, useState } from 'react'
import {
  Activity,
  ArrowUpRight,
  CircleHelp,
  ClipboardList,
  HeartPulse,
  LayoutDashboard,
  ListOrdered,
  LogOut,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { api, post } from './api'
import {
  aiStatusLabel,
  hasUrgentAlert,
  Badge,
  missingVitalKeys,
  MissingVitals,
  PatientCard,
  priorities,
  waitTime,
} from './components'
import Intake from './Intake'
import QuickVitals from './QuickVitals'
import PatientDetail, { AuditList } from './PatientDetail'
import type { AIHealth, Audit, Catalog, DashboardData, Patient, Priority, Staff } from './types'

const DEMO_PASSWORD = 'DemoOnly!2026'

const empty: DashboardData = {
  original_queue: [],
  priority_order: [],
  counts: { TOTAL: 0, IMMEDIATE: 0, SOON: 0, ROUTINE: 0, UNRESOLVED: 0 },
}
const titles: Record<string, string> = {
  dashboard: 'A clearer view of patient care.',
  queue: 'Every token, in perspective.',
  audit: 'Every decision has a history.',
  settings: 'Built for a transparent demo.',
}
export default function App() {
  const [user, setUser] = useState<Staff | null>(null),
    [checked, setChecked] = useState(false),
    [catalog, setCatalog] = useState<Catalog | null>(null),
    [page, setPage] = useState(window.location.pathname === '/intake' ? 'register' : 'dashboard'),
    [data, setData] = useState(empty),
    [error, setError] = useState(''),
    [patient, setPatient] = useState<Patient | null>(null),
    [vitalsPatient, setVitalsPatient] = useState<Patient | null>(null),
    [reviewFocus, setReviewFocus] = useState(false),
    [notice, setNotice] = useState(''),
    [query, setQuery] = useState(''),
    [filter, setFilter] = useState('ALL'),
    [selectedPriority, setSelectedPriority] = useState<Priority>('IMMEDIATE'),
    [logs, setLogs] = useState<Audit[]>([]),
    [lastSync, setLastSync] = useState<Date | null>(null),
    [busy, setBusy] = useState(false),
    [aiHealth, setAIHealth] = useState<AIHealth | null>(null)
  useEffect(() => {
    api<Catalog>('/catalog')
      .then(setCatalog)
      .catch(() =>
        setError('Cannot connect to the backend. Start the FastAPI server on port 8000.'),
      )
    api<Staff>('/auth/me')
      .then(setUser)
      .catch(() => {})
      .finally(() => setChecked(true))
    api<AIHealth>('/health')
      .then(setAIHealth)
      .catch(() => {})
  }, [])
  const refresh = useCallback(async () => {
    if (!user) return
    try {
      const result = await api<DashboardData>('/dashboard')
      setData(result)
      setLastSync(new Date())
      setError('')
    } catch (e) {
      setError((e as Error).message)
    }
  }, [user])
  useEffect(() => {
    void refresh()
    if (!user) return
    const timer = setInterval(() => void refresh(), 5000)
    return () => clearInterval(timer)
  }, [refresh, user])
  useEffect(() => {
    if (page === 'audit' && user)
      api<Audit[]>('/audit-logs')
        .then(setLogs)
        .catch((e) => setError(e.message))
  }, [page, user, data])
  function navigate(next: string) {
    setPatient(null)
    setVitalsPatient(null)
    setNotice('')
    setPage(next)
    setQuery('')
    setFilter('ALL')
    if (next === 'dashboard') setSelectedPriority('IMMEDIATE')
    window.history.replaceState({}, '', next === 'register' ? '/intake' : '/')
    window.scrollTo(0, 0)
  }
  async function openPatient(id: string, doctorReview = false) {
    setBusy(true)
    try {
      setReviewFocus(doctorReview)
      setPatient(await api<Patient>(`/encounters/${id}`))
      window.scrollTo(0, 0)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  async function openVitals(id: string) {
    setBusy(true)
    setNotice('')
    setError('')
    try {
      setVitalsPatient(await api<Patient>(`/encounters/${id}`))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  const visible = data.original_queue.filter(
    (p) =>
      (filter !== 'UNRESOLVED' || p.unresolved) &&
      (filter !== 'MISSING' || missingVitalKeys(p.vitals).length > 0) &&
      (filter !== 'OVERRIDE' || p.override_active) &&
      (filter !== 'ALERT' || hasUrgentAlert(p.assessment)) &&
      `${p.token} ${p.name} ${p.confirmed_text}`.toLowerCase().includes(query.toLowerCase()),
  )
  if (page === 'register' && catalog)
    return (
      <Intake
        catalog={catalog}
        onExit={() => navigate('dashboard')}
        staff={user}
        onStaffLogin={setUser}
      />
    )
  if (!checked)
    return (
      <main className="loading">
        <HeartPulse />
        Loading local workspace…
      </main>
    )
  if (!user)
    return (
      <>
        <DemoBanner />
        <Login onLogin={setUser} onIntake={() => navigate('register')} error={error} />
      </>
    )
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          className="brand"
          href="/"
          onClick={(e) => {
            e.preventDefault()
            navigate('dashboard')
          }}
        >
          <span className="brand-mark">
            <HeartPulse size={27} />
          </span>
          <span>
            OPD RAQ AIA<small>Care given in the right order.</small>
          </span>
        </a>
        <p className="nav-label">WORKSPACE</p>
        <nav aria-label="Main navigation">
          {[
            { id: 'dashboard', label: 'Dashboard', Icon: LayoutDashboard },
            { id: 'register', label: 'Register patient', Icon: Plus },
            { id: 'queue', label: 'Queue', Icon: ListOrdered },
            { id: 'audit', label: 'Audit log', Icon: ClipboardList },
            { id: 'settings', label: 'Settings', Icon: Settings2 },
          ].map(({ id, label, Icon }) => (
            <button
              key={id}
              className={page === id && !patient ? 'active' : ''}
              onClick={() => navigate(id)}
            >
              <Icon size={19} />
              {label}
              {id === 'dashboard' && <span className="nav-count">{data.counts.TOTAL}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <ShieldCheck size={21} />
          <strong>Staff stays in control</strong>
          <p>Agent priorities can be changed with a documented clinical observation.</p>
          <span>Synthetic demo only</span>
        </div>
        <div className="profile">
          <span className="avatar">{user.role[0]}</span>
          <span>
            <strong>{user.name}</strong>
            <small>{user.role === 'JR' ? 'Junior resident' : user.role.toLowerCase()}</small>
          </span>
          <button
            className="icon-button"
            aria-label="Sign out"
            onClick={() =>
              post('/auth/logout', {})
                .then(() => {
                  setUser(null)
                  setPatient(null)
                  setVitalsPatient(null)
                  setData(empty)
                })
                .catch((e) => setError(e.message))
            }
          >
            <LogOut size={18} />
          </button>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <span>
            <span className="live-dot" />
            Local OPD workspace
          </span>
          <div>
            <span className="demo-pill">SYNTHETIC DEMO</span>
            <span className="today">
              {new Date().toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </span>
          </div>
        </header>
        <main className="workspace-content" id="main-content" aria-busy={busy}>
          {notice && (
            <p className="alert info" role="status" aria-label="Vitals action result">
              {notice}
            </p>
          )}
          {error && (
            <div className="alert error" role="alert">
              {error}
            </div>
          )}
          {patient && catalog ? (
            <PatientDetail
              key={patient.id}
              initial={patient}
              focusReview={reviewFocus}
              user={user}
              catalog={catalog}
              onClose={() => setPatient(null)}
              onChange={() => void refresh()}
            />
          ) : (
            <>
              <div className="page-heading">
                <div>
                  <p className="eyebrow">
                    {page === 'dashboard' ? 'LIVE OVERVIEW' : page.toUpperCase()}
                  </p>
                  <h1>{titles[page]}</h1>
                  <p>
                    {page === 'dashboard'
                      ? 'Priorities update. Token numbers stay the same.'
                      : 'OPD Risk-Aware Queue AI Agent · local prototype'}
                  </p>
                </div>
                <button className="primary" onClick={() => navigate('register')}>
                  <Plus size={18} />
                  Register patient
                </button>
              </div>
              {(page === 'dashboard' || page === 'queue') && (
                <>
                  <div className="stats">
                    <Stat label="Total waiting" value={data.counts.TOTAL} kind="total" />
                    <Stat label="Immediate" value={data.counts.IMMEDIATE} kind="immediate" />
                    <Stat label="Soon" value={data.counts.SOON} kind="soon" />
                    <Stat label="Routine" value={data.counts.ROUTINE} kind="routine" />
                  </div>
                  <div className="attention-strip">
                    <div>
                      <Activity size={17} />
                      <strong>
                        {!aiHealth
                          ? 'AI status unavailable'
                          : aiHealth.ai_provider === 'disabled'
                            ? 'Local rules · AI off'
                            : aiHealth.ai_configured
                              ? `${aiHealth.ai_provider} configured · check each assessment`
                              : 'AI key missing · local fallback'}
                      </strong>
                      <span>Supplied rules · staff can override</span>
                    </div>
                    <button
                      onClick={() => setFilter(filter === 'UNRESOLVED' ? 'ALL' : 'UNRESOLVED')}
                      className={
                        data.counts.UNRESOLVED ? 'attention-button flagged' : 'attention-button'
                      }
                    >
                      <CircleHelp size={16} />
                      {data.counts.UNRESOLVED} Unresolved · Doctor review
                      <ArrowUpRight size={15} />
                    </button>
                  </div>
                  <div className="toolbar">
                    <label className="search">
                      <Search size={18} />
                      <span className="sr-only">Search patients</span>
                      <input
                        placeholder="Search token, name or symptoms…"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                      />
                    </label>
                    <label className="filter">
                      <span className="sr-only">Filter patients</span>
                      <select value={filter} onChange={(e) => setFilter(e.target.value)}>
                        <option value="ALL">All patients</option>
                        <option value="UNRESOLVED">Unresolved</option>
                        <option value="MISSING">Missing vitals</option>
                        <option value="OVERRIDE">Staff overrides</option>
                        <option value="ALERT">Safety alerts</option>
                      </select>
                    </label>
                    <button className="refresh-button" onClick={() => void refresh()}>
                      <RefreshCw size={15} />
                      <span>
                        {lastSync
                          ? `Updated ${lastSync.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`
                          : 'Refresh'}
                      </span>
                    </button>
                  </div>
                  {page === 'dashboard' ? (
                    <div className="queue-layout">
                      <section className="original-queue">
                        <div className="column-heading">
                          <div>
                            <ListOrdered size={18} />
                            <h2>Original Queue</h2>
                          </div>
                          <span>{visible.length}</span>
                        </div>
                        <p className="column-description">Registration order · fixed tokens</p>
                        <div className="original-list">
                          {visible.map((p, i) => (
                            <button
                              key={p.id}
                              onClick={() => void openPatient(p.id)}
                              className="original-row"
                            >
                              <span className="position">{i + 1}</span>
                              <span className="original-patient">
                                <strong>
                                  #{p.token} <span>{p.name}</span>
                                </strong>
                                <small>
                                  {p.age} years · {waitTime(p.registered_at)}
                                </small>
                              </span>
                              <span
                                className={'priority-dot ' + p.priority.toLowerCase()}
                                aria-label={p.priority}
                              />
                            </button>
                          ))}
                          {!visible.length && <Empty />}
                        </div>
                        <p className="queue-note">
                          A change in priority never changes a patient’s token.
                        </p>
                      </section>
                      <div className="priority-columns single-priority">
                        <label className="priority-selector">
                          Show priority
                          <select
                            value={selectedPriority}
                            onChange={(e) => setSelectedPriority(e.target.value as Priority)}
                          >
                            {priorities.map((value) => (
                              <option key={value} value={value}>
                                {value[0] + value.slice(1).toLowerCase()} ({data.counts[value] ?? 0}
                                )
                              </option>
                            ))}
                          </select>
                        </label>
                        {[selectedPriority].map((priority) => (
                          <section
                            className={'priority-column ' + priority.toLowerCase()}
                            key={priority}
                          >
                            <div className="column-heading">
                              <Badge priority={priority} />
                              <span>{visible.filter((p) => p.priority === priority).length}</span>
                            </div>
                            <p className="column-description">
                              {priority === 'IMMEDIATE'
                                ? 'Immediate staff assessment'
                                : priority === 'SOON'
                                  ? 'Prompt assessment / caution'
                                  : 'Routine queue suggestion'}
                            </p>
                            <div className="lane-cards">
                              {visible
                                .filter((p) => p.priority === priority)
                                .map((p) => (
                                  <PatientCard
                                    key={p.id}
                                    patient={p}
                                    onOpen={(id) => void openPatient(id)}
                                    onVitals={(id) => void openVitals(id)}
                                    onReview={(id) => void openPatient(id, true)}
                                  />
                                ))}
                              {!visible.some((p) => p.priority === priority) && <Empty />}
                            </div>
                          </section>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <section className="panel">
                      <h2>Priority queue</h2>
                      <div className="table-scroll">
                        <table>
                          <thead>
                            <tr>
                              <th>Position</th>
                              <th>Token</th>
                              <th>Patient</th>
                              <th>Priority</th>
                              <th>Review</th>
                              <th>Measurements</th>
                              <th>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.priority_order
                              .map((id) => visible.find((p) => p.id === id))
                              .filter((p): p is Patient => !!p)
                              .map((p, i) => (
                                <tr key={p.id}>
                                  <td>{i + 1}</td>
                                  <td>#{p.token}</td>
                                  <td>{p.name}</td>
                                  <td>
                                    <Badge priority={p.priority} />
                                  </td>
                                  <td>
                                    {p.unresolved ? 'Unresolved' : 'No doctor review requested'}
                                  </td>
                                  <td>
                                    <MissingVitals vitals={p.vitals} compact />
                                  </td>
                                  <td>
                                    <button
                                      className="secondary quick-vitals-button"
                                      aria-label={`Record available vitals for token ${p.token}`}
                                      onClick={() => void openVitals(p.id)}
                                    >
                                      Record available vitals
                                    </button>
                                    <button
                                      className="text-button"
                                      onClick={() => void openPatient(p.id)}
                                    >
                                      View details
                                    </button>
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  )}
                </>
              )}
              {page === 'audit' && (
                <section className="panel">
                  <h2>Read-only audit trail</h2>
                  <p className="muted">
                    Latest 300 events. Open a patient for their individual history.
                  </p>
                  <AuditList logs={logs} />
                </section>
              )}
              {page === 'settings' && (
                <section className="panel settings-panel">
                  <h2>Prototype configuration</h2>
                  <dl>
                    <dt>Data</dt>
                    <dd>Synthetic patient cases only</dd>
                    <dt>Rule version</dt>
                    <dd>{catalog?.version}</dd>
                    <dt>AI provider</dt>
                    <dd>
                      {!aiHealth
                        ? 'Status unavailable'
                        : aiHealth.ai_provider === 'disabled'
                          ? 'Disabled — local rules and explicit demo fallback'
                          : `${aiHealth.ai_provider} / ${aiHealth.ai_model} — ${aiHealth.ai_configured ? 'key configured; connectivity is verified per assessment' : 'key missing; run the private setup command'}`}
                      {aiHealth && !aiHealth.ai_configuration_valid && ' — unsupported provider'}
                    </dd>
                    <dt>Review workflow</dt>
                    <dd>
                      Automatic priorities. Optional nurse/intern/JR/doctor overrides. Doctor
                      assistance on request.
                    </dd>
                    <dt>Override requirement</dt>
                    <dd>
                      Nurse, intern and JR: at least one newly submitted vital plus a reason.
                      Doctor: reason required.
                    </dd>
                    <dt>Speech</dt>
                    <dd>
                      Saved Hindi/English neural instruction audio and optional browser speech
                      recognition. Recognition may use a remote service.
                    </dd>
                    <dt>Clinical status</dt>
                    <dd>
                      Not clinically validated. Qualitative rule conditions require careful staff
                      interpretation. No diagnosis or treatment recommendations.
                    </dd>
                  </dl>
                  <details>
                    <summary>View supplied safety matrix</summary>
                    <ol>
                      {catalog?.rules.map((r) => (
                        <li key={r.id}>
                          <strong>{r.domain}</strong> — {r.trigger}
                          <small>
                            Workbook row {r.source_row}. {r.basis}
                          </small>
                        </li>
                      ))}
                    </ol>
                  </details>
                </section>
              )}
            </>
          )}
          {vitalsPatient && (
            <QuickVitals
              key={vitalsPatient.id}
              initial={vitalsPatient}
              onClose={() => setVitalsPatient(null)}
              onSaved={(updated) => {
                setVitalsPatient(null)
                setNotice(
                  `Vitals saved for token #${updated.token}. ${aiStatusLabel(updated.assessment)}. ${updated.override_active ? 'Staff override preserved.' : 'Token unchanged.'}`,
                )
                void refresh()
              }}
            />
          )}
          <footer className="workspace-footer">
            <span>
              <ShieldCheck size={14} />
              Decision-support prototype · synthetic data only
            </span>
            <span>Clinical rules require qualified review and validation.</span>
          </footer>
        </main>
      </div>
    </div>
  )
}
function DemoBanner() {
  return (
    <div className="demo-banner">SYNTHETIC DEMO · काल्पनिक डेटा · Not for real patient care</div>
  )
}
function Empty() {
  return (
    <div className="empty">
      <Users size={22} />
      <p>No patients in this view</p>
    </div>
  )
}
function Stat({ label, value, kind }: { label: string; value: number; kind: string }) {
  return (
    <div className={'stat ' + kind}>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <span className="stat-symbol">
        {kind === 'total' ? (
          <Users size={23} />
        ) : kind === 'immediate' ? (
          <HeartPulse size={23} />
        ) : (
          <Activity size={23} />
        )}
      </span>
    </div>
  )
}
function Login({
  onLogin,
  onIntake,
  error: connectionError,
}: {
  onLogin: (u: Staff) => void
  onIntake: () => void
  error: string
}) {
  const [username, setUsername] = useState('nurse'),
    [password, setPassword] = useState(''),
    [credentialMessage, setCredentialMessage] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false)
  return (
    <main className="login-layout">
      <section className="login-story">
        <div className="brand light">
          <span className="brand-mark">
            <HeartPulse size={28} />
          </span>
          <span>
            OPD RAQ AIA<small>Care given in the right order.</small>
          </span>
        </div>
        <div>
          <p className="eyebrow">RISK-AWARE OPD QUEUE</p>
          <h1>
            Clinical urgency matters,
            <br />
            not just parcha numbers.
          </h1>
          <p>A dynamic patient prioritisation where clinicians always have the final say.</p>
          <div className="story-points">
            <span>
              <CheckIcon />
              Multilingual intake preserving patient's original words
            </span>
            <span>
              <CheckIcon />
              Original queue preserved, urgency reprioritises the queue
            </span>
            <span>
              <CheckIcon />
              Audit logs for every clinical override
            </span>
          </div>
        </div>
        <small>Synthetic demonstration · clinician validation required</small>
      </section>
      <section className="login-form-area">
        <div className="login-card">
          <span className="login-icon">
            <ShieldCheck size={30} />
          </span>
          <p className="eyebrow">STAFF WORKSPACE</p>
          <h2>Welcome to your OPD.</h2>
          <p className="muted">Sign in to view the queue and patient assessments.</p>
          {(error || connectionError) && (
            <div className="alert error" role="alert">
              {error || connectionError}
            </div>
          )}
          <form
            onSubmit={async (e) => {
              e.preventDefault()
              setBusy(true)
              setError('')
              try {
                onLogin(await post<Staff>('/auth/login', { username, password }))
              } catch (ex) {
                setError((ex as Error).message)
              } finally {
                setBusy(false)
              }
            }}
          >
            <label>
              Demo staff role
              <select value={username} onChange={(e) => setUsername(e.target.value)}>
                <option value="nurse">Nurse</option>
                <option value="doctor">Doctor</option>
                <option value="intern">Intern</option>
                <option value="jr">Junior resident</option>
              </select>
            </label>
            <label>
              Password
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  setCredentialMessage('')
                }}
              />
            </label>
            <div className="credential-note">
              <div className="credential-row">
                <p>
                  Local demo password
                  <br />
                  <code>{DEMO_PASSWORD}</code>
                </p>
                <button
                  type="button"
                  className="secondary fill-credentials"
                  disabled={busy}
                  onClick={() => {
                    setPassword(DEMO_PASSWORD)
                    setError('')
                    setCredentialMessage('Credentials filled. Open the staff workspace to sign in.')
                  }}
                >
                  Fill credentials
                </button>
              </div>
              <p className="credential-feedback" role="status">
                {credentialMessage}
              </p>
            </div>
            <button className="primary full-width" disabled={busy}>
              {busy ? 'Signing in…' : 'Open staff workspace'}
              <ArrowUpRight size={17} />
            </button>
          </form>
          <section className="patient-entry" aria-labelledby="patient-entry-title">
            <h3 id="patient-entry-title">Registering a demo patient?</h3>
            <button className="primary full-width" onClick={onIntake}>
              <Plus size={20} aria-hidden="true" />
              <span>Open Hindi / English patient form</span>
            </button>
          </section>
        </div>
      </section>
    </main>
  )
}
function CheckIcon() {
  return <ShieldCheck size={17} />
}
