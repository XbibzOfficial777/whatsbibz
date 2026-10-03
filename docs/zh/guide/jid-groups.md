---
title: JID、LID 与群组
description: 识别 WhatsApp 地址格式、区分 PN JID 和 LID，并安全缓存群组 metadata。
---

# JID、LID 与群组

`jid` 是协议地址，不是可以任意通过字符串操作处理的电话号码。消息 event 可能包含个人地址、LID、群组、newsletter 或状态目标。回复时优先使用 event 中的 `message.key.remoteJid`。

## 常见格式

| 类型 | 后缀 | 含义 |
|---|---|---|
| PN / phone-number JID | `@s.whatsapp.net` | 部分 event 中使用的电话号码类 WhatsApp 地址。 |
| LID | `@lid` | 新版 linked-device identity，不一定能显示电话号码。 |
| Group | `@g.us` | 群组对话地址，不是某个成员的地址。 |
| Newsletter | `@newsletter` | 频道/newsletter 地址。 |
| Status | `status@broadcast` | 状态 broadcast 目标。 |

JID 还可能带设备后缀，例如 PN 地址末尾的 `:device`。`normalizeJid()` 会删除已识别的设备后缀；它不会把群组转换为电话号码。

## JID helper

```js
import {
  digitsOf, isGroupJid, isLidJid, isPnJid,
  lidJid, normalizeJid, pnJid, sameUser,
} from '@xbibzlibrary/whatsbibz';

if (isGroupJid(jid)) {
  await sock.sendMessage(jid, { text: '发送给已确认的群组。' });
}
const normalized = normalizeJid(jid);
```

`pnJid(digits)` 根据数字构造 PN JID；`lidJid(digits)` 根据 identifier 构造 LID 格式地址。`digitsOf()` 提取数字，但**不会**验证输入是否为个人联系人；不要在 group 或其他 identifier 上调用它来推断电话号码。`sameUser(a, b)` 会比较支持的数字形式，但不能代替应用授权。

## PN ↔ LID 映射

`LidMap` 会保存从 message key 的 alternate field 学到的映射。请根据应用的持久化政策维护 map：

```js
import { LidMap } from '@xbibzlibrary/whatsbibz';

const lidMap = new LidMap();
lidMap.learnFromMessage(message);
const knownPn = lidMap.phoneOf(message.key.remoteJid);
const variants = lidMap.variants(message.key.remoteJid);
```

可用方法：`set(lid, pn)`、`phoneOf(lid)`、`lidOf(pn)`、`canonical(jid)`、`variants(jid)`、`learnFromMessage(message)`、`toJSON()` 和 `LidMap.fromJSON(data)`。Map 可能不完整或过时；LID 并非总能转换为电话号码。不要猜测号码或向未授权用户披露映射。

## 群组与 metadata

`createBibzWhats()` 会设置内存 group metadata cache，默认 `groupMetadataTtlMs` 为 5 分钟，以减少重复请求。Process 重启后缓存为空，它不等同于一致性数据库。如果 bot 需要最新成员、角色或群组名称，请监听 group update event，或通过当前版本的 socket API 获取 metadata。

群组消息可能在 `key.participant` 或 `participantAlt` 中包含发送者；对话地址是 group JID，而非发送者。若审计需要区分 thread 和 actor，应同时保存两者。不要向群组的 `remoteJid` 发送私信，也不要只根据显示名称识别成员。

## 安全实践

- 使用 event 中的原始 JID 回复，不要猜测电话号码。
- 发送前验证目标是否允许。
- 将 JID 和身份映射视为个人数据。
- 安全处理 null、缺失字段和未来格式。
- 在 cache/database key 中保存完整 JID；不要手动截掉 domain。
