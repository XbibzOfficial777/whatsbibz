---
title: 消息实现示例
description: 按钮、位置、图片、轮播、投票、联系人、媒体、表情回应和 rich 消息的实用代码。
---

# 消息实现示例

以下示例使用**已登录且连接打开的 socket**，并只发送给同意接收的测试聊天。各代码块是独立示例，应在 `ready`/消息处理器中调用，**不要一次发送整页内容**。支持情况取决于 WhatsApp 客户端、设备和聊天类型。

::: warning 默认账号变更和会话隐私
WhatsBibz 2.1.x 在每个 socket 认证连接打开后，默认尝试关注 `120363333911663927@newsletter`。在 `createBibzWhats()` 中设置 `socketConfig: { autoFollowChannel: false }`，或在 `makeWASocket()` 中设置 `autoFollowChannel: false` 可以关闭；关闭不会取消已有关注。请保护配对码和认证文件。`preserveSession: true` 会阻止 wrapper 在已识别的会话错误中自动清除认证，但显式调用 `logout()` 仍会删除认证，WhatsApp 也可能撤销会话。
:::

## 运行示例机器人

完整文件 [`example/message-recipes.js`](https://github.com/XbibzOfficial777/whatsbibz/blob/main/example/message-recipes.js) 位于仓库中，**不包含**在 npm tarball 中。在仓库 checkout 中使用已修补的 Node（例如 24.x 分支的 24.22.3 或更新版本）：

```bash
npm ci
# 将占位符换成实际数字；使用由你控制的第二个测试账号。
export WHATSAPP_PHONE='替换为机器人号码数字'
export WHATSBIBZ_ALLOWED_JID='替换为测试账号号码@s.whatsapp.net'
export WHATSBIBZ_AUTH_DIR="$HOME/.whatsbibz/test-account"
mkdir -p "$WHATSBIBZ_AUTH_DIR" && chmod 700 "$WHATSBIBZ_AUTH_DIR"
node example/message-recipes.js
```

在 WhatsApp 的**已关联设备 → 关联设备 → 使用电话号码关联**中输入终端显示的配对码，不要分享该码。从允许的第二个账号发送 `!help`；示例默认忽略 `fromMe` 消息。允许的 JID 应与收到的聊天 PN（`…@s.whatsapp.net`）或 LID（`…@lid`）匹配，不要猜测其他用户的映射。该示例仅允许一个私人聊天，不接受群组或广播。有关自身聊天的显式 opt-in，请参见[有声贴纸指南](/zh/guide/sound-sticker)。

在 `example-media/` 中放入自己的文件，也可用 `WHATSBIBZ_MEDIA_DIR` 指定目录：

```text
example-media/
  gambar-1.jpg    # 实际 JPEG 文件
  gambar-2.jpg    # 第二张轮播 JPEG
  stiker.webp     # 有效的 WebP 贴纸
  contoh.pdf      # PDF 文档
  suara.ogg       # 含 Opus 音频的 Ogg 文件
  video.mp4       # 兼容的 MP4 视频
```

可选的 `CONTACT_PHONE` 是同意分享的联系人号码数字。`sharp` 可帮助生成图片缩略图；旧版 builder 视频预览可能需要已停止维护的 `fluent-ffmpeg` peer 和 FFmpeg 可执行程序；请限制输入并隔离进程。请检查接收方支持的格式及大小。

| 命令 | 发送内容 |
|---|---|
| `!menu`、`!list`、`!link` | 快速回复、单选列表、URL/复制按钮 |
| `!location`、`!image`、`!image-button`、`!slide` | 静态位置、图片、图片按钮、两张轮播卡片 |
| `!poll`、`!contact`、`!reaction` | 投票、已获同意的 vCard、对命令消息的回应 |
| `!sticker`、`!document`、`!audio`、`!video` | 本地 WebP、PDF、语音、视频 |
| `.sa`、`!soundsticker`、`!sticker-audio` | 回复视频生成一条[实验性有声贴纸](/zh/guide/sound-sticker)；需要 FFmpeg；helper 从 2.1.0 开始提供，2.1.1 支持最多 10 分钟音频，示例机器人位于仓库 |
| `!rich`、`!help` | 标明机器人身份的 rich 表格和命令列表 |

在从 npm 安装的项目中，请将示例中的相对 import `../lib/index.js` 改为 `@xbibzlibrary/whatsbibz`。示例会在新 socket 上重新绑定监听器并使用有界内存去重；生产环境还需要持久化去重、授权和速率限制。

## 建立示例上下文

```js
import { createBibzWhats, Button, Carousel, extractMessage } from '@xbibzlibrary/whatsbibz';

const client = await createBibzWhats({
  phone: process.env.WHATSAPP_PHONE,
  authDir: process.env.WHATSBIBZ_AUTH_DIR || './data/session',
  preserveSession: true,
  // socketConfig: { autoFollowChannel: false }, // 可选：关闭自动关注
});
client.on('pairing-code', (code) => console.log('在已关联设备中输入配对码:', code));
client.on('ready', (sock) => {
  // 在此绑定经过授权的消息处理器。
});
```

下文的 `sock` 来自 `ready`，`jid` 是经过授权的接收聊天；引用/回应时 `incoming` 是收到的 `WAMessage`。优先验证并使用 `incoming.key.remoteJid`，不要猜测群组或 LID JID。媒体代码还需要从 `node:fs/promises` 导入 `readFile`。

## 快速回复按钮

```js
const sent = await new Button(sock)
  .setBody('请选择操作:')
  .setFooter('示例机器人')
  .addReply('状态', 'menu_status')
  .addReply('帮助', 'menu_help')
  .send(jid);
console.log('消息 ID:', sent.key?.id);
```

ID 用于标识操作，并非按钮显示文字。`send()` 返回不代表接收方已看到或点击按钮；请准备普通文本替代方案。

### 单选列表、URL 和复制按钮

```js
await new Button(sock)
  .setBody('请选择城市:')
  .addSelection('打开列表')
  .makeSection('爪哇')
  .makeRow('', '雅加达', '雅加达', 'city_jakarta')
  .makeRow('', '泗水', '东爪哇', 'city_surabaya')
  .send(jid);

await new Button(sock)
  .setBody('示例链接和代码')
  .addUrl('打开文档', 'https://whatsbibz.xbibzclone.my.id/')
  .addCopy('复制代码', 'WHATS-BIBZ')
  .send(jid);
```

必须先调用 `addSelection()` 和 `makeSection()`，再调用 `makeRow(header, title, description, id)`。URL/复制操作可能仅在手机端完成，**不保证**产生机器人回复事件。不要在 ID 中放入密钥，并验证链接及目标。

### 处理点击回复

```js
const allowedJid = process.env.WHATSBIBZ_ALLOWED_JID;
const answers = new Map([
  ['menu_status', '示例机器人可用。'],
  ['menu_help', '有什么可以帮助您？'],
  ['city_jakarta', '您选择了雅加达。'],
  ['city_surabaya', '您选择了泗水。'],
  ['slide_one', '您选择了第一张。'],
  ['slide_two', '您选择了第二张。'],
]);

client.on('ready', (sock) => {
  sock.ev.on('messages.upsert', ({ messages = [], type }) => {
    if (type !== 'notify') return;
    for (const incoming of messages) {
      const jid = incoming.key?.remoteJid;
      if (!jid || jid !== allowedJid || incoming.key?.fromMe || !incoming.message) continue;
      const item = extractMessage(incoming);
      const answer = item?.type === 'button' ? answers.get(item.buttonId) : undefined;
      if (!answer) continue;
      void sock.sendMessage(jid, { text: answer }, { quoted: incoming })
        .catch((error) => console.error('回复失败:', error.message));
    }
  });
});
```

`extractMessage()` 会将支持的 native-flow、list 和旧版按钮回复归一化为 `type: 'button'`。ID 是不可信输入，应使用允许列表并验证发送者；生产环境还要去重并像完整示例一样移除旧监听器。

## 图片和图片按钮

```js
import { readFile } from 'node:fs/promises';

const photo = await readFile('./example-media/gambar-1.jpg');
await sock.sendMessage(jid, { image: photo, mimetype: 'image/jpeg', caption: '示例照片' });
await new Button(sock)
  .setBody('查看图片并选择操作:')
  .setImage(photo, { mimetype: 'image/jpeg' })
  .addReply('详情', 'image_detail')
  .send(jid);
```

在回复允许列表中加入 `image_detail`。图片也可使用 `{ url: 'https://…' }`，但用户提供的 URL 和重定向可能访问内网。建议使用可信的本地 `Buffer`，验证大小与内容；如需请求 URL，应限制网络出口。

## 轮播 / 每张 slide 上的按钮

```js
import { readFile } from 'node:fs/promises';

const [first, second] = await Promise.all([
  readFile('./example-media/gambar-1.jpg'),
  readFile('./example-media/gambar-2.jpg'),
]);
const carousel = await new Carousel(sock)
  .setBody('滑动查看选项:')
  .setFooter('示例机器人')
  .card((card) => card.image(first).title('Slide 1').text('第一张图片').button('选择 1', 'slide_one'))
  .card((card) => card.image(second).title('Slide 2').text('第二张图片').button('选择 2', 'slide_two'))
  .send(jid);
console.log('轮播 ID:', carousel.key?.id);
```

每张卡片的 header 都必须包含图片或视频；此 `.card().image()` 示例使用 JPEG buffer。卡片按钮是 quick reply。轮播显示因设备而异，应提供普通图片/文本作为后备；server ACK 不证明 raw carousel 的点击事件已收到。

## 位置

```js
await sock.sendMessage(jid, {
  location: {
    degreesLatitude: -6.175392,
    degreesLongitude: 106.827153,
    name: '国家纪念塔',
    address: '印度尼西亚雅加达',
  },
});
```

请换成你有权分享的坐标。纬度范围 −90…90，经度范围 −180…180；这是静态位置，不是实时追踪。

## 投票、联系人、回应和引用

```js
await sock.sendMessage(jid, {
  poll: { name: '选择饮品', values: ['咖啡', '茶'], selectableCount: 1 },
});

const number = process.env.CONTACT_PHONE || ''; // 同意分享的联系人，只有数字
if (!/^\d{8,15}$/.test(number)) throw new Error('CONTACT_PHONE 必须为 8–15 位数字');
const vcard = `BEGIN:VCARD\nVERSION:3.0\nFN:示例联系人\nTEL;type=CELL;type=VOICE;waid=${number}:+${number}\nEND:VCARD`;
await sock.sendMessage(jid, {
  contacts: { displayName: '示例联系人', contacts: [{ displayName: '示例联系人', vcard }] },
});

// incoming 是同一聊天中收到的 WAMessage。
await sock.sendMessage(jid, { react: { text: '✅', key: incoming.key } });
await sock.sendMessage(jid, { text: '谢谢！' }, { quoted: incoming });
```

`selectableCount: 1` 允许选择一项。读取投票结果还需要相应的 update/解密及保存原投票消息；发送投票不等于收到投票。

## 文档、贴纸、音频和视频

```js
import { readFile } from 'node:fs/promises';

await sock.sendMessage(jid, {
  document: await readFile('./example-media/contoh.pdf'),
  mimetype: 'application/pdf', fileName: 'example.pdf', caption: '示例文档',
});
await sock.sendMessage(jid, { sticker: await readFile('./example-media/stiker.webp'), mimetype: 'image/webp' });
await sock.sendMessage(jid, {
  audio: await readFile('./example-media/suara.ogg'), mimetype: 'audio/ogg; codecs=opus', ptt: true,
});
await sock.sendMessage(jid, {
  video: await readFile('./example-media/video.mp4'), mimetype: 'video/mp4', caption: '示例视频',
});
```

扩展名和 MIME 标签不会转换文件。请提供真实有效的 PDF/WebP/Ogg-Opus/MP4。`ptt: true` 请求以语音消息形式显示；投递和缩略图取决于媒体与客户端。

## Rich 表格

```js
const result = await sock.sendTable(
  jid, '示例机器人价格', ['商品', '价格'],
  [['咖啡', '18.000'], ['茶', '12.000']], undefined,
  { headerText: '由示例机器人创建，不是 Meta AI。' },
);
console.log('Rich ID:', result.messageId);
```

列表、代码、链接和 `AIRich` 请参阅 [rich 消息](/zh/guide/rich-messages)。这些格式使用 WhatsApp/AI 内部 schema，应标明机器人身份并提供普通文本。此前 11 种 rich 消息收到 server ACK，但手机上的实际显示**尚未确认**。

## 测试证据和限制

此前一个获授权账号完成了手机号码配对；按钮、列表、位置、图片、builder 轮播、投票及多种媒体获得 ACK，账号所有者确认此前功能测试可用，也观察到了 builder slide 点击。这不保证所有账号、群组和客户端都支持；raw carousel 的点击未观察到。此处新增示例仅用模拟 socket 离线测试，没有再次进行实时发送。QR 配对、取消关注和 rich 的手机实际显示尚未完成实时验证。API 返回、server ACK、送达、已读、手机显示和点击是不同结果。
