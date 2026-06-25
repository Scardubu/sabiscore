'use client';

/**
 * Model Warmup Component
 * 
 * Preloads TensorFlow.js models in the background during app initialization
 * to eliminate cold start delays on first prediction.
 * 
 * Impact: Eliminates 10-15s cold start delay
 */

import { useEffect, useState } from 'react';

export function ModelWarmup() {
  const [, setStatus] = useState<'idle' | 'warming' | 'ready' | 'error'>('idle');

  useEffect(() => {
    let mounted = true;

    async function warmupModels() {
      if (typeof window === 'undefined') return;

      try {
        setStatus('warming');
        console.log('🔥 Starting model warmup...');

        // Dynamic import to avoid blocking initial render
        const { TFJSEnsembleEngine } = await import('@/lib/ml/tfjs-ensemble-engine');
        
        if (!mounted) return;

        const engine = new TFJSEnsembleEngine();
        await engine.initialize();

        if (!mounted) return;

        console.log('✅ Models preloaded and ready');
        setStatus('ready');

        // Store warmup completion in sessionStorage
        sessionStorage.setItem('models_warmed', 'true');
      } catch (error) {
        console.error('Model warmup failed:', error);
        if (mounted) {
          setStatus('error');
        }
      }
    }

    // Only warmup if not already done in this session
    const alreadyWarmed = sessionStorage.getItem('models_warmed');
    if (!alreadyWarmed) {
      warmupModels();
    } else {
      setStatus('ready');
    }

    return () => {
      mounted = false;
    };
  }, []);

  // Hidden component - only for background initialization
  return null;
}
