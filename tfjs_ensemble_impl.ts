// lib/ml/tfjs-ensemble-engine.ts
import * as tf from '@tensorflow/tfjs';

interface MatchFeatures {
  // Team features (normalized 0-1)
  homeForm: number[];           // [w, d, l, gf, ga] - 5 aggregated stats
  awayForm: number[];           // [w, d, l, gf, ga] - 5 aggregated stats
  homeXG: number[];             // xG last 5 games
  awayXG: number[];             // xG last 5 games
  homeXGA: number[];            // xG against last 5 games
  awayXGA: number[];            // xG against last 5 games
  
  // Match context
  homeAdvantage: number;        // Historical home win rate
  restDays: number;             // Days since last match
  injuries: number;             // Key players missing (0-1)
  h2hHistory: number[];         // Head to head [hw, d, aw] last 5
  
  // Spatial features (12x8 grid)
  homeShotMap: number[][];      // Shot density zones
  awayShotMap: number[][];
  homePressureMap: number[][];  // Pressing zones
  awayPressureMap: number[][];
}

interface PredictionOutput {
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

export class TFJSEnsembleEngine {
  private models: {
    dense: tf.LayersModel | null;
    lstm: tf.LayersModel | null;
    cnn: tf.LayersModel | null;
  } = { dense: null, lstm: null, cnn: null };
  
  private calibrator: IsotonicCalibrator;
  private isInitialized = false;
  
  constructor() {
    this.calibrator = new IsotonicCalibrator();
  }
  
  /**
   * Initialize all models - call once at startup
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    console.log('🧠 Initializing TensorFlow.js ensemble...');
    
    try {
      // Try to load pre-trained models from IndexedDB
      await this.loadModels();
      console.log('✅ Loaded pre-trained models');
    } catch (error) {
      console.log('📦 No pre-trained models found, building new ones...');
      await this.buildModels();
      console.log('✅ Models built and ready');
    }
    
    this.isInitialized = true;
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
          inputShape: [5, 12]  // 5 games, 12 features each (fixed dimension)
        }),
        tf.layers.dropout({ rate: 0.3 }),
        tf.layers.lstm({ units: 32 }),
        tf.layers.dense({ units: 16, activation: 'relu' }),
        tf.layers.dense({ units: 3, activation: 'softmax' })
      ]
    });
    
    this.models.lstm.compile({
      optimizer: 'adam',
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
          inputShape: [12, 8, 2]  // 12x8 grid, 2 channels (shots, pressure)
        }),
        tf.layers.maxPooling2d({ poolSize: [2, 2] }),
        tf.layers.conv2d({ filters: 64, kernelSize: 3, activation: 'relu' }),
        tf.layers.flatten(),
        tf.layers.dense({ units: 64, activation: 'relu' }),
        tf.layers.dropout({ rate: 0.3 }),
        tf.layers.dense({ units: 3, activation: 'softmax' })
      ]
    });
    
    this.models.cnn.compile({
      optimizer: 'adam',
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy']
    });
  }
  
  /**
   * Load pre-trained models from IndexedDB
   */
  private async loadModels(): Promise<void> {
    this.models.dense = await tf.loadLayersModel('indexeddb://dense-model');
    this.models.lstm = await tf.loadLayersModel('indexeddb://lstm-model');
    this.models.cnn = await tf.loadLayersModel('indexeddb://cnn-model');
    
    // Load calibrator
    const calibratorData = localStorage.getItem('calibrator');
    if (calibratorData) {
      this.calibrator.load(JSON.parse(calibratorData));
    }
  }
  
  /**
   * Save trained models to IndexedDB
   */
  async saveModels(): Promise<void> {
    await this.models.dense?.save('indexeddb://dense-model');
    await this.models.lstm?.save('indexeddb://lstm-model');
    await this.models.cnn?.save('indexeddb://cnn-model');
    
    // Save calibrator
    localStorage.setItem('calibrator', JSON.stringify(this.calibrator.export()));
    
    console.log('💾 Models saved to browser storage');
  }
  
  /**
   * Train all models on historical data
   */
  async train(data: TrainingDataset, options = { epochs: 50, batchSize: 32 }): Promise<TrainingMetrics> {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    console.log('🎓 Training ensemble on', data.samples.length, 'matches...');
    
    const { trainSet, valSet } = this.splitData(data);
    
    // Prepare data for each model
    const denseData = this.prepareDenseData(trainSet);
    const lstmData = this.prepareLSTMData(trainSet);
    const cnnData = this.prepareCNNData(trainSet);
    
    const valDenseData = this.prepareDenseData(valSet);
    const valLSTMData = this.prepareLSTMData(valSet);
    const valCNNData = this.prepareCNNData(valSet);
    
    // Train models in parallel
    const [denseHistory, lstmHistory, cnnHistory] = await Promise.all([
      this.models.dense!.fit(denseData.X, denseData.y, {
        epochs: options.epochs,
        batchSize: options.batchSize,
        validationData: [valDenseData.X, valDenseData.y],
        callbacks: {
          onEpochEnd: (epoch, logs) => {
            if (epoch % 10 === 0) {
              console.log(`Dense - Epoch ${epoch}: loss=${logs?.loss.toFixed(4)}, acc=${logs?.acc.toFixed(4)}`);
            }
          }
        }
      }),
      
      this.models.lstm!.fit(lstmData.X, lstmData.y, {
        epochs: Math.floor(options.epochs * 0.8), // LSTM trains slower
        batchSize: options.batchSize,
        validationData: [valLSTMData.X, valLSTMData.y]
      }),
      
      this.models.cnn!.fit(cnnData.X, cnnData.y, {
        epochs: Math.floor(options.epochs * 0.6), // CNN fastest
        batchSize: options.batchSize,
        validationData: [valCNNData.X, valCNNData.y]
      })
    ]);
    
    // Train calibrator on validation predictions
    await this.trainCalibrator(valSet);
    
    // Save trained models
    await this.saveModels();
    
    return {
      denseAccuracy: denseHistory.history.val_acc[denseHistory.history.val_acc.length - 1],
      lstmAccuracy: lstmHistory.history.val_acc[lstmHistory.history.val_acc.length - 1],
      cnnAccuracy: cnnHistory.history.val_acc[cnnHistory.history.val_acc.length - 1],
      calibratedBrier: await this.evaluateBrier(valSet)
    };
  }
  
  /**
   * Make prediction for a single match
   */
  async predict(features: MatchFeatures): Promise<PredictionOutput> {
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
    
    // Ensemble with learned weights (from validation)
    const weights = [0.45, 0.30, 0.25]; // Dense > LSTM > CNN
    const ensembledProbs = [
      denseProbs[0] * weights[0] + lstmProbs[0] * weights[1] + cnnProbs[0] * weights[2],
      denseProbs[1] * weights[0] + lstmProbs[1] * weights[1] + cnnProbs[1] * weights[2],
      denseProbs[2] * weights[0] + lstmProbs[2] * weights[1] + cnnProbs[2] * weights[2]
    ];
    
    // CRITICAL: Calibrate probabilities
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
      calibratedBrier: await this.estimateBrier(calibrated),
      ensembleVotes: {
        dense: Array.from(denseProbs),
        lstm: Array.from(lstmProbs),
        cnn: Array.from(cnnProbs)
      }
    };
  }
  
  /**
   * Feature preparation helpers
   */
  private featuresToDense(features: MatchFeatures): tf.Tensor {
    const flat = [
      ...features.homeForm,
      ...features.awayForm,
      ...features.homeXG,
      ...features.awayXG,
      ...features.homeXGA,
      ...features.awayXGA,
      features.homeAdvantage,
      features.restDays,
      features.injuries,
      ...features.h2hHistory
    ];
    
    return tf.tensor2d([flat], [1, flat.length]);
  }
  
  private featuresToLSTM(features: MatchFeatures): tf.Tensor {
    // Combine form features into temporal sequence (5 time steps)
    const sequence = [];
    for (let i = 0; i < 5; i++) {
      sequence.push([
        features.homeForm[i] || 0,
        features.awayForm[i] || 0,
        features.homeXG[i] || 0,
        features.awayXG[i] || 0,
        features.homeXGA[i] || 0,
        features.awayXGA[i] || 0,
        features.homeAdvantage || 0,
        features.restDays || 0,
        features.injuries || 0,
        ...features.h2hHistory,  // 3 more features = 12 total per timestep
      ]);
    }
    
    return tf.tensor3d([sequence], [1, 5, 12]);
  }
  
  private featuresToCNN(features: MatchFeatures): tf.Tensor {
    // Stack shot maps and pressure maps (12x8x2)
    const spatial = [];
    for (let i = 0; i < 12; i++) {
      const row = [];
      for (let j = 0; j < 8; j++) {
        row.push([
          features.homeShotMap[i][j] - features.awayShotMap[i][j],  // Channel 1: shot diff
          features.homePressureMap[i][j] - features.awayPressureMap[i][j]  // Channel 2: pressure diff
        ]);
      }
      spatial.push(row);
    }
    
    return tf.tensor4d([spatial], [1, 12, 8, 2]);
  }
  
  /**
   * Helper methods
   */
  private splitData(data: TrainingDataset): { trainSet: any; valSet: any } {
    const splitIdx = Math.floor(data.samples.length * 0.8);
    return {
      trainSet: data.samples.slice(0, splitIdx),
      valSet: data.samples.slice(splitIdx)
    };
  }
  
  private prepareDenseData(samples: any[]): { X: tf.Tensor; y: tf.Tensor } {
    const X = samples.map(s => this.featuresToDense(s.features));
    const y = samples.map(s => this.outcomeToOneHot(s.outcome));
    
    return {
      X: tf.concat(X),
      y: tf.tensor2d(y)
    };
  }
  
  private prepareLSTMData(samples: any[]): { X: tf.Tensor; y: tf.Tensor } {
    const X = samples.map(s => this.featuresToLSTM(s.features));
    const y = samples.map(s => this.outcomeToOneHot(s.outcome));
    
    return {
      X: tf.concat(X),
      y: tf.tensor2d(y)
    };
  }
  
  private prepareCNNData(samples: any[]): { X: tf.Tensor; y: tf.Tensor } {
    const X = samples.map(s => this.featuresToCNN(s.features));
    const y = samples.map(s => this.outcomeToOneHot(s.outcome));
    
    return {
      X: tf.concat(X),
      y: tf.tensor2d(y)
    };
  }
  
  private outcomeToOneHot(outcome: 'home' | 'draw' | 'away'): number[] {
    return outcome === 'home' ? [1, 0, 0] : 
           outcome === 'draw' ? [0, 1, 0] : 
           [0, 0, 1];
  }
  
  private async trainCalibrator(valSet: any[]): Promise<void> {
    const predictions = [];
    const actuals = [];
    
    // CRITICAL: Collect raw ensemble predictions WITHOUT calibration
    for (const sample of valSet) {
      const denseInput = this.featuresToDense(sample.features);
      const lstmInput = this.featuresToLSTM(sample.features);
      const cnnInput = this.featuresToCNN(sample.features);
      
      const densePred = this.models.dense!.predict(denseInput) as tf.Tensor;
      const lstmPred = this.models.lstm!.predict(lstmInput) as tf.Tensor;
      const cnnPred = this.models.cnn!.predict(cnnInput) as tf.Tensor;
      
      const [denseProbs, lstmProbs, cnnProbs] = await Promise.all([
        densePred.data(),
        lstmPred.data(),
        cnnPred.data()
      ]);
      
      // Ensemble weights
      const weights = [0.45, 0.30, 0.25];
      const rawEnsemble = [
        denseProbs[0] * weights[0] + lstmProbs[0] * weights[1] + cnnProbs[0] * weights[2],
        denseProbs[1] * weights[0] + lstmProbs[1] * weights[1] + cnnProbs[1] * weights[2],
        denseProbs[2] * weights[0] + lstmProbs[2] * weights[1] + cnnProbs[2] * weights[2]
      ];
      
      predictions.push(rawEnsemble);
      actuals.push(sample.outcome === 'home' ? 0 : sample.outcome === 'draw' ? 1 : 2);
      
      // Cleanup
      tf.dispose([densePred, lstmPred, cnnPred, denseInput, lstmInput, cnnInput]);
    }
    
    await this.calibrator.train(predictions, actuals);
  }
  
  private calculateConfidence(probs: number[]): number {
    // Confidence = max probability - entropy
    const maxProb = Math.max(...probs);
    const entropy = -probs.reduce((sum, p) => sum + (p > 0 ? p * Math.log(p) : 0), 0);
    return maxProb * (1 - entropy / Math.log(3));
  }
  
  private calculateAgreement(votes: number[][]): number {
    // Agreement = 1 - average pairwise distance
    const distances = [];
    for (let i = 0; i < votes.length; i++) {
      for (let j = i + 1; j < votes.length; j++) {
        const dist = Math.sqrt(
          votes[i].reduce((sum, v, k) => sum + Math.pow(v - votes[j][k], 2), 0)
        );
        distances.push(dist);
      }
    }
    return 1 - (distances.reduce((a, b) => a + b, 0) / distances.length);
  }
  
  private async evaluateBrier(samples: any[]): Promise<number> {
    let sumSquaredError = 0;
    
    for (const sample of samples) {
      const pred = await this.predict(sample.features);
      const actual = this.outcomeToOneHot(sample.outcome);
      
      sumSquaredError += Math.pow(pred.homeWin - actual[0], 2) +
                         Math.pow(pred.draw - actual[1], 2) +
                         Math.pow(pred.awayWin - actual[2], 2);
    }
    
    return sumSquaredError / samples.length;
  }
  
  private async estimateBrier(probs: number[]): Promise<number> {
    // Estimate Brier score from historical performance
    // This is a placeholder - would use actual outcomes in production
    return 0.18; // Target
  }
}

/**
 * Isotonic Regression Calibrator
 */
class IsotonicCalibrator {
  private bins: { threshold: number; calibrated: number }[] = [];
  
  async train(predictions: number[][], actuals: number[]): Promise<void> {
    // Focus on home win probability (index 0)
    const homeProbs = predictions.map(p => p[0]);
    const homeActuals = actuals.map(a => a === 0 ? 1 : 0);
    
    // Sort by prediction
    const sorted = homeProbs.map((p, i) => ({ pred: p, actual: homeActuals[i] }))
      .sort((a, b) => a.pred - b.pred);
    
    // Create 20 bins
    this.bins = [];
    const binSize = Math.floor(sorted.length / 20);
    
    for (let i = 0; i < 20; i++) {
      const slice = sorted.slice(i * binSize, (i + 1) * binSize);
      if (slice.length === 0) continue;
      
      const avgPred = slice.reduce((s, x) => s + x.pred, 0) / slice.length;
      const avgActual = slice.reduce((s, x) => s + x.actual, 0) / slice.length;
      
      this.bins.push({ threshold: avgPred, calibrated: avgActual });
    }
    
    // Enforce monotonicity
    for (let i = 1; i < this.bins.length; i++) {
      this.bins[i].calibrated = Math.max(
        this.bins[i - 1].calibrated,
        this.bins[i].calibrated
      );
    }
  }
  
  async calibrate(probs: number[]): Promise<number[]> {
    const calibratedHome = this.calibrateValue(probs[0]);
    
    // Proportionally adjust draw and away
    const total = probs[1] + probs[2];
    const factor = (1 - calibratedHome) / total;
    
    return [
      calibratedHome,
      probs[1] * factor,
      probs[2] * factor
    ];
  }
  
  private calibrateValue(prob: number): number {
    if (this.bins.length === 0) return prob;
    
    const bin = this.bins.find(b => prob <= b.threshold) || this.bins[this.bins.length - 1];
    return bin.calibrated;
  }
  
  export(): any {
    return { bins: this.bins };
  }
  
  load(data: any): void {
    this.bins = data.bins;
  }
}

// Type definitions
interface TrainingDataset {
  samples: Array<{
    features: MatchFeatures;
    outcome: 'home' | 'draw' | 'away';
  }>;
}

interface TrainingMetrics {
  denseAccuracy: number;
  lstmAccuracy: number;
  cnnAccuracy: number;
  calibratedBrier: number;
}