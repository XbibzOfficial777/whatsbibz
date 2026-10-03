---
title: 会话与安全
description: 保护 linked-device credentials、限制访问、谨慎备份，并区分 close 和 logout。
---

# 会话与安全

Multi-device 身份验证会保存加密材料与可能持续保留账号访问权限的 credentials。请将整个 `authDir` 视为高敏感 secret，而不是普通 cache 或配置目录。

## 安全保存 session

- 每个账号使用单独目录，例如 `./data/account-a-session`。
- 将 session path 加入 `.gitignore`，并检查开发备份、CI artifact、container image 与不安全同步工具。请验证当前项目里的 ignore rule，而不要假设其他 repo 的 pattern 也适用。
- 仅允许进程 user 读取和写入目录/文件。在共享服务器上隔离不同 bot/process。
- 使用持久化的加密 volume 或可审计的 secret storage。不要把 credentials、auth state、QR、配对码或 `sock.authState` 输出到日志。
- Client 写入期间不要复制 session folder。备份前调用 `close()`，一致性复制并加密，然后限制恢复人员访问。
- 不要让两个 process 共用一个 `authDir`。并发写入可能损坏或回退 state。

Library 使用 multi-file auth state。Process 运行时 key 或 credentials 更新会写入多个文件；不一致的旧备份可能无法恢复。请使用测试账号验证恢复流程。对存储和传输中的备份加密，并设置保留/删除政策。

## 不要提交 session

下面只是起始示例，请按应用实际使用的目录名称修改：

```text
# WhatsBibz session secrets（确认 pattern 与 authDir 一致）
/data/*session*/
/bibzwhats-session/
.env
```

添加到 Git staging 后，使用 `git status --short` 和 `git check-ignore -v data/account-a-session` 检查。如果 credentials 曾进入 commit 或日志，应视为泄漏：在手机上退出/解除 linked device，按团队流程清理历史并轮换 secret。从当前工作区删除文件不会自动删除旧 commit 中的副本。

## 正确使用 lifecycle 方法

`client.close()` 会关闭 socket 与 timer，但保留 `authDir` 供重启使用。`client.logout()` 请求 server 端登出并删除 session directory；设备需要重新配对。只有确实要撤销设备时才 logout，不要在每次部署时都 logout。

QR 和配对码属于临时凭据。通过私密渠道发送，只显示给获授权操作员，限制日志保留时间，避免出现在 CI 输出或公开截图。不要要求用户把 auth folder 上传至 issue tracker。

## 消息数据与隐私

收到的消息可能包含个人信息、图片、文件、位置和身份 metadata。尽量减少日志，设置保留期限并限制访问；打开文件前先验证，并告知用户 bot 如何处理数据。遵守所需 consent。数据到达 Node.js process 或 database 后，WhatsApp Web 的传输加密不再代表应用侧数据也自动加密。

WhatsBibz 不是官方 WhatsApp Business Platform。账号限制、协议变化、服务故障和运营风险仍可能发生。请遵守 Meta/WhatsApp 条款；不要发送未经请求的消息、绕过限制、发送 spam 或使用不受您控制的账号。
