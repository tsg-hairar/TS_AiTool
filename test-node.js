const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const env = {};
for (const [k, v] of Object.entries(process.env)) {
  if (!k.toUpperCase().includes('CLAUDE') && !k.toUpperCase().includes('ANTHROPIC')) {
    env[k] = v;
  }
}

const cliJs = path.join(process.env.APPDATA, 'npm', 'node_modules', '@anthropic-ai', 'claude-code', 'cli.js');
const cwd = path.join('C:', 'Users', 'Administrator', 'Desktop', 'TS delivery app');
const programFiles = path.join('C:', 'Program Files', 'nodejs', 'node.exe');
const nodeExe = fs.existsSync(programFiles) ? programFiles : process.execPath;

console.log('Node:', nodeExe, '| exists:', fs.existsSync(nodeExe));
console.log('CLI:', cliJs, '| exists:', fs.existsSync(cliJs));
console.log('CWD:', cwd);

const child = spawn(nodeExe, [cliJs, '-p', 'say hello', '--output-format', 'stream-json', '--verbose'], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env,
  cwd,
});
child.stdin.end();

let out = '';
child.stdout.on('data', d => {
  out += d.toString();
  console.log('CHUNK:', d.toString().substring(0, 150));
});
child.stderr.on('data', d => {
  console.error('STDERR:', d.toString().substring(0, 200));
});

setTimeout(() => { console.log('TIMEOUT'); child.kill(); }, 25000);

child.on('close', (code, signal) => {
  console.log('EXIT code=' + code + ' signal=' + signal);
  console.log('Total output length:', out.length);
});
child.on('error', e => console.log('ERROR:', e.message));
