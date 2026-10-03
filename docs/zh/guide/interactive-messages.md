---
title: 交互消息
description: 发送 quick reply 与选择列表，并使用 extractMessage 处理按钮响应。
---

# 交互消息

WhatsApp 提供多种按钮与交互 payload 格式。实际支持情况取决于 app 版本、平台和对话类型。请在自己控制的测试账号上验证，并提供纯文本替代方案，因为 server 可能拒绝某种格式，或收件人客户端无法显示。

## Native Flow quick reply

发送现代按钮时，可通过 `interactiveMessage` content 设置 `buttons` 数组。每个 button 都使用 `name` 和 JSON 字符串 `buttonParamsJson`。同一菜单内的 ID 应保持稳定且唯一，方便应用将响应映射到允许的操作。

```js
const buttons = [
  { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: '查看状态', id: 'status' }) },
  { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: '帮助', id: 'help' }) },
];

await sock.sendMessage(jid, {
  interactiveMessage: {
    title: '请选择一个可用选项。',
    header: 'WhatsBibz 菜单',
    footer: '选择操作',
    buttons,
  },
});
```

内部 payload 由 WhatsApp 定义，可能变化。请使用当前安装版本的 `AnyMessageContent` 类型验证 content。不要仅在 button ID 中放置 secret、token 或授权判断。用户端返回的响应仍是不可信输入。

## 处理按钮响应

`extractMessage(message)` 会将 Native Flow 响应规范化为 `{ type: 'button', buttonId, buttonText }`。在实现支持范围内，它也能处理旧版 `buttonsResponseMessage`、`templateButtonReplyMessage`、列表响应和 interactive response。

```js
const item = extractMessage(message);
if (item?.type !== 'button') return;

switch (item.buttonId) {
  case 'status':
    await sendText(sock, message.key.remoteJid, '已收到状态查询。', { quoted: message });
    break;
  case 'help':
    await sendText(sock, message.key.remoteJid, '请说明需要哪方面的帮助。', { quoted: message });
    break;
  default:
    // 忽略过期或未知 ID；不要将按钮显示文字直接当作命令执行。
    break;
}
```

如果需要读取 Native Flow 原始响应，可以查看 `message.message?.interactiveResponseMessage?.nativeFlowResponseMessage`。`paramsJson` 可能是 JSON string；请用 `try/catch` 解析，并验证其结构与 ID。列表选择可能通过 `listResponseMessage.singleSelectReply.selectedRowId` 返回。

## 可用 builder

`Button` 用于构建 Native Flow payload，支持 `addReply`、`addSelection`、`addUrl`、`addCopy` 和 `addCall` 等方法。`ButtonV2` 用于旧版 `buttonsMessage` 格式。`Carousel` 用于组合卡片。详细构造方法在 `lib/Modded/message_builder.js`；当前软件包对这些 builder 的 TypeScript declaration 较精简，部分方法参数可能是 `any`。

常见的 builder 用法：

```js
import { Button } from '@xbibzlibrary/whatsbibz';

const menu = new Button(sock)
  .text('请选择下一步操作')
  .addReply('查看状态', 'status')
  .addReply('帮助', 'help');

await menu.send(jid);
```

Builder 会转发 WhatsApp 内部协议，不属于稳定的公开 API。如果已安装版本的方法签名不同，请检查对应的 `lib/Modded/message_builder.js`，或使用 socket 类型支持的 payload。

## 兼容性与安全

- 仅将 allow-list 中的 `buttonId` 映射到操作；不要信任显示 label。
- 执行数据变更前检查 `message.key.remoteJid`、`participant`、账号状态和授权。
- 不要用按钮伪装广告、收集敏感信息或诱导用户同意。
- 部分群组或客户端可能不支持 Native Flow；准备文本替代方案。
- 新项目不应优先依赖旧版按钮格式；WhatsApp 可能随时更改其行为。
