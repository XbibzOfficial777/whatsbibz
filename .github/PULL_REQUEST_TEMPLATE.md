<!--
Thanks for the pull request. Keep it focused: one fix or one feature per PR.
Boleh ditulis dalam bahasa Indonesia atau Inggris.
-->

## Summary

<!-- What does this change and why? Link the issue: "Fixes #123". -->

## Type of change

- [ ] Bug fix
- [ ] New feature
- [ ] Protocol update (server behaviour changed — link the *Protocol change* issue and the measurement)
- [ ] Documentation
- [ ] Refactor / internal (no behaviour change)
- [ ] Dependency update

## How was it tested?

<!-- Commands you ran and their results. -->

- [ ] `npm test` passes
- [ ] `npm run check` passes
- [ ] `npm run test:live` was run (required when touching `lib/Socket/`, `lib/Utils/validate-connection.js`, `lib/Utils/platform-identity.js` or `lib/BibzWhats/`) — paste the summary line:

```
# tests 11  # pass 11  # fail 0
```

## Checklist

- [ ] A test covers the new or changed behaviour
- [ ] `.d.ts` files updated for any public API change
- [ ] `README.md` **and** `README.id.md` updated if user-facing behaviour changed
- [ ] `CHANGELOG.md` entry added under *Unreleased*
- [ ] No credentials, session files, tokens or real phone numbers in the diff
- [ ] Commit messages follow Conventional Commits (`fix(client): …`)

## Notes for the reviewer

<!-- Anything that needs a second look: server measurements, upstream diffs, trade-offs. -->
