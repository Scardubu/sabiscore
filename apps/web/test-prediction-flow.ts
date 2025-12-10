/**
 * End-to-End Prediction Flow Test
 * 
 * Tests the complete prediction pipeline:
 * 1. ML Model Prediction (TensorFlow.js)
 * 2. Kelly Criterion Optimization
 * 3. Odds Aggregation
 * 4. Monitoring & Analytics
 * 5. Error Handling
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';

interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
  details?: any;
}

const results: TestResult[] = [];

async function runTest(
  name: string,
  testFn: () => Promise<any>
): Promise<TestResult> {
  const start = Date.now();
  console.log(`\n🧪 Testing: ${name}...`);

  try {
    const details = await testFn();
    const duration = Date.now() - start;
    
    console.log(`✅ PASSED (${duration}ms)`);
    
    return {
      name,
      passed: true,
      duration,
      details,
    };
  } catch (error) {
    const duration = Date.now() - start;
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    console.log(`❌ FAILED (${duration}ms)`);
    console.log(`   Error: ${errorMessage}`);
    
    return {
      name,
      passed: false,
      duration,
      error: errorMessage,
    };
  }
}

// Test 1: Health Check API
async function testHealthCheck() {
  const response = await fetch(`${API_BASE_URL}/api/health`);
  
  if (!response.ok) {
    throw new Error(`Health check failed: ${response.status}`);
  }
  
  const data = await response.json();
  
  if (!data.status || !data.metrics) {
    throw new Error('Invalid health check response format');
  }
  
  console.log(`   Status: ${data.status}`);
  console.log(`   Predictions: ${data.metrics.totalPredictions || 0}`);
  
  return data;
}

// Test 2: Model Prediction
async function testPrediction() {
  const requestBody = {
    matchup: 'Arsenal vs Chelsea',
    league: 'EPL',
  };
  
  const response = await fetch(`${API_BASE_URL}/api/predict`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`Prediction failed: ${response.status} - ${errorData.error || 'Unknown error'}`);
  }
  
  const data = await response.json();
  
  if (!data.predictions || !data.metadata) {
    throw new Error('Invalid prediction response format');
  }
  
  console.log(`   Home Win: ${(data.predictions.home * 100).toFixed(1)}%`);
  console.log(`   Draw: ${(data.predictions.draw * 100).toFixed(1)}%`);
  console.log(`   Away Win: ${(data.predictions.away * 100).toFixed(1)}%`);
  console.log(`   Confidence: ${data.metadata.confidence}`);
  console.log(`   Model Time: ${data.metadata.modelInferenceTime}ms`);
  
  return data;
}

// Test 3: Kelly Criterion Optimizer
async function testKellyOptimizer() {
  const requestBody = {
    probability: 0.65,
    odds: 2.5,
    bankroll: 1000,
    confidence: 0.85,
  };
  
  const response = await fetch(`${API_BASE_URL}/api/kelly`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`Kelly calculation failed: ${response.status} - ${errorData.error || 'Unknown error'}`);
  }
  
  const data = await response.json();
  
  if (!data.kelly || !data.fractions) {
    throw new Error('Invalid Kelly response format');
  }
  
  console.log(`   Full Kelly: ₦${data.kelly.fullKelly.toFixed(2)}`);
  console.log(`   1/2 Kelly: ₦${data.fractions.half.toFixed(2)}`);
  console.log(`   1/4 Kelly: ₦${data.fractions.quarter.toFixed(2)}`);
  console.log(`   1/8 Kelly: ₦${data.fractions.eighth.toFixed(2)}`);
  console.log(`   Expected Value: ₦${data.kelly.expectedValue.toFixed(2)}`);
  
  return data;
}

// Test 4: Drift Detection
async function testDriftDetection() {
  const response = await fetch(`${API_BASE_URL}/api/drift`);
  
  if (!response.ok) {
    throw new Error(`Drift detection failed: ${response.status}`);
  }
  
  const data = await response.json();
  
  if (!data.severity) {
    throw new Error('Invalid drift response format');
  }
  
  console.log(`   Severity: ${data.severity}`);
  console.log(`   Requires Action: ${data.requiresAction}`);
  console.log(`   Metrics: ${data.metrics?.length || 0} tracked`);
  
  return data;
}

// Test 5: Odds Aggregation (Premier League)
async function testOddsAggregation() {
  const response = await fetch(`${API_BASE_URL}/api/odds/EPL`);
  
  if (!response.ok) {
    throw new Error(`Odds aggregation failed: ${response.status}`);
  }
  
  const data = await response.json();
  
  if (!Array.isArray(data)) {
    throw new Error('Invalid odds response format - expected array');
  }
  
  console.log(`   Bookmakers: ${data.length}`);
  if (data.length > 0) {
    console.log(`   Sample: ${data[0].name} - ${data[0].odds?.home || 'N/A'}`);
  }
  
  return data;
}

// Test 6: Error Handling (Invalid Input)
async function testErrorHandling() {
  const invalidBody = {
    matchup: '', // Empty matchup should fail validation
    league: 'INVALID_LEAGUE',
  };
  
  const response = await fetch(`${API_BASE_URL}/api/predict`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(invalidBody),
  });
  
  if (response.ok) {
    throw new Error('Expected validation error but request succeeded');
  }
  
  const errorData = await response.json();
  
  if (!errorData.error) {
    throw new Error('Error response missing error message');
  }
  
  console.log(`   Error Type: ${errorData.error}`);
  console.log(`   Status Code: ${response.status}`);
  
  return errorData;
}

// Test 7: Prediction Performance (Warmup)
async function testPredictionPerformance() {
  const times: number[] = [];
  const iterations = 3;
  
  for (let i = 0; i < iterations; i++) {
    const start = Date.now();
    
    const response = await fetch(`${API_BASE_URL}/api/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        matchup: 'Liverpool vs Manchester United',
        league: 'EPL',
      }),
    });
    
    if (!response.ok) {
      throw new Error(`Prediction ${i + 1} failed: ${response.status}`);
    }
    
    const duration = Date.now() - start;
    times.push(duration);
    
    console.log(`   Iteration ${i + 1}: ${duration}ms`);
  }
  
  const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);
  
  console.log(`   Average: ${avgTime.toFixed(0)}ms`);
  console.log(`   Min: ${minTime}ms, Max: ${maxTime}ms`);
  
  if (avgTime > 3000) {
    console.log(`   ⚠️  Warning: Average response time exceeds 3s`);
  }
  
  return { times, avgTime, minTime, maxTime };
}

// Main test runner
async function runAllTests() {
  console.log('🚀 SabiScore 3.0 - End-to-End Test Suite');
  console.log('='.repeat(60));
  console.log(`API Base URL: ${API_BASE_URL}`);
  console.log('='.repeat(60));
  
  // Run all tests
  results.push(await runTest('Health Check API', testHealthCheck));
  results.push(await runTest('Model Prediction', testPrediction));
  results.push(await runTest('Kelly Criterion Optimizer', testKellyOptimizer));
  results.push(await runTest('Drift Detection', testDriftDetection));
  results.push(await runTest('Odds Aggregation', testOddsAggregation));
  results.push(await runTest('Error Handling', testErrorHandling));
  results.push(await runTest('Prediction Performance', testPredictionPerformance));
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Test Summary');
  console.log('='.repeat(60));
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
  
  console.log(`✅ Passed: ${passed}/${results.length}`);
  console.log(`❌ Failed: ${failed}/${results.length}`);
  console.log(`⏱️  Total Duration: ${totalDuration}ms`);
  
  if (failed > 0) {
    console.log('\n❌ Failed Tests:');
    results
      .filter(r => !r.passed)
      .forEach(r => console.log(`   - ${r.name}: ${r.error}`));
  }
  
  console.log('\n' + '='.repeat(60));
  
  // Exit with error code if any tests failed
  if (failed > 0) {
    process.exit(1);
  }
}

// Run tests
runAllTests().catch(error => {
  console.error('\n💥 Test suite crashed:', error);
  process.exit(1);
});
