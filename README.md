This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Supabase keepalive (avoid project pause)

Supabase can pause free-tier projects after ~7 days of inactivity. To keep the project active, call the keepalive endpoint at least every 5 days.

- **Endpoint:** `GET /api/keepalive` — runs a minimal Supabase read so the project sees activity.
- **Optional auth:** Set `KEEPALIVE_SECRET` in env; then call with `?secret=YOUR_SECRET` or header `X-Keepalive-Secret: YOUR_SECRET` or `Authorization: Bearer YOUR_SECRET`.

**Vercel:** A cron is configured in `vercel.json` to hit `/api/keepalive` every 4 days. Set in Vercel:
- `KEEPALIVE_SECRET` (same value you use below)
- `CRON_SECRET` = same value as `KEEPALIVE_SECRET` so the cron request is allowed

**Hostinger / other hosts:** Use a free external cron (e.g. [cron-job.org](https://cron-job.org), [EasyCron](https://www.easycron.com)) or your host’s cron to run every 4–5 days:

```bash
curl -s "https://YOUR_DOMAIN/api/keepalive?secret=YOUR_KEEPALIVE_SECRET"
```

**GitHub Actions:** Add a workflow that runs on schedule (e.g. `schedule: ['0 12 */4 * *']`) and runs the same `curl` to your deployed URL.

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
