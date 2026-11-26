<script setup lang="ts">
import { computed } from 'vue'
import { useData } from 'vitepress'
import { ArrowUpRight, Code2, Mail, Package, Send } from '@lucide/vue'
import { projectLinks } from '../lib/project-links'

const { localeIndex } = useData()
const descriptions = {
  root: {
    telegram: 'Kirim pesan melalui Telegram.',
    github: 'Lihat profil dan proyek developer.',
    email: 'Hubungi melalui email.',
    npm: 'Lihat paket, versi, dan cara instalasi.',
  },
  en: {
    telegram: 'Send a message on Telegram.',
    github: 'See the developer profile and projects.',
    email: 'Get in touch by email.',
    npm: 'View the package, versions, and installation.',
  },
  zh: {
    telegram: '通过 Telegram 发送消息。',
    github: '查看开发者主页和项目。',
    email: '通过电子邮件联系。',
    npm: '查看软件包、版本和安装方式。',
  },
}
const copy = computed(() => descriptions[localeIndex.value as keyof typeof descriptions] || descriptions.en)
const links = computed(() => [
  { title: 'Telegram', value: '@xbibzofficial', detail: copy.value.telegram, href: projectLinks.telegram, icon: Send, external: true },
  { title: 'GitHub', value: 'XbibzOfficial777', detail: copy.value.github, href: projectLinks.developerGitHub, icon: Code2, external: true },
  { title: 'Email', value: projectLinks.email, detail: copy.value.email, href: `mailto:${projectLinks.email}`, icon: Mail, external: false },
  { title: 'npm', value: '@xbibzlibrary/whatsbibz', detail: copy.value.npm, href: projectLinks.npm, icon: Package, external: true },
])
</script>

<template>
  <div class="ww-card-grid ww-contact-grid">
    <a
      v-for="item in links"
      :key="item.title"
      class="ww-card ww-contact-card"
      :href="item.href"
      :target="item.external ? '_blank' : undefined"
      :rel="item.external ? 'noopener noreferrer' : undefined"
    >
      <span class="ww-card-icon" aria-hidden="true"><component :is="item.icon" :size="20" :stroke-width="1.7" /></span>
      <span class="ww-card-copy">
        <strong>{{ item.title }}</strong>
        <span class="ww-contact-value">{{ item.value }}</span>
        <span>{{ item.detail }}</span>
      </span>
      <ArrowUpRight v-if="item.external" class="ww-contact-arrow" :size="16" aria-hidden="true" />
    </a>
  </div>
</template>
