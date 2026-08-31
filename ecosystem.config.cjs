/* eslint-disable @typescript-eslint/no-require-imports -- PM2 loads ecosystem files as CommonJS. */
const fs = require("node:fs");
const path = require("node:path");

const root = __dirname;
const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");
const tunnelConfig = process.env.WAITRELAY_TUNNEL_CONFIG ?? path.join(root, "ops", "cloudflared.yml");
const cloudflaredCandidates = [
  process.env.WAITRELAY_CLOUDFLARED_PATH,
  "C:\\Program Files (x86)\\cloudflared\\cloudflared.exe",
  "C:\\Program Files\\cloudflared\\cloudflared.exe",
].filter(Boolean);
const cloudflared = cloudflaredCandidates.find((candidate) => fs.existsSync(candidate));

if (!fs.existsSync(nextBin)) {
  throw new Error("Next.js is not installed. Run pnpm install before starting PM2.");
}
if (!cloudflared) {
  throw new Error("cloudflared.exe was not found. Set WAITRELAY_CLOUDFLARED_PATH.");
}
if (!fs.existsSync(tunnelConfig)) {
  throw new Error(`Cloudflare Tunnel config was not found at ${tunnelConfig}.`);
}

const shared = {
  cwd: root,
  namespace: "waitrelay",
  autorestart: true,
  watch: false,
  time: true,
  restart_delay: 5_000,
  max_restarts: 50,
  kill_timeout: 15_000,
};

module.exports = {
  apps: [
    {
      ...shared,
      name: "waitrelay-web",
      script: nextBin,
      interpreter: process.execPath,
      args: ["start", "--hostname", "127.0.0.1", "--port", "4318"],
      min_uptime: 15_000,
      max_memory_restart: "1G",
      env: { NODE_ENV: "production" },
    },
    {
      ...shared,
      name: "waitrelay-proxy",
      script: path.join(root, "ops", "origin-proxy.mjs"),
      interpreter: process.execPath,
      min_uptime: 10_000,
      max_memory_restart: "256M",
      env: {
        WAITRELAY_PROXY_HOST: "127.0.0.1",
        WAITRELAY_PROXY_PORT: "4317",
        WAITRELAY_UPSTREAM_HOST: "127.0.0.1",
        WAITRELAY_UPSTREAM_PORT: "4318",
      },
    },
    {
      ...shared,
      name: "waitrelay-tunnel",
      script: cloudflared,
      interpreter: "none",
      args: ["tunnel", "--no-autoupdate", "--config", tunnelConfig, "run"],
      min_uptime: 10_000,
    },
  ],
};
