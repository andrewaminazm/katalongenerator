import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distServices = path.join(serverRoot, "dist", "services");

const files = [
  "extractLocators.inbrowser.js",
  "recorderInject.inbrowser.js",
  "collectPlaywrightRaw.inbrowser.js",
];

fs.mkdirSync(distServices, { recursive: true });
for (const f of files) {
  const src = path.join(serverRoot, "src", "services", f);
  const dest = path.join(distServices, f);
  fs.copyFileSync(src, dest);
  console.log("Copied", f, "→ dist/services/");
}
