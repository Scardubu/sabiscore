'use client';

/**
 * Backend Warmup Component
 * 
 * Pings the Render backend API on initial page load to start
 * warming up the FastAPI server before user requests predictions.
 * 
 * Impact: Reduces 30-60s cold start delay on free tier Render
 * 
 * The Render free tier spins down after 15 minutes of inactivity.
 * This component proactively wakes it up when users visit the site.
 */

import { useEffect, useState } from 'react';

export function BackendWarmup() {
  const [, setStatus] = useState<'idle' | 'warming' | 'ready' | 'cold'>('idle');

  useEffect(() => {
    let mounted = true;
    let retryCount = 0;
    const maxRetries = 3;
    const retryDelay = 5000; // 5 seconds between retries

    async function pingBackend() {
      try {
        setStatus('warming');
        console.log('🔥 Warming up backend API...');

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout

        // Use the Next.js proxy route (/api/health) instead of calling the Render
        // backend directly. Direct browser → Render calls are cross-origin and
        // blocked when the backend is cold (preflight fails with null status).
        const response = await fetch('/api/health', {
          method: 'GET',
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!mounted) return;

        if (response.ok) {
          console.log('✅ Backend is warm and ready');
          setStatus('ready');
          sessionStorage.setItem('backend_warmed', Date.now().toString());
        } else {
          throw new Error(`Backend returned ${response.status}`);
        }
      } catch {
        if (!mounted) return;

        if (retryCount < maxRetries) {
          retryCount++;
          console.log(`⏳ Backend warming up, retry ${retryCount}/${maxRetries}...`);
          setTimeout(pingBackend, retryDelay);
        } else {
          console.log('❄️ Backend is cold - first request may be slow');
          setStatus('cold');
        }
      }
    }

    // Check if we've pinged recently (within last 10 minutes)
    const lastWarmup = sessionStorage.getItem('backend_warmed');
    const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
    
    if (!lastWarmup || parseInt(lastWarmup) < tenMinutesAgo) {
      // Start warmup after a short delay to not block initial render
      const timer = setTimeout(pingBackend, 100);
      return () => {
        mounted = false;
        clearTimeout(timer);
      };
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
