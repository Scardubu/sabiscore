import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { processedDir, rawDir } from "./config.mjs";

export async function ensureStorage() {
  await mkdir(rawDir, { recursive: true });
  await mkdir(processedDir, { recursive: true });
}

export async function writeJson(kind, name, payload) {
  await ensureStorage();
  const file = join(processedDir, `${kind}-${name}.json`);
  await writeFile(file, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return file;
}

export async function writeRaw(name, content) {
  await ensureStorage();
  const file = join(rawDir, name);
  await writeFile(file, content, "utf8");
  return file;
}

export async function writeManifest(run) {
  await ensureStorage();
  const manifest = {
    schema_version: "1.0.0",
    generated_at: new Date().toISOString(),
    zero_paid_api: true,
    ...run
  };
  const file = join(processedDir, "manifest.json");
  await writeFile(file, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return file;
}

export async function readFixture(path) {
  return readFile(path, "utf8");
}
