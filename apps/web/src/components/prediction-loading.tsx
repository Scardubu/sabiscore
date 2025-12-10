/**
 * Prediction Loading State
 * 
 * Animated loading placeholder for predictions.
 */

'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';

export function PredictionLoading() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 shadow-lg"
    >
      <div className="flex items-center justify-center py-12">
        <div className="text-center space-y-4">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            className="inline-block"
          >
            <Loader2 className="w-12 h-12 text-emerald-600 dark:text-emerald-400" />
          </motion.div>
          <div>
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-1">
              Analyzing Match...
            </h3>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              Running ensemble models and calibrating probabilities
            </p>
          </div>
          
          {/* Progress Steps */}
          <div className="flex items-center justify-center gap-2 pt-4">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="w-2 h-2 rounded-full bg-emerald-600 dark:bg-emerald-400"
                animate={{
                  scale: [1, 1.5, 1],
                  opacity: [0.3, 1, 0.3],
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  delay: i * 0.2,
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export function PredictionSkeleton() {
  return (
    <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 shadow-lg animate-pulse">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div className="h-6 w-48 bg-neutral-200 dark:bg-neutral-800 rounded" />
          <div className="h-6 w-24 bg-neutral-200 dark:bg-neutral-800 rounded-full" />
        </div>
        
        {/* Probabilities */}
        <div className="grid grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 w-16 bg-neutral-200 dark:bg-neutral-800 rounded" />
              <div className="h-2 w-full bg-neutral-200 dark:bg-neutral-800 rounded-full" />
            </div>
          ))}
        </div>
        
        {/* Details */}
        <div className="space-y-2 pt-4">
          <div className="h-4 w-full bg-neutral-200 dark:bg-neutral-800 rounded" />
          <div className="h-4 w-3/4 bg-neutral-200 dark:bg-neutral-800 rounded" />
        </div>
      </div>
    </div>
  );
}
