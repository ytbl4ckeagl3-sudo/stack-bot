const { spawnSync } = require("child_process");
const path = require("path");

const cacheDir =
  process.env.PUPPETEER_CACHE_DIR || path.join(__dirname, "..", ".cache", "puppeteer");

process.env.PUPPETEER_CACHE_DIR = cacheDir;

const isWindows = process.platform === "win32";
const npx = isWindows ? "npx.cmd" : "npx";
const result = isWindows
  ? spawnSync(`${npx} puppeteer browsers install chrome`, {
      stdio: "inherit",
      env: process.env,
      shell: true
    })
  : spawnSync(npx, ["puppeteer", "browsers", "install", "chrome"], {
      stdio: "inherit",
      env: process.env
    });

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status || 0);
