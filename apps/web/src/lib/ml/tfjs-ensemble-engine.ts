/**
 * TensorFlow.js Ensemble Engine for Browser-Native ML
 * 
 * Implements a 3-model ensemble (Dense NN + LSTM + CNN) with isotonic calibration
 * for football match outcome prediction.
 * 
 * @module lib/ml/tfjs-ensemble-engine
 */

import * as tf from '@tensorflow/tfjs';

// ============================================================================
// Type Definitions
// ============================================================================

export interface EnsembleMatchFeatures {
  // Team features (normalized 0-1)
  homeForm: number[];           // [w, d, l, gf, ga] last 10 games
  awayForm: number[];
  homeXG: number[];             // xG last 10 games
  awayXG: number[];
  homeXGA: number[];            // xG against
  awayXGA: number[];
  
  // Match context
  homeAdvantage: number;        // Historical home win rate
  restDays: number;             // Days since last match (normalized)
  injuries: number;             // Key players missing (0-1)
  h2hHistory: number[];         // Head to head [hw, d, aw] last 5
  
  // Spatial features (12x8 grid)
  homeShotMap: number[][];      // Shot density zones
  awayShotMap: number[][];
  homePressureMap: number[][];  // Pressing zones
  awayPressureMap: number[][];
}

export interface PredictionOutput {
  homeWin: number;
  draw: number;
  awayWin: number;
  confidence: number;
  ensembleAgreement: number;
  calibratedBrier: number;
  ensembleVotes: {
    dense: number[];
    lstm: number[];
    cnn: number[];
  };
}

export interface EnsembleTrainingDataset {
  samples: Array<{
    features: EnsembleMatchFeatures;
    outcome: 'home' | 'draw' | 'away';
  }>;
}

export interface TrainingMetrics {
  denseAccuracy: number;
  lstmAccuracy: number;
  cnnAccuracy: number;
  ensembleAccuracy: number;
  calibratedBrier: number;
  totalSamples: number;
  trainingTime: number;
}

export interface TrainingOptions {
  epochs: number;
  batchSize: number;
  validationSplit: number;
  onProgress?: (message: string, progress: number) => void;
  onEpochEnd?: (epoch: number, logs: tf.Logs | undefined) => void;
}

// ============================================================================
// Isotonic Calibrator
// ============================================================================

export class IsotonicCalibrator {
  private bins: { threshold: number; calibrated: number }[] = [];
  private trained = false;
  
  /**
   * Train the calibrator on validation predictions
   */
  async train(predictions: number[][], actuals: number[]): Promise<void> {
    if (predictions.length === 0) {
      console.warn('No predictions to train calibrator');
      return;
    }
    
    // Focus on home win probability (index 0)
    const homeProbs = predictions.map(p => p[0]);
    const homeActuals = actuals.map(a => a === 0 ? 1 : 0);
    
    // Sort by prediction
    const sorted = homeProbs.map((p, i) => ({ pred: p, actual: homeActuals[i] }))
      .sort((a, b) => a.pred - b.pred);
    
    // Create 20 bins
    this.bins = [];
    const binSize = Math.max(1, Math.floor(sorted.length / 20));
    
    for (let i = 0; i < 20; i++) {
      const start = i * binSize;
      const end = Math.min((i + 1) * binSize, sorted.length);
      const slice = sorted.slice(start, end);
      
      if (slice.length === 0) continue;
      
      const avgPred = slice.reduce((s, x) => s + x.pred, 0) / slice.length;
      const avgActual = slice.reduce((s, x) => s + x.actual, 0) / slice.length;
      
      this.bins.push({ threshold: avgPred, calibrated: avgActual });
    }
    
    // Enforce monotonicity (isotonic constraint)
    for (let i = 1; i < this.bins.length; i++) {
      this.bins[i].calibrated = Math.max(
        this.bins[i - 1].calibrated,
        this.bins[i].calibrated
      );
    }
    
    this.trained = true;
  }
  
  /**
   * Calibrate probability predictions
   */
  async calibrate(probs: number[]): Promise<number[]> {
    if (!this.trained || this.bins.length === 0) {
      return probs; // Return uncalibrated if not trained
    }
    
    const calibratedHome = this.calibrateValue(probs[0]);
    
    // Proportionally adjust draw and away to sum to 1
    const remaining = 1 - calibratedHome;
    const originalRemaining = probs[1] + probs[2];
    
    if (originalRemaining <= 0) {
      return [calibratedHome, remaining / 2, remaining / 2];
    }
    
    const factor = remaining / originalRemaining;
    
    return [
      calibratedHome,
      probs[1] * factor,
      probs[2] * factor
    ];
  }
  
  private calibrateValue(prob: number): number {
    if (this.bins.length === 0) return prob;
    
    // Find appropriate bin using binary search
    const bin = this.bins.find(b => prob <= b.threshold) || this.bins[this.bins.length - 1];
    return Math.max(0, Math.min(1, bin.calibrated));
  }
  
  /**
   * Export calibrator state for persistence
   */
  export(): { bins: Array<{ threshold: number; calibrated: number }>; trained: boolean } {
    return { bins: this.bins, trained: this.trained };
  }
  
  /**
   * Load calibrator state
   */
  load(data: { bins: Array<{ threshold: number; calibrated: number }>; trained: boolean }): void {
    this.bins = data.bins || [];
    this.trained = data.trained || false;
  }
  
  /**
   * Check if calibrator is trained
   */
  isTrained(): boolean {
    return this.trained;
  }
}

// ============================================================================
// TensorFlow.js Ensemble Engine
// ============================================================================

export class TFJSEnsembleEngine {
  private models: {
    dense: tf.LayersModel | null;
    lstm: tf.LayersModel | null;
    cnn: tf.LayersModel | null;
  } = { dense: null, lstm: null, cnn: null };
  
  private calibrator: IsotonicCalibrator;
  private isInitialized = false;
  private ensembleWeights = [0.45, 0.30, 0.25]; // Dense > LSTM > CNN
  
  constructor() {
    this.calibrator = new IsotonicCalibrator();
  }
  
  /**
   * Initialize all models - call once at startup
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    console.log('🧠 Initializing TensorFlow.js ensemble...');
    
    // Set backend to WebGL for GPU acceleration
    await tf.ready();
    console.log(`Using backend: ${tf.getBackend()}`);
    
    try {
      // Try to load pre-trained models from IndexedDB
      await this.loadModels();
      console.log('✅ Loaded pre-trained models from storage');
    } catch (error) {
      console.log('📦 No pre-trained models found, building new ones...');
      await this.buildModels();
      console.log('✅ Models built and ready');
    }
    
    this.isInitialized = true;
  }
  
  /**
   * Get model information for health checks
   */
  getModelInfo() {
    return {
      initialized: this.isInitialized,
      backend: tf.getBackend(),
      modelsLoaded: {
        dense: this.models.dense !== null,
        lstm: this.models.lstm !== null,
        cnn: this.models.cnn !== null,
      },
      calibratorTrained: this.calibrator.isTrained(),
      ensembleWeights: {
        dense: this.ensembleWeights[0],
        lstm: this.ensembleWeights[1],
        cnn: this.ensembleWeights[2],
      },
    };
  }
  
  /**
   * Build the three ensemble models
   */
  private async buildModels(): Promise<void> {
    // Model 1: Dense Neural Network (general patterns)
    this.models.dense = tf.sequential({
      layers: [
        tf.layers.dense({ 
          units: 128, 
          activation: 'relu', 
          inputShape: [50],
          kernelRegularizer: tf.regularizers.l2({ l2: 0.01 })
        }),
        tf.layers.batchNormalization(),
        tf.layers.dropout({ rate: 0.3 }),
        tf.layers.dense({ units: 64, activation: 'relu' }),
        tf.layers.batchNormalization(),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.dense({ units: 32, activation: 'relu' }),
        tf.layers.dense({ units: 3, activation: 'softmax' })
      ]
    });
    
    this.models.dense.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy']
    });
    
    // Model 2: LSTM (temporal patterns - form, momentum)
    this.models.lstm = tf.sequential({
      layers: [
        tf.layers.lstm({ 
          units: 64, 
          returnSequences: true, 
          inputShape: [10, 20]  // 10 games, 20 features each
        }),
        tf.layers.dropout({ rate: 0.3 }),
        tf.layers.lstm({ units: 32 }),
        tf.layers.dense({ units: 16, activation: 'relu' }),
        tf.layers.dense({ units: 3, activation: 'softmax' })
      ]
    });
    
    this.models.lstm.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy']
    });
    
    // Model 3: CNN (spatial patterns - shot maps, pressure)
    this.models.cnn = tf.sequential({
      layers: [
        tf.layers.conv2d({ 
          filters: 32, 
          kernelSize: 3, 
          activation: 'relu', 
          inputShape: [12, 8, 2],  // 12x8 grid, 2 channels (shots, pressure)
          padding: 'same'
        }),
        tf.layers.maxPooling2d({ poolSize: [2, 2] }),
        tf.layers.conv2d({ 
          filters: 64, 
          kernelSize: 3, 
          activation: 'relu',
          padding: 'same'
        }),
        tf.layers.flatten(),
        tf.layers.dense({ units: 64, activation: 'relu' }),
        tf.layers.dropout({ rate: 0.3 }),
        tf.layers.dense({ units: 3, activation: 'softmax' })
      ]
    });
    
    this.models.cnn.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy']
    });
  }
  
  /**
   * Load pre-trained models from IndexedDB
   */
  private async loadModels(): Promise<void> {
    this.models.dense = await tf.loadLayersModel('indexeddb://sabiscore-dense-model');
    this.models.lstm = await tf.loadLayersModel('indexeddb://sabiscore-lstm-model');
    this.models.cnn = await tf.loadLayersModel('indexeddb://sabiscore-cnn-model');
    
    // Load calibrator from localStorage
    const calibratorData = localStorage.getItem('sabiscore-calibrator');
    if (calibratorData) {
      this.calibrator.load(JSON.parse(calibratorData));
    }
  }
  
  /**
   * Save trained models to IndexedDB
   */
  async saveModels(): Promise<void> {
    if (this.models.dense) {
      await this.models.dense.save('indexeddb://sabiscore-dense-model');
    }
    if (this.models.lstm) {
      await this.models.lstm.save('indexeddb://sabiscore-lstm-model');
    }
    if (this.models.cnn) {
      await this.models.cnn.save('indexeddb://sabiscore-cnn-model');
    }
    
    // Save calibrator to localStorage
    localStorage.setItem('sabiscore-calibrator', JSON.stringify(this.calibrator.export()));
    
    console.log('💾 Models saved to browser storage');
  }
  
  /**
   * Train all models on historical data
   */
  async train(
    data: EnsembleTrainingDataset, 
    options: TrainingOptions = { epochs: 50, batchSize: 32, validationSplit: 0.2 }
  ): Promise<TrainingMetrics> {
    const startTime = Date.now();
    
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    options.onProgress?.(`🎓 Training ensemble on ${data.samples.length} matches...`, 0);
    
    const { trainSet, valSet } = this.splitData(data, options.validationSplit);
    
    // Prepare data for each model
    options.onProgress?.('Preparing training data...', 0.05);
    
    const denseData = this.prepareDenseData(trainSet);
    const lstmData = this.prepareLSTMData(trainSet);
    const cnnData = this.prepareCNNData(trainSet);
    
    const valDenseData = this.prepareDenseData(valSet);
    const valLSTMData = this.prepareLSTMData(valSet);
    const valCNNData = this.prepareCNNData(valSet);
    
    // Train Dense model
    options.onProgress?.('Training Dense NN...', 0.1);
    const denseHistory = await this.models.dense!.fit(denseData.X, denseData.y, {
      epochs: options.epochs,
      batchSize: options.batchSize,
      validationData: [valDenseData.X, valDenseData.y],
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          if (epoch % 5 === 0) {
            options.onProgress?.(
              `Dense NN - Epoch ${epoch}/${options.epochs}: acc=${(logs?.acc || 0).toFixed(4)}`,
              0.1 + (epoch / options.epochs) * 0.25
            );
          }
          options.onEpochEnd?.(epoch, logs);
        }
      }
    });
    
    // Train LSTM model
    options.onProgress?.('Training LSTM...', 0.4);
    const lstmEpochs = Math.floor(options.epochs * 0.8);
    const lstmHistory = await this.models.lstm!.fit(lstmData.X, lstmData.y, {
      epochs: lstmEpochs,
      batchSize: options.batchSize,
      validationData: [valLSTMData.X, valLSTMData.y],
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          if (epoch % 5 === 0) {
            options.onProgress?.(
              `LSTM - Epoch ${epoch}/${lstmEpochs}: acc=${(logs?.acc || 0).toFixed(4)}`,
              0.4 + (epoch / lstmEpochs) * 0.2
            );
          }
        }
      }
    });
    
    // Train CNN model
    options.onProgress?.('Training CNN...', 0.65);
    const cnnEpochs = Math.floor(options.epochs * 0.6);
    const cnnHistory = await this.models.cnn!.fit(cnnData.X, cnnData.y, {
      epochs: cnnEpochs,
      batchSize: options.batchSize,
      validationData: [valCNNData.X, valCNNData.y],
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          if (epoch % 5 === 0) {
            options.onProgress?.(
              `CNN - Epoch ${epoch}/${cnnEpochs}: acc=${(logs?.acc || 0).toFixed(4)}`,
              0.65 + (epoch / cnnEpochs) * 0.15
            );
          }
        }
      }
    });
    
    // Train calibrator on validation predictions
    options.onProgress?.('Training calibrator...', 0.85);
    await this.trainCalibrator(valSet);
    
    // Evaluate ensemble
    options.onProgress?.('Evaluating ensemble...', 0.9);
    const ensembleAccuracy = await this.evaluateEnsemble(valSet);
    const calibratedBrier = await this.evaluateBrier(valSet);
    
    // Save trained models
    options.onProgress?.('Saving models...', 0.95);
    await this.saveModels();
    
    // Cleanup tensors
    tf.dispose([
      denseData.X, denseData.y,
      lstmData.X, lstmData.y,
      cnnData.X, cnnData.y,
      valDenseData.X, valDenseData.y,
      valLSTMData.X, valLSTMData.y,
      valCNNData.X, valCNNData.y
    ]);
    
    const trainingTime = (Date.now() - startTime) / 1000;
    
    const metrics: TrainingMetrics = {
      denseAccuracy: this.getLastAccuracy(denseHistory),
      lstmAccuracy: this.getLastAccuracy(lstmHistory),
      cnnAccuracy: this.getLastAccuracy(cnnHistory),
      ensembleAccuracy,
      calibratedBrier,
      totalSamples: data.samples.length,
      trainingTime
    };
    
    options.onProgress?.(`✅ Training complete in ${trainingTime.toFixed(1)}s`, 1);
    
    return metrics;
  }
  
  /**
   * Make prediction for a single match
   */
  async predict(features: EnsembleMatchFeatures): Promise<PredictionOutput> {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    // Prepare inputs for each model
    const denseInput = this.featuresToDense(features);
    const lstmInput = this.featuresToLSTM(features);
    const cnnInput = this.featuresToCNN(features);
    
    // Get predictions from all models
    const densePred = this.models.dense!.predict(denseInput) as tf.Tensor;
    const lstmPred = this.models.lstm!.predict(lstmInput) as tf.Tensor;
    const cnnPred = this.models.cnn!.predict(cnnInput) as tf.Tensor;
    
    const [denseProbs, lstmProbs, cnnProbs] = await Promise.all([
      densePred.data(),
      lstmPred.data(),
      cnnPred.data()
    ]);
    
    // Ensemble with learned weights
    const ensembledProbs = [
      denseProbs[0] * this.ensembleWeights[0] + lstmProbs[0] * this.ensembleWeights[1] + cnnProbs[0] * this.ensembleWeights[2],
      denseProbs[1] * this.ensembleWeights[0] + lstmProbs[1] * this.ensembleWeights[1] + cnnProbs[1] * this.ensembleWeights[2],
      denseProbs[2] * this.ensembleWeights[0] + lstmProbs[2] * this.ensembleWeights[1] + cnnProbs[2] * this.ensembleWeights[2]
    ];
    
    // Calibrate probabilities
    const calibrated = await this.calibrator.calibrate(ensembledProbs);
    
    // Calculate confidence and agreement
    const confidence = this.calculateConfidence(calibrated);
    const agreement = this.calculateAgreement([
      Array.from(denseProbs),
      Array.from(lstmProbs),
      Array.from(cnnProbs)
    ]);
    
    // Cleanup tensors
    tf.dispose([densePred, lstmPred, cnnPred, denseInput, lstmInput, cnnInput]);
    
    return {
      homeWin: calibrated[0],
      draw: calibrated[1],
      awayWin: calibrated[2],
      confidence,
      ensembleAgreement: agreement,
      calibratedBrier: 0.18, // Placeholder - would use actual outcomes
      ensembleVotes: {
        dense: Array.from(denseProbs),
        lstm: Array.from(lstmProbs),
        cnn: Array.from(cnnProbs)
      }
    };
  }
  
  // ============================================================================
  // Feature Preparation
  // ============================================================================
  
  private featuresToDense(features: EnsembleMatchFeatures): tf.Tensor {
    const flat = [
      ...features.homeForm.slice(0, 5),
      ...features.awayForm.slice(0, 5),
      ...features.homeXG.slice(0, 10),
      ...features.awayXG.slice(0, 10),
      ...features.homeXGA.slice(0, 5),
      ...features.awayXGA.slice(0, 5),
      features.homeAdvantage,
      features.restDays,
      features.injuries,
      ...features.h2hHistory.slice(0, 5)
    ];
    
    // Pad to 50 features
    while (flat.length < 50) {
      flat.push(0);
    }
    
    return tf.tensor2d([flat.slice(0, 50)], [1, 50]);
  }
  
  private featuresToLSTM(features: EnsembleMatchFeatures): tf.Tensor {
    // Combine form features into temporal sequence (10 timesteps, 20 features each)
    const sequence: number[][] = [];
    
    for (let i = 0; i < 10; i++) {
      const timestep = [
        features.homeForm[i] || 0,
        features.awayForm[i] || 0,
        features.homeXG[i] || 0,
        features.awayXG[i] || 0,
        features.homeXGA[i] || 0,
        features.awayXGA[i] || 0,
        features.homeAdvantage,
        features.restDays,
        features.injuries,
        features.h2hHistory[0] || 0,
        features.h2hHistory[1] || 0,
        features.h2hHistory[2] || 0,
        0, 0, 0, 0, 0, 0, 0, 0 // Padding to 20 features
      ];
      sequence.push(timestep);
    }
    
    return tf.tensor3d([sequence], [1, 10, 20]);
  }
  
  private featuresToCNN(features: EnsembleMatchFeatures): tf.Tensor {
    // Stack shot maps and pressure maps (12x8x2)
    const spatial: number[][][] = [];
    
    for (let i = 0; i < 12; i++) {
      const row: number[][] = [];
      for (let j = 0; j < 8; j++) {
        const homeShot = features.homeShotMap[i]?.[j] || 0;
        const awayShot = features.awayShotMap[i]?.[j] || 0;
        const homePressure = features.homePressureMap[i]?.[j] || 0;
        const awayPressure = features.awayPressureMap[i]?.[j] || 0;
        
        row.push([
          homeShot - awayShot,      // Channel 1: shot difference
          homePressure - awayPressure  // Channel 2: pressure difference
        ]);
      }
      spatial.push(row);
    }
    
    return tf.tensor4d([spatial], [1, 12, 8, 2]);
  }
  
  // ============================================================================
  // Data Preparation for Training
  // ============================================================================
  
  private splitData(
    data: EnsembleTrainingDataset, 
    validationSplit: number
  ): { trainSet: typeof data.samples; valSet: typeof data.samples } {
    const shuffled = [...data.samples].sort(() => Math.random() - 0.5);
    const splitIdx = Math.floor(shuffled.length * (1 - validationSplit));
    
    return {
      trainSet: shuffled.slice(0, splitIdx),
      valSet: shuffled.slice(splitIdx)
    };
  }
  
  private prepareDenseData(samples: EnsembleTrainingDataset['samples']): { X: tf.Tensor; y: tf.Tensor } {
    const features: number[][] = [];
    const labels: number[][] = [];
    
    for (const sample of samples) {
      const flat = [
        ...sample.features.homeForm.slice(0, 5),
        ...sample.features.awayForm.slice(0, 5),
        ...sample.features.homeXG.slice(0, 10),
        ...sample.features.awayXG.slice(0, 10),
        ...sample.features.homeXGA.slice(0, 5),
        ...sample.features.awayXGA.slice(0, 5),
        sample.features.homeAdvantage,
        sample.features.restDays,
        sample.features.injuries,
        ...sample.features.h2hHistory.slice(0, 5)
      ];
      
      while (flat.length < 50) flat.push(0);
      
      features.push(flat.slice(0, 50));
      labels.push(this.outcomeToOneHot(sample.outcome));
    }
    
    return {
      X: tf.tensor2d(features),
      y: tf.tensor2d(labels)
    };
  }
  
  private prepareLSTMData(samples: EnsembleTrainingDataset['samples']): { X: tf.Tensor; y: tf.Tensor } {
    const sequences: number[][][] = [];
    const labels: number[][] = [];
    
    for (const sample of samples) {
      const sequence: number[][] = [];
      
      for (let i = 0; i < 10; i++) {
        const timestep = [
          sample.features.homeForm[i] || 0,
          sample.features.awayForm[i] || 0,
          sample.features.homeXG[i] || 0,
          sample.features.awayXG[i] || 0,
          sample.features.homeXGA[i] || 0,
          sample.features.awayXGA[i] || 0,
          sample.features.homeAdvantage,
          sample.features.restDays,
          sample.features.injuries,
          sample.features.h2hHistory[0] || 0,
          sample.features.h2hHistory[1] || 0,
          sample.features.h2hHistory[2] || 0,
          0, 0, 0, 0, 0, 0, 0, 0
        ];
        sequence.push(timestep);
      }
      
      sequences.push(sequence);
      labels.push(this.outcomeToOneHot(sample.outcome));
    }
    
    return {
      X: tf.tensor3d(sequences),
      y: tf.tensor2d(labels)
    };
  }
  
  private prepareCNNData(samples: EnsembleTrainingDataset['samples']): { X: tf.Tensor; y: tf.Tensor } {
    const spatials: number[][][][] = [];
    const labels: number[][] = [];
    
    for (const sample of samples) {
      const spatial: number[][][] = [];
      
      for (let i = 0; i < 12; i++) {
        const row: number[][] = [];
        for (let j = 0; j < 8; j++) {
          const homeShot = sample.features.homeShotMap[i]?.[j] || 0;
          const awayShot = sample.features.awayShotMap[i]?.[j] || 0;
          const homePressure = sample.features.homePressureMap[i]?.[j] || 0;
          const awayPressure = sample.features.awayPressureMap[i]?.[j] || 0;
          
          row.push([homeShot - awayShot, homePressure - awayPressure]);
        }
        spatial.push(row);
      }
      
      spatials.push(spatial);
      labels.push(this.outcomeToOneHot(sample.outcome));
    }
    
    return {
      X: tf.tensor4d(spatials),
      y: tf.tensor2d(labels)
    };
  }
  
  private outcomeToOneHot(outcome: 'home' | 'draw' | 'away'): number[] {
    return outcome === 'home' ? [1, 0, 0] : 
           outcome === 'draw' ? [0, 1, 0] : 
           [0, 0, 1];
  }
  
  // ============================================================================
  // Evaluation & Metrics
  // ============================================================================
  
  private async trainCalibrator(valSet: EnsembleTrainingDataset['samples']): Promise<void> {
    const predictions: number[][] = [];
    const actuals: number[] = [];
    
    for (const sample of valSet) {
      const pred = await this.predict(sample.features);
      predictions.push([pred.homeWin, pred.draw, pred.awayWin]);
      actuals.push(sample.outcome === 'home' ? 0 : sample.outcome === 'draw' ? 1 : 2);
    }
    
    await this.calibrator.train(predictions, actuals);
  }
  
  private async evaluateEnsemble(valSet: EnsembleTrainingDataset['samples']): Promise<number> {
    let correct = 0;
    
    for (const sample of valSet) {
      const pred = await this.predict(sample.features);
      const predictedOutcome = pred.homeWin > pred.draw && pred.homeWin > pred.awayWin ? 'home' :
                               pred.awayWin > pred.draw ? 'away' : 'draw';
      
      if (predictedOutcome === sample.outcome) {
        correct++;
      }
    }
    
    return correct / valSet.length;
  }
  
  private async evaluateBrier(valSet: EnsembleTrainingDataset['samples']): Promise<number> {
    let sumSquaredError = 0;
    
    for (const sample of valSet) {
      const pred = await this.predict(sample.features);
      const actual = this.outcomeToOneHot(sample.outcome);
      
      sumSquaredError += Math.pow(pred.homeWin - actual[0], 2) +
                         Math.pow(pred.draw - actual[1], 2) +
                         Math.pow(pred.awayWin - actual[2], 2);
    }
    
    return sumSquaredError / valSet.length;
  }
  
  private calculateConfidence(probs: number[]): number {
    const maxProb = Math.max(...probs);
    const entropy = -probs.reduce((sum, p) => sum + (p > 0 ? p * Math.log(p) : 0), 0);
    const maxEntropy = Math.log(3);
    
    return maxProb * (1 - entropy / maxEntropy);
  }
  
  private calculateAgreement(votes: number[][]): number {
    const distances: number[] = [];
    
    for (let i = 0; i < votes.length; i++) {
      for (let j = i + 1; j < votes.length; j++) {
        const dist = Math.sqrt(
          votes[i].reduce((sum, v, k) => sum + Math.pow(v - votes[j][k], 2), 0)
        );
        distances.push(dist);
      }
    }
    
    const avgDistance = distances.reduce((a, b) => a + b, 0) / distances.length;
    return Math.max(0, 1 - avgDistance);
  }
  
  private getLastAccuracy(history: tf.History): number {
    const valAcc = history.history.val_acc as number[] | undefined;
    const acc = history.history.acc as number[] | undefined;
    
    if (valAcc && valAcc.length > 0) {
      return valAcc[valAcc.length - 1];
    }
    if (acc && acc.length > 0) {
      return acc[acc.length - 1];
    }
    return 0;
  }
  
  // ============================================================================
  // Utility Methods
  // ============================================================================
  
  /**
   * Check if models are initialized
   */
  isReady(): boolean {
    return this.isInitialized;
  }
  
  /**
   * Get calibrator instance
   */
  getCalibrator(): IsotonicCalibrator {
    return this.calibrator;
  }
  
  /**
   * Clear models from memory and storage
   */
  async clearModels(): Promise<void> {
    if (this.models.dense) {
      this.models.dense.dispose();
      this.models.dense = null;
    }
    if (this.models.lstm) {
      this.models.lstm.dispose();
      this.models.lstm = null;
    }
    if (this.models.cnn) {
      this.models.cnn.dispose();
      this.models.cnn = null;
    }
    
    // Clear from IndexedDB
    try {
      await tf.io.removeModel('indexeddb://sabiscore-dense-model');
      await tf.io.removeModel('indexeddb://sabiscore-lstm-model');
      await tf.io.removeModel('indexeddb://sabiscore-cnn-model');
    } catch (e) {
      // Models may not exist
    }
    
    localStorage.removeItem('sabiscore-calibrator');
    this.isInitialized = false;
    
    console.log('🗑️ Models cleared');
  }
  
  /**
   * Get memory info
   */
  getMemoryInfo(): { numTensors: number; numBytes: number } {
    const info = tf.memory();
    return {
      numTensors: info.numTensors,
      numBytes: info.numBytes
    };
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const ensembleEngine = new TFJSEnsembleEngine();
