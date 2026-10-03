---
title: 测试与诊断
description: 运行单元测试、导出检查以及需要谨慎执行的 live identity test。
---

# 测试与诊断

在连接主要号码之前，请先本地测试 parsing helper 和 wrapper 行为。项目测试位于 `test/`，使用 Node.js 内置 test runner。

## 基础检查

```bash
npm install
npm test
npm run check
```

`npm test` 会运行 `test/*.test.js`，包含离线 identity 和 lifecycle test。`npm run check` 会 import package entrypoint 并检查必要导出。文档命令有 `npm run docs:dev`、`npm run docs:build` 和 `npm run docs:preview`。

本地测试无法证明 WhatsApp server 一定接受配对请求或消息格式。部分协议行为只能通过测试账号验证。

## Live identity test

`npm run test:live` 会启用直接访问 WhatsApp/Web endpoint 的 test。执行前，请先阅读 `test/identity-live.test.js` 与[身份验证说明](/zh/guide/device-identity)，并且只使用自己控制的账号/号码。测试会产生网络流量、QR/配对数据、rate limit，也可能因 server 更新而改变结果。

不要在公开 CI 中运行 live test，不要测试他人账号，也不要反复探测大量 identity。仅在计划好的验证中、经账号操作员同意并确保间隔后运行。测试成功不是长期兼容保证。

## 添加应用层测试

- 为 `extractMessage()` 测试文本、媒体、ephemeral/view-once wrapper、编辑、按钮、poll 和可选字段。
- 使用 message ID 测试去重，并测试 event 重复出现时的行为。
- 多次模拟 `ready`，确认 handler 被绑定到 active socket。
- 测试 `sendText`/`sendMedia` 的 timeout 与失败路径，确认 retry 不会产生失控重复消息。
- 测试关闭 client 后 reconnect timer 是否已取消。
- Fixture 不应包含真实 credentials 或个人数据；请使用脱敏的 mock message。

修改 identity/protocol 逻辑时，记录 Node.js/WhatsBibz 版本、测试日期、handshake/pairing 阶段和脱敏状态码。只有取得账号所有者同意后才更新 live test。
