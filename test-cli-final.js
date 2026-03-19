const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const env = {};
for (const [k, v] of Object.entries(process.env)) {
  const up = k.toUpperCase();
  if (up.indexOf('CLAUDE') === -1 && up.indexOf('ANTHROPIC') === -1) {
    env[k] = v;
  }
}

const cliJs = path.join(process.env.APPDATA, 'npm', 'node_modules', '@anthropic-ai', 'claude-code', 'cli.js');
const nodeExe = path.join('C:', 'Program Files', 'nodejs', 'node.exe');

const outFile = 'c:/Users/Administrator/Desktop/TS_AiTool/test-output.txt';

fs.writeFileSync(outFile, 'Starting test...\n');
fs.appendFileSync(outFile, 'nodeExe: ' + nodeExe + ' exists: ' + fs.existsSync(nodeExe) + '\n');
fs.appendFileSync(outFile, 'cliJs: ' + cliJs + ' exists: ' + fs.existsSync(cliJs) + '\n');

const r = spawnSync(nodeExe, [cliJs, '-p', 'say hello', '--output-format', 'text'], {
  env,
  timeout: 25000,
});

fs.appendFileSync(outFile, 'STATUS: ' + r.status + '\n');
fs.appendFileSync(outFile, 'SIGNAL: ' + r.signal + '\n');
fs.appendFileSync(outFile, 'STDOUT len: ' + (r.stdout ? r.stdout.length : 0) + '\n');
fs.appendFileSync(outFile, 'STDERR: ' + (r.stderr ? r.stderr.toString().substring(0, 500) : 'none') + '\n');
if (r.stdout && r.stdout.length > 0) {
  fs.appendFileSync(outFile, 'STDOUT: ' + r.stdout.toString().substring(0, 500) + '\n');
}
fs.appendFileSync(outFile, 'DONE\n');
