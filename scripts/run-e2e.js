import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');

async function playwrightAvailable() {
  try {
    await import('@playwright/test');
    return true;
  } catch (error) {
    if (error.code === 'ERR_MODULE_NOT_FOUND') {
      return false;
    }
    throw error;
  }
}

if (!(await playwrightAvailable())) {
  console.warn(
    'Skipping Playwright end-to-end tests: @playwright/test is not installed. Run "npm install" to enable them.'
  );
  process.exit(0);
}

const binName = process.platform === 'win32' ? 'playwright.cmd' : 'playwright';
const binPath = resolve(rootDir, 'node_modules', '.bin', binName);
const command = existsSync(binPath) ? binPath : 'npx';
const args = existsSync(binPath) ? ['test'] : ['playwright', 'test'];

const runner = spawn(command, args, {
  stdio: 'inherit',
  shell: command === 'npx',
  env: process.env,
  cwd: rootDir,
});

runner.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});

runner.on('error', (error) => {
  console.error('Failed to launch Playwright tests:', error);
  process.exit(1);
});
