<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useData, useRoute, withBase } from 'vitepress'
import { DialogClose, DialogContent, DialogDescription, DialogOverlay, DialogPortal, DialogRoot, DialogTitle, DialogTrigger } from 'reka-ui'
import { ArrowUpRight, Menu, X } from '@lucide/vue'
import { Button } from './ui/button'

const open = ref(false)
const { theme, site, localeIndex } = useData()
const route = useRoute()
const sections = computed(() => Array.isArray(theme.value.sidebar) ? theme.value.sidebar : [])
const allLanguages = computed(() => Object.entries(site.value.locales).map(([key, locale]) => ({
  key,
  label: locale.label,
  href: withBase(locale.link || (key === 'root' ? '/' : `/${key}/`)),
  current: key === localeIndex.value,
})))
const currentLanguage = computed(() => allLanguages.value.find((language) => language.current) || allLanguages.value[0])
const languages = computed(() => allLanguages.value.filter((language) => !language.current))
type MobileCopy = {
  trigger: string
  title: string
  description: string
  close: string
  nav: string
  language: string
  current: string
  repository: string
}
const defaultCopy: MobileCopy = {
  trigger: 'Open navigation', title: 'Navigation', description: 'Choose a guide or reference page.', close: 'Close navigation', nav: 'Documentation navigation', language: 'Language', current: 'Current', repository: 'Open the GitHub repository',
}
const copyByLocale: Record<string, MobileCopy> = {
  root: { trigger: 'Buka navigasi', title: 'Navigasi', description: 'Pilih panduan atau referensi.', close: 'Tutup navigasi', nav: 'Navigasi dokumentasi', language: 'Bahasa', current: 'Saat ini', repository: 'Buka repository di GitHub' },
  en: defaultCopy,
  zh: { trigger: '打开导航', title: '站点导航', description: '选择指南或参考文档。', close: '关闭导航', nav: '文档导航', language: '语言', current: '当前', repository: '打开 GitHub 仓库' },
}
const copy = computed(() => copyByLocale[localeIndex.value] || defaultCopy)

watch(() => route.path, () => { open.value = false })
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogTrigger as-child>
      <Button variant="outline" size="icon" class="ww-mobile-trigger" :aria-label="copy.trigger">
        <Menu :size="18" :stroke-width="1.8" />
      </Button>
    </DialogTrigger>
    <DialogPortal>
      <DialogOverlay class="ww-mobile-overlay" />
      <DialogContent class="ww-mobile-content">
        <div class="ww-mobile-header">
          <div>
            <DialogTitle class="ww-mobile-title">{{ copy.title }}</DialogTitle>
            <DialogDescription class="ww-mobile-description">{{ copy.description }}</DialogDescription>
          </div>
          <DialogClose as-child>
            <Button variant="ghost" size="icon" class="ww-mobile-close" :aria-label="copy.close">
              <X :size="18" />
            </Button>
          </DialogClose>
        </div>
        <nav class="ww-mobile-nav" :aria-label="copy.nav">
          <section v-for="section in sections" :key="section.text">
            <p class="ww-mobile-label">{{ section.text }}</p>
            <a
              v-for="item in section.items || []"
              :key="item.link || item.text"
              :href="item.link ? withBase(item.link) : '#'"
              class="ww-mobile-link"
              :aria-current="route.path === item.link ? 'page' : undefined"
              @click="open = false"
            >
              <span>{{ item.text }}</span>
              <ArrowUpRight :size="15" />
            </a>
          </section>
          <section>
            <p class="ww-mobile-label">{{ copy.language }}</p>
            <p class="ww-mobile-current-locale">{{ copy.current }}: {{ currentLanguage?.label }}</p>
            <a
              v-for="language in languages"
              :key="language.key"
              :href="language.href"
              class="ww-mobile-link"
              :aria-current="language.current ? 'page' : undefined"
              @click="open = false"
            >
              <span>{{ language.label }}</span>
            </a>
          </section>
        </nav>
        <a class="ww-mobile-footer" href="https://github.com/XbibzOfficial777/whatsbibz" target="_blank" rel="noreferrer">
          {{ copy.repository }} <ArrowUpRight :size="15" />
        </a>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
