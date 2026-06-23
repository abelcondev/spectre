#!/usr/bin/env node
/**
 * Detect Pencil.dev installation and write the MCP server config to .mcp.json.
 *
 * Supported installations:
 * - Pencil desktop app on macOS (arm64 / x64)
 * - Pencil VS Code extension
 *
 * Usage:
 *   node scripts/detect-pencil-mcp.mjs [--write]
 *
 * Without --write it prints the detected config without writing files.
 */

import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { homedir, platform } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = dirname(__dirname);

const args = process.argv.slice(2);
const dryRun = !args.includes('--write');

/**
 * Candidate MCP server binaries to look for.
 * Each entry is a function that returns the absolute path or null.
 */
function getCandidates() {
  const candidates = [];
  const os = platform();

  if (os === 'darwin') {
    candidates.push(
      '/Applications/Pencil.app/Contents/Resources/app.asar.unpacked/out/mcp-server-darwin-arm64',
      '/Applications/Pencil.app/Contents/Resources/app.asar.unpacked/out/mcp-server-darwin-x64',
    );
  } else if (os === 'win32') {
    candidates.push(
      join(
        process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local'),
        'Programs',
        'Pencil',
        'resources',
        'app.asar.unpacked',
        'out',
        'mcp-server-win32-x64.exe',
      ),
      'C:\\Program Files\\Pencil\\resources\\app.asar.unpacked\\out\\mcp-server-win32-x64.exe',
    );
  } else {
    candidates.push(
      '/opt/Pencil/resources/app.asar.unpacked/out/mcp-server-linux-x64',
      '/usr/lib/pencil/resources/app.asar.unpacked/out/mcp-server-linux-x64',
      join(homedir(), 'Applications', 'Pencil', 'resources', 'app.asar.unpacked', 'out', 'mcp-server-linux-x64'),
    );
  }

  // VS Code extension paths (cross-platform)
  const vscodeDirs = [
    join(homedir(), '.vscode', 'extensions'),
    join(homedir(), '.vscode-insiders', 'extensions'),
    join(homedir(), '.cursor', 'extensions'),
  ];

  for (const dir of vscodeDirs) {
    if (existsSync(dir)) {
      candidates.push(
        join(dir, 'pencil-dev.pencil', 'out', `mcp-server-${os === 'darwin' ? 'darwin-arm64' : os === 'win32' ? 'win32-x64' : 'linux-x64'}`),
      );
    }
  }

  return candidates;
}

function detectPencilBinary() {
  for (const candidate of getCandidates()) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

function buildMcpConfig(binaryPath) {
  const isDesktopApp = binaryPath.includes('Pencil.app') || binaryPath.toLowerCase().includes('pencil');
  const args = isDesktopApp ? ['--app', 'desktop'] : [];

  return {
    mcpServers: {
      pencil: {
        command: binaryPath,
        args,
        env: {},
      },
    },
  };
}

async function main() {
  const binaryPath = detectPencilBinary();

  if (!binaryPath) {
    console.error('[detect-pencil-mcp] Pencil MCP server binary not found.');
    console.error('[detect-pencil-mcp] Searched:');
    for (const candidate of getCandidates()) {
      console.error(`  - ${candidate}`);
    }
    process.exit(1);
  }

  console.log(`[detect-pencil-mcp] Found Pencil MCP server: ${binaryPath}`);

  const config = buildMcpConfig(binaryPath);
  const configPath = join(projectRoot, '.mcp.json');

  let existing = null;
  if (existsSync(configPath)) {
    try {
      existing = JSON.parse(await readFile(configPath, 'utf8'));
    } catch {
      console.error(`[detect-pencil-mcp] Existing ${configPath} is not valid JSON.`);
      process.exit(1);
    }
  }

  const merged = {
    ...(existing || {}),
    mcpServers: {
      ...(existing?.mcpServers || {}),
      ...config.mcpServers,
    },
  };

  const output = JSON.stringify(merged, null, 2) + '\n';

  if (dryRun) {
    console.log('[detect-pencil-mcp] Dry run. Would write to:', configPath);
    console.log(output);
    return;
  }

  await writeFile(configPath, output, 'utf8');
  console.log(`[detect-pencil-mcp] Wrote Pencil MCP config to ${configPath}`);
  console.log('[detect-pencil-mcp] Restart Spectre (e.g. /new) to load the MCP server.');
}

main().catch((err) => {
  console.error('[detect-pencil-mcp] Error:', err);
  process.exit(1);
});
