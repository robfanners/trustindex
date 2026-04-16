# Incident — Production outage on app.verisum.org

**Date:** 2026-04-14 → 2026-04-15 (multi-day cascade, resolved 2026-04-15 evening)
**Severity:** SEV1 — app unusable, timing overlapped with Avenga CEO demo
**Status:** Resolved. Root cause understood. Preventions in flight.

---

## Summary

Two compounding bugs took the app from healthy to completely broken over 24 hours:

1. **Silent Next.js patch bump (16.1.6 → 16.1.7)** enabled Turbopack as the production build default. Hostinger's static asset serving doesn't match Turbopack's output layout, so every `/_next/static/chunks/*.js` returned 404. HTML rendered, no JS executed.
2. **Panic downgrade to 16.1.6** (with `rm -rf package-lock.json`) pulled newer patch versions of Stripe SDK and recharts that required updated type signatures. "Fixes" were force-pushed to make TypeScript pass, but the resulting bundle crashed the Node process on boot with a non-obvious runtime error — producing HTTP 503 from Hostinger's edge.

Recovery was via `git revert` of both bad commits. Prod stabilised ~30 minutes after revert propagated through Hostinger's build queue.

## Timeline

| Time (BST)         | Event                                                                                                                            |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| 2026-04-14 ~morning| `npm install` upgrades Next 16.1.6 → 16.1.7. Deploy succeeds. Live site serves broken HTML with 404s on every chunk.              |
| 2026-04-14 ~later  | Root cause identified: Turbopack became the default prod builder in 16.1.7. Fix: `NEXT_DISABLE_TURBOPACK=1` in the build script. |
| 2026-04-15 10:54   | Commit `25e2b74` — Turbopack disabled. ✅ Correct fix.                                                                            |
| 2026-04-15 10:54   | Commit `24f4a87` — unrelated panic downgrade to Next 16.1.6 + package-lock rewrite. ❌ Unnecessary and destructive.               |
| 2026-04-15 11:00   | Commit `53960b6` — TS casts to silence stripe/recharts type errors caused by the package-lock rewrite. ❌ Symptom treatment.       |
| 2026-04-15 ~midday | Live app returns HTTP 503 — Node process crash loop on boot. Hostinger logs not showing stdout clearly.                           |
| 2026-04-15 evening | `git revert` of `24f4a87` and `53960b6` (→ `fab9936`, `9c61f91`). Turbopack fix retained.                                         |
| 2026-04-15 ~30 min later | Hostinger rebuilds from reverted tree. Prod healthy. `/auth/login`, `/try`, `/api/try-explorer` all 200.                    |

## Root cause

**Direct cause:** Next.js 16.1.7 made Turbopack the default for `next build`. Hostinger's static-asset layer cannot serve Turbopack's chunk layout. Every app bundle 404s.

**Contributing factors:**

- No environment between local dev and production — a full prod deploy was the first time we exercised the 16.1.7 build on Hostinger.
- Automatic minor/patch updates not pinned. `^16.1.6` let npm silently install 16.1.7.
- Under demo pressure, the response was to layer additional changes (downgrade + lockfile rewrite + type casts) rather than narrow the change set. Each layer introduced its own failure mode.
- Deploy blocker (`npm run predeploy` → tsc + lint + test + build) was bypassed when the pre-push hook was not triggered on the initial 16.1.7 bump — the new dep came in via local `npm install`, not an explicit commit that predeploy could gate.

## Resolution

One surgical change was sufficient to restore service: revert the downgrade and its type-cast follow-up. The Turbopack fix (`NEXT_DISABLE_TURBOPACK=1` in the `build` script) is still in place and is the only line that needs to stay — without it, the next Hostinger rebuild would 404 again.

After revert, working tree at HEAD is byte-identical to the Turbopack-fix commit (`25e2b74`). No improvements were lost.

## What to do differently

### Immediate (this week)

1. **Tag known-good commits.** After any successful deploy, tag HEAD as `v-known-good-YYYY-MM-DD`. Rollback becomes one command: `git reset --hard <tag> && git push --force-with-lease` (only if necessary — `git revert` is still preferred).
2. **Pin Next.js to exact version.** Change `"next": "^16.1.7"` to `"next": "16.1.7"` in `package.json`. Prevents silent minor/patch bumps of a framework where any change can break the Hostinger build.
3. **Document the Turbopack trap in `DEPLOY.md`.** Already in auto-memory; needs to exist in a checked-in runbook too.

### Short-term (next two weeks)

4. **Staging environment on Hostinger.** New Hostinger site pointing at a `staging` branch. Every main-candidate PR merges there first and is smoke-tested before fast-forwarding to main. See `docs/operations/staging-setup.md`.
5. **Resist layered fixes during an outage.** One change at a time. Revert before re-attempting. If the first fix didn't work, the second fix should be the revert, not another patch on top.

### Longer-term

6. **Hostinger observability.** Runtime logs currently only show the latest deploy and Hostinger buffers stdout. Wire Next.js server logs to an external sink (Logtail, Axiom, or similar) so crash-loop errors are visible without having to guess from HTTP codes.
7. **Synthetic health check.** A scheduled (Make.com or cron) `curl -fsS https://app.verisum.org/api/keepalive` that alerts on non-200. Would have caught the chunk 404s within minutes instead of via manual discovery.

## Decision log

- **Do not re-pin `package-lock.json` as a reflex during outages.** Regenerating the lockfile during a live incident pulled newer transitive versions of stripe and recharts. The type errors that followed were noise — treating them as bugs caused a second commit that compounded the problem.
- **Do not bundle multiple fixes in one push.** Commit `24f4a87` conflated "Turbopack workaround" with "Next downgrade" with "lockfile rewrite". When rollback was needed, `git revert` had to undo all three, losing clarity on which change fixed what.

## References

- Turbopack-disable commit: `25e2b74`
- Bad downgrade commit: `24f4a87` (reverted in `fab9936`)
- Bad type-cast commit: `53960b6` (reverted in `9c61f91`)
- Memory: `.auto-memory/project_hostinger_turbopack.md`
