---
title: Sessions and security
description: Protect linked-device credentials, limit access, back up carefully, and distinguish close from logout.
---

# Sessions and security

Multi-device authentication stores cryptographic material and credentials that can preserve account access. Treat the entire `authDir` as a high-sensitivity secret—not as an ordinary cache or configuration folder.

## Store sessions safely

- Give each account its own directory, for example `./data/account-a-session`.
- Add session paths to `.gitignore`, developer backups, CI artifacts, container images, and any unsafe sync tool. Verify ignore rules for your project; a pattern that works in one repository may not apply in another.
- Restrict directory and file permissions to the process user. Isolate each bot/process on shared servers.
- Use persistent encrypted volumes or audited secret storage. Do not print credentials, auth state, QR codes, pairing codes, or `sock.authState` objects to logs.
- Do not copy a folder while the client is writing it. For a backup, stop the client with `close()`, copy atomically and encrypt the copy, then restrict access to recovery operators.
- Do not run two processes against the same `authDir`. Concurrent writes can corrupt or roll back state.

The library uses multi-file auth state. Several files can change while the process runs as keys or credentials are updated; an older copy may not restore if the snapshot is inconsistent. Test recovery with a test account. Encrypt both in transit and at rest, and define retention and deletion policies.

## Keep sessions out of Git

The following is a starting point only; adapt it to the names your application uses:

```text
# WhatsBibz session secrets (ensure patterns match your authDir)
/data/*session*/
/bibzwhats-session/
.env
```

After staging, verify with `git status --short` and `git check-ignore -v data/account-a-session`. If credentials ever entered a commit or log, assume they were exposed: log out/unlink the device from the phone, clean up history according to your team's policy, and rotate secrets. Removing a file from the working tree does not remove older committed copies.

## Use lifecycle methods correctly

`client.close()` closes the socket and timers while preserving `authDir` for a restart. `client.logout()` requests a server-side logout and deletes the session directory; the linked device must be paired again. Use logout when you intend to revoke the device, not on every deployment.

QR codes and pairing codes act like temporary credentials. Send them over private channels, show them only to an authorized operator, limit how long logs retain them, and avoid CI output or public screenshots. Never ask users to upload their auth folder to an issue tracker.

## Message data and privacy

Incoming messages can contain personal data, pictures, files, locations, and identity metadata. Minimize logging, set retention, restrict access, validate files before opening, and tell users how your bot processes their data. Obtain any required consent. WhatsApp Web transport does not guarantee that data remains encrypted after it reaches your Node.js process or database.

WhatsBibz is not the official WhatsApp Business Platform. Account restrictions, protocol changes, service failures, and operational risk remain possible. Follow Meta/WhatsApp terms; do not send unsolicited messages, bypass limits, spam, or operate accounts you do not control.
