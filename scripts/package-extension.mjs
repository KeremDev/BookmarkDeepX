import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
const distDir = resolve(root, "dist");
const releaseDir = resolve(root, "release");
const zipPath = resolve(releaseDir, `BookmarkDeepX-v${pkg.version}.zip`);

if (!existsSync(resolve(distDir, "manifest.json"))) {
  throw new Error("dist/manifest.json not found. Run npm run build first.");
}

mkdirSync(releaseDir, { recursive: true });
rmSync(zipPath, { force: true });

const result = spawnSync("zip", ["-r", zipPath, "."], {
  cwd: distDir,
  encoding: "utf8",
  stdio: "inherit",
});

if (result.error) {
  throw result.error;
}

if (result.status !== 0) {
  throw new Error(`zip exited with status ${result.status}`);
}

console.log(`Created ${zipPath}`);
