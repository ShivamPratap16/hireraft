import { useState, useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { Mail, Lock, User, Zap, Check, X } from 'lucide-react'
import { Button, Input, ThemeToggle } from '../components/ui'

export default function Register() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const strength = useMemo(() => {
    const checks = [
      { label: 'At least 6 characters', met: password.length >= 6 },
      { label: 'Contains a number', met: /\d/.test(password) },
      { label: 'Contains uppercase', met: /[A-Z]/.test(password) },
    ]
    return checks
  }, [password])

  const strengthPct = password.length === 0
    ? 0
    : Math.round((strength.filter((c) => c.met).length / strength.length) * 100)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.detail || 'Registration failed')
        return
      }
      const data = await res.json()
      login(data.token, data.user)
      navigate('/dashboard')
    } catch {
      setError('Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex bg-[var(--surface-0)] relative">
      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle variant="icon" />
      </div>
      {/* Left branding panel */}
      <div className="hidden lg:flex lg:w-[55%] relative overflow-hidden flex-col justify-center items-center px-16">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-700/20 via-brand-600/10 to-transparent" />
        <div className="absolute top-1/3 -right-20 w-80 h-80 rounded-full bg-brand-500/10 blur-3xl animate-float" />
        <div className="absolute bottom-1/3 left-10 w-64 h-64 rounded-full bg-brand-700/8 blur-3xl animate-float" style={{ animationDelay: '1s' }} />

        <div className="relative z-10 text-center max-w-md">
          <Link to="/" className="inline-flex items-center gap-3 mb-6 group">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 group-hover:opacity-90 transition-opacity">
              <Zap className="w-8 h-8 text-white" />
            </div>
          </Link>
          <h2 className="text-3xl font-bold text-[var(--text-primary)] mb-4">
            Start Applying in Minutes
          </h2>
          <p className="text-[var(--text-secondary)] leading-relaxed mb-10">
            Set up your profile, connect your platforms, and let HireRaft handle the rest. No manual form-filling, no tab-switching.
          </p>

          <div className="grid grid-cols-2 gap-4 text-left">
            {[
              { num: '1', text: 'Create your account' },
              { num: '2', text: 'Upload your resume' },
              { num: '3', text: 'Add platform credentials' },
              { num: '4', text: 'Hit run & relax' },
            ].map((s, i) => (
              <div
                key={i}
                className="glass rounded-2xl p-4 animate-slide-up"
                style={{ animationDelay: `${i * 0.1}s` }}
              >
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-brand-500/20 text-brand-400 text-xs font-bold mb-2">
                  {s.num}
                </span>
                <p className="text-sm font-medium text-[var(--text-primary)]">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm animate-fade-in">
          <Link to="/" className="lg:hidden flex items-center justify-center gap-2 mb-8">
            <div className="p-2 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="text-2xl font-bold bg-gradient-to-r from-brand-400 to-brand-600 bg-clip-text text-transparent">
              HireRaft
            </span>
          </Link>

          <div className="glass rounded-3xl p-8 shadow-lg">
            <div className="text-center mb-8">
              <h1 className="text-xl font-bold text-[var(--text-primary)]">Create an account</h1>
              <p className="text-sm text-[var(--text-muted)] mt-1">Get started with your automated job search</p>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl px-4 py-3 mb-5 animate-slide-up">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <Input
                label="Name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                icon={<User className="w-4 h-4" />}
              />

              <Input
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                icon={<Mail className="w-4 h-4" />}
              />

              <Input
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Min 6 characters"
                icon={<Lock className="w-4 h-4" />}
              />

              {password.length > 0 && (
                <div className="space-y-2 animate-slide-up">
                  <div className="flex gap-1 h-1.5">
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className={`flex-1 rounded-full transition-all duration-300 ${
                          strengthPct > i * 33
                            ? strengthPct >= 100 ? 'bg-emerald-500' : strengthPct >= 66 ? 'bg-amber-400' : 'bg-red-400'
                            : 'bg-[var(--surface-3)]'
                        }`}
                      />
                    ))}
                  </div>
                  <div className="space-y-1">
                    {strength.map((c, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        {c.met
                          ? <Check className="w-3 h-3 text-emerald-400" />
                          : <X className="w-3 h-3 text-[var(--text-muted)]" />}
                        <span className={c.met ? 'text-emerald-400' : 'text-[var(--text-muted)]'}>
                          {c.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Button type="submit" loading={loading} className="w-full" size="lg">
                Create Account
              </Button>
            </form>

            <p className="text-center text-sm text-[var(--text-muted)] mt-6">
              Already have an account?{' '}
              <Link to="/login" className="text-brand-400 hover:text-brand-300 font-medium transition-colors">
                Sign in
              </Link>
            </p>
            <p className="text-center text-xs text-[var(--text-muted)] mt-4">
              <Link to="/" className="text-brand-400/80 hover:text-brand-400 hover:underline">
                Back to home
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
