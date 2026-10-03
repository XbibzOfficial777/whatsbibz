---
title: Security and responsible use
description: Protect sessions, respect privacy and consent, and follow WhatsApp usage limits.
---

# Security and responsible use

WhatsBibz is an unofficial library that communicates with WhatsApp Web. Use it only with accounts you control and for activity permitted by WhatsApp/Meta terms and applicable law.

## Protect account credentials

1. Store `authDir` on encrypted storage with least-privilege permissions; never commit it or upload it as a build artifact/log.
2. Keep pairing codes and QR images secret. Never send session credentials to users, vendors, or public issues.
3. Stop the client before making a backup. Encrypt the backup and set retention/deletion rules; do not share one session directory among processes.
4. If a session leaks, unlink the device from the phone, treat the credentials as compromised, review logs/backups, and pair again only after addressing the cause.
5. Minimize logged message data. Redact JIDs, phone numbers, content, files, and personal metadata.

## Protect recipients

- Obtain appropriate consent and provide an honored opt-out.
- Avoid unsolicited bulk messages, spam, impersonation, fraud, phishing, and automation intended to evade blocks or rate limits.
- Treat incoming events and button responses as untrusted input; allow-list actions.
- Limit per-number/group rates, idempotency, retries, file sizes, and worker access to data.
- Do not use rich messages to suggest that your bot comes from Meta, WhatsApp, or a human.

## Support boundaries

The protocol, identity profiles, pairing fields, and rich schemas can change at any time. The wrapper provides bounded recovery but cannot guarantee availability, delivery, policy compliance, or that an account will not be restricted. For business-critical needs, evaluate the official WhatsApp Business Platform and appropriate operational support.

## Report a vulnerability

Do not publicly disclose sessions, pairing codes, private payloads, or exploit steps that expose account access. Use the repository's [security policy](https://github.com/XbibzOfficial777/whatsbibz/security/policy): report privately through GitHub Security or email `revandoppratama@gmail.com` with the subject `[whatsbibz security]`. Provide only the minimum details needed for safe reproduction and coordinate before public disclosure.
