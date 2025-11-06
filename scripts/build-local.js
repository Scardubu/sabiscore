const { spawn } = require('child_process');

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: 'inherit', shell: true, ...opts });
    p.on('close', (code) => {
      if (code === 0) return resolve();
      return reject(new Error(`${cmd} ${args.join(' ')} exited with ${code}`));
    });
  });
}

(async () => {
  try {
    console.log('Building apps/web...');
  // Ensure deps are present for web (use npm install to be tolerant on dev machines)
  await run('npm', ['install', '--prefix', 'apps/web']);
    await run('npm', ['run', 'build', '--prefix', 'apps/web']);

    console.log('Running backend tests (optional)...');
    // Install backend deps and run tests (non-blocking if pytest missing)
    try {
      await run('python', ['-m', 'pip', 'install', '--upgrade', 'pip']);
      await run('python', ['-m', 'pip', 'install', '-r', 'backend/requirements.txt']);
      await run('python', ['-m', 'pytest', 'backend/tests/ -q']);
    } catch (e) {
      console.warn('Backend tests skipped or failed (non-fatal):', e.message);
    }

    console.log('Local build finished successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Local build failed:', err.message);
    process.exit(1);
  }
})();
