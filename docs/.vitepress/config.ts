import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vitepress'

const configDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(configDir, '../..')
const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8')) as { version: string }
const repository = 'https://github.com/XbibzOfficial777/whatsbibz'
const rawLogo = 'https://raw.githubusercontent.com/XbibzOfficial777/whatsbibz/main/assets/logo/png/mark-512.png'
const rawFavicon = 'https://raw.githubusercontent.com/XbibzOfficial777/whatsbibz/main/assets/logo/whatsbibz.ico'
const onGitHubActions = process.env.GITHUB_ACTIONS === 'true'
const logoSrc = onGitHubActions ? rawLogo : '/whatsbibz-mark.png'
const faviconSrc = onGitHubActions ? rawFavicon : '/favicon.ico'

const versionMenu = (label: string) => ({
  text: `v${pkg.version}`,
  items: [
    { text: label === 'Version' ? 'npm package' : label === '版本' ? 'npm 软件包' : 'Paket npm', link: 'https://www.npmjs.com/package/@xbibzlibrary/whatsbibz' },
    { text: 'GitHub', link: repository },
    { text: label === 'Version' ? 'Changelog' : label === '版本' ? '更新日志' : 'Catatan versi', link: `${repository}/blob/main/CHANGELOG.md` },
  ],
})

const sidebarId = [
  { text: 'Mulai di sini', items: [
    { text: 'Ikhtisar', link: '/' },
    { text: 'Mulai cepat', link: '/guide/getting-started' },
    { text: 'Alur kerja client', link: '/guide/client-lifecycle' },
    { text: 'Konfigurasi', link: '/guide/configuration' },
  ] },
  { text: 'Panduan', items: [
    { text: 'Pairing dan QR', link: '/guide/pairing' },
    { text: 'Identitas perangkat', link: '/guide/device-identity' },
    { text: 'Koneksi, reconnect, dan event', link: '/guide/connection-events' },
    { text: 'Pesan: kirim dan baca', link: '/guide/messages' },
    { text: 'Tombol interaktif', link: '/guide/interactive-messages' },
    { text: 'Rich message', link: '/guide/rich-messages' },
    { text: 'JID, kontak, dan grup', link: '/guide/jid-groups' },
    { text: 'Sesi dan keamanan', link: '/guide/session-security' },
    { text: 'Socket Baileys tingkat rendah', link: '/guide/low-level-api' },
    { text: 'TypeScript dan migrasi', link: '/guide/typescript-migration' },
    { text: 'Troubleshooting', link: '/guide/troubleshooting' },
    { text: 'Pengujian', link: '/guide/testing' },
    { text: 'Operasional produksi', link: '/guide/production-operations' },
  ] },
  { text: 'Referensi', items: [
    { text: 'API client & event', link: '/reference/client-api' },
    { text: 'Opsi client', link: '/reference/client-options' },
    { text: 'Helper pesan', link: '/reference/message-helpers' },
    { text: 'Identitas dan pairing', link: '/reference/identity-pairing' },
    { text: 'Event client', link: '/reference/events' },
    { text: 'Ekspor publik', link: '/reference/exports' },
  ] },
  { text: 'Lainnya', items: [
    { text: 'Contoh', link: '/examples' },
    { text: 'FAQ', link: '/faq' },
    { text: 'Keamanan dan batas penggunaan', link: '/security' },
  ] },
]

const sidebarEn = [
  { text: 'Start here', items: [
    { text: 'Overview', link: '/en/' },
    { text: 'Getting started', link: '/en/guide/getting-started' },
    { text: 'Client lifecycle', link: '/en/guide/client-lifecycle' },
    { text: 'Configuration', link: '/en/guide/configuration' },
  ] },
  { text: 'Guides', items: [
    { text: 'Pairing and QR', link: '/en/guide/pairing' },
    { text: 'Device identity', link: '/en/guide/device-identity' },
    { text: 'Connection and events', link: '/en/guide/connection-events' },
    { text: 'Sending and reading messages', link: '/en/guide/messages' },
    { text: 'Interactive messages', link: '/en/guide/interactive-messages' },
    { text: 'Rich messages', link: '/en/guide/rich-messages' },
    { text: 'JIDs, contacts, and groups', link: '/en/guide/jid-groups' },
    { text: 'Sessions and security', link: '/en/guide/session-security' },
    { text: 'Low-level Baileys socket', link: '/en/guide/low-level-api' },
    { text: 'TypeScript and migration', link: '/en/guide/typescript-migration' },
    { text: 'Troubleshooting', link: '/en/guide/troubleshooting' },
    { text: 'Testing', link: '/en/guide/testing' },
    { text: 'Production operations', link: '/en/guide/production-operations' },
  ] },
  { text: 'Reference', items: [
    { text: 'Client API and events', link: '/en/reference/client-api' },
    { text: 'Client options', link: '/en/reference/client-options' },
    { text: 'Message helpers', link: '/en/reference/message-helpers' },
    { text: 'Identity and pairing', link: '/en/reference/identity-pairing' },
    { text: 'Client events', link: '/en/reference/events' },
    { text: 'Public exports', link: '/en/reference/exports' },
  ] },
  { text: 'More', items: [
    { text: 'Examples', link: '/en/examples' },
    { text: 'FAQ', link: '/en/faq' },
    { text: 'Security and responsible use', link: '/en/security' },
  ] },
]

const sidebarZh = [
  { text: '开始使用', items: [
    { text: '概览', link: '/zh/' },
    { text: '快速开始', link: '/zh/guide/getting-started' },
    { text: '客户端生命周期', link: '/zh/guide/client-lifecycle' },
    { text: '配置', link: '/zh/guide/configuration' },
  ] },
  { text: '指南', items: [
    { text: '配对与二维码', link: '/zh/guide/pairing' },
    { text: '设备身份', link: '/zh/guide/device-identity' },
    { text: '连接与事件', link: '/zh/guide/connection-events' },
    { text: '发送与读取消息', link: '/zh/guide/messages' },
    { text: '交互消息', link: '/zh/guide/interactive-messages' },
    { text: 'Rich Message', link: '/zh/guide/rich-messages' },
    { text: 'JID、联系人与群组', link: '/zh/guide/jid-groups' },
    { text: '会话与安全', link: '/zh/guide/session-security' },
    { text: '底层 Baileys Socket', link: '/zh/guide/low-level-api' },
    { text: 'TypeScript 与迁移', link: '/zh/guide/typescript-migration' },
    { text: '故障排查', link: '/zh/guide/troubleshooting' },
    { text: '测试', link: '/zh/guide/testing' },
    { text: '生产环境运维', link: '/zh/guide/production-operations' },
  ] },
  { text: '参考', items: [
    { text: '客户端 API 与事件', link: '/zh/reference/client-api' },
    { text: 'Client 选项', link: '/zh/reference/client-options' },
    { text: '消息辅助函数', link: '/zh/reference/message-helpers' },
    { text: '身份与配对', link: '/zh/reference/identity-pairing' },
    { text: '客户端事件', link: '/zh/reference/events' },
    { text: '公开导出', link: '/zh/reference/exports' },
  ] },
  { text: '更多', items: [
    { text: '示例', link: '/zh/examples' },
    { text: '常见问题', link: '/zh/faq' },
    { text: '安全与负责任使用', link: '/zh/security' },
  ] },
]

// Bind visible search text to each route's locale-specific theme instead of selecting it from a runtime map.
// The active locale theme changes with the page route, which keeps the search button/modal aligned after navigation.
const searchTranslations = {
  root: {
    button: { buttonText: 'Cari dokumentasi', buttonAriaLabel: 'Cari dokumentasi WhatsBibz' },
    modal: { backButtonTitle: 'Tutup pencarian', displayDetails: 'Tampilkan daftar rinci', noResultsText: 'Tidak ada hasil', resetButtonTitle: 'Hapus pencarian', footer: { selectText: 'pilih', navigateText: 'navigasi', closeText: 'tutup' } },
  },
  en: {
    button: { buttonText: 'Search', buttonAriaLabel: 'Search documentation' },
    modal: { backButtonTitle: 'Close search', displayDetails: 'Display detailed list', noResultsText: 'No results', resetButtonTitle: 'Clear search', footer: { selectText: 'select', navigateText: 'navigate', closeText: 'close' } },
  },
  zh: {
    button: { buttonText: '搜索', buttonAriaLabel: '搜索文档' },
    modal: { backButtonTitle: '关闭搜索', displayDetails: '显示详细列表', noResultsText: '没有结果', resetButtonTitle: '清除搜索', footer: { selectText: '选择', navigateText: '导航', closeText: '关闭' } },
  },
}
const searchForLocale = (locale: keyof typeof searchTranslations) => ({
  provider: 'local' as const,
  options: { translations: searchTranslations[locale] },
})
const localSearch = searchForLocale('root')

const sharedTheme = {
  logo: { src: logoSrc, alt: 'WhatsBibz mark' },
  search: localSearch,
  socialLinks: [{ icon: 'github', link: repository }],
  i18nRouting: false,
  outline: { level: [2, 3] as [number, number], label: 'Di halaman ini' },
  editLink: { pattern: `${repository}/edit/main/docs/:path`, text: 'Sarankan perbaikan di GitHub' },
}

const themeId = {
  ...sharedTheme,
  search: searchForLocale('root'),
  siteTitle: 'WhatsBibz',
  langMenuLabel: 'Bahasa',
  nav: [
    { text: 'Panduan', link: '/guide/getting-started' },
    { text: 'Referensi', link: '/reference/client-api' },
    { text: 'Contoh', link: '/examples' },
    versionMenu('Versi'),
  ],
  sidebar: sidebarId,
  outline: { level: [2, 3] as [number, number], label: 'Di halaman ini' },
  footer: { message: 'Dokumentasi WhatsBibz', copyright: 'WhatsBibz · MIT License' },
  docFooter: { prev: 'Halaman sebelumnya', next: 'Halaman selanjutnya' },
  darkModeSwitchLabel: 'Tampilan',
  lightModeSwitchTitle: 'Beralih ke tema terang',
  darkModeSwitchTitle: 'Beralih ke tema gelap',
  sidebarMenuLabel: 'Menu dokumentasi',
  returnToTopLabel: 'Kembali ke atas',
  skipToContentLabel: 'Lewati ke konten',
  lastUpdatedText: 'Terakhir diperbarui',
  notFound: { title: 'HALAMAN TIDAK DITEMUKAN', quote: 'Halaman ini mungkin dipindahkan atau tidak tersedia.', linkLabel: 'Kembali ke beranda', linkText: 'Beranda' },
}

const themeEn = {
  ...sharedTheme,
  search: searchForLocale('en'),
  siteTitle: 'WhatsBibz',
  langMenuLabel: 'Language',
  nav: [
    { text: 'Guides', link: '/en/guide/getting-started' },
    { text: 'Reference', link: '/en/reference/client-api' },
    { text: 'Examples', link: '/en/examples' },
    versionMenu('Version'),
  ],
  sidebar: sidebarEn,
  outline: { level: [2, 3] as [number, number], label: 'On this page' },
  editLink: { pattern: `${repository}/edit/main/docs/:path`, text: 'Suggest an edit on GitHub' },
  footer: { message: 'WhatsBibz documentation', copyright: 'WhatsBibz · MIT License' },
  docFooter: { prev: 'Previous page', next: 'Next page' },
  darkModeSwitchLabel: 'Appearance',
  lightModeSwitchTitle: 'Switch to light theme',
  darkModeSwitchTitle: 'Switch to dark theme',
  sidebarMenuLabel: 'Documentation menu',
  returnToTopLabel: 'Return to top',
  skipToContentLabel: 'Skip to content',
  lastUpdatedText: 'Last updated',
  notFound: { title: 'PAGE NOT FOUND', quote: 'This page may have moved or no longer exists.', linkLabel: 'Return to home', linkText: 'Home' },
}

const themeZh = {
  ...sharedTheme,
  search: searchForLocale('zh'),
  siteTitle: 'WhatsBibz 文档',
  langMenuLabel: '选择语言',
  nav: [
    { text: '指南', link: '/zh/guide/getting-started' },
    { text: '参考', link: '/zh/reference/client-api' },
    { text: '示例', link: '/zh/examples' },
    versionMenu('版本'),
  ],
  sidebar: sidebarZh,
  outline: { level: [2, 3] as [number, number], label: '本页目录' },
  editLink: { pattern: `${repository}/edit/main/docs/:path`, text: '在 GitHub 上建议修改' },
  footer: { message: 'WhatsBibz 文档', copyright: 'WhatsBibz · MIT License' },
  docFooter: { prev: '上一页', next: '下一页' },
  darkModeSwitchLabel: '外观',
  lightModeSwitchTitle: '切换到浅色主题',
  darkModeSwitchTitle: '切换到深色主题',
  sidebarMenuLabel: '文档导航',
  returnToTopLabel: '返回顶部',
  skipToContentLabel: '跳到正文',
  lastUpdatedText: '最后更新',
  notFound: { title: '找不到页面', quote: '此页面可能已移动或不存在。', linkLabel: '返回首页', linkText: '首页' },
}

export default defineConfig({
  lang: 'id-ID',
  title: 'WhatsBibz',
  description: 'Panduan dan referensi WhatsBibz, library WhatsApp Web multi-device untuk Node.js.',
  base: process.env.PAGES_BASE_PATH || '/',
  cleanUrls: true,
  lastUpdated: true,
  locales: {
    root: { label: 'Bahasa Indonesia', lang: 'id-ID', link: '/', title: 'WhatsBibz', description: 'Dokumentasi WhatsBibz dalam Bahasa Indonesia.', themeConfig: themeId },
    en: { label: 'English', lang: 'en-US', link: '/en/', title: 'WhatsBibz', description: 'WhatsBibz documentation for the Node.js WhatsApp Web library.', themeConfig: themeEn },
    zh: { label: '简体中文', lang: 'zh-CN', link: '/zh/', title: 'WhatsBibz', description: 'WhatsBibz Node.js WhatsApp Web 库文档。', themeConfig: themeZh },
  },
  vite: {
    plugins: [tailwindcss()],
    resolve: { alias: { '@': path.resolve(configDir, 'theme') } },
    server: { allowedHosts: true },
  },
  head: [
    ['meta', { name: 'theme-color', content: '#11695d' }],
    ['meta', { property: 'og:title', content: 'WhatsBibz Documentation' }],
    ['meta', { property: 'og:description', content: 'Guides and API reference for @xbibzlibrary/whatsbibz.' }],
    ['link', { rel: 'icon', type: 'image/x-icon', href: faviconSrc }],
  ],
  markdown: {
    lineNumbers: true,
    theme: { light: 'github-light', dark: 'github-dark' },
  },
  themeConfig: themeId,
})
