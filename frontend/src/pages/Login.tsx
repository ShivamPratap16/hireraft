import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { Mail, Lock, Zap, Target, BarChart3, Calendar } from 'lucide-react'
import { Button, Input, ThemeToggle } from '../components/ui'

const features = [
  { icon: <Zap className="w-5 h-5" />, title: 'Auto-Apply to 4 Platforms', desc: 'Naukri, LinkedIn, Indeed & Internshala' },
  { icon: <Target className="w-5 h-5" />, title: 'Smart Job Matching', desc: 'Keywords, role & location based search' },
  { icon: <BarChart3 className="w-5 h-5" />, title: 'Track Every Application', desc: 'Real-time dashboard with status updates' },
  { icon: <Calendar className="w-5 h-5" />, title: 'Automated Scheduling', desc: 'Daily runs with configurable limits' },
]

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.detail || 'Login failed')
        return
      }
      const data = await res.json()
      login(data.token, data.user)
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
      <div className="hidden lg:flex lg:w-[55%] relative overflow-hidden flex-col justify-center px-16 xl:px-20">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-600/20 via-brand-700/10 to-transparent" />
        <div className="absolute top-1/4 -left-32 w-96 h-96 rounded-full bg-brand-500/10 blur-3xl animate-float" />
        <div className="absolute bottom-1/4 right-0 w-72 h-72 rounded-full bg-brand-700/8 blur-3xl animate-float" style={{ animationDelay: '1.5s' }} />

        <div className="relative z-10">
          <Link to="/" className="inline-flex items-center gap-3 mb-2 group">
            <div className="p-2.5 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 group-hover:opacity-90 transition-opacity">
              <Zap className="w-7 h-7 text-white" />
            </div>
            <span className="text-3xl font-bold bg-gradient-to-r from-brand-400 to-brand-600 bg-clip-text text-transparent">
              HireRaft
            </span>
          </Link>
          <p className="text-lg text-[var(--text-secondary)] mt-4 mb-12 max-w-md leading-relaxed">
            Automate your job search. Apply to hundreds of positions while you focus on what matters — preparing for interviews.
          </p>

          <div className="space-y-5">
            {features.map((f, i) => (
              <div
                key={i}
                className="flex items-start gap-4 p-4 rounded-2xl glass transition-all duration-200 hover:border-brand-500/20 animate-slide-up"
                style={{ animationDelay: `${i * 0.1}s` }}
              >
                <div className="p-2 rounded-xl bg-brand-500/10 text-brand-400 shrink-0">
                  {f.icon}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-[var(--text-primary)]">{f.title}</h3>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm animate-fade-in">
          {/* Mobile logo */}
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
              <h1 className="text-xl font-bold text-[var(--text-primary)]">Welcome back</h1>
              <p className="text-sm text-[var(--text-muted)] mt-1">Sign in to continue your job hunt</p>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl px-4 py-3 mb-5 animate-slide-up">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
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
                placeholder="Your password"
                icon={<Lock className="w-4 h-4" />}
              />

              <Button type="submit" loading={loading} className="w-full" size="lg">
                Sign In
              </Button>
            </form>

            <p className="text-center text-sm text-[var(--text-muted)] mt-6">
              Don't have an account?{' '}
              <Link to="/register" className="text-brand-400 hover:text-brand-300 font-medium transition-colors">
                Create one
              </Link>
            </p>
          </div>

          <p className="text-center text-xs text-[var(--text-muted)] mt-6">
            <Link to="/" className="text-brand-400/80 hover:text-brand-400 hover:underline">
              Back to home
            </Link>
            <span className="opacity-60 mx-2">·</span>
            <span className="opacity-60">Your credentials are encrypted and stored locally</span>
          </p>
        </div>
      </div>
    </div>
  )
}
