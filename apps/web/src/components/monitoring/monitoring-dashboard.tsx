/**
 * Monitoring Dashboard Component
 * 
 * Displays system health, rolling metrics, and drift detection.
 */

'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Activity, TrendingUp, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import type { HealthMetrics, RollingMetrics, DriftReport } from '@/lib/monitoring/free-analytics';

export function MonitoringDashboard() {
  const [health, setHealth] = useState<HealthMetrics | null>(null);
  const [metrics, setMetrics] = useState<RollingMetrics | null>(null);
  const [drift, setDrift] = useState<DriftReport | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);
  
  async function loadData() {
    try {
      const [healthRes, metricsRes, driftRes] = await Promise.all([
        fetch('/api/health'),
        fetch('/api/metrics'),
        fetch('/api/drift'),
      ]);
      
      if (healthRes.ok) {
        const data = await healthRes.json();
        setHealth(data);
      }
      
      if (metricsRes.ok) {
        const data = await metricsRes.json();
        setMetrics(data.metrics);
      }
      
      if (driftRes.ok) {
        const data = await driftRes.json();
        setDrift(data);
      }
    } catch (error) {
      console.error('Failed to load monitoring data:', error);
    } finally {
      setLoading(false);
    }
  }
  
  if (loading) {
    return <MonitoringDashboardSkeleton />;
  }
  
  return (
    <div className="space-y-6">
      {/* Health Status */}
      {health && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 shadow-lg"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
              System Health
            </h3>
            <StatusBadge status={health.status} />
          </div>
          
          <div className="grid grid-cols-3 gap-4 mb-4">
            <MetricCard
              label="Accuracy"
              value={`${(health.accuracy * 100).toFixed(1)}%`}
              status={health.accuracy >= 0.65 ? 'good' : health.accuracy >= 0.50 ? 'warning' : 'critical'}
            />
            <MetricCard
              label="Brier Score"
              value={health.brierScore.toFixed(3)}
              status={health.brierScore <= 0.20 ? 'good' : health.brierScore <= 0.25 ? 'warning' : 'critical'}
            />
            <MetricCard
              label="ROI"
              value={`${health.roi.toFixed(1)}%`}
              status={health.roi >= 5 ? 'good' : health.roi >= 0 ? 'warning' : 'critical'}
            />
          </div>
          
          {health.issues.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                Issues ({health.issues.length})
              </h4>
              {health.issues.map((issue, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-2 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20"
                >
                  <AlertTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                  <span className="text-sm text-yellow-700 dark:text-yellow-400">
                    {issue}
                  </span>
                </div>
              ))}
            </div>
          )}
          
          <div className="mt-4 text-xs text-neutral-600 dark:text-neutral-400">
            Last updated: {new Date(health.lastUpdate).toLocaleString()}
          </div>
        </motion.div>
      )}
      
      {/* Rolling Metrics */}
      {metrics && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 shadow-lg"
        >
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-4">
            Rolling Metrics
          </h3>
          
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="p-4 rounded-lg bg-neutral-50 dark:bg-neutral-800/50">
              <div className="text-xs text-neutral-600 dark:text-neutral-400 mb-1">
                Total Predictions
              </div>
              <div className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                {metrics.totalPredictions}
              </div>
            </div>
            
            <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-900/20">
              <div className="text-xs text-neutral-600 dark:text-neutral-400 mb-1">
                Correct
              </div>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {metrics.correctPredictions}
              </div>
            </div>
            
            <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20">
              <div className="text-xs text-neutral-600 dark:text-neutral-400 mb-1">
                Bets Placed
              </div>
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {metrics.totalBets}
              </div>
            </div>
            
            <div className="p-4 rounded-lg bg-purple-50 dark:bg-purple-900/20">
              <div className="text-xs text-neutral-600 dark:text-neutral-400 mb-1">
                Total Profit
              </div>
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                ₦{metrics.totalProfit.toFixed(0)}
              </div>
            </div>
          </div>
          
          {/* By Outcome */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
              Accuracy by Outcome
            </h4>
            <div className="grid grid-cols-3 gap-4">
              <OutcomeCard
                label="Home Wins"
                accuracy={metrics.byOutcome.home.accuracy}
                total={metrics.byOutcome.home.total}
                correct={metrics.byOutcome.home.correct}
              />
              <OutcomeCard
                label="Draws"
                accuracy={metrics.byOutcome.draw.accuracy}
                total={metrics.byOutcome.draw.total}
                correct={metrics.byOutcome.draw.correct}
              />
              <OutcomeCard
                label="Away Wins"
                accuracy={metrics.byOutcome.away.accuracy}
                total={metrics.byOutcome.away.total}
                correct={metrics.byOutcome.away.correct}
              />
            </div>
          </div>
        </motion.div>
      )}
      
      {/* Drift Detection */}
      {drift && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 shadow-lg"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
              Model Drift Detection
            </h3>
            <DriftBadge severity={drift.severity} />
          </div>
          
          <p className="text-sm text-neutral-700 dark:text-neutral-300 mb-4">
            {drift.recommendation}
          </p>
          
          {drift.driftDetected && (
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20">
                <div className="text-xs text-neutral-600 dark:text-neutral-400 mb-1">
                  Accuracy Drift
                </div>
                <div className="text-xl font-bold text-red-600 dark:text-red-400">
                  {(drift.metrics.accuracyDrift * 100).toFixed(1)}%
                </div>
              </div>
              
              <div className="p-4 rounded-lg bg-yellow-50 dark:bg-yellow-900/20">
                <div className="text-xs text-neutral-600 dark:text-neutral-400 mb-1">
                  Brier Drift
                </div>
                <div className="text-xl font-bold text-yellow-600 dark:text-yellow-400">
                  {(drift.metrics.brierDrift * 100).toFixed(1)}%
                </div>
              </div>
              
              <div className="p-4 rounded-lg bg-orange-50 dark:bg-orange-900/20">
                <div className="text-xs text-neutral-600 dark:text-neutral-400 mb-1">
                  ROI Drift
                </div>
                <div className="text-xl font-bold text-orange-600 dark:text-orange-400">
                  {drift.metrics.roiDrift.toFixed(1)}%
                </div>
              </div>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: 'healthy' | 'degraded' | 'critical' }) {
  const config = {
    healthy: {
      icon: CheckCircle,
      className: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
      label: 'Healthy',
    },
    degraded: {
      icon: AlertTriangle,
      className: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
      label: 'Degraded',
    },
    critical: {
      icon: XCircle,
      className: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
      label: 'Critical',
    },
  };
  
  const { icon: Icon, className, label } = config[status];
  
  return (
    <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${className}`}>
      <Icon className="w-3 h-3" />
      {label}
    </div>
  );
}

function DriftBadge({ severity }: { severity: 'none' | 'low' | 'medium' | 'high' | 'critical' }) {
  const config = {
    none: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
    low: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
    medium: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
    high: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400',
    critical: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
  };
  
  return (
    <div className={`px-3 py-1 rounded-full text-xs font-medium uppercase ${config[severity]}`}>
      {severity}
    </div>
  );
}

function MetricCard({ label, value, status }: { label: string; value: string; status: 'good' | 'warning' | 'critical' }) {
  const colors = {
    good: 'text-emerald-600 dark:text-emerald-400',
    warning: 'text-yellow-600 dark:text-yellow-400',
    critical: 'text-red-600 dark:text-red-400',
  };
  
  return (
    <div className="p-4 rounded-lg bg-neutral-50 dark:bg-neutral-800/50">
      <div className="text-xs text-neutral-600 dark:text-neutral-400 mb-1">
        {label}
      </div>
      <div className={`text-2xl font-bold ${colors[status]}`}>
        {value}
      </div>
    </div>
  );
}

function OutcomeCard({ label, accuracy, total, correct }: {
  label: string;
  accuracy: number;
  total: number;
  correct: number;
}) {
  return (
    <div className="p-4 rounded-lg bg-neutral-50 dark:bg-neutral-800/50">
      <div className="text-xs text-neutral-600 dark:text-neutral-400 mb-1">
        {label}
      </div>
      <div className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
        {(accuracy * 100).toFixed(1)}%
      </div>
      <div className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">
        {correct}/{total}
      </div>
    </div>
  );
}

export function MonitoringDashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 shadow-lg animate-pulse">
        <div className="h-6 bg-neutral-200 dark:bg-neutral-800 rounded w-1/4 mb-4" />
        <div className="grid grid-cols-3 gap-4">
          <div className="h-20 bg-neutral-200 dark:bg-neutral-800 rounded" />
          <div className="h-20 bg-neutral-200 dark:bg-neutral-800 rounded" />
          <div className="h-20 bg-neutral-200 dark:bg-neutral-800 rounded" />
        </div>
      </div>
    </div>
  );
}
