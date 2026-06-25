import { useState } from 'react'
import Logo from './Logo'
import Tooltip from './ui/Tooltip'

const Header = () => {
  const [isDark, setIsDark] = useState(false)

  const toggleTheme = () => {
    setIsDark(!isDark)
    document.documentElement.classList.toggle('dark')
  }

  return (
    <header className="px-4 pt-6 pb-4">
      <div className="glass-card max-w-6xl mx-auto px-5 py-6 md:px-10 md:py-7">
        <h1 className="sr-only">SabiScore</h1>
        <div className="grid gap-6 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center">
          <div className="flex items-center gap-4 md:gap-6 min-w-0">
            <Logo variant="wordmark" size={220} className="hidden md:block" />
            <Logo variant="icon" size={56} className="md:hidden" />
            <div className="flex flex-col gap-1 md:hidden">
              <span className="text-[0.7rem] uppercase tracking-[0.45em] text-cyan-300/80">AI Football Intelligence</span>
              <span className="text-2xl font-black tracking-tight leading-tight text-slate-100">SABISCORE</span>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <p className="text-sm md:text-base text-slate-300/90 leading-relaxed text-center md:text-left">
              Predictive analytics, xG models, and value detection across Europe's top leagues.
            </p>
            <div className="flex items-center gap-2 justify-center md:justify-start">
              <Tooltip content="5 league models with 86 ML features" position="bottom">
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 cursor-help">
                  v3.0 Edge
                </span>
              </Tooltip>
              <Tooltip content="Ensemble ML models trained on historical match data" position="bottom">
                <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 cursor-help">
                  90-92% Accuracy
                </span>
              </Tooltip>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3">
            <button
              onClick={toggleTheme}
              className="p-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-colors duration-200 text-slate-200"
              aria-label="Toggle theme"
            >
              {isDark ? (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}

export default Header
