import Logo from './Logo'

const LoadingScreen = () => {
  return (
    <div className="min-h-screen bg-app-surface flex items-center justify-center">
      <div className="glass-card p-12 text-center space-y-4">
        <div className="w-32 h-32 mx-auto mb-4">
          <Logo variant="icon" size={120} animated={true} />
        </div>
        <h2 className="text-2xl font-semibold text-slate-100">Loading SABISCORE...</h2>
        <p className="text-slate-300/80">Initializing AI models and connecting to backend</p>
      </div>
    </div>
  )
}

export default LoadingScreen
