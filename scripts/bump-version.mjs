#!/usr/bin/env node
// scripts/bump-version.mjs
// Usage:
//   node scripts/bump-version.mjs --suite 2.1.0
//   node scripts/bump-version.mjs --skill backend-systems-auditor --version 1.3.0
//   node scripts/bump-version.mjs --schema 2.0.1

import { readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'

const REGISTRY_PATH = resolve(process.cwd(), 'registry.json')

function readRegistry() {
  return JSON.parse(readFileSync(REGISTRY_PATH, 'utf-8'))
}

function writeRegistry(data) {
  writeFileSync(REGISTRY_PATH, JSON.stringify(data, null, 2) + '\n', 'utf-8')
}

function isSemver(v) {
  return /^\d+\.\d+\.\d+$/.test(v)
}

const args = process.argv.slice(2)
const flags = {}
for (let i = 0; i < args.length; i += 2) {
  flags[args[i].replace(/^--/, '')] = args[i + 1]
}

const registry = readRegistry()

// Bump suite version
if (flags.suite) {
  if (!isSemver(flags.suite)) {
    console.error(`[ERROR] Invalid semver: ${flags.suite}`)
    process.exit(1)
  }
  const prev = registry.suiteVersion
  registry.suiteVersion = flags.suite
  registry.updatedAt = new Date().toISOString().split('T')[0]
  writeRegistry(registry)
  console.log(`✓ Suite version: ${prev} → ${flags.suite}`)
  console.log(`  Updated: registry.json`)
  console.log(`  Next: git add registry.json && git commit -m "chore: bump skill suite to v${flags.suite}"`)
}

// Bump schema version
else if (flags.schema) {
  if (!isSemver(flags.schema)) {
    console.error(`[ERROR] Invalid semver: ${flags.schema}`)
    process.exit(1)
  }
  const prev = registry.schemaVersion
  registry.schemaVersion = flags.schema
  registry.updatedAt = new Date().toISOString().split('T')[0]
  writeRegistry(registry)
  console.log(`✓ Schema version: ${prev} → ${flags.schema}`)
}

// Bump individual skill version
else if (flags.skill && flags.version) {
  if (!isSemver(flags.version)) {
    console.error(`[ERROR] Invalid semver: ${flags.version}`)
    process.exit(1)
  }
  const skill = registry.skills.find(s => s.name === flags.skill)
  if (!skill) {
    console.error(`[ERROR] Skill not found: ${flags.skill}`)
    console.error(`Available: ${registry.skills.map(s => s.name).join(', ')}`)
    process.exit(1)
  }
  const prev = skill.version
  skill.version = flags.version
  registry.updatedAt = new Date().toISOString().split('T')[0]
  writeRegistry(registry)
  console.log(`✓ ${flags.skill}: ${prev} → ${flags.version}`)
}

else {
  console.log(`
Usage:
  node scripts/bump-version.mjs --suite <semver>
  node scripts/bump-version.mjs --skill <name> --version <semver>
  node scripts/bump-version.mjs --schema <semver>

Examples:
  node scripts/bump-version.mjs --suite 2.1.0
  node scripts/bump-version.mjs --skill backend-systems-auditor --version 1.3.0
  `)
  process.exit(1)
}
