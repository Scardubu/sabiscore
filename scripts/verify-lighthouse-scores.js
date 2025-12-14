/**
 * Verify Lighthouse performance scores meet production targets
 * Target: 98+ performance score, <800ms page load
 */

const fs = require('fs');
const path = require('path');

const PERFORMANCE_TARGETS = {
  performance: 98,
  accessibility: 95,
  bestPractices: 95,
  seo: 95,
  firstContentfulPaint: 1500, // ms
  largestContentfulPaint: 2500, // ms
  totalBlockingTime: 200, // ms
  cumulativeLayoutShift: 0.1,
  speedIndex: 3000, // ms
  timeToInteractive: 3000, // ms
};

function verifyLighthouseScores() {
  console.log('🔍 Verifying Lighthouse performance scores...\n');
  
  // Read Lighthouse results (uploaded by lighthouse-ci-action)
  const resultsDir = path.join(__dirname, '../.lighthouseci');
  
  if (!fs.existsSync(resultsDir)) {
    console.error('❌ Lighthouse results directory not found');
    process.exit(1);
  }
  
  // Find all lighthouse report files
  const files = fs.readdirSync(resultsDir)
    .filter(f => f.endsWith('.json'));
  
  if (files.length === 0) {
    console.error('❌ No Lighthouse reports found');
    process.exit(1);
  }
  
  console.log(`Found ${files.length} Lighthouse reports\n`);
  
  let allPassed = true;
  
  files.forEach((file, index) => {
    const reportPath = path.join(resultsDir, file);
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    
    console.log(`\n📊 Report ${index + 1}: ${report.finalUrl}`);
    console.log('─'.repeat(60));
    
    // Check category scores
    const categories = report.categories;
    
    const perfScore = Math.round(categories.performance.score * 100);
    const a11yScore = Math.round(categories.accessibility.score * 100);
    const bpScore = Math.round(categories['best-practices'].score * 100);
    const seoScore = Math.round(categories.seo.score * 100);
    
    console.log(`Performance:     ${perfScore}% ${perfScore >= PERFORMANCE_TARGETS.performance ? '✅' : '❌'} (target: ${PERFORMANCE_TARGETS.performance}%)`);
    console.log(`Accessibility:   ${a11yScore}% ${a11yScore >= PERFORMANCE_TARGETS.accessibility ? '✅' : '❌'} (target: ${PERFORMANCE_TARGETS.accessibility}%)`);
    console.log(`Best Practices:  ${bpScore}% ${bpScore >= PERFORMANCE_TARGETS.bestPractices ? '✅' : '❌'} (target: ${PERFORMANCE_TARGETS.bestPractices}%)`);
    console.log(`SEO:             ${seoScore}% ${seoScore >= PERFORMANCE_TARGETS.seo ? '✅' : '❌'} (target: ${PERFORMANCE_TARGETS.seo}%)`);
    
    // Check detailed metrics
    const audits = report.audits;
    
    console.log('\n⏱️  Performance Metrics:');
    
    const fcp = Math.round(audits['first-contentful-paint'].numericValue);
    const lcp = Math.round(audits['largest-contentful-paint'].numericValue);
    const tbt = Math.round(audits['total-blocking-time'].numericValue);
    const cls = audits['cumulative-layout-shift'].numericValue.toFixed(3);
    const si = Math.round(audits['speed-index'].numericValue);
    const tti = Math.round(audits['interactive'].numericValue);
    
    console.log(`FCP:  ${fcp}ms ${fcp <= PERFORMANCE_TARGETS.firstContentfulPaint ? '✅' : '❌'} (target: ${PERFORMANCE_TARGETS.firstContentfulPaint}ms)`);
    console.log(`LCP:  ${lcp}ms ${lcp <= PERFORMANCE_TARGETS.largestContentfulPaint ? '✅' : '❌'} (target: ${PERFORMANCE_TARGETS.largestContentfulPaint}ms)`);
    console.log(`TBT:  ${tbt}ms ${tbt <= PERFORMANCE_TARGETS.totalBlockingTime ? '✅' : '❌'} (target: ${PERFORMANCE_TARGETS.totalBlockingTime}ms)`);
    console.log(`CLS:  ${cls} ${parseFloat(cls) <= PERFORMANCE_TARGETS.cumulativeLayoutShift ? '✅' : '❌'} (target: ${PERFORMANCE_TARGETS.cumulativeLayoutShift})`);
    console.log(`SI:   ${si}ms ${si <= PERFORMANCE_TARGETS.speedIndex ? '✅' : '❌'} (target: ${PERFORMANCE_TARGETS.speedIndex}ms)`);
    console.log(`TTI:  ${tti}ms ${tti <= PERFORMANCE_TARGETS.timeToInteractive ? '✅' : '❌'} (target: ${PERFORMANCE_TARGETS.timeToInteractive}ms)`);
    
    // Check if all targets met
    const passed = 
      perfScore >= PERFORMANCE_TARGETS.performance &&
      a11yScore >= PERFORMANCE_TARGETS.accessibility &&
      bpScore >= PERFORMANCE_TARGETS.bestPractices &&
      seoScore >= PERFORMANCE_TARGETS.seo &&
      fcp <= PERFORMANCE_TARGETS.firstContentfulPaint &&
      lcp <= PERFORMANCE_TARGETS.largestContentfulPaint &&
      tbt <= PERFORMANCE_TARGETS.totalBlockingTime &&
      parseFloat(cls) <= PERFORMANCE_TARGETS.cumulativeLayoutShift &&
      si <= PERFORMANCE_TARGETS.speedIndex &&
      tti <= PERFORMANCE_TARGETS.timeToInteractive;
    
    if (!passed) {
      allPassed = false;
    }
  });
  
  console.log('\n' + '='.repeat(60));
  
  if (allPassed) {
    console.log('✅ All performance targets met!');
    console.log('🚀 Ready for production deployment');
    process.exit(0);
  } else {
    console.log('❌ Some performance targets not met');
    console.log('⚠️  Review and optimize before deploying to production');
    process.exit(1);
  }
}

// Run verification
verifyLighthouseScores();
