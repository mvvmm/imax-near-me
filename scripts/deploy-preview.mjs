import { spawn } from 'node:child_process';
import { writePreviewOutput } from './preview-output.mjs';

const child = spawn('cf', ['previews', 'deploy', ...process.argv.slice(2)], {
  stdio: ['inherit', 'pipe', 'inherit'],
});
let output = '';
child.stdout.on('data', chunk => { process.stdout.write(chunk); output += chunk; });
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
child.on('close', async code => {
  if (code !== 0) { process.exitCode = code ?? 1; return; }
  try {
    // Build progress may precede the JSON. Parse the final preview object.
    const starts = [...output.matchAll(/^\s*\{/gm)].map(match => match.index);
    let result;
    for (const start of starts.reverse()) {
      try {
        const candidate = JSON.parse(output.slice(start));
        if (candidate.type === 'preview') { result = candidate; break; }
      } catch { /* Try the next JSON boundary. */ }
    }
    if (!result) throw new Error('Could not find cf preview JSON in command output');
    const file = await writePreviewOutput(result, process.env.WRANGLER_OUTPUT_FILE_DIRECTORY, '70mm', process.env.WRANGLER_OUTPUT_FILE_PATH);
    if (file) console.log(`Reported preview URLs to Workers Builds: ${file}`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
});
