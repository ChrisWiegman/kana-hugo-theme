import { chromium } from "@playwright/test";
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const server = spawn(
  "hugo",
  ["server", "--source", "dev", "--port", "1314", "--disableFastRender", "--baseURL", "http://127.0.0.1:1314"],
  { cwd: root, stdio: "pipe" }
);

async function waitForServer(url, timeout = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("Server did not start in time");
}

try {
  console.log("Starting Hugo dev server...");
  await waitForServer("http://127.0.0.1:1314");
  console.log("Server ready. Taking screenshots...");

  const browser = await chromium.launch();

  const page1 = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
  await page1.goto("http://127.0.0.1:1314", { waitUntil: "networkidle" });
  await page1.screenshot({ path: path.join(root, "images", "screenshot.png"), clip: { x: 0, y: 0, width: 1500, height: 1000 } });
  console.log("Saved images/screenshot.png (1500x1000)");

  const page2 = await browser.newPage({ viewport: { width: 900, height: 600 } });
  await page2.goto("http://127.0.0.1:1314", { waitUntil: "networkidle" });
  await page2.screenshot({ path: path.join(root, "images", "tn.png"), clip: { x: 0, y: 0, width: 900, height: 600 } });
  console.log("Saved images/tn.png (900x600)");

  await browser.close();
} finally {
  server.kill();
}
