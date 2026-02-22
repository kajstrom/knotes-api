import * as esbuild from "esbuild";
import * as fs from "fs";
import * as path from "path";

const outDir = path.resolve(__dirname, "../dist");

// Ensure dist directory exists
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// Get all node_modules as external by default, except aws-sdk
const externalModules = fs
  .readdirSync(path.resolve(__dirname, "../node_modules"))
  .filter(
    (dir) =>
      !dir.startsWith(".") && dir !== "aws-sdk" && dir !== "@aws-sdk"
  )
  .map((dir) => dir);

esbuild
  .build({
    entryPoints: [path.resolve(__dirname, "../src/handler.ts")],
    outfile: path.resolve(outDir, "index.js"),
    bundle: true,
    platform: "node",
    target: "node22",
    external: externalModules,
    format: "cjs",
    sourcemap: false,
  })
  .catch(() => process.exit(1));
