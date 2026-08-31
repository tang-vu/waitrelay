# Local Hosting

WaitRelay runs as a production Next.js process on `127.0.0.1:4318`. A local origin proxy listens on `127.0.0.1:4317`, preserves streaming, and adds `Cache-Control: no-transform` to HTML so Cloudflare cannot inject analytics into the privacy boundary. The named tunnel publishes that origin at `https://waitrelay.tangvu.dev`.

## Process management

Both processes are declared in `ecosystem.config.cjs`:

- `waitrelay-web`: Next.js production server
- `waitrelay-proxy`: local streaming proxy and final HTML response policy
- `waitrelay-tunnel`: Cloudflare Tunnel connector

Start or refresh them with:

```powershell
pnpm install --frozen-lockfile
pnpm build
pm2 start ecosystem.config.cjs --update-env
pm2 save --force
```

Inspect them with:

```powershell
pm2 status
pm2 logs waitrelay-web --lines 100
pm2 logs waitrelay-tunnel --lines 100
```

The machine-level tunnel credential is intentionally outside the repository at `%USERPROFILE%\.cloudflared\waitrelay-v2.json`. Never commit or copy that file into the project.

## Health checks

```powershell
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:4317/api/health
Invoke-WebRequest -UseBasicParsing https://waitrelay.tangvu.dev/api/health
```

Run the seeded browser smoke test through Cloudflare with:

```powershell
$env:PLAYWRIGHT_BASE_URL="https://waitrelay.tangvu.dev"
$env:PLAYWRIGHT_SKIP_WEBSERVER="1"
pnpm exec playwright test tests/e2e/demo-smoke.spec.ts --project=chromium
Remove-Item Env:PLAYWRIGHT_BASE_URL,Env:PLAYWRIGHT_SKIP_WEBSERVER
```

The public endpoint depends on this Windows machine, PM2 resurrection after login, local network availability, and the Cloudflare Tunnel connector.
