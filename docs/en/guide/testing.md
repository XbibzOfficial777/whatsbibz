---
title: Testing and diagnostics
description: Run unit tests, export checks, and live identity tests carefully.
---

# Testing and diagnostics

Test parsing helpers and wrapper behavior locally before connecting a primary number. The project test suite is in `test/` and uses Node.js's built-in test runner.

## Basic checks

```bash
npm install
npm test
npm run check
```

`npm test` runs `test/*.test.js`, including offline identity and lifecycle coverage. `npm run check` imports the package entrypoint and verifies required exports. Documentation commands are `npm run docs:dev`, `npm run docs:build`, and `npm run docs:preview`.

Local tests cannot prove that WhatsApp's server will accept a pairing request or message format. Some protocol behavior can only be checked with a test account.

## Live identity tests

`npm run test:live` enables tests that communicate directly with WhatsApp/Web endpoints. Run them only with an account/number you control, after reviewing `test/identity-live.test.js` and the [identity verification notes](/en/guide/device-identity). Tests can generate traffic, pairing/QR output, rate limits, or different outcomes as the server changes.

Do not run live tests in public CI, against someone else's account, or repeatedly to probe a long list of identities. Use them for a planned validation with operator approval and sufficient delay. A result is not a long-term guarantee.

## Add application-level tests

- Test `extractMessage()` with text, media, ephemeral/view-once wrappers, edits, buttons, polls, and optional fields.
- Test deduplication using message IDs and behavior when an event appears twice.
- Simulate `ready` more than once to verify handlers move to the active socket.
- Test timeout/failure paths from `sendText`/`sendMedia`; ensure retries do not create uncontrolled duplicates.
- Close the client in tests and verify reconnect timers have been cancelled.
- Do not place real credentials or personal data in fixtures; use sanitized mock messages.

If you change identity/protocol logic, record Node.js and WhatsBibz versions, test date, handshake/pairing phase, and sanitized status. Update live tests only with the account owner's approval.
