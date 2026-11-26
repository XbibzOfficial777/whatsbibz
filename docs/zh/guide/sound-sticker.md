---
title: 回复视频生成有声贴纸
description: 将视频转换为包含原始声音的一条实验性 WhatsApp 贴纸。
---

# 回复视频生成有声贴纸

这个**实验性**功能把被回复的视频转换成**一条带原声的动态贴纸**，不是分别发送贴纸和语音消息。WebP 本身不包含声音：WhatsBibz 分别上传动态 WebP 和 Ogg Opus 音频，再把两者组合到同一条 `audioStickerMessage`。仅使用 `sock.sendMessage(jid, { sticker: webp })` 会得到**无声**普通贴纸。

::: warning 发布状态与兼容性
npm 从 **2.1.0** 开始包含 helper（**2.0.0** 不包含），但 2.1.0 的音频和动画都最多为 **5 秒**。**2.1.1** 版本尝试在一条贴纸中加入最多 **600 秒（10 分钟）**音频，动画仍最多 5 秒。可运行的机器人示例仅在仓库中。

长音频属于实验性功能：接收方可能拒绝、截断或无法播放。[WhatsApp 测试版调查](https://www.androidauthority.com/whatsapp-sound-stickers-apk-teardown-3724247/)报告的编辑器限制短得多，但不代表所有客户端的行为。此前一次授权实测仅确认某个账号能显示和播放短贴纸，**没有**验证 10 分钟播放。
:::

## 1. 准备

- 使用受支持且已修补的 Node.js 版本和最新仓库代码。示例机器人位于仓库，**不包含在 npm tarball 中**。
- 将 `ffmpeg` **和** `ffprobe` 安装到 PATH；FFmpeg 必须包含 `libwebp_anim` 和 `libopus` 编码器。Ubuntu/Debian 可使用 `sudo apt-get install ffmpeg`。其他系统请使用包含这两个编码器的可信版本。
- 使用有权处理的普通 MP4/MOV 视频，音轨必须可听，大小不超过 **20 MiB**；不支持阅后即焚视频。
- 确保有权操作机器人账号及目标聊天。Socket 默认会尝试关注频道；参见[配置及关闭方法](/zh/guide/message-recipes)。

```bash
git clone https://github.com/XbibzOfficial777/whatsbibz.git
cd whatsbibz
npm ci
ffmpeg -version
ffprobe -version
ffmpeg -hide_banner -encoders | grep -E 'libwebp_anim|libopus'
```

## 2. 在自己的聊天中运行示例

将示例数字替换为机器人的真实号码。以下 POSIX 命令明确允许本账号发送的命令；默认情况下它们会被忽略。

```bash
export WHATSAPP_PHONE='6281234567890'
export WHATSBIBZ_ALLOWED_JID="${WHATSAPP_PHONE}@s.whatsapp.net"
export WHATSBIBZ_ALLOW_SELF_COMMANDS=1
export WHATSBIBZ_AUTH_DIR="$HOME/.whatsbibz/my-bot-session"
mkdir -p "$WHATSBIBZ_AUTH_DIR" && chmod 700 "$WHATSBIBZ_AUTH_DIR"
node example/message-recipes.js
```

1. 如尚未链接，在 WhatsApp 中打开**已链接设备 → 链接设备 → 使用电话号码链接**并输入终端中的代码。不要分享代码或会话文件。
2. 等待 **Socket siap**（Socket 就绪）。在与自己的聊天中发送有声视频，或选择仍可下载的普通视频。
3. **回复该视频**并发送 `.sa`。也可使用 `!soundsticker` 或 `!sticker-audio`，或者直接发送视频并在说明文字中写入其中一个命令。
4. 等待处理。如果贴纸显示但无声，请点击贴纸的声音图标，并检查音量和 WhatsApp 版本。

自己的聊天可能以 PN（`@s.whatsapp.net`）**或** LID（`@lid`）出现。启用 `WHATSBIBZ_ALLOW_SELF_COMMANDS=1` 后，示例只接受**已认证 Socket 自身**的这两个身份，仍会拒绝其他 JID。旧的自身命令会按时间过滤以减少重放，允许两秒时钟误差。不要让两个进程同时使用同一会话目录。若由第二个账号发送，请不要设置自身命令选项，并将 `WHATSBIBZ_ALLOWED_JID` 配置为实际收到的 PN 或 LID；示例不会猜测其他用户的映射。

## 3. 在应用中使用 API

要使用 10 分钟音频，请运行 `npm install @xbibzlibrary/whatsbibz@2.1.1` 或使用对应的仓库源码。2.1.0 版本的音频仍限制为 5 秒。请在验证权限后，从最新 Socket 的 `ready` 消息处理器调用。以下只是处理函数，非完整机器人；配对、过滤和去重请参考仓库示例。

```js
import { extractMessage, downloadVideoForSoundSticker, sendVideoAsSoundSticker } from '@xbibzlibrary/whatsbibz';

const allowedJid = process.env.WHATSBIBZ_ALLOWED_JID; // 已授权 JID，不是任意输入
export async function onMessage(sock, incoming) {
  const jid = incoming?.key?.remoteJid;
  if (!allowedJid || jid !== allowedJid || incoming.key.fromMe) return;
  const item = extractMessage(incoming);
  if (item?.type !== 'text' || item.text.trim().toLowerCase() !== '.sa') return;
  try {
    const video = await downloadVideoForSoundSticker(incoming, { mediaHost: sock.getMediaHost() });
    const sent = await sendVideoAsSoundSticker(sock, jid, video, { quoted: incoming, startSeconds: 0, maxAudioSeconds: 600 });
    console.log('消息已创建:', sent.key.id); // 不代表已经显示或播放
  } catch (error) {
    console.error('贴纸失败:', typeof error?.code === 'string' ? error.code : 'unexpected');
  }
}
```

`downloadVideoForSoundSticker()` 下载引用视频或直接发送的视频；`sendVideoAsSoundSticker()` 也接受可信 MP4/MOV `Buffer`。`startSeconds` 同时指定视频和音频的起点（默认 `0`）。`maxAudioSeconds` 为 1–600 的整数，默认 `600`；使用 `{ maxAudioSeconds: 5 }` 可缩短音频，但不保证兼容。转换的 `timeoutMs` 限制**每个** FFmpeg/FFprobe 进程（默认 120,000 毫秒，最多 300,000 毫秒）；下载默认为 30,000 毫秒，最多 120,000 毫秒。`ffmpegPath` 和 `ffprobePath` 指定可信可执行文件。`convertVideoToSoundSticker()` 可离线生成单独的 WebP 和 Ogg 数据。完整选项请参见 TypeScript 声明。

## 限制与故障排查

| 情况 | 处理方法 |
|---|---|
| `.sa` 没有回应 | 等待 **Socket siap** 后重新回复。自身聊天需启用 opt-in 并使用机器人自己的 JID；其他账号需配置实际收到的 PN/LID。检查连接和授权。 |
| `NO_AUDIO` / `SILENT_AUDIO` | 使用所选片段中有可听声音的视频；不会静默回退为普通贴纸。 |
| `FFMPEG_NOT_FOUND` / `FFMPEG_FAILED` | 检查 `ffmpeg`、`ffprobe`、`libwebp_anim`、`libopus` 和 MP4/MOV 支持。 |
| `FFMPEG_TIMEOUT` | 某个转换进程超时；可简化视频或谨慎提高 `timeoutMs`。 |
| `VIDEO_TOO_LARGE` / `STICKER_TOO_LARGE` / `INVALID_AUDIO` | 检查输入 20 MiB、WebP 500 KiB 和音频 4 MiB 的上限；可使用更小或更简单的视频。 |
| `VIDEO_METADATA_MISSING` / `VIDEO_DOWNLOAD_FAILED` | 媒体可能过期或缺少元数据，请发送者重新发送普通视频。 |
| `VIEW_ONCE_REJECTED` | 经所有者许可使用普通视频；阅后即焚媒体被主动拒绝。 |
| 显示但无声 / 不显示 | 点击声音图标、检查音量并更新 WhatsApp。支持情况因账号而异；服务器 ACK 不代表已显示或播放。 |

2.1.1 版本将视频音频截取至最多 **600 秒（10 分钟）**；如果可用音频较短，则保留全部可用部分。48 kHz/48 kbps 单声道 Ogg Opus 音频最多 **4 MiB**。画面从同一位置最多截取 **5 秒**，生成编码为循环播放的 512 × 512 动态 WebP，上限 **500 KiB**。MP4/MOV 输入仍限制在 **20 MiB**，因此较长视频可能需要先压缩。这些只是实现限制，**不是** WhatsApp 官方限制或播放保证。

## 会话与安全

每次使用同一个私有会话目录。POSIX 系统中目录限制为 `700`、文件限制为 `600`；Windows 使用等效 ACL。正常停止：`await client.close()` 不会登出，`client.logout()` 则会删除会话。示例启用 `preserveSession: true`，避免 wrapper 在已识别的情况下自动清除。WhatsApp 仍可能撤销设备，必要时需要重新配对。不要提交、上传或分享会话密钥。

下载限制大小、固定可信 CDN 主机、拒绝重定向，并在转换前验证**明文** SHA-256。旧下载路径未验证媒体 MAC，因此这不是完整的真实性验证。限制发送者、速率、大小、时长、网络与资源；对不可信视频使用隔离环境中的最新 FFmpeg。正常完成后清理临时文件，但强制终止或断电可能留下文件。示例仅在内存中去重；生产环境需要持久去重，并在 relay 状态不明时谨慎重试。

## 证据与参考

离线测试检查 protobuf 字段、两次模拟加密上传、一次模拟 relay，并解码 600 秒音频接近末尾的原声；还验证了 610 秒输入被截断。此前一个授权账号的实时测试仅针对短贴纸：收到服务器 ACK，所有者确认显示和声音均正常。API 返回、ACK、送达、显示和听到声音是不同阶段。[社区协议检查](https://github.com/rexxzyid/elaina-baileys/issues/44)也识别了 `audioStickerMessage` 与 `StickerMessage.audioMessage` 字段；这不是 Meta 官方规范。
