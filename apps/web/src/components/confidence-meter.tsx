/**
 * Confidence Meter Visualization
 * 
 * Progressive confidence meter with model agreement indicators.
 * Helps users understand prediction reliability.
 * 
 * Impact: Better user trust, clearer decision-making
 */

'use client';

import { motion } from 'framer-motion';
import { AlertCircle, CheckCircle2, AlertTriangle, TrendingUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export interface ConfidenceMeterProps {
  confidence: number;           // 0-1
  ensembleAgreement?: number;   // 0-1
  poissonAgreement?: number;    // 0-1
  disagreementSeverity?: 'low' | 'medium' | 'high' | 'critical';
  showDetails?: boolean;
}

export function ConfidenceMeter({
  confidence,
  ensembleAgreement,
  poissonAgreement,
  disagreementSeverity,
  showDetails = false,
}: ConfidenceMeterProps) {
  // Determine confidence level
  const level = getConfidenceLevel(confidence);
  
  // Color scheme based on confidence
  const colors = {
    high: {
      bg: 'bg-green-100 dark:bg-green-950',
      bar: 'bg-gradient-to-r from-green-500 to-emerald-600',
      text: 'text-green-700 dark:text-green-300',
      icon: CheckCircle2,
    },
    medium: {
      bg: 'bg-yellow-100 dark:bg-yellow-950',
      bar: 'bg-gradient-to-r from-yellow-500 to-amber-600',
      text: 'text-yellow-700 dark:text-yellow-300',
      icon: TrendingUp,
    },
    low: {
      bg: 'bg-red-100 dark:bg-red-950',
      bar: 'bg-gradient-to-r from-red-500 to-rose-600',
      text: 'text-red-700 dark:text-red-300',
      icon: AlertCircle,
    },
  };
  
  const theme = colors[level];
  const Icon = theme.icon;
  
  return (
    <div className="space-y-3">
      {/* Main Confidence Display */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className={cn('h-5 w-5', theme.text)} />
          <span className="text-sm font-medium text-muted-foreground">
            Model Confidence
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn('text-2xl font-bold', theme.text)}>
            {(confidence * 100).toFixed(1)}%
          </span>
          <span className={cn('text-xs px-2 py-1 rounded-full', theme.bg, theme.text)}>
            {level.toUpperCase()}
          </span>
        </div>
      </div>
      
      {/* Animated Progress Bar */}
      <div className="relative h-3 bg-muted rounded-full overflow-hidden">
        <motion.div
          className={cn('h-full rounded-full', theme.bar)}
          initial={{ width: 0 }}
          animate={{ width: `${confidence * 100}%` }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
      </div>
      
      {/* Disagreement Warning */}
      {disagreementSeverity && disagreementSeverity !== 'low' && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className={cn(
            'flex items-start gap-2 p-3 rounded-lg text-sm',
            disagreementSeverity === 'critical' && 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300',
            disagreementSeverity === 'high' && 'bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-300',
            disagreementSeverity === 'medium' && 'bg-yellow-100 dark:bg-yellow-950 text-yellow-700 dark:text-yellow-300'
          )}
        >
          <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-medium">Model Disagreement Detected</p>
            <p className="text-xs mt-1 opacity-80">
              {disagreementSeverity === 'critical' && 'Models strongly disagree - avoid betting on this match'}
              {disagreementSeverity === 'high' && 'High disagreement - proceed with extreme caution'}
              {disagreementSeverity === 'medium' && 'Moderate disagreement - consider reducing stake'}
            </p>
          </div>
        </motion.div>
      )}
      
      {/* Detailed Metrics */}
      {showDetails && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          transition={{ delay: 0.4 }}
          className="pt-3 border-t"
        >
          <div className="grid grid-cols-2 gap-3 text-sm">
            {ensembleAgreement !== undefined && (
              <MetricBadge
                label="Neural Agreement"
                value={ensembleAgreement}
                tooltip="Agreement between Dense, LSTM, and CNN models"
              />
            )}
            {poissonAgreement !== undefined && (
              <MetricBadge
                label="Statistical Alignment"
                value={poissonAgreement}
                tooltip="Agreement between neural models and Poisson distribution"
              />
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
}

/**
 * Compact confidence badge for inline display
 */
export function ConfidenceBadge({ confidence }: { confidence: number }) {
  const level = getConfidenceLevel(confidence);
  
  const colors = {
    high: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',
    medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300',
    low: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
  };
  
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium', colors[level])}>
      <span className="relative flex h-2 w-2">
        <span className={cn(
          'animate-ping absolute inline-flex h-full w-full rounded-full opacity-75',
          level === 'high' && 'bg-green-500',
          level === 'medium' && 'bg-yellow-500',
          level === 'low' && 'bg-red-500'
        )} />
        <span className={cn(
          'relative inline-flex rounded-full h-2 w-2',
          level === 'high' && 'bg-green-600',
          level === 'medium' && 'bg-yellow-600',
          level === 'low' && 'bg-red-600'
        )} />
      </span>
      {(confidence * 100).toFixed(0)}%
    </span>
  );
}

/**
 * Agreement metrics card
 */
export function ModelAgreementCard({
  ensembleAgreement,
  poissonAgreement,
  disagreementAnalysis,
}: {
  ensembleAgreement: number;
  poissonAgreement?: number;
  disagreementAnalysis?: {
    severity: 'low' | 'medium' | 'high' | 'critical';
    details: {
      standardDeviation: number;
      outliers: string[];
    };
  };
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          Model Agreement Analysis
        </h4>
        
        <div className="space-y-3">
          <AgreementBar
            label="Neural Ensemble"
            value={ensembleAgreement}
            description="Agreement between Dense, LSTM, CNN"
          />
          
          {poissonAgreement !== undefined && (
            <AgreementBar
              label="Statistical Alignment"
              value={poissonAgreement}
              description="Neural vs Poisson distribution"
            />
          )}
          
          {disagreementAnalysis && disagreementAnalysis.details.outliers.length > 0 && (
            <div className="pt-2 border-t">
              <p className="text-xs text-muted-foreground mb-1">Outlier Models:</p>
              <div className="flex flex-wrap gap-1">
                {disagreementAnalysis.details.outliers.map((outlier, i) => (
                  <span key={i} className="text-xs px-2 py-1 bg-muted rounded">
                    {outlier}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Helper Components
// ============================================================================

function MetricBadge({
  label,
  value,
  tooltip,
}: {
  label: string;
  value: number;
  tooltip?: string;
}) {
  const agreement = getAgreementLevel(value);
  
  return (
    <div className="flex items-center justify-between p-2 bg-muted rounded-lg" title={tooltip}>
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn(
        'text-sm font-semibold',
        agreement === 'high' && 'text-green-600 dark:text-green-400',
        agreement === 'medium' && 'text-yellow-600 dark:text-yellow-400',
        agreement === 'low' && 'text-red-600 dark:text-red-400'
      )}>
        {(value * 100).toFixed(0)}%
      </span>
    </div>
  );
}

function AgreementBar({
  label,
  value,
  description,
}: {
  label: string;
  value: number;
  description: string;
}) {
  const agreement = getAgreementLevel(value);
  
  const barColor = {
    high: 'bg-green-500',
    medium: 'bg-yellow-500',
    low: 'bg-red-500',
  };
  
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium">{label}</span>
        <span className="text-xs text-muted-foreground">{(value * 100).toFixed(0)}%</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <motion.div
          className={barColor[agreement]}
          initial={{ width: 0 }}
          animate={{ width: `${value * 100}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </div>
      <p className="text-xs text-muted-foreground mt-1">{description}</p>
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function getConfidenceLevel(confidence: number): 'low' | 'medium' | 'high' {
  if (confidence >= 0.75) return 'high';
  if (confidence >= 0.60) return 'medium';
  return 'low';
}

function getAgreementLevel(agreement: number): 'low' | 'medium' | 'high' {
  if (agreement >= 0.85) return 'high';
  if (agreement >= 0.70) return 'medium';
  return 'low';
}
