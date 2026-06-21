import { appendFile, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { appRoot } from './paths.mjs';

const packageName = '@moonshot-ai/kimi-code';
const packageJson = JSON.parse(
  await readFile(resolve(appRoot, 'package.json'), 'utf-8'),
);

function parsePublishedPackages() {
  const raw = process.env['CHANGESETS_PUBLISHED_PACKAGES'];
  if (raw === undefined || raw.trim().length === 0) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function outputLine(name, value) {
  return `${name}=${value}\n`;
}

const publishedPackage = parsePublishedPackages().find(
  (entry) =>
    typeof entry === 'object' &&
    entry !== null &&
    entry.name === packageName &&
    typeof entry.version === 'string',
);

// Specter releases are tagged v0.x.y and are not published to npm. When the
// workflow is triggered by a version tag, use that tag directly and always
// publish native artifacts.
const refType = process.env['GITHUB_REF_TYPE'];
const refName = process.env['GITHUB_REF_NAME'];
const isSpecterTag = refType === 'tag' && typeof refName === 'string' && refName.startsWith('v');

const version = isSpecterTag
  ? refName.replace(/^v/, '')
  : (publishedPackage?.version ?? packageJson.version);
const shouldPublish = isSpecterTag || publishedPackage !== undefined;
const tag = isSpecterTag ? refName : `${packageName}@${version}`;
const githubOutput = process.env['GITHUB_OUTPUT'];

if (githubOutput !== undefined) {
  await appendFile(
    githubOutput,
    [
      outputLine('should_publish', String(shouldPublish)),
      outputLine('version', version),
      outputLine('tag', tag),
    ].join(''),
  );
}

console.log(`should_publish=${String(shouldPublish)}`);
console.log(`version=${version}`);
console.log(`tag=${tag}`);
