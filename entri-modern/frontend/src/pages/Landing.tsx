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
      {/* ===== Hero with Nav ===== */}
      <section style={{ position: 'relative', padding: '0', overflow: 'hidden', background: '#ffffff' }}>
        {/* Hero BG image — clear, no blur */}
        <div style={{ position: 'absolute', inset: 0, background: 'url(/HeroBG2.png) center/cover no-repeat', pointerEvents: 'none', zIndex: 0 }} />

        {/* Fade to white at bottom */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 120, background: 'linear-gradient(to bottom, transparent 0%, #ffffff 100%)', pointerEvents: 'none', zIndex: 1 }} />

        {/* Desktop Nav */}
        <header className="nav" style={{ background: 'transparent', backdropFilter: 'none', WebkitBackdropFilter: 'none', borderBottom: 'none', position: 'relative', zIndex: 2 }}>
          <div className="ln-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64, gap: 16 }}>
            <a href="#" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', flexShrink: 0 }}>
              <img src="/logo.png" alt="entri logo" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', border: '1.5px solid #000' }} />
              <span className="font-inter" style={{ fontWeight: 700, fontSize: 20, color: '#0b0f1e', letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>entri</span>
            </a>

            <nav className="nav-links font-inter" style={{ display: 'flex', alignItems: 'center', gap: 20, flexShrink: 0 }}>
              <a href="#features" className="nav-link" style={{ whiteSpace: 'nowrap', fontSize: 14, color: 'rgba(11,15,30,.72)' }}>Features</a>
              <a href="#how" className="nav-link" style={{ whiteSpace: 'nowrap', fontSize: 14, color: 'rgba(11,15,30,.72)' }}>How it works</a>
              <a href="#demo" className="nav-link" style={{ whiteSpace: 'nowrap', fontSize: 14, color: 'rgba(11,15,30,.72)' }}>See it in action</a>
            </nav>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }} className="nav-actions">
              <Link to="/login" className="font-inter nav-login" style={{ padding: '7px 12px', color: 'rgba(11,15,30,.85)', textDecoration: 'none', fontWeight: 500, fontSize: 13, whiteSpace: 'nowrap', transition: 'color .15s ease' }}>Log in</Link>
              <Link to="/login" className="font-inter" style={{ padding: '7px 14px', background: '#0b0f1e', color: '#fff', borderRadius: 8, fontWeight: 600, fontSize: 13, textDecoration: 'none', boxShadow: 'none', transition: 'transform .15s ease', lineHeight: 1, whiteSpace: 'nowrap' }}>Get started <ArrowRight style={{ width: 14, height: 14, display: 'inline', verticalAlign: 'middle' }} /></Link>
              <button onClick={() => setMenuOpen(v => !v)} className="btn btn-ghost nav-toggle" style={{ padding: 6, display: 'none' }} aria-label="Menu">
                {menuOpen ? <X style={{ width: 18, height: 18 }} /> : <Menu style={{ width: 18, height: 18 }} />}
              </button>
            </div>
          </div>
        </header>

        {/* Mobile header: logo left, hamburger right */}
        <div className="mobile-header" style={{ position: 'relative', zIndex: 2, borderBottom: 'none' }}>
          <div className="ln-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 56, padding: '0 16px' }}>
            <a href="#" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
              <img src="/logo.png" alt="entri logo" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', border: '1.5px solid #000' }} />
              <span className="font-inter" style={{ fontWeight: 700, fontSize: 18, color: '#0b0f1e', letterSpacing: '-0.02em' }}>entri</span>
            </a>
            <button onClick={() => setMenuOpen(v => !v)} aria-label="Menu" className="mobile-menu-toggle" style={{ background: 'transparent', border: 'none', color: '#0b0f1e', padding: 8, cursor: 'pointer' }}>
              {menuOpen ? <X style={{ width: 22, height: 22 }} /> : <Menu style={{ width: 22, height: 22 }} />}
            </button>
          </div>
        </div>

        {/* Hero Content */}
        <div className="ln-container" style={{ position: 'relative', zIndex: 1, paddingTop: 80, paddingBottom: 40 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 24, maxWidth: 860, margin: '0 auto' }}>
            <Reveal>
              <h1 className="font-display" style={{ fontSize: 'clamp(48px, 6vw, 96px)', color: '#0b0f1e', lineHeight: 1.05, letterSpacing: '-0.03em', margin: 0, textAlign: 'center' }}>
                Agentic finance<br />starts here
              </h1>
            </Reveal>

            <Reveal delay={0.1}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                <p className="font-inter" style={{ fontSize: 'clamp(17px, 1.8vw, 21px)', lineHeight: 1.55, color: 'rgba(11,15,30,.7)', margin: '0 0 28px', maxWidth: 640, textAlign: 'center' }}>
                  Today's top SMBs trust entri to automate accounting, understand profit and cash flow in real time, and move their business forward.
                </p>
                <Link to="/login" className="font-inter liquid-glass-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '14px 32px', fontWeight: 600, fontSize: 15, textDecoration: 'none' }}>
                  Get Access <ArrowRight style={{ width: 18, height: 18 }} />
                </Link>
              </div>
            </Reveal>
          </div>
        </div>

        {/* Hero Image extending from hero */}
        <div className="ln-container" style={{ position: 'relative', zIndex: 1, paddingBottom: 40 }}>
          <Reveal delay={0.2}>
            <img src="/HERO2.png" alt="Entri dashboard" style={{ width: '100%', height: 'auto', display: 'block', borderRadius: 8, border: '1px solid #000', marginLeft: 0, marginRight: 'auto' }} />
          </Reveal>
        </div>
      </section>

      {/* ===== Announcement tape — under hero image ===== */}
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
    </div>
  )
}
