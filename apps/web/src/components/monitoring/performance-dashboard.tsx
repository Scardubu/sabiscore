/**
 * Performance Monitoring Dashboard
 * 
 * Real-time visualization of model performance, drift detection, and betting metrics.
 */

'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Activity, TrendingUp, AlertTriangle, CheckCircle, XCircle, Target, Download, FileJson, FileSpreadsheet } from 'lucide-react';
import type { HealthMetrics, DriftReport } from '@/lib/monitoring/free-analytics';

export function PerformanceDashboard() {
  const [health, setHealth] = useState<HealthMetrics | null>(null);
  const [drift, setDrift] = useState<DriftReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDashboardData();
    const interval = setInterval(loadDashboardData, 30000); // Update every 30s
    return () => clearInterval(interval);
  }, []);

  async function loadDashboardData() {
    try {
      setLoading(true);
      setError(null);

      const [healthResponse, driftResponse] = await Promise.all([
        fetch('/api/health'),
        fetch('/api/drift'),
      ]);

      if (healthResponse.ok) {
        const healthData = await healthResponse.json();
        setHealth(healthData);
      }

      if (driftResponse.ok) {
        const driftData = await driftResponse.json();
        setDrift(driftData);
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  if (loading && !health) {
    return (
      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-8">
        <div className="flex items-center justify-center gap-3">
          <Activity className="w-5 h-5 animate-pulse" />
          <span className="text-sm text-muted-foreground">Loading dashboard...</span>
        </div>
      </div>
    );
  }

  if (error && !health) {
    return (
      <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10 p-6">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
          <span className="text-sm text-red-600 dark:text-red-400">{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Health Status Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6"
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold">System Health</h3>
          <StatusBadge status={health?.status || 'unknown'} />
        </div>

        {health && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <MetricCard
              label="Accuracy"
              value={`${(health.accuracy * 100).toFixed(1)}%`}
              target={75}
              current={health.accuracy * 100}
              icon={Target}
              color="blue"
            />
            <MetricCard
              label="Brier Score"
              value={health.brierScore.toFixed(3)}
              target={0.25}
              current={health.brierScore}
              icon={Activity}
              color="purple"
              inverse
            />
            <MetricCard
              label="ROI"
              value={`${health.roi > 0 ? '+' : ''}${health.roi.toFixed(1)}%`}
              target={0}
              current={health.roi}
              icon={TrendingUp}
              color={health.roi >= 0 ? 'green' : 'red'}
            />
          </div>
        )}

        {health?.issues && health.issues.length > 0 && (
          <div className="mt-4 p-4 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-amber-900 dark:text-amber-100 mb-2">Issues Detected</p>
                <ul className="text-sm text-amber-700 dark:text-amber-300 space-y-1">
                  {health.issues.map((issue, i) => (
                    <li key={i}>• {issue}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </motion.div>

      {/* Drift Detection Card */}
      {drift && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold">Model Drift Detection</h3>
            <DriftBadge severity={drift.severity} />
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <DriftMetric
                label="Accuracy Drift"
                value={`${(drift.metrics.accuracyDrift * 100).toFixed(2)}%`}
                severity={drift.metrics.accuracyDrift > 0.05 ? 'high' : drift.metrics.accuracyDrift > 0.03 ? 'medium' : 'low'}
              />
              <DriftMetric
                label="Brier Drift"
                value={drift.metrics.brierDrift.toFixed(3)}
                severity={drift.metrics.brierDrift > 0.03 ? 'high' : drift.metrics.brierDrift > 0.02 ? 'medium' : 'low'}
              />
              <DriftMetric
                label="ROI Drift"
                value={`${drift.metrics.roiDrift > 0 ? '+' : ''}${drift.metrics.roiDrift.toFixed(1)}%`}
                severity={Math.abs(drift.metrics.roiDrift) > 5 ? 'high' : Math.abs(drift.metrics.roiDrift) > 3 ? 'medium' : 'low'}
              />
            </div>

            {drift.driftDetected && (
              <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800">
                <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">Recommendation</p>
                <p className="text-sm text-blue-700 dark:text-blue-300">{drift.recommendation}</p>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Prediction Stats Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Prediction Statistics</h3>
          <ExportButton predictionCount={health?.predictionCount || 0} />
        </div>
        {health && (
          <div className="text-sm text-muted-foreground">
            <p>Total Predictions: <span className="font-medium text-foreground">{health.predictionCount}</span></p>
            <p className="mt-2 text-xs">Last Updated: {new Date(health.lastUpdate).toLocaleString()}</p>
          </div>
        )}
      </motion.div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const variants = {
    healthy: {
      bg: 'bg-green-100 dark:bg-green-900/20',
      text: 'text-green-700 dark:text-green-400',
      icon: CheckCircle,
    },
    degraded: {
      bg: 'bg-amber-100 dark:bg-amber-900/20',
      text: 'text-amber-700 dark:text-amber-400',
      icon: AlertTriangle,
    },
    critical: {
      bg: 'bg-red-100 dark:bg-red-900/20',
      text: 'text-red-700 dark:text-red-400',
      icon: XCircle,
    },
    unknown: {
      bg: 'bg-gray-100 dark:bg-gray-900/20',
      text: 'text-gray-700 dark:text-gray-400',
      icon: Activity,
    },
  };

  const variant = variants[status as keyof typeof variants] || variants.unknown;
  const Icon = variant.icon;

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${variant.bg}`}>
      <Icon className={`w-4 h-4 ${variant.text}`} />
      <span className={`text-sm font-medium capitalize ${variant.text}`}>{status}</span>
    </div>
  );
}

function DriftBadge({ severity }: { severity: string }) {
  const colors = {
    none: 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400',
    low: 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400',
    medium: 'bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400',
    high: 'bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400',
    critical: 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400',
  };

  const colorClass = colors[severity as keyof typeof colors] || colors.none;

  return (
    <div className={`px-3 py-1.5 rounded-full ${colorClass}`}>
      <span className="text-sm font-medium capitalize">{severity}</span>
    </div>
  );
}

interface MetricCardProps {
  label: string;
  value: string;
  target: number;
  current: number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  inverse?: boolean;
}

function MetricCard({ label, value, target, current, icon: Icon, color, inverse = false }: MetricCardProps) {
  const isGood = inverse ? current <= target : current >= target;
  
  const colorClasses = {
    blue: 'text-blue-600 dark:text-blue-400',
    purple: 'text-purple-600 dark:text-purple-400',
    green: 'text-green-600 dark:text-green-400',
    red: 'text-red-600 dark:text-red-400',
  };

  return (
    <div className="p-4 rounded-lg border border-neutral-200 dark:border-neutral-800">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${colorClasses[color as keyof typeof colorClasses]}`} />
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <p className="text-2xl font-bold">{value}</p>
      <div className="mt-2 flex items-center gap-2">
        {isGood ? (
          <CheckCircle className="w-3 h-3 text-green-600 dark:text-green-400" />
        ) : (
          <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400" />
        )}
        <span className="text-xs text-muted-foreground">
          Target: {inverse ? '≤' : '≥'} {target}{label === 'Accuracy' ? '%' : ''}
        </span>
      </div>
    </div>
  );
}

function DriftMetric({ label, value, severity }: { label: string; value: string; severity: string }) {
  const colors = {
    low: 'text-green-600 dark:text-green-400',
    medium: 'text-amber-600 dark:text-amber-400',
    high: 'text-red-600 dark:text-red-400',
  };

  return (
    <div className="text-center">
      <p className="text-sm text-muted-foreground mb-1">{label}</p>
      <p className={`text-xl font-bold ${colors[severity as keyof typeof colors] || colors.low}`}>
        {value}
      </p>
    </div>
  );
}

function ExportButton({ predictionCount }: { predictionCount: number }) {
  const [isExporting, setIsExporting] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  async function handleExport(format: 'json' | 'csv') {
    setIsExporting(true);
    setShowMenu(false);

    try {
      const response = await fetch(`/api/monitoring/export?format=${format}`);
      
      if (!response.ok) {
        throw new Error('Export failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sabiscore-monitoring-${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export error:', error);
      alert('Export failed. Please try again.');
    } finally {
      setIsExporting(false);
    }
  }

  if (predictionCount === 0) {
    return null;
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        disabled={isExporting}
        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors disabled:opacity-50"
        aria-label="Export data"
      >
        {isExporting ? (
          <Activity className="w-4 h-4 animate-spin" />
        ) : (
          <Download className="w-4 h-4" />
        )}
        Export
      </button>

      {showMenu && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setShowMenu(false)}
          />
          <div className="absolute right-0 top-full mt-2 w-48 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-lg z-20">
            <div className="p-2 space-y-1">
              <button
                onClick={() => handleExport('json')}
                className="w-full flex items-center gap-3 px-3 py-2 text-sm text-left hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-md transition-colors"
              >
                <FileJson className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <div>
                  <div className="font-medium">JSON</div>
                  <div className="text-xs text-muted-foreground">Full data export</div>
                </div>
              </button>
              <button
                onClick={() => handleExport('csv')}
                className="w-full flex items-center gap-3 px-3 py-2 text-sm text-left hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-md transition-colors"
              >
                <FileSpreadsheet className="w-4 h-4 text-green-600 dark:text-green-400" />
                <div>
                  <div className="font-medium">CSV</div>
                  <div className="text-xs text-muted-foreground">Spreadsheet format</div>
                </div>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
