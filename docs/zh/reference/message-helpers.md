---
title: 消息 helper 参考
description: 发送、提取、时间戳、JID 和配对 helper 的签名与返回值。
---

# 消息 helper 参考

以下 helper 均可从 `@xbibzlibrary/whatsbibz` entrypoint 导入。接收 `sock` 的 helper 同时兼容 `makeWASocket()` 与 `createBibzWhats()` 返回的 `client.sock`。

## 发送

| Helper | 签名 / 结果 |
|---|---|
| `sendText(sock, jid, text, opts?)` | `Promise<{ ok: boolean; ids: string[]; error?: Error }>`；options `{ quoted?, format?: boolean, maxLen?: number }`，默认格式化开启、长度 4000。 |
| `sendWithRetry(sock, jid, content, options?, opts?)` | 返回包含 `{ result, error }` 的 Promise；两项都可能为 null。`{ attempts?: number }` 默认 3 次，重试间隔 500 ms 与 1500 ms。 |
| `sendMedia(sock, jid, content, opts?)` | 返回包含 `{ result, error }` 的 Promise；字段可能为 null。Options `{ quoted?, fallbackToDocument?: boolean }`；Buffer media 默认尝试 document fallback。 |
| `splitText(text, maxLen?)` | `string[]`，默认长度 `4000`；拆分时尽量优先换行/空格。 |
| `whatsappify(text)` | `string`；有限的 Markdown 到 WhatsApp 格式转换，不是完整 parser。 |
| `react(sock, jid, key, reactionText)` | 返回消息或 `undefined` 的 Promise；`key` 是 message key。 |
| `presence(sock, jid, state?)` | `Promise<boolean>`；默认 `'composing'`，request 抛错时返回 false。 |

`sendText()` 如果后续片段失败，会返回已经发送部分的 ID。Retry 不提供幂等保证；timeout 可能发生在 server 已接受消息之后。

## 读取

| Helper | 签名 / 说明 |
|---|---|
| `extractMessage(message)` | 返回 `ExtractedMessage` 或 `null`；展开常见 wrapper 并规范化文本、媒体、按钮、poll、reaction 等。 |
| `unwrapMessage(content)` | 返回 `proto.IMessage` 或 `null`；展开 edited/ephemeral/view-once/document-caption wrapper。 |
| `messageTimestampMs(message)` | `number`；Unix 毫秒，缺失/无效时返回 `0`。 |
| `downloadMediaMessage(message, type, options, context?)` | 通过 core helper 下载并解密媒体；`type` 可选 `buffer` 或 `stream`。请核对安装版本的 `MediaDownloadOptions`。 |
| `downloadContentFromMessage(downloadable, type, options?)` | 从匹配的 key/path 建立媒体 stream；调用方可能需要读取/合并 stream。 |

### `ExtractedMessage` 结构

`type` 的可能值：`text`、`image`、`video`、`audio`、`sticker`、`document`、`reaction`、`button`、`poll` 或 `other`。常见字段为 `text`、`participant`。可选字段包括 `mentions`、`quoted`、`quotedParticipant`、`quotedStanzaId`、`quotedMessage`、`imageMsg`、`videoMsg`、`audioMsg`、`stickerMsg`、`documentMsg`、`reactionMsg`、`fileName`、`mimetype`、`fileLength`、`buttonId`、`buttonText`、`pollName`、`pollOptions` 和 `otherKind`。

展开后没有 content 时，`extractMessage()` 返回 `null`。媒体消息的 `text` 通常是 caption 或空字符串，而不是应用中显示的全部内容。请单独下载媒体，并在使用前校验。

## JID

| Helper | 行为 |
|---|---|
| `digitsOf(jid)` | 取 `@` 前的部分、移除 `:device` 后缀并保留数字；它不是电话号码验证器。 |
| `pnJid(digits)` | 构造 `<digits>@s.whatsapp.net`；没有数字时返回空字符串。 |
| `lidJid(digits)` | 构造 `<digits>@lid`；没有数字时返回空字符串。 |
| `normalizeJid(jid)` | 删除 user JID 的 device suffix；group JID 原样返回。 |
| `isPnJid`、`isLidJid`、`isGroupJid`、`isNewsletterJid`、`isStatusJid` | 基本 suffix/ID 判断。 |
| `sameUser(a, b)` | 比较简化后的数字字符串；不能作为授权 helper。 |
| `LidMap` | 内存 PN/LID 映射，提供 `set`、`phoneOf`、`lidOf`、`canonical`、`variants`、`learnFromMessage`、`toJSON`、`fromJSON`。 |

JID/LID 是身份标识；不要从不支持的值推断电话号码。见[JID 与群组指南](/zh/guide/jid-groups)。

## 配对

`normalizePairingCode(value)` 仅对恰好 8 位 A–Z/0–9 返回大写代码，否则返回空字符串。`createPairingController(options)` 可用于底层集成，但大多数应用应由高层 client 管理。配对 event metadata 类型为 `{ custom: boolean; fallback: boolean }`。`PAIRING_REFRESH_MS` 是 150000，`PAIRING_BACKOFF_MAX_MS` 是 600000。
