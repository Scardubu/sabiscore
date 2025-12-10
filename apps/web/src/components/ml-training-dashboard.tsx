/**
 * ML Training Dashboard
 * 
 * Interactive training interface for TensorFlow.js ensemble models.
 * Browser-based training using StatsBomb open data.
 */

'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, CheckCircle, AlertTriangle, Database, Zap, TrendingUp } from 'lucide-react';
import { trainFreeModels, type FreeTrainingConfig, type TrainingResult } from '@/lib/ml/train-tfjs-free';

export function MLTrainingDashboard() {
  const [training, setTraining] = useState(false);
  const [config] = useState<Partial<FreeTrainingConfig>>({
    minMatches: 300,
    validationSplit: 0.2,
    epochs: 50,
    batchSize: 32,
    competitions: [11, 9, 37], // La Liga, Premier League, NWSL (StatsBomb competition IDs)
  });
  const [progress, setProgress] = useState<{ message: string; progress: number; phase: string } | null>(null);
  const [result, setResult] = useState<TrainingResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function startTraining() {
    setTraining(true);
    setError(null);
    setResult(null);

    try {
      const trainingResult = await trainFreeModels((message: string, progressNum: number, phase: string) => {
        setProgress({ message, progress: progressNum, phase });
      });

      setResult(trainingResult);
    } catch (err) {
      console.error('Training failed:', err);
      setError(err instanceof Error ? err.message : 'Training failed');
    } finally {
      setTraining(false);
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 p-6">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-neutral-900 dark:text-neutral-100 mb-2">
          ML Training Dashboard
        </h1>
        <p className="text-neutral-600 dark:text-neutral-400">
          Train TensorFlow.js ensemble models using StatsBomb open data
        </p>
      </div>

      {/* Configuration Panel */}
      {!training && !result && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 shadow-lg"
        >
          <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100 mb-6">
            Training Configuration
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                Minimum Matches
              </div>
              <div className="w-full px-4 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100">
                {config.minMatches}
              </div>
            </div>

            <div>
              <div className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                Validation Split
              </div>
              <div className="w-full px-4 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100">
                {config.validationSplit}
              </div>
            </div>

            <div>
              <div className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                Epochs
              </div>
              <div className="w-full px-4 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100">
                {config.epochs}
              </div>
            </div>

            <div>
              <div className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                Batch Size
              </div>
              <div className="w-full px-4 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100">
                {config.batchSize}
              </div>
            </div>
          </div>

          <div className="mt-6">
            <button
              onClick={startTraining}
              className="w-full px-6 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium transition-colors flex items-center justify-center gap-2"
            >
              <Zap className="w-5 h-5" />
              Start Training
            </button>
          </div>
        </motion.div>
      )}

      {/* Training Progress */}
      {training && progress && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 shadow-lg"
        >
          <div className="flex items-center gap-4 mb-6">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-600 dark:text-emerald-400" />
            <div>
              <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
                Training in Progress
              </h2>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                Phase: {progress.phase}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <MetricCard
              icon={<Database className="w-5 h-5" />}
              label="Progress"
              value={`${progress.progress.toFixed(0)}%`}
            />
            <MetricCard
              icon={<TrendingUp className="w-5 h-5" />}
              label="Message"
              value={progress.message}
            />
          </div>
        </motion.div>
      )}

      {/* Training Result */}
      {result && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 p-6 shadow-lg"
        >
          <div className="flex items-center gap-4 mb-6">
            <CheckCircle className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
            <div>
              <h2 className="text-xl font-semibold text-emerald-900 dark:text-emerald-100">
                Training Complete!
              </h2>
              <p className="text-sm text-emerald-700 dark:text-emerald-300">
                Models saved to browser storage
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <ResultCard
              label="Ensemble Accuracy"
              value={result.metrics?.ensembleAccuracy ? `${(result.metrics.ensembleAccuracy * 100).toFixed(1)}%` : 'N/A'}
              color="emerald"
            />
            <ResultCard
              label="Brier Score"
              value={result.metrics?.calibratedBrier ? result.metrics.calibratedBrier.toFixed(3) : 'N/A'}
              color="blue"
            />
            <ResultCard
              label="Training Samples"
              value={result.datasetStats?.totalSamples.toString() || 'N/A'}
              color="purple"
            />
          </div>

          <div className="mt-6">
            <button
              onClick={() => {
                setResult(null);
                setProgress(null);
              }}
              className="w-full px-6 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium transition-colors"
            >
              Train Again
            </button>
          </div>
        </motion.div>
      )}

      {/* Error State */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-6 shadow-lg"
        >
          <div className="flex items-start gap-4">
            <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-red-900 dark:text-red-100 mb-2">
                Training Failed
              </h3>
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}

function MetricCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className="flex items-center gap-3 p-4 rounded-lg bg-neutral-50 dark:bg-neutral-800/50">
      <div className="text-emerald-600 dark:text-emerald-400">{icon}</div>
      <div className="flex-1">
        <div className="text-sm text-neutral-600 dark:text-neutral-400">{label}</div>
        <div className="text-lg font-bold text-neutral-900 dark:text-neutral-100">{value}</div>
      </div>
    </div>
  );
}

function ResultCard({ label, value, color }: { label: string; value: string; color: string }) {
  const colorClasses = {
    emerald: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
    blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
    purple: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400',
  };

  return (
    <div className={`rounded-lg p-4 ${colorClasses[color as keyof typeof colorClasses]}`}>
      <div className="text-xs font-medium uppercase mb-2">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}
