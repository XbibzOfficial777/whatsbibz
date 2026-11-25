---
title: 实验性语音通话
description: 限制、依赖和一次经授权的呼出示例。
---

# 实验性语音通话

::: warning 尚未证明连接成功
VoIP 使用非官方 WhatsApp Web 协议，可能停留在 **Connecting**。最近修改之前的一次真实测试曾响铃，但出现 `ICE_FAILED`，接收方没有听到声音。之后对 relay 和音频 feeder 的修改仅经过**离线测试**，尚未通过新的真实通话验证。`ready`、`ringing` 甚至 `connected` 都不能证明对方听到声音。
:::

安装适用于当前平台的 `@roamhq/wrtc` native binary（例如 `npm install @roamhq/wrtc@0.10.0`），并确保 FFmpeg 位于 `PATH`。只呼叫同意的接收方，只播放有权使用的音频。FFmpeg 输入必须为**可信**文件路径，不要直接使用聊天文本或任意 URL。WASM 默认每个 worker 池 20 个线程，内存占用较高；`workerPoolSize` 可设为 4–20，但减小线程池仍属实验性，可能发生死锁。公共 STUN 有响应也不能证明 WhatsApp relay 可访问。

## 显式触发一次通话

仅在 socket 已登录并 `open`、且接收方同意之后调用；不要在每次重连时自动重复呼叫。每个 socket 只能有一个 bridge，同时只能有一个呼出通话。

```js
import { VoipClient } from '@xbibzlibrary/whatsbibz';

export async function callOnce(sock, phone, trustedAudioFile) {
  const voip = new VoipClient({
    onDiagnostic: ({ component, code }) => console.log('VoIP:', component, code),
  });
  try {
    await voip.connectWithSocket(sock);
    const call = await voip.call(phone, {
      audioSource: trustedAudioFile,
      connectTimeoutMs: 45_000,
      durationMs: 180_000,
      endOnAudioEnd: true,
    });
    call.on('ringing', () => console.log('响铃'));
    call.on('connected', () => console.log('WASM 已激活；音频尚未验证'));
    const reason = await call.waitForEnd();
    return { reason, stats: voip.getStats() };
  } finally {
    voip.disconnect(); // 不会登出或删除 WhatsApp session
  }
}
```

在 WASM 状态变为 `Active` 之前，feeder 只发送静音；之后才开始播放音源。`connectTimeoutMs` 限制未连接等待时间；`durationMs` 从拨号开始计算，包含等待接听的时间。设为 `0` 可禁用对应 timer。`endOnAudioEnd` 默认为 `false`（音频结束后继续静音）；设为 `true` 则在有限音频播完后挂断。实际播放情况仍需接收方确认。

## 诊断与会话

- `getStats().connected` 仅表示 bridge 已连接 socket，不表示媒体已连接；relay 包计数也不能证明声音已播放。
- `ICE_FAILED` 表示 relay ICE 失败；`CONNECTION_TIMEOUT` 表示通话未及时进入活动状态（例如无人接听），不能单凭此确定原因。同一 relay IP 会尝试其公布的备用端口，但不保证成功。
- `READY_TIMEOUT_ASSUMED` 表示 15 秒内未观察到 WASM ready 回调，旧兼容行为基于假设继续；这不是准备就绪或通话成功的证明。
- 避免输出敏感包/SDP；不要分享号码、token、配对码或会话文件。`CALL_DUMP_RELAY_PACKETS_PATH` 会创建敏感 dump，生产环境应保持关闭。
- 建议使用 `preserveSession: true` 并在关闭时 `await client.close()`。单个 auth 文件通过同目录 rename 替换，但这不是多文件事务，也不能保证断电后持久化；保存错误会写入日志，服务器仍可能拒绝会话。请保留私密且经过验证的备份。
