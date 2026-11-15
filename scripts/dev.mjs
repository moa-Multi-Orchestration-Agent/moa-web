import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const backend = process.argv[2] === 'backend';
const args = process.argv.slice(backend ? 3 : 2);
const next = fileURLToPath(new URL('../node_modules/next/dist/bin/next', import.meta.url));
const child = spawn(process.execPath, [next, 'dev', ...args], {
  stdio: 'inherit',
  env: { ...process.env, NEXT_PUBLIC_API_MOCKING: backend ? '' : 'enabled' },
});
child.on('error', (error) => {
  console.error(error);
  process.exitCode = 1;
});
child.on('exit', (code) => {
  process.exitCode = code ?? 1;
});
