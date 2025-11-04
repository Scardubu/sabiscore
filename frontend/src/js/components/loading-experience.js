/**
 * Enhanced Loading Experience
 * Provides entertaining and informative loading states during prediction analysis
 */

export class LoadingExperience {
    constructor() {
        this.currentStep = 0;
        this.startTime = null;
        this.stepInterval = null;
        this.progressInterval = null;
        this.currentProgress = 0;
        
        // Analysis steps with realistic timing and messages
        this.analysisSteps = [
            {
                title: "🔍 Gathering Match Data",
                message: "Scraping live statistics from FlashScore, OddsPortal, and Transfermarkt...",
                duration: 3000,
                funFacts: [
                    "Did you know? We analyze over 51 features per match!",
                    "Fun fact: Squad valuations can predict outcomes with 68% accuracy",
                    "Interesting: Home advantage is worth ~0.4 goals on average"
                ]
            },
            {
                title: "⚽ Analyzing Team Performance",
                message: "Processing historical stats, current form, and head-to-head records...",
                duration: 4000,
                funFacts: [
                    "Fact: Teams with 3+ consecutive wins have 72% higher confidence",
                    "Did you know? Recent form is weighted 3x more than season averages",
                    "Insight: Clean sheet streaks boost defensive strength by 15-25%"
                ]
            },
            {
                title: "🧮 Engineering Features",
                message: "Calculating possession patterns, form trends, and tactical matchups...",
                duration: 3000,
                funFacts: [
                    "Our model considers: goals, assists, xG, possession, pressing stats...",
                    "Feature engineering transforms raw data into 51 prediction signals",
                    "Tactical style matchups can swing probabilities by 10-15%"
                ]
            },
            {
                title: "🤖 Running AI Ensemble",
                message: "Random Forest, XGBoost, and LightGBM models are analyzing patterns...",
                duration: 4000,
                funFacts: [
                    "3 ML models vote together for maximum accuracy!",
                    "Trained on 5,005+ historical matches across top 5 leagues",
                    "Our ensemble achieves 65-70% prediction accuracy"
                ]
            },
            {
                title: "📊 Calculating Probabilities",
                message: "Generating win/draw/loss probabilities with confidence intervals...",
                duration: 3000,
                funFacts: [
                    "We use Bayesian inference for probability calibration",
                    "Confidence scores reflect model certainty (50-95% range)",
                    "Probabilities are adjusted for bookmaker margins"
                ]
            },
            {
                title: "💰 Identifying Value Bets",
                message: "Comparing model odds vs bookmaker lines to find betting edges...",
                duration: 3000,
                funFacts: [
                    "Value bets: When our model odds > bookmaker odds",
                    "Kelly Criterion optimizes stake size for long-term growth",
                    "Expected Value (EV) shows profit potential per $100 bet"
                ]
            },
            {
                title: "🎯 Running Monte Carlo Simulation",
                message: "Simulating 10,000 match scenarios for risk assessment...",
                duration: 4000,
                funFacts: [
                    "Monte Carlo: Running 10,000 virtual matches!",
                    "Variance analysis reveals outcome distribution patterns",
                    "95th percentile outcomes show worst-case scenarios"
                ]
            },
            {
                title: "📈 Generating xG Analysis",
                message: "Forecasting expected goals based on attacking/defensive strength...",
                duration: 2000,
                funFacts: [
                    "xG predicts likely scorelines better than historical averages",
                    "Expected Goals considers shot quality, not just quantity",
                    "Over 2.5 goals? xG tells us if it's realistic"
                ]
            },
            {
                title: "✨ Finalizing Insights",
                message: "Packaging predictions, narratives, and recommendations...",
                duration: 2000,
                funFacts: [
                    "Your personalized betting report is almost ready!",
                    "AI-generated narratives explain the 'why' behind predictions",
                    "All data cached for instant future lookups"
                ]
            }
        ];
    }

    /**
     * Start the loading experience
     */
    start() {
        this.startTime = Date.now();
        this.currentStep = 0;
        this.currentProgress = 0;
        
        // Step through analysis phases
        this.stepInterval = setInterval(() => {
            this.nextStep();
        }, 3000); // Update every 3 seconds

        // Smooth progress bar animation
        this.progressInterval = setInterval(() => {
            this.updateProgress();
        }, 50); // Update every 50ms for smooth animation

        return this.renderInitialState();
    }

    /**
     * Stop the loading experience
     */
    stop() {
        if (this.stepInterval) {
            clearInterval(this.stepInterval);
            this.stepInterval = null;
        }
        if (this.progressInterval) {
            clearInterval(this.progressInterval);
            this.progressInterval = null;
        }
    }

    /**
     * Move to next analysis step
     */
    nextStep() {
        if (this.currentStep < this.analysisSteps.length - 1) {
            this.currentStep++;
            this.updateStepDisplay();
        }
    }

    /**
     * Update progress bar smoothly
     */
    updateProgress() {
        const elapsedTime = Date.now() - this.startTime;
        const estimatedTotalTime = 28000; // ~28 seconds total (sum of step durations)
        
        // Calculate progress (0-95%, leave room for final completion)
        const calculatedProgress = Math.min((elapsedTime / estimatedTotalTime) * 95, 95);
        
        // Smooth transition using easing
        const progressDiff = calculatedProgress - this.currentProgress;
        this.currentProgress += progressDiff * 0.1; // Ease-out effect

        // Update progress bar
        const progressBar = document.querySelector('.loading-progress-fill');
        const progressText = document.querySelector('.loading-progress-text');
        
        if (progressBar) {
            progressBar.style.width = `${this.currentProgress}%`;
        }
        if (progressText) {
            progressText.textContent = `${Math.floor(this.currentProgress)}%`;
        }
    }

    /**
     * Update step display with animation
     */
    updateStepDisplay() {
        const step = this.analysisSteps[this.currentStep];
        const stepTitle = document.querySelector('.loading-step-title');
        const stepMessage = document.querySelector('.loading-step-message');
        const funFact = document.querySelector('.loading-fun-fact');
        const stepIndicator = document.querySelector('.loading-step-indicator');

        if (stepTitle) {
            // Fade out, update, fade in
            stepTitle.style.opacity = '0';
            setTimeout(() => {
                stepTitle.textContent = step.title;
                stepTitle.style.opacity = '1';
            }, 200);
        }

        if (stepMessage) {
            stepMessage.style.opacity = '0';
            setTimeout(() => {
                stepMessage.textContent = step.message;
                stepMessage.style.opacity = '1';
            }, 300);
        }

        if (funFact) {
            const randomFact = step.funFacts[Math.floor(Math.random() * step.funFacts.length)];
            funFact.style.opacity = '0';
            setTimeout(() => {
                funFact.textContent = randomFact;
                funFact.style.opacity = '1';
            }, 400);
        }

        if (stepIndicator) {
            stepIndicator.textContent = `Step ${this.currentStep + 1} of ${this.analysisSteps.length}`;
        }
    }

    /**
     * Complete the loading with 100% progress
     */
    complete() {
        this.stop();
        
        // Animate to 100%
        this.currentProgress = 100;
        const progressBar = document.querySelector('.loading-progress-fill');
        const progressText = document.querySelector('.loading-progress-text');
        
        if (progressBar) {
            progressBar.style.width = '100%';
            progressBar.style.background = 'linear-gradient(90deg, var(--success), var(--primary))';
        }
        if (progressText) {
            progressText.textContent = '100%';
        }

        // Show completion message
        const stepTitle = document.querySelector('.loading-step-title');
        const stepMessage = document.querySelector('.loading-step-message');
        
        if (stepTitle) {
            stepTitle.textContent = '✅ Analysis Complete!';
        }
        if (stepMessage) {
            stepMessage.textContent = 'Your personalized betting insights are ready...';
        }
    }

    /**
     * Render initial loading state HTML
     */
    renderInitialState() {
        const step = this.analysisSteps[0];
        const randomFact = step.funFacts[Math.floor(Math.random() * step.funFacts.length)];

        return `
            <div class="enhanced-loading-card">
                <!-- Animated spinner -->
                <div class="loading-spinner-container">
                    <div class="loading-spinner-ring"></div>
                    <div class="loading-spinner-core">
                        <svg class="loading-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z" 
                                  fill="currentColor" opacity="0.8"/>
                        </svg>
                    </div>
                </div>

                <!-- Progress bar -->
                <div class="loading-progress-container">
                    <div class="loading-progress-bar">
                        <div class="loading-progress-fill" style="width: 0%"></div>
                    </div>
                    <div class="loading-progress-text">0%</div>
                </div>

                <!-- Current step -->
                <div class="loading-step-container">
                    <h3 class="loading-step-title">${step.title}</h3>
                    <p class="loading-step-message">${step.message}</p>
                    <div class="loading-step-indicator">Step 1 of ${this.analysisSteps.length}</div>
                </div>

                <!-- Fun fact / educational content -->
                <div class="loading-info-container">
                    <div class="loading-fun-fact">
                        💡 ${randomFact}
                    </div>
                </div>

                <!-- Estimated time -->
                <div class="loading-eta">
                    <svg class="eta-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
                        <path d="M12 6V12L16 14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                    <span>Estimated time: 15-30 seconds</span>
                </div>

                <!-- Processing indicators (mini cards) -->
                <div class="loading-process-indicators">
                    <div class="process-indicator" data-status="active">
                        <span class="indicator-icon">📊</span>
                        <span class="indicator-label">Data</span>
                    </div>
                    <div class="process-indicator" data-status="pending">
                        <span class="indicator-icon">🤖</span>
                        <span class="indicator-label">AI</span>
                    </div>
                    <div class="process-indicator" data-status="pending">
                        <span class="indicator-icon">💰</span>
                        <span class="indicator-label">Odds</span>
                    </div>
                    <div class="process-indicator" data-status="pending">
                        <span class="indicator-icon">🎯</span>
                        <span class="indicator-label">Insights</span>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Get simple loading state (fallback)
     */
    static getSimpleLoadingHTML() {
        return `
            <div class="loading-card">
                <div class="loading-spinner"></div>
                <h3>Analyzing Match...</h3>
                <p>Our AI is processing the latest data and generating predictions</p>
            </div>
        `;
    }
}

export default LoadingExperience;
