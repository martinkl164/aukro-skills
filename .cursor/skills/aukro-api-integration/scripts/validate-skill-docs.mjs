#!/usr/bin/env node
/**
 * Validates Aukro skill docs against the local OpenAPI asset.
 *
 * Run from repo root:
 *   node .cursor/skills/aukro-api-integration/scripts/validate-skill-docs.mjs
 *
 * What it checks:
 * 1) Endpoints listed in SKILL.md "Key endpoints" table exist in openapi.yaml.
 * 2) Listed endpoint method+path pairs are not deprecated in openapi.yaml.
 * 3) Schemas listed in reference.md "Main schemas" table exist in openapi.yaml.
 * 4) reference.md does not contain a stale hardcoded "currently DD.MM.YYYY" date.
 *
 * Exit codes:
 * 0 = all checks passed
 * 1 = docs update needed (missing/deprecated/mismatch)
 * 2 = script/runtime error
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = join(__dirname, '..');

const OPENAPI_PATH = join(SKILL_DIR, 'openapi.yaml');
const SKILL_MD_PATH = join(SKILL_DIR, 'SKILL.md');
const REFERENCE_MD_PATH = join(SKILL_DIR, 'reference.md');

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD', 'TRACE'];

function extractSectionByHeading(markdown, headingText) {
  const headingRegex = new RegExp(`^##\\s+${escapeRegExp(headingText)}\\s*$`, 'm');
  const startMatch = markdown.match(headingRegex);

  if (!startMatch || startMatch.index === undefined) {
    return null;
  }

  const start = startMatch.index + startMatch[0].length;
  const rest = markdown.slice(start);
  const endMatch = rest.match(/^##\s+/m);

  if (!endMatch || endMatch.index === undefined) {
    return rest.trim();
  }

  return rest.slice(0, endMatch.index).trim();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseSkillChangelogDate(skillContent) {
  const frontmatterMatch = skillContent.match(/^---\s*\r?\n([\s\S]*?)\r?\n---/);
  if (!frontmatterMatch) {
    return null;
  }

  const frontmatter = frontmatterMatch[1];
  const dateMatch = frontmatter.match(/changelogDate:\s*["']?(\d{2}\.\d{2}\.\d{4})["']?/);
  return dateMatch ? dateMatch[1] : null;
}

function parseOpenApiOperations(openapiContent) {
  const operations = new Map();
  const lines = openapiContent.split(/\r?\n/);

  let currentPath = null;
  let currentMethod = null;

  for (const line of lines) {
    const pathMatch = line.match(/^  (\/[^:]+):\s*$/);
    if (pathMatch) {
      currentPath = pathMatch[1];
      currentMethod = null;
      continue;
    }

    const methodMatch = line.match(/^    (get|post|put|patch|delete|options|head|trace):\s*$/i);
    if (currentPath && methodMatch) {
      currentMethod = methodMatch[1].toUpperCase();
      operations.set(`${currentMethod} ${currentPath}`, { deprecated: false });
      continue;
    }

    if (currentPath && currentMethod && /^      deprecated:\s*true\s*$/i.test(line)) {
      const key = `${currentMethod} ${currentPath}`;
      const current = operations.get(key);
      if (current) {
        current.deprecated = true;
        operations.set(key, current);
      }
      continue;
    }

    const pathLevelKey = line.match(/^    ([A-Za-z0-9_-]+):\s*$/);
    if (
      currentPath &&
      currentMethod &&
      pathLevelKey &&
      !HTTP_METHODS.includes(pathLevelKey[1].toUpperCase())
    ) {
      currentMethod = null;
    }
  }

  return operations;
}

function parseOpenApiSchemas(openapiContent) {
  const schemas = new Set();
  const lines = openapiContent.split(/\r?\n/);

  let inComponents = false;
  let inSchemas = false;

  for (const line of lines) {
    if (/^components:\s*$/.test(line)) {
      inComponents = true;
      continue;
    }

    if (!inComponents) {
      continue;
    }

    if (/^  schemas:\s*$/.test(line)) {
      inSchemas = true;
      continue;
    }

    if (inSchemas && /^  [A-Za-z0-9_-]+:\s*$/.test(line)) {
      inSchemas = false;
      continue;
    }

    if (inSchemas) {
      const schemaMatch = line.match(/^    ([A-Za-z0-9_]+):\s*$/);
      if (schemaMatch) {
        schemas.add(schemaMatch[1]);
      }
    }
  }

  return schemas;
}

function parseEndpointsFromSkill(skillContent) {
  const section = extractSectionByHeading(skillContent, 'Key endpoints (use v2; older ones are deprecated)');
  if (!section) {
    throw new Error('Could not find "Key endpoints" section in SKILL.md');
  }

  const endpoints = [];
  const lines = section.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('|')) {
      continue;
    }

    if (/^\|[-\s|]+\|?$/.test(trimmed)) {
      continue;
    }

    const cells = trimmed
      .split('|')
      .slice(1, -1)
      .map((part) => part.trim());

    if (cells.length < 4 || cells[0] === 'Operation') {
      continue;
    }

    const operationLabel = cells[0];
    const methodCell = cells[1].toUpperCase();
    const pathCell = cells[2].replace(/`/g, '').trim();

    const methods = [...methodCell.matchAll(/GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD|TRACE/g)].map((m) => m[0]);
    if (methods.length === 0) {
      throw new Error(`Could not parse HTTP method(s) for operation "${operationLabel}"`);
    }

    if (!pathCell.startsWith('/')) {
      throw new Error(`Could not parse API path for operation "${operationLabel}"`);
    }

    for (const method of methods) {
      endpoints.push({ operationLabel, method, path: pathCell });
    }
  }

  if (endpoints.length === 0) {
    throw new Error('No endpoints parsed from SKILL.md key endpoint table');
  }

  return endpoints;
}

function parseSchemasFromReference(referenceContent) {
  const section = extractSectionByHeading(referenceContent, 'Main schemas (components/schemas)');
  if (!section) {
    throw new Error('Could not find "Main schemas" section in reference.md');
  }

  const schemas = new Set();
  const lines = section.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('|')) {
      continue;
    }

    if (/^\|[-\s|]+\|?$/.test(trimmed)) {
      continue;
    }

    const cells = trimmed
      .split('|')
      .slice(1, -1)
      .map((part) => part.trim());

    if (cells.length < 2 || cells[0] === 'Schema') {
      continue;
    }

    const schemaCell = cells[0];
    const matches = [...schemaCell.matchAll(/`([^`]+)`/g)].map((m) => m[1].trim());
    const schemaNames = matches.length > 0 ? matches : schemaCell.split('/').map((v) => v.trim());

    for (const schemaName of schemaNames) {
      if (schemaName) {
        schemas.add(schemaName);
      }
    }
  }

  if (schemas.size === 0) {
    throw new Error('No schemas parsed from reference.md schema table');
  }

  return schemas;
}

function main() {
  let openapiContent;
  let skillContent;
  let referenceContent;

  try {
    openapiContent = readFileSync(OPENAPI_PATH, 'utf8');
    skillContent = readFileSync(SKILL_MD_PATH, 'utf8');
    referenceContent = readFileSync(REFERENCE_MD_PATH, 'utf8');
  } catch (error) {
    console.error('Could not read one of required files:', error.message);
    process.exit(2);
  }

  let endpoints;
  let schemasInReference;

  try {
    endpoints = parseEndpointsFromSkill(skillContent);
    schemasInReference = parseSchemasFromReference(referenceContent);
  } catch (error) {
    console.error(error.message);
    process.exit(2);
  }

  const operations = parseOpenApiOperations(openapiContent);
  const schemas = parseOpenApiSchemas(openapiContent);

  const missingEndpoints = [];
  const deprecatedEndpoints = [];
  const missingSchemas = [];
  const notices = [];

  for (const endpoint of endpoints) {
    const key = `${endpoint.method} ${endpoint.path}`;
    const op = operations.get(key);

    if (!op) {
      missingEndpoints.push(`${endpoint.operationLabel}: ${key}`);
      continue;
    }

    if (op.deprecated) {
      deprecatedEndpoints.push(`${endpoint.operationLabel}: ${key}`);
    }
  }

  for (const schema of schemasInReference) {
    if (!schemas.has(schema)) {
      missingSchemas.push(schema);
    }
  }

  const skillDate = parseSkillChangelogDate(skillContent);
  const hardcodedReferenceDate = referenceContent.match(/\(currently\s+(\d{2}\.\d{2}\.\d{4})\)/);

  if (hardcodedReferenceDate) {
    const referenceDate = hardcodedReferenceDate[1];
    if (skillDate && referenceDate !== skillDate) {
      notices.push(
        `reference.md hardcoded date (${referenceDate}) differs from SKILL.md changelogDate (${skillDate}).`
      );
    } else {
      notices.push(
        `reference.md contains hardcoded date (${referenceDate}); consider removing it to avoid future drift.`
      );
    }
  }

  console.log('Parsed OpenAPI operations:', operations.size);
  console.log('Parsed OpenAPI schemas:', schemas.size);
  console.log('Parsed documented endpoints:', endpoints.length);
  console.log('Parsed documented schemas:', schemasInReference.size);

  const hasIssues =
    missingEndpoints.length > 0 ||
    deprecatedEndpoints.length > 0 ||
    missingSchemas.length > 0 ||
    notices.length > 0;

  if (!hasIssues) {
    console.log('OK: Skill docs are consistent with openapi.yaml and have no deprecated documented endpoints.');
    process.exit(0);
  }

  if (missingEndpoints.length > 0) {
    console.log('\nMissing documented endpoints in openapi.yaml:');
    for (const item of missingEndpoints) {
      console.log(`- ${item}`);
    }
  }

  if (deprecatedEndpoints.length > 0) {
    console.log('\nDocumented endpoints marked deprecated in openapi.yaml:');
    for (const item of deprecatedEndpoints) {
      console.log(`- ${item}`);
    }
  }

  if (missingSchemas.length > 0) {
    console.log('\nMissing documented schemas in openapi.yaml:');
    for (const item of missingSchemas) {
      console.log(`- ${item}`);
    }
  }

  if (notices.length > 0) {
    console.log('\nNotices:');
    for (const notice of notices) {
      console.log(`- ${notice}`);
    }
  }

  console.log('\nUPDATE NEEDED: Refresh SKILL.md/reference.md to match openapi.yaml.');
  process.exit(1);
}

main();
