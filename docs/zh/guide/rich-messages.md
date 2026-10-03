---
title: Rich Message 与 Socket 辅助方法
description: 使用 WhatsBibz 添加的表格、列表、代码块、链接和 AIRich 排版。
---

# Rich Message 与 Socket 辅助方法

除核心 helper 外，WhatsBibz socket 还提供发送表格、列表、代码块、链接和 rich response 的方法。这些方法扩展在 `WASocket` 上，并转发 WhatsApp 内部消息格式；最终显示方式由收件人客户端决定。

## 表格、列表、代码和链接

```js
// 表格：标题、列名、行、可选引用消息、选项
const tableResult = await sock.sendTable(
  jid,
  '价格表',
  ['商品', '价格'],
  [['咖啡', 'Rp18.000'], ['茶', 'Rp12.000']],
  incomingMessage,
  { footer: '价格今日更新' },
);

// 代码块：代码、可选引用消息、选项
await sock.sendCodeBlock(jid, 'const answer = 42;\nconsole.log(answer);', incomingMessage, {
  language: 'javascript',
  title: 'JavaScript 示例',
});

// 链接：引导文字、URL 或 { displayName, url }、可选引用
await sock.sendLink(jid, '官方文档:', [
  { displayName: 'Node.js', url: 'https://nodejs.org/docs/latest/api/' },
  'https://github.com/XbibzOfficial777/whatsbibz',
], incomingMessage);
```

`sendTable`、`sendCodeBlock` 和 `sendLink` 在 relay 后返回 `{ message, messageId }`。详细选项请查看已安装软件包中的 `lib/Utils/rich-messages.js` 和 `lib/Socket/messages-send.js`。`sendTableV2`、`sendList`、`sendCodeBlockV2` 和 `sendLinkV2` 提供其他格式。因为它们使用内部协议 content，不同客户端的显示可能不同。

## 组合 rich response

```js
import { AIRich } from '@xbibzlibrary/whatsbibz';

const report = new AIRich(sock)
  .addText('今日运行摘要。')
  .addTable([
    ['区域', '状态'],
    ['API', '正常'],
    ['队列', '检查中'],
  ])
  .addCode('javascript', 'const status = "normal";')
  .addSuggest(['查看状态详情', '打开恢复指南']);

await report.send(jid, {
  forwarded: true,
  includesUnifiedResponse: true,
  includesSubmessages: true,
});
```

`AIRich` 可链式调用 `addText`、`addTable`、`addCode`、`addSource`、`addImage`、`addVideo`、`addProduct`、`addPost`、`addReels`、`addTip`、`addSuggest`、`addSubmessage` 和 `addSection`。`send(jid, options)` 支持 `forwarded`、`notification`、`includesUnifiedResponse`、`includesSubmessages`；默认均为 true，只有 `notification` 默认 false。`ORich` 是兼容用的子类/alias。部分方法生成的结构类似 WhatsApp 内部 rich/GenAI response，不是稳定公开契约。

Rich media 需要提供 builder 能处理的 URL 或 content；普通媒体上传仍可能需要身份验证。`addImage` 和 `addVideo` 支持 URL resolve/autofill 选项；在生产依赖这些路径前，请阅读已安装版本的实现。

## 选择合适的 helper

- 普通文本、轻量格式、长文本拆分和可检查的返回值使用 `sendText()`。
- 图片、音频、文档、位置、poll、reaction 和引用消息使用 `sendMessage()` 或 `sendMedia()`。
- 仅在收件人支持 rich layout 时使用 `sendTable`、`sendCodeBlock` 或 `sendLink`，并准备纯文本 fallback。
- 使用 `AIRich` 展示已经测试过的结构化内容；不要用它冒充其他产品。

## 互操作与透明度

Rich response 使用与 WhatsApp AI/GenAI 回复相关的 schema，可能显示为转发或 assistant 风格消息。请明确告知用户内容来自您的 bot；不要冒充 Meta AI、其他企业或真人，也不要虚构认证或关联关系。

WhatsApp 可能在 library 更新前修改 protobuf field 或 feature flag。请在目标 Android、iOS、Desktop 版本上测试，检查返回的 `messageId`，保留纯文本 fallback，不要让交互布局成为完成任务的唯一方式。
