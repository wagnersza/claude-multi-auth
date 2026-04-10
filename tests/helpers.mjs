import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export function createTempDir(prefix = "cma-test-") {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

export function removeTempDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

export function writeTempJson(dir, filename, data) {
  const filePath = path.join(dir, filename);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
  return filePath;
}
