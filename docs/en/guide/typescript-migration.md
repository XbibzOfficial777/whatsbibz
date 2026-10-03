---
title: TypeScript and migration
description: Configure TypeScript ESM, use public types, understand aliases, and migrate from an earlier Baileys integration.
---

# TypeScript and migration

WhatsBibz publishes an ESM package with declaration files. Node.js 20 or later is required. For a new TypeScript project, select module settings that understand ESM.

## TypeScript configuration

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": false,
    "outDir": "dist"
  },
  "include": ["src/**/*.ts"]
}
```

Set `"type": "module"` in `package.json`, or use `.mts`/`.mjs` according to your toolchain. CommonJS `require()` is not a supported package export (`import` is the published condition); a CommonJS application should migrate to ESM or use dynamic `import()`.

## Import the API and types

```ts
import {
  createBibzWhats,
  extractMessage,
  sendText,
  type BibzWhatsClient,
  type BibzWhatsOptions,
  type ExtractedMessage,
  type WASocket,
} from '@xbibzlibrary/whatsbibz';

const options: BibzWhatsOptions = {
  phone: process.env.WHATSAPP_PHONE,
  authDir: './data/account-session',
};
const client: BibzWhatsClient = await createBibzWhats(options);

client.on('ready', (sock: WASocket) => {
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const message of messages) {
      const result: ExtractedMessage | null = extractMessage(message);
      if (result?.type === 'text') {
        await sendText(sock, message.key.remoteJid, 'Message received.', { quoted: message });
      }
    }
  });
});
```

Socket event payloads follow the Baileys-compatible types in the installed version. Some rich builders (`Button`, `ButtonV2`, `AIRich`, `Carousel`) have minimal declarations and dynamically typed methods; do not expect strict autocomplete for every builder option.

## Aliases and compatibility exports

- `createBibzWhats` is the recommended high-level client factory; `createWhatsBibz` is an alias.
- `makeWASocket` is the default export and a named export; `makeBibzSocket` and `makeWhatsBibzSocket` are aliases.
- `WASocket` is the return type of `makeWASocket`; `BibzSocket` aliases that type.
- `BibzWhatsEngine` is an exported socket helper class. `sock.bibz` and `sock.ourin` are engine aliases, but new applications should prefer stable socket methods.
- `sendText`, `sendMedia`, `extractMessage`, `LidMap`, and identity/pairing utilities are exported from the package entrypoint.

Check the [public exports reference](/en/reference/exports) and `lib/index.d.ts` for what the installed version actually publishes. Repository `main` may be newer than npm; declarations in `node_modules/@xbibzlibrary/whatsbibz` are authoritative for your build.

## Migrating from a manual client or earlier package version

1. Upgrade Node.js to a supported version and install `@xbibzlibrary/whatsbibz`.
2. Update imports to the WhatsBibz package entrypoint; avoid importing multiple Baileys forks into one process.
3. Choose `createBibzWhats()` if you want wrapper pairing/reconnect/session behavior. Move socket handlers under `client.on('ready', sock => ...)` so they attach after every reconnect.
4. Keep `makeWASocket()` if you already own a reliable auth store and lifecycle; you remain responsible for saving credentials and reconnecting.
5. Replace ad-hoc text sending with `sendText()` only after reviewing its formatting default. Set `{ format: false }` to preserve text exactly.
6. Audit `authDir`, session paths, version pinning, logger, and `browser` configuration before deployment.
7. Run tests and verify one message flow using a test account before moving a production number.

There is no requirement to use a legacy alias or engine. Do not patch `node_modules` directly; if you find an incompatibility, create a safe minimal reproduction and open an issue.
