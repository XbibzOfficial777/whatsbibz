---
title: 收发消息
description: 发送文本与媒体、解析收到的消息、处理引用回复，并安全处理消息 event。
---

# 收发消息

所有消息 helper 都接收 active socket (`sock`) 和目标 JID。Helper 不会取代底层 API；需要特定协议功能时仍可以调用 `sock.sendMessage(jid, content)`。

## 接收消息

`messages.upsert` 可能包含 notify、history sync 或 append 消息。响应式机器人通常只处理 `type === 'notify'`，然后跳过自己发出的消息和没有 payload 的消息。Reconnect 或同步期间，同一消息可能再次出现；可使用 `message.key.id` 作为数据库去重键。

```js
import { extractMessage, sendText } from '@xbibzlibrary/whatsbibz';

async function onMessages(sock, { messages, type }) {
  if (type !== 'notify') return;
  for (const message of messages) {
    if (message.key.fromMe || !message.message) continue;
    const item = extractMessage(message);
    if (!item) continue;
    if (item.type === 'text' && item.text.trim().toLowerCase() === 'ping') {
      const result = await sendText(sock, message.key.remoteJid, 'pong', { quoted: message });
      if (!result.ok) console.error('回复失败:', result.error);
    }
  }
}
```

`extractMessage()` 会打开 ephemeral、view-once、带 caption 的 document，以及 edited message wrapper。结果类型有 `text`、`image`、`video`、`audio`、`sticker`、`document`、`reaction`、`button`、`poll` 或 `other`。结果包含 `text`（部分媒体类型中为空）、`participant` 和类型专属字段，例如 `imageMsg`、`videoMsg`、`documentMsg`、`buttonId`、`mentions`、`quotedMessage`、`quotedStanzaId` 和 `pollOptions`。并非每一种消息都会提供所有字段。

`unwrapMessage()` 只打开常见 wrapper。`messageTimestampMs(message)` 将 protobuf timestamp 转换为 Unix 毫秒，不存在时返回 `0`。这些 helper 不会自动下载或解密媒体；请使用包提供的 `downloadMediaMessage` 或 `downloadContentFromMessage`，并查看[公开导出](/zh/reference/exports)。

## 发送文本

```js
const result = await sendText(sock, jid, '你好，*朋友*!', {
  quoted: incomingMessage,
  maxLen: 4000,
});
if (!result.ok) throw result.error;
console.log('消息 ID:', result.ids);
```

`sendText(sock, jid, text, options)` 返回 `{ ok, ids, error? }`。默认先执行 `whatsappify()`：将 `**粗体**` 和 `__粗体__` 转成 WhatsApp 粗体格式，将 `~~删除线~~` 转成 `~删除线~`，移除标题前缀，并将 Markdown 链接改成 `label (URL)`。这是轻量转换，不是完整 Markdown parser。设置 `{ format: false }` 可原样传递文本。

超过 `maxLen`（默认 4000 个字符）的文本会尽量在换行或空格处拆分。各片段依次发送，间隔 250 ms。每段默认最多发送三次，重试等待 500 ms 和 1500 ms。如果某一段失败，helper 返回此前已发送部分的 ID 和 `error`，因此可能出现部分投递。没有去重或核对状态时不要重发整段回复，以免产生重复消息。

通用 content 可使用 `sendWithRetry(sock, jid, content, options, { attempts })`。所有尝试失败后，它返回 `{ result: null, error }`，而不是抛出异常。传输 timeout 不代表 server 一定没有收到消息。

## 发送媒体

```js
import { readFile } from 'node:fs/promises';

const image = await readFile('./report.png'); // Node Buffer
const sent = await sendMedia(sock, jid, {
  image,
  mimetype: 'image/png',
  caption: '报告摘要',
  fileName: 'report.png',
}, { quoted: incomingMessage, fallbackToDocument: true });
if (!sent.result) console.error(sent.error);
```

`sendMedia()` 将 `AnyMessageContent` 传给 `sock.sendMessage()`。媒体发送失败且来源是 `Buffer` 时，helper 可以尝试作为 document 重发；URL 和 stream 不会自动转换。设置 `fallbackToDocument: false` 可关闭此行为。`image`、`video`、`audio`、`sticker` 和 `document` 遵循 Baileys content 格式；按需提供 MIME type、文件名、caption 或 `ptt`。

收到文件后，根据 `extractMessage()` 的类型调用媒体下载 helper。限制大小、在应用侧验证 MIME/content、使用自己生成的安全文件名，不要信任发送者提供的文件名或 metadata。

## Reaction 与 presence

`react(sock, jid, message.key, reactionText)` 对指定消息发送 reaction。`presence(sock, jid, state)` 可以发送 `composing`、`recording`、`paused`、`available` 或 `unavailable`，默认值为 `composing`。该 helper 返回 boolean，并捕获错误。请适度使用 presence；它不代表消息一定已发送或已读。

## 引用、mention 与群组

引用消息使用 `{ quoted: incomingMessage }`。原生 mention 可以用 `sock.sendMessage(jid, { text, mentions: [participantJid] })` 或安装版本对应的 content schema。优先使用 event 提供的 `remoteJid`/`participant`，不要从电话号码自行拼接 JID。个人 PN JID、LID 和群组 JID 格式不同；参阅[JID、LID 与群组](/zh/guide/jid-groups)。

不要在没有 rate policy 的情况下对每条消息自动回复。使用权限检查、opt-out、队列、去重和每个收件人的发送限制。Library 不会授权未经请求的消息，也不会提升 WhatsApp 官方发送额度。
