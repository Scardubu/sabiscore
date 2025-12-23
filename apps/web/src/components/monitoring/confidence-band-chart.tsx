/**
 * Confidence Band Chart
 * 
 * Visualizes prediction accuracy stratified by confidence levels.
 * Shows calibration quality and identifies confidence ranges where model performs well/poorly.
 */

'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, AlertCircle, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ConfidenceBandData {
  band: string;
  minConfidence: number;
  maxConfidence: number;
  accuracy: number;
  count: number;
  expectedAccuracy: number; // Average confidence in this band
  calibrationError: number;
}

export interface ConfidenceBandChartProps {
  className?: string;
}

export function ConfidenceBandChart({ className }: ConfidenceBandChartProps) {
  const [bands, setBands] = useState<ConfidenceBandData[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    loadConfidenceBands();
    const interval = setInterval(loadConfidenceBands, 60000); // Update every minute
    return () => clearInterval(interval);
  }, []);
  
  async function loadConfidenceBands() {
    try {
      const response = await fetch('/api/monitoring/confidence-bands');
      if (response.ok) {
        const data = await response.json();
        setBands(data.bands || []);
      }
    } catch (error) {
      console.error('Failed to load confidence bands:', error);
    } finally {
      setLoading(false);
    }
  }
  
  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-purple-500" />
            Confidence Band Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-12">
            <div className="animate-pulse text-muted-foreground">Loading...</div>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  if (bands.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-purple-500" />
            Confidence Band Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            No confidence data available yet. Make predictions to see analysis.
          </div>
        </CardContent>
      </Card>
    );
  }
  
  const maxCount = Math.max(...bands.map(b => b.count));
  
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-purple-500" />
          Confidence Band Analysis
        </CardTitle>
        <p className="text-sm text-muted-foreground mt-2">
          Accuracy breakdown by prediction confidence level
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Band Visualization */}
        <div className="space-y-4">
          {bands.map((band, index) => (
            <ConfidenceBandRow
              key={band.band}
              band={band}
              maxCount={maxCount}
              index={index}
            />
          ))}
        </div>
        
        {/* Calibration Summary */}
        <div className="pt-4 border-t border-slate-800">
          <h4 className="text-sm font-medium mb-3">Calibration Quality</h4>
          <div className="grid grid-cols-2 gap-4">
            <CalibrationMetric
              label="Well Calibrated"
              count={bands.filter(b => Math.abs(b.calibrationError) < 0.05).length}
              total={bands.length}
              color="green"
            />
            <CalibrationMetric
              label="Needs Attention"
              count={bands.filter(b => Math.abs(b.calibrationError) >= 0.05).length}
              total={bands.length}
              color="yellow"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ConfidenceBandRow({
  band,
  maxCount,
  index,
}: {
  band: ConfidenceBandData;
  maxCount: number;
  index: number;
}) {
  const isWellCalibrated = Math.abs(band.calibrationError) < 0.05;
  const accuracyPercent = band.accuracy * 100;
  const expectedPercent = band.expectedAccuracy * 100;
  const barWidth = maxCount > 0 ? (band.count / maxCount) * 100 : 0;
  
  // Color based on calibration quality
  let barColor = 'from-purple-500/80 to-pink-500/80';
  if (isWellCalibrated) {
    barColor = 'from-green-500/80 to-emerald-500/80';
  } else if (Math.abs(band.calibrationError) > 0.1) {
    barColor = 'from-red-500/80 to-orange-500/80';
  } else {
    barColor = 'from-yellow-500/80 to-orange-500/80';
  }
  
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.1 }}
      className="space-y-2"
    >
      {/* Band Header */}
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <span className="font-medium">{band.band}</span>
          <span className="text-xs text-muted-foreground">
            ({band.minConfidence}-{band.maxConfidence}%)
          </span>
          {isWellCalibrated ? (
            <CheckCircle className="h-3 w-3 text-green-400" />
          ) : (
            <AlertCircle className="h-3 w-3 text-yellow-400" />
          )}
        </div>
        <span className="text-xs text-muted-foreground">
          {band.count} predictions
        </span>
      </div>
      
      {/* Accuracy Bar */}
      <div className="relative h-12 bg-slate-800 rounded-lg overflow-hidden">
        <motion.div
          className={cn('h-full bg-gradient-to-r', barColor)}
          initial={{ width: 0 }}
          animate={{ width: `${barWidth}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
        
        {/* Accuracy vs Expected Markers */}
        <div className="absolute inset-0 flex items-center px-3 justify-between">
          <div className="flex items-center gap-3">
            <div className="text-xs font-medium text-white drop-shadow">
              Accuracy: {accuracyPercent.toFixed(1)}%
            </div>
            <div className="text-xs text-white/70 drop-shadow">
              Expected: {expectedPercent.toFixed(1)}%
            </div>
          </div>
          
          <div
            className={cn(
              'text-xs font-medium px-2 py-1 rounded',
              isWellCalibrated
                ? 'bg-green-500/30 text-green-200'
                : 'bg-yellow-500/30 text-yellow-200'
            )}
          >
            {band.calibrationError > 0 ? '+' : ''}{(band.calibrationError * 100).toFixed(1)}%
          </div>
        </div>
      </div>
      
      {/* Calibration Indicator */}
      <div className="flex items-center gap-2 text-xs">
        <div className="flex-1 h-1 bg-slate-700 rounded-full overflow-hidden relative">
          {/* Expected accuracy line */}
          <motion.div
            className="absolute h-full w-0.5 bg-white/50"
            initial={{ left: `${expectedPercent}%` }}
            animate={{ left: `${expectedPercent}%` }}
            transition={{ duration: 0.001 }}
          />
          {/* Actual accuracy marker */}
          <motion.div
            className="absolute h-full w-1 bg-white rounded-full"
            initial={{ left: `${expectedPercent}%` }}
            animate={{ left: `${accuracyPercent}%` }}
            transition={{ duration: 0.8 }}
          />
        </div>
      </div>
    </motion.div>
  );
}

function CalibrationMetric({
  label,
  count,
  total,
  color,
}: {
  label: string;
  count: number;
  total: number;
  color: 'green' | 'yellow' | 'red';
}) {
  const percentage = total > 0 ? (count / total) * 100 : 0;
  
  const colorClasses = {
    green: 'text-green-400 bg-green-500/20',
    yellow: 'text-yellow-400 bg-yellow-500/20',
    red: 'text-red-400 bg-red-500/20',
  };
  
  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50">
      <span className="text-sm">{label}</span>
      <div className={cn('px-2 py-1 rounded text-xs font-medium', colorClasses[color])}>
        {count}/{total} ({percentage.toFixed(0)}%)
      </div>
    </div>
  );
}

/**
 * Calibration Curve Component
 * Shows perfect calibration line vs actual calibration
 */
export function CalibrationCurve({ className }: { className?: string }) {
  const [curveData, setCurveData] = useState<{ predicted: number; actual: number }[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    loadCalibrationCurve();
  }, []);
  
  async function loadCalibrationCurve() {
    try {
      const response = await fetch('/api/monitoring/calibration-curve');
      if (response.ok) {
        const data = await response.json();
        setCurveData(data.curve || []);
      }
    } catch (error) {
      console.error('Failed to load calibration curve:', error);
    } finally {
      setLoading(false);
    }
  }
  
  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Calibration Curve</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-12">
            <div className="animate-pulse text-muted-foreground">Loading...</div>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Calibration Curve</CardTitle>
        <p className="text-sm text-muted-foreground">
          Predicted probability vs actual outcome frequency
        </p>
      </CardHeader>
      <CardContent>
        <div className="relative w-full h-64 bg-slate-900 rounded-lg p-4">
          <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            {/* Perfect calibration line */}
            <line
              x1="0"
              y1="100"
              x2="100"
              y2="0"
              stroke="currentColor"
              strokeWidth="0.5"
              strokeDasharray="2,2"
              className="text-slate-600"
            />
            
            {/* Actual calibration curve */}
            {curveData.length > 1 && (
              <polyline
                points={curveData
                  .map(point => `${point.predicted * 100},${100 - point.actual * 100}`)
                  .join(' ')}
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="text-purple-400"
              />
            )}
            
            {/* Data points */}
            {curveData.map((point, i) => (
              <circle
                key={i}
                cx={point.predicted * 100}
                cy={100 - point.actual * 100}
                r="1.5"
                fill="currentColor"
                className="text-purple-300"
              />
            ))}
          </svg>
          
          {/* Axis labels */}
          <div className="absolute bottom-0 left-0 right-0 flex justify-between text-xs text-muted-foreground px-4 pb-2">
            <span>0%</span>
            <span>Predicted Probability</span>
            <span>100%</span>
          </div>
          <div className="absolute top-0 left-0 bottom-0 flex flex-col justify-between text-xs text-muted-foreground py-4">
            <span>100%</span>
            <span className="transform -rotate-90">Actual Frequency</span>
            <span>0%</span>
          </div>
        </div>
        
        <div className="mt-4 flex items-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-4 h-0.5 bg-slate-600 border-dashed border-t" />
            <span className="text-muted-foreground">Perfect Calibration</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-0.5 bg-purple-400" />
            <span className="text-muted-foreground">Actual Calibration</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
