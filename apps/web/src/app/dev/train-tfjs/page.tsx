'use client';

/**
 * Dev-Only Training Page
 * 
 * Browser-based interface for training TensorFlow.js ensemble models
 * using free StatsBomb open data. This page is for development only
 * and should not be exposed in production.
 * 
 * @route /dev/train-tfjs
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Brain, 
  Play, 
  RotateCcw, 
  CheckCircle2, 
  XCircle, 
  Loader2,
  Database,
  Cpu,
  BarChart3,
  Clock,
  Trash2,
  Download,
  AlertTriangle
} from 'lucide-react';

import { 
  FreeTrainingPipeline, 
  DEFAULT_TRAINING_CONFIG,
  type TrainingResult,
  type TrainingPhase,
  type FreeTrainingConfig
} from '@/lib/ml/train-tfjs-free';

// ============================================================================
// Types
// ============================================================================

interface LogEntry {
  id: number;
  timestamp: Date;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
}

interface TrainingState {
  status: 'idle' | 'running' | 'paused' | 'complete' | 'error';
  phase: TrainingPhase;
  progress: number;
  currentMessage: string;
  result: TrainingResult | null;
  logs: LogEntry[];
}

// ============================================================================
// Component
// ============================================================================

export default function TrainTFJSPage() {
  // State
  const [state, setState] = useState<TrainingState>({
    status: 'idle',
    phase: 'initializing',
    progress: 0,
    currentMessage: 'Ready to train',
    result: null,
    logs: []
  });
  
  const [config, setConfig] = useState<FreeTrainingConfig>(DEFAULT_TRAINING_CONFIG);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [hasExistingModels, setHasExistingModels] = useState(false);
  
  const pipelineRef = useRef<FreeTrainingPipeline | null>(null);
  const logIdRef = useRef(0);
  const logsEndRef = useRef<HTMLDivElement>(null);
  
  // Check for existing models on mount
  useEffect(() => {
    checkModels();
  }, []);
  
  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [state.logs]);
  
  const checkModels = async () => {
    try {
      const pipeline = new FreeTrainingPipeline();
      const exists = await pipeline.hasTrainedModels();
      setHasExistingModels(exists);
    } catch {
      setHasExistingModels(false);
    }
  };
  
  const addLog = useCallback((message: string, type: LogEntry['type'] = 'info') => {
    setState(prev => ({
      ...prev,
      logs: [...prev.logs, {
        id: logIdRef.current++,
        timestamp: new Date(),
        message,
        type
      }]
    }));
  }, []);
  
  const handleProgress = useCallback((message: string, progress: number, phase: TrainingPhase) => {
    setState(prev => ({
      ...prev,
      phase,
      progress,
      currentMessage: message
    }));
    
    // Add significant messages to log
    if (message.includes('✅') || message.includes('📊') || message.includes('🎓')) {
      addLog(message, 'success');
    } else if (message.includes('⚠️')) {
      addLog(message, 'warning');
    }
  }, [addLog]);
  
  const handleEpochEnd = useCallback((epoch: number, logs: Record<string, number>) => {
    if (epoch % 10 === 0) {
      const acc = logs.acc || logs.accuracy || 0;
      const valAcc = logs.val_acc || logs.val_accuracy || 0;
      addLog(`Epoch ${epoch}: acc=${(acc * 100).toFixed(1)}%, val_acc=${(valAcc * 100).toFixed(1)}%`, 'info');
    }
  }, [addLog]);
  
  const startTraining = async () => {
    setState(prev => ({
      ...prev,
      status: 'running',
      phase: 'initializing',
      progress: 0,
      currentMessage: 'Starting training...',
      result: null,
      logs: []
    }));
    
    addLog('🚀 Starting TensorFlow.js ensemble training...', 'info');
    addLog(`Config: ${config.minMatches} matches, ${config.epochs} epochs`, 'info');
    
    try {
      pipelineRef.current = new FreeTrainingPipeline({
        ...config,
        onProgress: handleProgress,
        onEpochEnd: handleEpochEnd
      });
      
      const result = await pipelineRef.current.run();
      
      if (result.success) {
        addLog('✅ Training completed successfully!', 'success');
        addLog(`📊 Ensemble Accuracy: ${((result.metrics?.ensembleAccuracy || 0) * 100).toFixed(1)}%`, 'success');
        addLog(`📊 Brier Score: ${(result.metrics?.calibratedBrier || 0).toFixed(4)}`, 'success');
        addLog(`⏱️ Total time: ${(result.timing?.total || 0 / 1000).toFixed(1)}s`, 'info');
        
        setState(prev => ({
          ...prev,
          status: 'complete',
          result
        }));
        
        setHasExistingModels(true);
      } else {
        throw new Error(result.error || 'Training failed');
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      addLog(`❌ Training failed: ${errorMessage}`, 'error');
      
      setState(prev => ({
        ...prev,
        status: 'error',
        currentMessage: errorMessage,
        result: { success: false, error: errorMessage }
      }));
    }
  };
  
  const clearModels = async () => {
    try {
      addLog('🗑️ Clearing saved models...', 'info');
      const pipeline = new FreeTrainingPipeline();
      await pipeline.clearModels();
      setHasExistingModels(false);
      addLog('✅ Models cleared from browser storage', 'success');
    } catch (error) {
      addLog(`❌ Failed to clear models: ${error}`, 'error');
    }
  };
  
  const resetState = () => {
    setState({
      status: 'idle',
      phase: 'initializing',
      progress: 0,
      currentMessage: 'Ready to train',
      result: null,
      logs: []
    });
  };
  
  // Phase display info
  const phaseInfo: Record<TrainingPhase, { label: string; icon: React.ReactNode }> = {
    initializing: { label: 'Initializing', icon: <Loader2 className="h-4 w-4 animate-spin" /> },
    fetching_data: { label: 'Fetching Data', icon: <Database className="h-4 w-4" /> },
    adapting_data: { label: 'Adapting Data', icon: <RotateCcw className="h-4 w-4" /> },
    training_dense: { label: 'Training Dense NN', icon: <Cpu className="h-4 w-4" /> },
    training_lstm: { label: 'Training LSTM', icon: <Cpu className="h-4 w-4" /> },
    training_cnn: { label: 'Training CNN', icon: <Cpu className="h-4 w-4" /> },
    calibrating: { label: 'Calibrating', icon: <BarChart3 className="h-4 w-4" /> },
    evaluating: { label: 'Evaluating', icon: <BarChart3 className="h-4 w-4" /> },
    saving: { label: 'Saving Models', icon: <Download className="h-4 w-4" /> },
    complete: { label: 'Complete', icon: <CheckCircle2 className="h-4 w-4" /> }
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      {/* Header */}
      <header className="border-b border-white/10 bg-slate-900/50 backdrop-blur-sm">
        <div className="mx-auto max-w-6xl px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 p-2">
                <Brain className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold">TFJS Training Pipeline</h1>
                <p className="text-sm text-slate-400">Dev-only • StatsBomb Open Data</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {hasExistingModels && (
                <span className="flex items-center gap-1 rounded-full bg-green-500/20 px-3 py-1 text-xs text-green-400">
                  <CheckCircle2 className="h-3 w-3" />
                  Models Saved
                </span>
              )}
              <span className="rounded-full bg-amber-500/20 px-3 py-1 text-xs text-amber-400">
                <AlertTriangle className="mr-1 inline h-3 w-3" />
                Development Only
              </span>
            </div>
          </div>
        </div>
      </header>
      
      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left Column - Controls */}
          <div className="space-y-6">
            {/* Training Controls */}
            <div className="rounded-xl border border-white/10 bg-slate-900/50 p-6">
              <h2 className="mb-4 text-lg font-semibold">Training Controls</h2>
              
              <div className="space-y-4">
                {/* Main Action Button */}
                <button
                  onClick={state.status === 'idle' || state.status === 'error' ? startTraining : resetState}
                  disabled={state.status === 'running'}
                  className={`flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 font-medium transition-all ${
                    state.status === 'running'
                      ? 'cursor-not-allowed bg-slate-700 text-slate-400'
                      : state.status === 'complete'
                      ? 'bg-green-600 hover:bg-green-500'
                      : 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500'
                  }`}
                >
                  {state.status === 'running' ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Training...
                    </>
                  ) : state.status === 'complete' ? (
                    <>
                      <RotateCcw className="h-5 w-5" />
                      Train Again
                    </>
                  ) : (
                    <>
                      <Play className="h-5 w-5" />
                      Start Training
                    </>
                  )}
                </button>
                
                {/* Clear Models Button */}
                {hasExistingModels && state.status !== 'running' && (
                  <button
                    onClick={clearModels}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-500/30 px-4 py-2 text-sm text-red-400 transition-all hover:bg-red-500/10"
                  >
                    <Trash2 className="h-4 w-4" />
                    Clear Saved Models
                  </button>
                )}
              </div>
            </div>
            
            {/* Configuration */}
            <div className="rounded-xl border border-white/10 bg-slate-900/50 p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold">Configuration</h2>
                <button
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="text-sm text-cyan-400 hover:text-cyan-300"
                >
                  {showAdvanced ? 'Hide' : 'Show'} Advanced
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm text-slate-400">Min Matches</label>
                  <input
                    type="number"
                    value={config.minMatches}
                    onChange={e => setConfig(c => ({ ...c, minMatches: parseInt(e.target.value) || 100 }))}
                    disabled={state.status === 'running'}
                    className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-white disabled:opacity-50"
                  />
                </div>
                
                <div>
                  <label className="mb-1 block text-sm text-slate-400">Epochs</label>
                  <input
                    type="number"
                    value={config.epochs}
                    onChange={e => setConfig(c => ({ ...c, epochs: parseInt(e.target.value) || 10 }))}
                    disabled={state.status === 'running'}
                    className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-white disabled:opacity-50"
                  />
                </div>
                
                <AnimatePresence>
                  {showAdvanced && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="space-y-4 overflow-hidden"
                    >
                      <div>
                        <label className="mb-1 block text-sm text-slate-400">Batch Size</label>
                        <input
                          type="number"
                          value={config.batchSize}
                          onChange={e => setConfig(c => ({ ...c, batchSize: parseInt(e.target.value) || 16 }))}
                          disabled={state.status === 'running'}
                          className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-white disabled:opacity-50"
                        />
                      </div>
                      
                      <div>
                        <label className="mb-1 block text-sm text-slate-400">Validation Split</label>
                        <input
                          type="number"
                          step="0.05"
                          min="0.1"
                          max="0.4"
                          value={config.validationSplit}
                          onChange={e => setConfig(c => ({ ...c, validationSplit: parseFloat(e.target.value) || 0.2 }))}
                          disabled={state.status === 'running'}
                          className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-white disabled:opacity-50"
                        />
                      </div>
                      
                      <div>
                        <label className="mb-1 block text-sm text-slate-400">Max Matches/Competition</label>
                        <input
                          type="number"
                          value={config.maxMatchesPerCompetition}
                          onChange={e => setConfig(c => ({ ...c, maxMatchesPerCompetition: parseInt(e.target.value) || 50 }))}
                          disabled={state.status === 'running'}
                          className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-white disabled:opacity-50"
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
          
          {/* Right Column - Progress & Results */}
          <div className="space-y-6 lg:col-span-2">
            {/* Progress Card */}
            <div className="rounded-xl border border-white/10 bg-slate-900/50 p-6">
              <h2 className="mb-4 text-lg font-semibold">Training Progress</h2>
              
              {/* Phase indicator */}
              <div className="mb-4 flex items-center gap-2">
                <div className={`rounded-full p-2 ${
                  state.status === 'running' ? 'bg-cyan-500/20 text-cyan-400' :
                  state.status === 'complete' ? 'bg-green-500/20 text-green-400' :
                  state.status === 'error' ? 'bg-red-500/20 text-red-400' :
                  'bg-slate-700 text-slate-400'
                }`}>
                  {phaseInfo[state.phase].icon}
                </div>
                <span className="font-medium">{phaseInfo[state.phase].label}</span>
              </div>
              
              {/* Progress bar */}
              <div className="mb-2 h-3 overflow-hidden rounded-full bg-slate-800">
                <motion.div
                  className="h-full bg-gradient-to-r from-cyan-500 to-blue-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${state.progress * 100}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
              
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">{state.currentMessage}</span>
                <span className="font-mono text-cyan-400">{(state.progress * 100).toFixed(1)}%</span>
              </div>
            </div>
            
            {/* Results Card */}
            {state.result && state.result.success && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl border border-green-500/30 bg-green-500/10 p-6"
              >
                <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-green-400">
                  <CheckCircle2 className="h-5 w-5" />
                  Training Results
                </h2>
                
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-lg bg-slate-900/50 p-4">
                    <p className="text-sm text-slate-400">Ensemble Accuracy</p>
                    <p className="text-2xl font-bold text-green-400">
                      {((state.result.metrics?.ensembleAccuracy || 0) * 100).toFixed(1)}%
                    </p>
                  </div>
                  
                  <div className="rounded-lg bg-slate-900/50 p-4">
                    <p className="text-sm text-slate-400">Brier Score</p>
                    <p className="text-2xl font-bold text-cyan-400">
                      {(state.result.metrics?.calibratedBrier || 0).toFixed(4)}
                    </p>
                  </div>
                  
                  <div className="rounded-lg bg-slate-900/50 p-4">
                    <p className="text-sm text-slate-400">Total Samples</p>
                    <p className="text-2xl font-bold text-white">
                      {state.result.datasetStats?.totalSamples || 0}
                    </p>
                  </div>
                  
                  <div className="rounded-lg bg-slate-900/50 p-4">
                    <p className="text-sm text-slate-400">Training Time</p>
                    <p className="text-2xl font-bold text-white">
                      {((state.result.timing?.total || 0) / 1000).toFixed(1)}s
                    </p>
                  </div>
                </div>
                
                {/* Model accuracies */}
                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  <div className="flex items-center justify-between rounded-lg bg-slate-900/50 px-4 py-2">
                    <span className="text-sm text-slate-400">Dense NN</span>
                    <span className="font-mono text-sm">
                      {((state.result.metrics?.denseAccuracy || 0) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-slate-900/50 px-4 py-2">
                    <span className="text-sm text-slate-400">LSTM</span>
                    <span className="font-mono text-sm">
                      {((state.result.metrics?.lstmAccuracy || 0) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-slate-900/50 px-4 py-2">
                    <span className="text-sm text-slate-400">CNN</span>
                    <span className="font-mono text-sm">
                      {((state.result.metrics?.cnnAccuracy || 0) * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              </motion.div>
            )}
            
            {/* Error Card */}
            {state.result && !state.result.success && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl border border-red-500/30 bg-red-500/10 p-6"
              >
                <h2 className="mb-2 flex items-center gap-2 text-lg font-semibold text-red-400">
                  <XCircle className="h-5 w-5" />
                  Training Failed
                </h2>
                <p className="text-slate-300">{state.result.error}</p>
              </motion.div>
            )}
            
            {/* Logs */}
            <div className="rounded-xl border border-white/10 bg-slate-900/50 p-6">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                <Clock className="h-5 w-5 text-slate-400" />
                Training Logs
              </h2>
              
              <div className="h-64 overflow-y-auto rounded-lg bg-slate-950 p-4 font-mono text-sm">
                {state.logs.length === 0 ? (
                  <p className="text-slate-500">Logs will appear here during training...</p>
                ) : (
                  state.logs.map(log => (
                    <div
                      key={log.id}
                      className={`mb-1 ${
                        log.type === 'success' ? 'text-green-400' :
                        log.type === 'error' ? 'text-red-400' :
                        log.type === 'warning' ? 'text-amber-400' :
                        'text-slate-300'
                      }`}
                    >
                      <span className="text-slate-500">
                        [{log.timestamp.toLocaleTimeString()}]
                      </span>{' '}
                      {log.message}
                    </div>
                  ))
                )}
                <div ref={logsEndRef} />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
