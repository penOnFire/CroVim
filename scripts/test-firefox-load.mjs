import { spawn } from 'node:child_process';
import { access } from 'node:fs/promises';

async function testFirefoxLoad() {
  console.log('Testing CroVim installation and runtime in Firefox...');
  try {
    await access('/usr/bin/firefox');
  } catch {
    console.log('Firefox binary not found at /usr/bin/firefox; skipping Firefox launch test.');
    return;
  }

  return new Promise((resolve, reject) => {
    const child = spawn(
      'npx',
      [
        'web-ext',
        'run',
        '--source-dir',
        'dist',
        '--firefox=/usr/bin/firefox',
        '--args=-headless',
        '--no-input',
      ],
      { stdio: 'pipe' }
    );

    let stdout = '';
    let stderr = '';
    let resolved = false;

    const timeout = setTimeout(() => {
      if (!resolved) {
        child.kill('SIGKILL');
        reject(new Error(`Firefox load timeout:\n${stdout}\n${stderr}`));
      }
    }, 15000);

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
      if (stdout.includes('Installed') || stdout.includes('as a temporary add-on')) {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          console.log('✓ Successfully installed CroVim temporary add-on into Firefox.');
          child.kill('SIGINT');
          resolve();
        }
      }
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });

    child.on('exit', (code) => {
      clearTimeout(timeout);
      if (!resolved && code !== 0) {
        reject(new Error(`Firefox process exited with code ${code}:\n${stderr}`));
      }
    });
  });
}

testFirefoxLoad()
  .then(() => {
    console.log('Firefox compatibility verified!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Firefox load test failed:', err);
    process.exit(1);
  });
