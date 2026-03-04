#!/usr/bin/env node
/**
 * Validates the Aukro API skill's changelog date against the OpenAPI spec.
 * Run from repo root: node .cursor/skills/aukro-api-integration/scripts/check-changelog.mjs
 *
 * Reads the skill asset openapi.yaml and SKILL.md, extracts the latest changelog
 * date from the spec and the changelogDate from the skill, compares them, and
 * exits 0 if up-to-date, 1 if update needed, 2 if error.
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = join(__dirname, '..');
const OPENAPI_PATH = join(SKILL_DIR, 'openapi.yaml');
const SKILL_MD_PATH = join(SKILL_DIR, 'SKILL.md');

const CHANGELOG_DATE_REGEX = /name:\s*Changelog[\s\S]*?description:\s*["']?[\s\S]*?-\s*(\d{2}\.\d{2}\.\d{4})/;
const FRONTMATTER_BLOCK_REGEX = /^---\s*\r?\n([\s\S]*?)\r?\n---/;
const FRONTMATTER_DATE_REGEX = /changelogDate:\s*["']?(\d{2}\.\d{2}\.\d{4})["']?/;

function parseDDMMYYYY(s) {
  const [d, m, y] = s.split('.').map(Number);
  return { year: y, month: m, day: d };
}

function isNewer(a, b) {
  const pa = parseDDMMYYYY(a);
  const pb = parseDDMMYYYY(b);
  if (pa.year !== pb.year) return pa.year > pb.year;
  if (pa.month !== pb.month) return pa.month > pb.month;
  return pa.day > pb.day;
}

function main() {
  let openapiContent;
  let skillContent;

  try {
    openapiContent = readFileSync(OPENAPI_PATH, 'utf8');
  } catch (e) {
    console.error('Could not read openapi.yaml:', e.message);
    process.exit(2);
  }

  try {
    skillContent = readFileSync(SKILL_MD_PATH, 'utf8');
  } catch (e) {
    console.error('Could not read SKILL.md:', e.message);
    process.exit(2);
  }

  const specMatch = openapiContent.match(CHANGELOG_DATE_REGEX);
  if (!specMatch) {
    console.error('Could not find Changelog date in openapi.yaml (regex did not match)');
    process.exit(2);
  }
  const specDate = specMatch[1];

  const frontmatterMatch = skillContent.match(FRONTMATTER_BLOCK_REGEX);
  if (!frontmatterMatch) {
    console.error('Could not find frontmatter block in SKILL.md');
    process.exit(2);
  }

  const skillMatch = frontmatterMatch[1].match(FRONTMATTER_DATE_REGEX);
  if (!skillMatch) {
    console.error('Could not find changelogDate in SKILL.md frontmatter');
    process.exit(2);
  }
  const skillDate = skillMatch[1];

  console.log('OpenAPI spec latest changelog date:', specDate);
  console.log('Skill changelogDate:', skillDate);

  if (specDate === skillDate) {
    console.log('OK: Skill is up to date.');
    process.exit(0);
  }

  if (isNewer(specDate, skillDate)) {
    console.log('UPDATE NEEDED: Official changelog has a newer date. Run the "Keeping the skill up to date" workflow in SKILL.md.');
    process.exit(1);
  }

  // Spec date is older than skill (e.g. local spec was updated manually)
  console.log('OK: Skill date is same or newer than spec (no action).');
  process.exit(0);
}

main();
