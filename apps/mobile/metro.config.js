const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Watch monorepo root so shared packages (api-client, shared-types) resolve
config.watchFolders = [monorepoRoot];

// Make sure Metro resolves from the mobile app first, then monorepo root
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];

// Follow pnpm symlinks into the virtual store
config.resolver.unstable_enableSymlinks = true;

// Force project root so bundle requests resolve from apps/mobile
config.projectRoot = projectRoot;

module.exports = config;
