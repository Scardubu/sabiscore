interface ErrorScreenProps {
  onRetry: () => void
}

const ErrorScreen = ({ onRetry }: ErrorScreenProps) => {
  return (
    <div className="min-h-screen bg-app-surface flex items-center justify-center">
      <div className="glass-card p-12 text-center max-w-md space-y-6 border border-red-500/20">
        <div className="w-16 h-16 mx-auto mb-6 bg-red-500/20 rounded-full flex items-center justify-center">
          <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <h2 className="text-2xl font-semibold text-red-400">Connection Error</h2>
        <p className="text-slate-300/85 space-y-2">
          <span className="block">Unable to connect to the SabiScore backend API.</span>
          <span className="block text-sm text-slate-400/80">Start the platform with <code className="font-mono text-xs bg-white/5 px-1.5 py-0.5 rounded">.\START_SABISCORE.bat</code> (or run the backend manually on port 8000) before refreshing.</span>
        </p>
        <button onClick={onRetry} className="btn-primary">
          Retry Connection
        </button>
      </div>
    </div>
  )
}

export default ErrorScreen
