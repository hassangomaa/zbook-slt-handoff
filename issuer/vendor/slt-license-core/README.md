# slt-license-core (vendored)

A synced copy of `packages/slt-license-core`, so this product works as a
standalone repository.

**Do not edit these files.** Edit the canonical copy and run:

```bash
node scripts/sync-license-core.mjs
```

`node scripts/sync-license-core.mjs --check` fails the build if this copy
has drifted. It must never drift: the issuer signs licences with this code
and the client verifies them with the same code. One byte of difference and
every licence fails at the customer's site with no visible cause.
