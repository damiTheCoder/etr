import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  ChevronRight,
  BookOpen,
  TrendingUp,
  Calculator,
  FileCheck2,
  MessagesSquare,
  LineChart,
  PiggyBank,
  Sparkles,
  Check,
  Menu,
  X,
  Zap,
  ShieldCheck,
  Lock,
} from 'lucide-react'
import '../assets/landing.css'

function Reveal({ children, delay = 0, className = '', style }: { children: React.ReactNode; delay?: number; className?: string; style?: React.CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          observer.unobserve(el)
        }
      },
      { threshold: 0.12 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      className={`reveal ${visible ? 'visible' : ''} ${className}`}
      style={{ transitionDelay: `${delay}s`, ...style }}
    >
      {children}
    </div>
  )
}

const features = [
  {
    icon: BookOpen,
    title: 'Clean accounting records',
    desc: 'Automatically prepare clean accounting records — no manual entry, no messy spreadsheets.',
  },
  {
    icon: TrendingUp,
    title: 'Profit, costs & cash flow in real time',
    desc: 'Understand profit, costs, and cash flow in real time — not at month-end when it is too late.',
  },
  {
    icon: Calculator,
    title: 'Proactive tax management',
    desc: 'Calculate and manage taxes proactively — entri keeps you ahead of deadlines.',
  },
  {
    icon: FileCheck2,
    title: 'Audit-ready financials',
    desc: 'Prepare audit-ready financials on demand — ready for any auditor, anytime.',
  },
  {
    icon: MessagesSquare,
    title: 'Ask questions in plain language',
    desc: 'Ask questions and get answers in plain language — no accounting degree required.',
  },
  {
    icon: LineChart,
    title: 'Cash flow analysis',
    desc: 'Estimate and model cash flow so you always know what you can spend, hire, or invest in next.',
  },
  {
    icon: PiggyBank,
    title: 'Automate investments & savings',
    desc: 'Automate investments and savings with rules you set — hands-free and effortless.',
  },
]

const steps = [
  { n: '01', title: 'Connect your accounts', desc: 'Link your bank, payment processors, and tools. entri starts organizing your books instantly.' },
  { n: '02', title: 'Ask entri anything', desc: 'Type or speak in plain language — about profit, taxes, vendors, or next month\'s forecast.' },
  { n: '03', title: 'Get it done automatically', desc: 'entri books entries, flags issues, prepares filings, and takes action with your approval.' },
]

const demoChats = [
  { q: 'How much profit did we make this quarter?', a: <>You\'re up <span className="pos">+23%</span> QoQ — <strong>₦8.4M</strong> net profit. Revenue climbed to ₦31M while operating costs held flat at ₦19M. Cash position is ₦12.6M.</> },
  { q: 'Prepare my VAT filing for Q3', a: <>Done. Output VAT is <strong>₦1.8M</strong>, input VAT ₦640K — net payable <strong>₦1.16M</strong>. I\'ve drafted the filing and flagged one deductible you missed.</> },
  { q: 'Estimate cash flow for next month', a: <>Projected inflow: <strong>₦4.2M</strong>, outflow: <strong>₦3.1M</strong>. Net: <span className="pos">+₦1.1M</span>. I\'d suggest moving ₦400K into your savings bucket.</> },
]

type ChatMessage = {
  from: string
  type?: string
  text?: React.ReactNode
  title?: string
  url?: string
  time: string
}
const chatMocks: { messages: ChatMessage[] }[] = [
  {
    messages: [
      { from: 'user', text: 'How much profit did we make this quarter?', time: '9:31' },
      { from: 'entri', text: <>You\'re up <span className="pos" style={{ color: '#16a34a', fontWeight: 700 }}>+23%</span> QoQ — <strong>₦8.4M</strong> net profit. Revenue climbed to ₦31M while operating costs held flat at ₦19M. Cash position is ₦12.6M.</>, time: '9:31' },
      { from: 'entri', type: 'action', text: 'Generate P&L report', time: '9:31' },
    ],
  },
  {
    messages: [
      { from: 'user', text: 'Prepare my VAT filing for Q3', time: '9:31' },
      { from: 'entri', text: <>Done. Output VAT is <strong>₦1.8M</strong>, input VAT ₦640K — net payable <strong>₦1.16M</strong>. I\'ve drafted the filing and flagged one deductible you missed.</>, time: '9:31' },
      { from: 'entri', type: 'link', title: 'VAT filing Q3', url: 'entri.app/filings/vat-q3', time: '9:31' },
    ],
  },
  {
    messages: [
      { from: 'user', text: 'Estimate cash flow for next month', time: '9:31' },
      { from: 'entri', text: <>Projected inflow: <strong>₦4.2M</strong>, outflow: <strong>₦3.1M</strong>. Net: <span className="pos" style={{ color: '#16a34a', fontWeight: 700 }}>+₦1.1M</span>. I\'d suggest moving ₦400K into your savings bucket.</>, time: '9:31' },
      { from: 'entri', type: 'action', text: 'Set up savings transfer', time: '9:31' },
    ],
  },
]

const marquee = ['Accounting', 'Tax Filing', 'Cash Flow', 'Audit Prep', 'Forecasting', 'Invoicing', 'Reconciliation', 'Savings', 'Investments', 'Reporting']

export default function Landing() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [activeDemo, setActiveDemo] = useState(0)

  return (
    <div className="landing">
      {/* ===== Announcement banner ===== */}
      <div style={{ background: '#1e40ff', overflow: 'hidden', padding: '10px 0', position: 'relative' }}>
        <div className="ln-container" style={{ position: 'relative' }}>
          <div className="announcement-marquee" style={{ display: 'flex', gap: 48, width: 'max-content', animation: 'announcement-scroll 60s linear infinite' }}>
            {[...Array(8)].map((_, i) => (
              <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
                <img src="/anthropic-icon.svg" alt="Anthropic icon" style={{ width: 16, height: 16, flexShrink: 0 }} />
                <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 14, color: '#fff' }}>
                  entri is in early access — the agentic financial OS for SMBs
                </span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ===== Hero with Nav ===== */}
      <section style={{ position: 'relative', padding: '0', background: 'url(/heroBG.jpeg) center/cover no-repeat', overflow: 'hidden' }}>
        {/* Grid overlay */}
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.03) 1px, transparent 1px)', backgroundSize: '60px 60px', pointerEvents: 'none' }} />

        {/* Fade to white at bottom */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 120, background: 'linear-gradient(to bottom, transparent 0%, #ffffff 100%)', pointerEvents: 'none', zIndex: 1 }} />

        {/* Desktop Nav */}
        <header className="nav" style={{ background: 'transparent', backdropFilter: 'none', WebkitBackdropFilter: 'none', borderBottom: '1px solid rgba(255,255,255,.1)', position: 'relative', zIndex: 2 }}>
          <div className="ln-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64, gap: 16 }}>
            <a href="#" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', flexShrink: 0 }}>
              <img src="/logo.png" alt="entri logo" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', border: '1.5px solid #000' }} />
              <span className="font-inter" style={{ fontWeight: 700, fontSize: 20, color: '#fff', letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>entri</span>
            </a>

            <nav className="nav-links font-inter" style={{ display: 'flex', alignItems: 'center', gap: 20, flexShrink: 0 }}>
              <a href="#features" className="nav-link" style={{ whiteSpace: 'nowrap', fontSize: 14 }}>Features</a>
              <a href="#how" className="nav-link" style={{ whiteSpace: 'nowrap', fontSize: 14 }}>How it works</a>
              <a href="#demo" className="nav-link" style={{ whiteSpace: 'nowrap', fontSize: 14 }}>See it in action</a>
            </nav>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }} className="nav-actions">
              <Link to="/login" className="font-inter nav-login" style={{ padding: '7px 12px', color: 'rgba(255,255,255,.85)', textDecoration: 'none', fontWeight: 500, fontSize: 13, whiteSpace: 'nowrap', transition: 'color .15s ease' }}>Log in</Link>
              <Link to="/login" className="font-inter" style={{ padding: '7px 14px', background: '#fff', color: '#0b0f1e', borderRadius: 8, fontWeight: 600, fontSize: 13, textDecoration: 'none', boxShadow: '0 1px 3px rgba(0,0,0,.12)', transition: 'transform .15s ease, box-shadow .15s ease', lineHeight: 1, whiteSpace: 'nowrap' }}>Get started <ArrowRight style={{ width: 14, height: 14, display: 'inline', verticalAlign: 'middle' }} /></Link>
              <button onClick={() => setMenuOpen(v => !v)} className="btn btn-ghost nav-toggle" style={{ padding: 6, display: 'none' }} aria-label="Menu">
                {menuOpen ? <X style={{ width: 18, height: 18 }} /> : <Menu style={{ width: 18, height: 18 }} />}
              </button>
            </div>
          </div>
        </header>

        {/* Mobile header: logo left, hamburger right */}
        <div className="mobile-header" style={{ position: 'relative', zIndex: 2, borderBottom: '1px solid rgba(255,255,255,.1)' }}>
          <div className="ln-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 56, padding: '0 16px' }}>
            <a href="#" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
              <img src="/logo.png" alt="entri logo" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', border: '1.5px solid #000' }} />
              <span className="font-inter" style={{ fontWeight: 700, fontSize: 18, color: '#fff', letterSpacing: '-0.02em' }}>entri</span>
            </a>
            <button onClick={() => setMenuOpen(v => !v)} aria-label="Menu" className="mobile-menu-toggle" style={{ background: 'transparent', border: 'none', color: '#fff', padding: 8, cursor: 'pointer' }}>
              {menuOpen ? <X style={{ width: 22, height: 22 }} /> : <Menu style={{ width: 22, height: 22 }} />}
            </button>
          </div>
        </div>

        {/* Hero Content */}
        <div className="ln-container" style={{ position: 'relative', zIndex: 1, paddingTop: 80, paddingBottom: 40 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'clamp(36px, 5vw, 72px)', alignItems: 'center' }}>
            <Reveal>
              <h1 className="font-display" style={{ fontSize: 'clamp(48px, 6vw, 96px)', color: '#fff', lineHeight: 1.05, letterSpacing: '-0.03em', margin: 0, textShadow: '0 2px 20px rgba(0,0,0,.3)' }}>
                Agentic finance<br />starts here
              </h1>
            </Reveal>

            <Reveal delay={0.1}>
              <div>
                <p className="font-inter" style={{ fontSize: 'clamp(17px, 1.8vw, 21px)', lineHeight: 1.55, color: 'rgba(255,255,255,.85)', margin: '0 0 28px', maxWidth: 480, textShadow: '0 1px 10px rgba(0,0,0,.3)' }}>
                  Today's top SMBs trust entri to automate accounting, understand profit and cash flow in real time, and move their business forward.
                </p>
                <Link to="/login" className="font-inter" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '14px 28px', background: '#fff', color: '#0b0f1e', borderRadius: 8, fontWeight: 600, fontSize: 15, textDecoration: 'none', boxShadow: '0 4px 20px rgba(0,0,0,.25)' }}>
                  Request a demo <ArrowRight style={{ width: 18, height: 18 }} />
                </Link>
              </div>
            </Reveal>
          </div>
        </div>

        {/* Hero Image extending from hero */}
        <div className="ln-container" style={{ position: 'relative', zIndex: 1, paddingBottom: 0 }}>
          <Reveal delay={0.2}>
            <img src="/HERO2.png" alt="Entri dashboard" style={{ width: '100%', height: 'auto', display: 'block', borderRadius: 8, border: '1px solid #000', marginLeft: 0, marginRight: 'auto' }} />
          </Reveal>
        </div>
      </section>

      {/* ===== Financial Statements ===== */}
      <section style={{ padding: '56px 0', background: '#ffffff' }}>
        <div className="ln-container">
          <Reveal style={{ textAlign: 'center', marginBottom: 72 }}>
            <p className="font-inter" style={{ fontSize: 14, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.08em', color: '#333', margin: 0 }}>
              Across all Financial Statements
            </p>
          </Reveal>
          <div style={{ height: 24 }}></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0, border: '1px solid #000' }}>
            {[
              { title: 'Balance Sheet', desc: 'Assets, liabilities, and equity at a glance' },
              { title: 'Profit & Loss', desc: 'Revenue, expenses, and net income tracking' },
              { title: 'Cash Flow', desc: 'Inflows, outflows, and cash position in real time' },
              { title: 'Trial Balance', desc: 'Verify debits and credits across accounts' },
              { title: 'General Ledger', desc: 'Complete transaction history by account' },
              { title: 'Tax Summary', desc: 'Tax obligations, filings, and compliance' },
            ].map((item, i) => (
              <Reveal key={item.title} delay={i * 0.08}>
                <div style={{ padding: '24px 20px', borderRight: i % 3 !== 2 ? '1px solid #000' : 'none', borderBottom: '1px solid #000', background: 'linear-gradient(135deg, #1e40ff 0%, #4f6fff 100%)', transition: 'box-shadow .2s ease, transform .2s ease' }}>
                  <h3 className="font-inter" style={{ fontSize: 18, fontWeight: 700, color: '#fff', margin: '0 0 8px' }}>{item.title}</h3>
                  <p className="font-inter" style={{ fontSize: 14, lineHeight: 1.5, color: 'rgba(255,255,255,.8)', margin: 0 }}>{item.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ===== Blue feature card ===== */}
      <section id="features" style={{ padding: '100px 0', background: 'var(--lpaper)' }}>
        <div className="ln-container feature-split" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'clamp(36px, 5vw, 72px)', alignItems: 'center' }}>
          <Reveal>
            <img src="/HERO3.png" alt="Entri difference" style={{ width: '100%', height: 'auto', display: 'block', borderRadius: 16 }} />
          </Reveal>
          <Reveal delay={0.1}>
            <div style={{ maxWidth: 480 }}>
              <h2 className="font-display" style={{ fontSize: 'clamp(32px, 5vw, 48px)', color: 'var(--lnavy)', margin: '22px 0 0', lineHeight: 1.1 }}>
                Your Finance<br />made simple.
              </h2>
              <p className="font-inter" style={{ fontSize: 16, lineHeight: 1.6, color: 'rgba(11,15,30,.6)', margin: '18px 0 24px' }}>
                Just a simple conversational AI-powered software. Talk to entri the way you'd talk to your CFO — it understands, acts, and keeps your finances spotless.
              </p>
              <Link to="/login" className="btn btn-primary" style={{ background: '#1e40ff', color: '#fff', border: '1.5px solid #000' }}>Learn more</Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ===== Dark feature card ===== */}
      <section style={{ padding: '40px 0 100px', background: 'var(--lpaper)' }}>
        <div className="ln-container">
          <div className="white-card" style={{ padding: 'clamp(36px, 5vw, 72px)' }}>
            <Reveal style={{ position: 'relative', zIndex: 1, maxWidth: 720, margin: '0 auto', textAlign: 'center' }}>
              <h2 className="font-display" style={{ fontSize: 'clamp(32px, 5vw, 52px)', color: 'var(--lnavy)', margin: '22px 0 0', lineHeight: 1.05 }}>
                Your entire finance team,<br />in a <span style={{ color: 'rgba(11,15,30,.6)' }}>conversation.</span>
              </h2>
              <p className="font-inter" style={{ fontSize: 18, lineHeight: 1.6, color: 'rgba(11,15,30,.55)', margin: '20px auto 0', maxWidth: 560 }}>
                entri handles the work that used to need a bookkeeper, an accountant, and a CFO — automatically.
              </p>
            </Reveal>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 0, marginTop: 56 }}>
              {features.map((f, i) => (
                <Reveal key={f.title} delay={i * 0.06}>
                  <div style={{ background: 'linear-gradient(135deg, #1e40ff 0%, #4f6fff 100%)', border: '1px solid #000', borderRadius: 0, padding: '28px 22px' }}>
                    <div className="feature-icon" style={{ background: 'rgba(255,255,255,.2)', color: '#fff' }}><f.icon /></div>
                    <h3 className="font-inter" style={{ fontSize: 18, fontWeight: 700, color: '#fff', margin: '14px 0 10px' }}>{f.title}</h3>
                    <p className="font-inter" style={{ fontSize: 14, lineHeight: 1.55, color: 'rgba(255,255,255,.9)', margin: 0 }}>{f.desc}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ===== How it works ===== */}
      <section id="how" style={{ padding: '80px 0', background: 'var(--lpaper)', borderTop: '1px solid rgba(11,15,30,.06)', borderBottom: '1px solid rgba(11,15,30,.06)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'relative', zIndex: 1 }}>
        <div className="ln-container">
          <Reveal style={{ textAlign: 'center', maxWidth: 640, margin: '0 auto 56px' }}>
            <span className="badge badge-blue">How it works</span>
            <h2 className="font-display" style={{ fontSize: 'clamp(32px, 5vw, 52px)', color: 'var(--lnavy)', margin: '22px 0 0', lineHeight: 1.05 }}>
              Three steps. Zero <span style={{ color: 'rgba(11,15,30,.6)' }}>spreadsheets.</span>
            </h2>
          </Reveal>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>
            {steps.map((s, i) => (
              <Reveal key={s.n} delay={i * 0.1}>
                <div style={{ position: 'relative', padding: '8px 0' }}>
                  <span className="font-display" style={{ fontSize: 64, color: 'rgba(30,64,255,.15)', lineHeight: 1, display: 'block' }}>{s.n}</span>
                  <h3 className="font-inter" style={{ fontSize: 22, fontWeight: 700, color: 'var(--lnavy)', margin: '6px 0 10px' }}>{s.title}</h3>
                  <p className="font-inter" style={{ fontSize: 16, lineHeight: 1.55, color: 'rgba(11,15,30,.55)', margin: 0 }}>{s.desc}</p>
                  {i < steps.length - 1 && (
                    <ChevronRight style={{ width: 24, height: 24, color: 'rgba(11,15,30,.2)', position: 'absolute', top: 24, right: -12 }} />
                  )}
                </div>
              </Reveal>
            ))}
          </div>
        </div>
        </div>
      </section>

      {/* ===== Conversation demo ===== */}
      <section id="demo" style={{ padding: '100px 0', background: 'var(--lpaper)' }}>
        <div className="ln-container">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 'clamp(36px, 5vw, 72px)', alignItems: 'center' }}>
            <Reveal>
              <span className="badge badge-coral">See it in action</span>
              <h2 className="font-display" style={{ fontSize: 'clamp(32px, 5vw, 52px)', color: 'var(--lnavy)', margin: '22px 0 0', lineHeight: 1.05 }}>
                Just ask.<br />Get answers in <span style={{ color: 'rgba(11,15,30,.6)' }}>plain language.</span>
              </h2>
              <p className="font-inter" style={{ fontSize: 18, lineHeight: 1.6, color: 'rgba(11,15,30,.55)', margin: '22px 0 28px' }}>
                No reports to decode, no jargon. Ask a real question and entri replies like a
                trusted advisor who already knows your numbers.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {demoChats.map((d, i) => (
                  <Link key={i} to="/login" onClick={() => setActiveDemo(i)} className="font-inter demo-btn" style={{
                    textAlign: 'left',
                    padding: '14px 18px',
                    borderRadius: 12,
                    border: '1.5px solid #000',
                    background: 'linear-gradient(135deg, #1e40ff 0%, #4f6fff 100%)',
                    color: '#fff',
                    fontWeight: 600,
                    fontSize: 15,
                    cursor: 'pointer',
                    transition: 'all .15s ease',
                    display: 'flex', alignItems: 'center', gap: 10,
                    textDecoration: 'none',
                  }}>
                    <span style={{ width: 26, height: 26, borderRadius: '50%', background: '#fff', color: '#1e40ff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>{i + 1}</span>
                    {d.q}
                  </Link>
                ))}
              </div>
            </Reveal>

            <Reveal delay={0.12}>
              <div style={{ background: 'linear-gradient(180deg, #e8f0fe 0%, #1e40ff 100%)', borderRadius: 24, border: 'none', overflow: 'hidden', maxWidth: 420, marginLeft: 'auto', fontFamily: "'Inter', 'Glacial Indifference', sans-serif" }}>
                {/* Header */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 18px 18px', background: 'transparent' }}>
                  <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#fff', overflow: 'hidden', marginBottom: 10, border: '2px solid #000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 22, color: 'rgba(11,15,30,.7)' }}>
                    <img src="/logo.png" alt="entri" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--lnavy)', margin: 0 }}>entri</div>
                  <div style={{ fontSize: 13, color: 'rgba(11,15,30,.45)', margin: '2px 0 14px' }}>@entri</div>
                  <div style={{ display: 'flex', gap: 24 }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(11,15,30,.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(11,15,30,.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(11,15,30,.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
                  </div>
                </div>

                {/* Date */}
                <div style={{ textAlign: 'center', padding: '18px 0 10px', fontSize: 13, color: 'rgba(11,15,30,.45)' }}>Today</div>

                {/* Messages */}
                <div style={{ padding: '0 18px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {chatMocks[activeDemo].messages.map((msg, idx) => (
                    <div key={idx} style={{ alignSelf: msg.from === 'user' ? 'flex-end' : 'flex-start', background: '#fff', color: 'var(--lnavy)', padding: msg.type === 'action' || msg.type === 'link' ? '10px 14px' : '12px 16px', borderRadius: 18, borderBottomLeftRadius: msg.from === 'user' ? 18 : 6, borderBottomRightRadius: msg.from === 'user' ? 6 : 18, maxWidth: '85%', fontSize: 14, lineHeight: 1.5, boxShadow: '0 1px 2px rgba(0,0,0,.06)' }}>
                      {msg.type === 'action' && (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'rgba(30,64,255,.15)', color: '#1e40ff', padding: '8px 13px', borderRadius: 9, fontSize: 13, fontWeight: 600 }}>
                          <Sparkles style={{ width: 14, height: 14 }} /> {msg.text}
                        </div>
                      )}
                      {msg.type === 'link' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fff', border: '1px solid rgba(11,15,30,.08)', borderRadius: 12, padding: '10px 12px', boxShadow: '0 1px 2px rgba(0,0,0,.04)' }}>
                          <div style={{ width: 32, height: 32, borderRadius: 8, background: '#fff', border: '1px solid rgba(11,15,30,.08)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1e40ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>{msg.title}</div>
                            <div style={{ fontSize: 12, color: 'rgba(11,15,30,.45)' }}>{msg.url}</div>
                          </div>
                          <div style={{ marginLeft: 'auto', fontSize: 11, color: 'rgba(11,15,30,.35)' }}>{msg.time}</div>
                        </div>
                      )}
                      {msg.type === 'voice' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#1e40ff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="#fff"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                          </div>
                          <svg width="120" height="24" viewBox="0 0 120 24" preserveAspectRatio="none" style={{ flex: 1 }}>
                            <rect x="0" y="8" width="3" height="8" rx="1" fill="rgba(11,15,30,.2)"/><rect x="6" y="6" width="3" height="12" rx="1" fill="rgba(11,15,30,.2)"/><rect x="12" y="10" width="3" height="4" rx="1" fill="rgba(11,15,30,.2)"/><rect x="18" y="4" width="3" height="16" rx="1" fill="rgba(11,15,30,.2)"/><rect x="24" y="8" width="3" height="8" rx="1" fill="rgba(11,15,30,.2)"/><rect x="30" y="6" width="3" height="12" rx="1" fill="rgba(11,15,30,.2)"/><rect x="36" y="10" width="3" height="4" rx="1" fill="rgba(11,15,30,.2)"/><rect x="42" y="4" width="3" height="16" rx="1" fill="rgba(11,15,30,.2)"/><rect x="48" y="8" width="3" height="8" rx="1" fill="rgba(11,15,30,.2)"/><rect x="54" y="6" width="3" height="12" rx="1" fill="rgba(11,15,30,.2)"/><rect x="60" y="10" width="3" height="4" rx="1" fill="rgba(11,15,30,.2)"/><rect x="66" y="4" width="3" height="16" rx="1" fill="rgba(11,15,30,.2)"/><rect x="72" y="8" width="3" height="8" rx="1" fill="rgba(11,15,30,.2)"/><rect x="78" y="6" width="3" height="12" rx="1" fill="rgba(11,15,30,.2)"/><rect x="84" y="10" width="3" height="4" rx="1" fill="rgba(11,15,30,.2)"/><rect x="90" y="4" width="3" height="16" rx="1" fill="rgba(11,15,30,.2)"/><rect x="96" y="8" width="3" height="8" rx="1" fill="rgba(11,15,30,.2)"/><rect x="102" y="6" width="3" height="12" rx="1" fill="rgba(11,15,30,.2)"/><rect x="108" y="10" width="3" height="4" rx="1" fill="rgba(11,15,30,.2)"/><rect x="114" y="4" width="3" height="16" rx="1" fill="rgba(11,15,30,.2)"/>
                          </svg>
                          <div style={{ textAlign: 'right', fontSize: 11, color: 'rgba(11,15,30,.35)', whiteSpace: 'nowrap' }}>00:35<div style={{ fontSize: 10, color: 'rgba(11,15,30,.3)' }}>9:32</div></div>
                        </div>
                      )}
                      {!msg.type && (
                        <>
                          <div>{msg.text}</div>
                          {msg.time && <div style={{ textAlign: 'right', fontSize: 11, color: 'rgba(11,15,30,.35)', marginTop: 4 }}>{msg.time}</div>}
                        </>
                      )}
                    </div>
                  ))}
                </div>

                {/* Input */}
                <div style={{ padding: '18px 22px', borderTop: '1px solid rgba(11,15,30,.06)', background: 'rgba(255,255,255,.85)', display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, borderRadius: '0 0 24px 24px' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(11,15,30,.35)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                  <div style={{ flex: 1, fontSize: 14, color: 'rgba(11,15,30,.4)' }}>Write a message</div>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(11,15,30,.35)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(11,15,30,.35)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ===== Trust strip ===== */}
      <section style={{ padding: '0 0 80px', background: 'var(--lpaper)' }}>
        <div className="ln-container trust-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0 }}>
          {[
            { t: 'Audit-ready', d: 'Statements that pass review' },
            { t: 'Bank-grade security', d: '256-bit encryption, always' },
            { t: 'Real-time', d: 'Answers the moment you ask' },
          ].map((item, i) => (
            <Reveal key={item.t} delay={i * 0.08}>
              <div style={{ background: 'linear-gradient(135deg, #1e40ff 0%, #4f6fff 100%)', border: '1px solid #000', borderRadius: 0, padding: '28px 22px' }}>
                <h4 className="font-inter" style={{ fontSize: 16, fontWeight: 700, color: '#fff', margin: '0 0 6px' }}>{item.t}</h4>
                <p className="font-inter" style={{ fontSize: 14, lineHeight: 1.55, color: 'rgba(255,255,255,.9)', margin: 0 }}>{item.d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ===== Subscription ===== */}
      <section style={{ padding: '40px 0 80px', background: 'var(--lpaper)' }}>
        <div className="ln-container">
          <div className="white-card" style={{ padding: 'clamp(36px, 5vw, 72px)', textAlign: 'center', position: 'relative' }}>
            <Reveal style={{ position: 'relative', zIndex: 1, maxWidth: 720, margin: '0 auto' }}>
              <span className="badge" style={{ background: 'rgba(11,15,30,.06)', color: 'rgba(11,15,30,.85)', border: '1px solid rgba(11,15,30,.1)' }}>Simple pricing</span>
              <h2 className="font-display" style={{ fontSize: 'clamp(32px, 5vw, 52px)', color: 'var(--lnavy)', margin: '22px 0 0', lineHeight: 1.05 }}>
                One plan. Every feature.
              </h2>
              <div style={{ margin: '18px 0 0' }}>
                <span className="font-display" style={{ fontSize: 'clamp(48px, 6vw, 80px)', background: 'linear-gradient(135deg, #1e40ff 0%, #4f6fff 100%)', color: '#fff', lineHeight: 1.05, fontWeight: 700, padding: '8px 28px', borderRadius: 16, border: '2px solid #000', display: 'inline-block' }}>₦3,200</span>
                <p className="font-inter" style={{ fontSize: 16, lineHeight: 1.6, color: 'rgba(11,15,30,.55)', margin: '10px 0 0' }}>per month for all AI accounting features</p>
                <p className="font-inter" style={{ fontSize: 16, lineHeight: 1.6, color: 'rgba(11,15,30,.55)', margin: '10px 0 0' }}>Join the SMBs letting entri run their books, taxes, and cash flow — one conversation at a time.</p>
                <Link to="/login" className="btn btn-primary" style={{ marginTop: 24, background: '#1e40ff', color: '#fff', border: '1.5px solid #000' }}>Get started</Link>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ===== Footer ===== */}
      <footer style={{ padding: '56px 0 40px', background: 'var(--lpaper)', borderTop: '1px solid rgba(11,15,30,.06)' }}>
        <div className="ln-container">
          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr', gap: 32, flexWrap: 'wrap' }}>
            <div>
              <a href="#" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', marginBottom: 14 }}>
                <img src="/logo.png" alt="entri logo" style={{ width: 32, height: 32, borderRadius: 8, objectFit: 'cover', border: '1.5px solid #000' }} />
                <span className="font-inter" style={{ fontWeight: 700, fontSize: 20, color: 'var(--lnavy)' }}>entri</span>
              </a>
              <p className="font-inter" style={{ fontSize: 14, lineHeight: 1.6, color: 'rgba(11,15,30,.45)', maxWidth: 280, margin: 0 }}>
                The agentic financial operating system for small and medium businesses. Just a conversation away.
              </p>
            </div>

            {[
              { h: 'Product', links: ['Features', 'How it works', 'Pricing', 'Changelog'] },
              { h: 'Company', links: ['About', 'Careers', 'Blog', 'Contact'] },
              { h: 'Legal', links: ['Privacy', 'Terms', 'Security', 'Compliance'] },
            ].map(col => (
              <div key={col.h}>
                <h4 className="font-inter" style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'rgba(11,15,30,.5)', margin: '0 0 16px' }}>{col.h}</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                  {col.links.map(l => <a key={l} href="#" className="footer-link">{l}</a>)}
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 44, paddingTop: 24, borderTop: '1px solid rgba(11,15,30,.06)', flexWrap: 'wrap', gap: 12 }}>
            <p className="font-inter" style={{ fontSize: 13, color: 'rgba(11,15,30,.35)', margin: 0 }}>&copy; {new Date().getFullYear()} entri. All rights reserved.</p>
            <p className="font-inter" style={{ fontSize: 13, color: 'rgba(11,15,30,.35)', margin: 0, display: 'inline-flex', alignItems: 'center', gap: 7 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#7ee8b8' }} /> All systems operational
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
