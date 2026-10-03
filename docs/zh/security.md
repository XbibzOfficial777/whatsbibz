---
title: 安全与负责任使用
description: 保护 session、尊重隐私和 consent，并遵守 WhatsApp 使用限制。
---

# 安全与负责任使用

WhatsBibz 是通过 WhatsApp Web 通信的非官方 library。只应在自己控制的账号上使用，并确保活动符合 WhatsApp/Meta 条款和当地法律。

## 保护账号凭据

1. 将 `authDir` 放在加密存储中，并实施最小权限；不要提交或上传为 build artifact/log。
2. 对配对码和 QR 保密。不要将 session credentials 发送给用户、供应商或公开 issue。
3. 备份前停止 client。对备份加密并设置保留/删除规则；不要让多个 process 共用 session directory。
4. 如果 session 泄漏，请在手机端解除 linked device，将 credentials 视为已泄露，审查日志/备份并处理原因后再重新配对。
5. 减少记录的消息数据；隐藏 JID、电话号码、内容、文件与个人 metadata。

## 保护消息接收者

- 获取适当 consent，并提供有效的 opt-out。
- 避免未经请求的批量消息、spam、冒充、欺诈、phishing 和意图绕过封禁或 rate limit 的自动化。
- 将收到的 event 和 button response 视为不可信输入；只允许 allow-list 操作。
- 限制每个号码/群组的发送速率、retry、文件大小，并限制 worker 访问数据。
- 不要使用 rich message 暗示 bot 来自 Meta、WhatsApp 或真人。

## 支持边界

协议、identity profile、pairing field 与 rich schema 都可能随时变化。Wrapper 提供有限的恢复机制，但不保证服务可用、消息送达、政策合规或账号不会被限制。业务关键场景应评估官方 WhatsApp Business Platform 与相应运营支持。

## 报告安全问题

不要公开披露 session、配对码、私人 payload 或可能暴露账号访问的 exploit 步骤。请遵循 repository 的[安全政策](https://github.com/XbibzOfficial777/whatsbibz/security/policy)，通过 GitHub Security 私下报告，或发送邮件至 `revandoppratama@gmail.com` 并使用主题 `[whatsbibz security]`。只提供安全复现所需的最少信息，并在公开披露前先协调。
