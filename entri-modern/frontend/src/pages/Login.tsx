import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, ArrowRight, Sparkles } from 'lucide-react'
import '../assets/landing.css'

export default function Login() {
  const [showPassword, setShowPassword] = useState(false)
  const navigate = useNavigate()

  const handleGetStarted = () => {
    navigate('/dashboard')
  }

  const handleSocialLogin = (provider: string) => {
    navigate('/dashboard')
  }

  return (
    <div style={{ height: '100vh', overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
      {/* Main split */}
      <div className="login-split" style={{ flex: '1 1 0', minHeight: 0, display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
        {/* Left: Image */}
        <div style={{ position: 'relative', background: '#f8f8f8', overflow: 'hidden' }}>
          <img
            src="/HERO3.png"
            alt="Entri"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        </div>

        {/* Right: Form */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 32px', background: '#fff' }}>
          <div style={{ width: '100%', maxWidth: 380 }}>
            <div style={{ marginBottom: 28 }}>
              <img src="/logo.png" alt="entri logo" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', border: '1.5px solid #000' }} />
            </div>

            <h1 style={{ fontSize: 'clamp(28px, 3vw, 40px)', fontWeight: 700, color: '#000', margin: '0 0 8px', lineHeight: 1.1 }}>Welcome to entri</h1>
            <p style={{ fontSize: 15, color: 'rgba(11,15,30,.55)', margin: '0 0 28px' }}>Sign in or create an account to continue</p>

            {/* Form */}
            <form style={{ display: 'flex', flexDirection: 'column', gap: 14 }} onSubmit={(e) => e.preventDefault()}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'rgba(11,15,30,.7)', marginBottom: 6 }}>Email</label>
                <input type="email" placeholder="you@example.com" style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: 'none', background: '#f3f4f6', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'rgba(11,15,30,.7)', marginBottom: 6 }}>Password</label>
                <div style={{ position: 'relative' }}>
                  <input type={showPassword ? 'text' : 'password'} placeholder="••••••••" style={{ width: '100%', padding: '12px 44px 12px 14px', borderRadius: 12, border: 'none', background: '#f3f4f6', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
                  <button type="button" onClick={() => setShowPassword(v => !v)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'rgba(11,15,30,.45)' }}>
                    {showPassword ? <EyeOff style={{ width: 18, height: 18 }} /> : <Eye style={{ width: 18, height: 18 }} />}
                  </button>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13, color: 'rgba(11,15,30,.55)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input type="checkbox" style={{ width: 16, height: 16, accentColor: '#1e40ff' }} />
                  Remember me
                </label>
                <a href="#" style={{ color: '#1e40ff', textDecoration: 'none', fontWeight: 600 }}>Forgot password?</a>
              </div>
              <button type="submit" onClick={handleGetStarted} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: '14px 16px', borderRadius: 12, border: '1.5px solid #000', background: 'linear-gradient(135deg, #1e40ff 0%, #4f6fff 100%)', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', marginTop: 4 }}>
                Get started <ArrowRight style={{ width: 18, height: 18 }} />
              </button>
            </form>

            <p style={{ textAlign: 'center', fontSize: 13, color: 'rgba(11,15,30,.45)', margin: '18px 0 0' }}>
              Don't have an account? <a href="#" style={{ color: '#1e40ff', fontWeight: 600, textDecoration: 'none' }}>Sign up</a>
            </p>

            {/* Divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0' }}>
              <div style={{ flex: 1, height: 1, background: 'rgba(11,15,30,.15)' }} />
              <span style={{ fontSize: 12, color: 'rgba(11,15,30,.45)', textTransform: 'uppercase', letterSpacing: '.06em' }}>or</span>
              <div style={{ flex: 1, height: 1, background: 'rgba(11,15,30,.15)' }} />
            </div>

            {/* Social login */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button type="button" onClick={() => handleSocialLogin('google')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, width: '100%', padding: '12px 16px', borderRadius: 12, border: '1.5px solid #000', background: '#fff', color: '#000', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                Continue with Google
              </button>
              <button type="button" onClick={() => handleSocialLogin('apple')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, width: '100%', padding: '12px 16px', borderRadius: 12, border: '1.5px solid #000', background: '#000', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/></svg>
                Continue with Apple
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
