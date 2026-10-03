---
title: TypeScript 与迁移
description: 配置 TypeScript ESM、使用公开类型、了解 API alias，并迁移现有 Baileys client。
---

# TypeScript 与迁移

WhatsBibz 发布 ESM 软件包和 declaration files，需要 Node.js 20 或更新版本。新 TypeScript 项目应选择支持 ESM 的 module 配置。

## TypeScript 配置

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

在 `package.json` 设置 `"type": "module"`，或按 toolchain 使用 `.mts`/`.mjs`。Package export map 发布的是 `import` 条件，不支持 CommonJS `require()`；CommonJS 应用需要迁移到 ESM 或使用 dynamic `import()`。

## 导入 API 和类型

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
        await sendText(sock, message.key.remoteJid, '已收到消息。', { quoted: message });
      }
    }
  });
});
```

Socket event payload 遵循已安装版本中的 Baileys-compatible 类型。部分 rich builder（`Button`、`ButtonV2`、`AIRich`、`Carousel`）声明较精简，method 参数可能是动态类型；不能期待所有 builder 选项都有严格 autocomplete。

## API alias 与兼容项

- `createBibzWhats` 是推荐的高层 factory；`createWhatsBibz` 是 alias。
- `makeWASocket` 同时作为 default 和 named export；`makeBibzSocket` 与 `makeWhatsBibzSocket` 是 alias。
- `WASocket` 是 `makeWASocket` 的返回类型；`BibzSocket` 是该类型的 alias。
- `BibzWhatsEngine` 是导出的 socket helper class。`sock.bibz` 和 `sock.ourin` 是 engine alias；新应用优先使用稳定的 socket method。
- `sendText`、`sendMedia`、`extractMessage`、`LidMap` 及 identity/pairing 工具均从 package entrypoint 导出。

查看[公开导出参考](/zh/reference/exports)和 `lib/index.d.ts`，确认已安装版本实际发布的 API。Repository 的 `main` 可能比 npm release 新；构建时应以 `node_modules/@xbibzlibrary/whatsbibz` 内的 declaration 为准。

## 从手动 client 或旧版集成迁移

1. 将 Node.js 升级到支持版本并安装 `@xbibzlibrary/whatsbibz`。
2. 将 import 更新为 WhatsBibz package entrypoint；避免在同一 process 同时导入多个 Baileys fork。
3. 想使用 wrapper 的 pairing/reconnect/session 管理时，选择 `createBibzWhats()`。将 socket handler 放入 `client.on('ready', sock => ...)`，使每次 reconnect 都能重新绑定。
4. 如果已有可靠 auth store 和 lifecycle，可以继续使用 `makeWASocket()`；凭据保存与 reconnect 仍由应用负责。
5. 使用 `sendText()` 取代临时文本发送逻辑前，检查它的默认格式转换。需要原样文本时设置 `{ format: false }`。
6. 部署前审核 `authDir`、session path、版本选择、logger 和 `browser` 设置。
7. 先运行 test，并用测试账号验证一条消息，再迁移生产号码。

新应用不必依赖 legacy alias 或 engine。不要直接 patch `node_modules`；遇到不兼容时请准备安全的最小复现并提交 issue。
