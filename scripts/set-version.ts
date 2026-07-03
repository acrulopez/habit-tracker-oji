/**
 * Sync app.config.ts's marketing version from a release tag. Run in CI on a tag push:
 *
 *   npx tsx scripts/set-version.ts v1.2.0     # explicit tag
 *   GITHUB_REF_NAME=v1.2.0 npx tsx scripts/set-version.ts
 *   npm run set-version v1.2.0
 *
 * Strips a leading "v", validates the tag is plain semver (X.Y.Z), and rewrites
 * the `version: "X.Y.Z"` line in app.config.ts. The build number
 * (CFBundleVersion / versionCode) is NOT touched here — EAS auto-increments it
 * (appVersionSource: remote, autoIncrement: true). The git tag is the single
 * source of truth for the marketing version; this edit is not committed back.
 *
 * NOTE: this app uses a dynamic app.config.ts (not app.json), so the version is
 * edited by regex rather than JSON parse. It matches the single top-level
 * `version: "<semver>"` entry.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

const SEMVER = /^\d+\.\d+\.\d+$/;
// Matches   version: "1.2.0"   or   version: '1.2.0'
const VERSION_LINE = /(\bversion:\s*)(['"])(\d+\.\d+\.\d+)\2/g;

function fail(message: string): never {
  console.error(`set-version: ${message}`);
  process.exit(1);
}

const rawTag = (process.argv[2] ?? process.env.GITHUB_REF_NAME ?? '').trim();
if (!rawTag) {
  fail('no tag provided (pass an argument or set GITHUB_REF_NAME), e.g. v1.2.0');
}

const version = rawTag.replace(/^v/, '');
if (!SEMVER.test(version)) {
  fail(`tag "${rawTag}" is not a valid vX.Y.Z version`);
}

const configPath = path.resolve(__dirname, '..', 'app.config.ts');
const source = fs.readFileSync(configPath, 'utf8');

const matches = source.match(VERSION_LINE);
if (!matches) {
  fail('app.config.ts has no `version: "X.Y.Z"` entry to update');
}
if (matches.length > 1) {
  fail(`expected one version entry in app.config.ts, found ${matches.length}`);
}

let previous = '';
const updated = source.replace(VERSION_LINE, (_m, prefix, quote, current) => {
  previous = current;
  return `${prefix}${quote}${version}${quote}`;
});

fs.writeFileSync(configPath, updated);
console.log(`set-version: app.config.ts version ${previous} -> ${version}`);
