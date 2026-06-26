import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { manifestDir, processedDir, rawDir } from "./config.mjs";

export async function ensureStorage() {
  await mkdir(rawDir, { recursive: true });
  await mkdir(processedDir, { recursive: true });
  await mkdir(manifestDir, { recursive: true });
}

export function contentHash(content) {
  return createHash("sha256").update(String(content), "utf8").digest("hex");
}

async function atomicWrite(file, content) {
  await ensureStorage();
  const tempFile = `${file}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tempFile, content, "utf8");
  await rename(tempFile, file);
  return file;
}

export async function writeJson(kind, name, payload) {
  await ensureStorage();
  const file = join(processedDir, `${kind}-${name}.json`);
  const content = `${JSON.stringify(payload, null, 2)}\n`;
  await atomicWrite(file, content);
  return { file, hash: contentHash(content) };
}

export async function writeRaw(name, content) {
  await ensureStorage();
  const file = join(rawDir, name);
  await atomicWrite(file, content);
  return { file, hash: contentHash(content) };
}

export async function writeManifest(run) {
  await ensureStorage();
  const now = new Date().toISOString();
  const runId = run.run_id ?? randomUUID();
  const manifest = {
    manifest_version: "1.0",
    run_id: runId,
    source_id: run.source_id ?? "node-scraper",
    adapter_version: run.adapter_version ?? "1.0.0",
    schema_version: run.schema_version ?? "1.0.0",
    started_at: run.started_at ?? now,
    completed_at: run.completed_at ?? now,
    status: run.status ?? "SUCCESS",
    record_count: run.record_count ?? 0,
    raw_files: run.raw_files ?? [],
    processed_files: run.processed_files ?? [],
    payload_hashes: run.payload_hashes ?? {},
    source_timestamp: run.source_timestamp ?? null,
    oldest_record_timestamp: run.oldest_record_timestamp ?? null,
    freshness: run.freshness ?? "UNKNOWN",
    errors: run.errors ?? [],
    licence: run.licence ?? {},
    attribution: run.attribution ?? null,
    generated_at: now,
    zero_paid_api: true,
    command: run.command ?? null,
    source_policy: run.source_policy ?? null,
    ...run
  };
  const file = join(manifestDir, `${runId}-${basename(manifest.source_id)}.manifest.json`);
  await atomicWrite(file, `${JSON.stringify(manifest, null, 2)}\n`);
  return file;
}

export async function readFixture(path) {
  return readFile(path, "utf8");
}
