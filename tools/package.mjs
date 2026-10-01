import { cp, mkdir, rm, writeFile, readFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

const project = fileURLToPath(new URL("../", import.meta.url));
const outputRoot = resolve(project, "release");
const bundle = resolve(outputRoot, "JunglePang");
// The disposable bundle is confined to this project's release directory.
if (!bundle.startsWith(outputRoot + sep))
  throw new Error("Invalid bundle path");
await mkdir(outputRoot, { recursive: true });
await rm(bundle, { recursive: true, force: true });
await mkdir(resolve(bundle, "tools"), { recursive: true });
await mkdir(resolve(bundle, "licenses"), { recursive: true });
for (const file of ["README.md", "START-JUNGLE-PANG.cmd", "index.html", "docs", "dist", "artifacts", "src", "public", "tests", "package.json", "package-lock.json", "tsconfig.json", "vite.config.ts", "vitest.config.ts", "playwright.config.ts", ".gitignore", ".gitattributes"])
  await cp(resolve(project, file), resolve(bundle, file), { recursive: true });
for (const file of ["serve.mjs", "start.ps1", "package.mjs"])
  await cp(resolve(project, "tools", file), resolve(bundle, "tools", file));
await cp(
  resolve(project, "node_modules/phaser/LICENSE.md"),
  resolve(bundle, "licenses/Phaser-MIT.txt"),
);
await cp(
  resolve(project, "node_modules/eventemitter3/LICENSE"),
  resolve(bundle, "licenses/EventEmitter3-MIT.txt"),
);
const version = JSON.parse(
  await readFile(resolve(project, "package.json"), "utf8"),
).version;
await writeFile(
  resolve(bundle, "BUILD.json"),
  JSON.stringify(
    {
      version,
      createdAt: new Date().toISOString(),
      indexSha256: createHash("sha256")
        .update(await readFile(resolve(bundle, "dist/index.html")))
        .digest("hex"),
    },
    null,
    2,
  ) + "\n",
);
const zipPath = resolve(outputRoot, `JunglePang-${version}.zip`);
// Paths passed via environment variables remain literal PowerShell values.
execFileSync(
  "powershell.exe",
  [
    "-NoProfile",
    "-Command",
    "Compress-Archive -LiteralPath $env:PANG_PACKAGE_SOURCE -DestinationPath $env:PANG_PACKAGE_ZIP -Force",
  ],
  {
    env: {
      ...process.env,
      PANG_PACKAGE_SOURCE: bundle,
      PANG_PACKAGE_ZIP: zipPath,
    },
  },
);
const digest = createHash("sha256")
  .update(await readFile(zipPath))
  .digest("hex");
await writeFile(zipPath + ".sha256", `${digest}  JunglePang-${version}.zip\n`);
console.log(`Package: ${zipPath}\nSHA256: ${digest}`);
