import esbuild from "esbuild";
import pinoPlugin from "esbuild-plugin-pino";
import { copyFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");

async function build() {
  console.log("Building backend...");
  
  // Ensure dist directory exists
  mkdirSync(join(rootDir, "dist"), { recursive: true });
  
  await esbuild.build({
    entryPoints: [join(rootDir, "index.ts")],
    bundle: true,
    platform: "node",
    target: "node20",
    format: "esm",
    outfile: join(rootDir, "dist/index.mjs"),
    sourcemap: true,
    external: ["@workspace/*"],
    plugins: [pinoPlugin()],
    logLevel: "info",
  });
  
  console.log("Build complete!");
}

build().catch(console.error);
