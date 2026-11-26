<script setup lang="ts">
import { computed } from 'vue'
import { useData, withBase } from 'vitepress'
import { ArrowRight, BookOpen, Code2, Mail, Package } from '@lucide/vue'
import { projectLinks } from '../lib/project-links'
import { Button } from './ui/button'

const { localeIndex } = useData()
const copy = computed(() => ({
  root: { start: 'Buka panduan', repository: 'Lihat repository', npm: 'Lihat di npm', contact: 'Kontak developer' },
  en: { start: 'Read the guide', repository: 'View repository', npm: 'View on npm', contact: 'Contact developer' },
  zh: { start: '阅读指南', repository: '查看仓库', npm: '查看 npm', contact: '联系开发者' },
}[localeIndex.value] || { start: 'Read the guide', repository: 'View repository', npm: 'View on npm', contact: 'Contact developer' }))
const prefix = computed(() => localeIndex.value === 'root' ? '' : `/${localeIndex.value}`)
const guideHref = computed(() => withBase(`${prefix.value}/guide/getting-started`))
const contactHref = computed(() => withBase(`${prefix.value}/contact`))
</script>

<template>
  <div class="ww-home-actions">
    <Button as="a" :href="guideHref" size="lg" class="ww-primary-action">
      <BookOpen :size="17" />
      {{ copy.start }}
      <ArrowRight :size="16" />
    </Button>
    <Button as="a" :href="projectLinks.npm" variant="outline" size="lg" class="ww-secondary-action" target="_blank" rel="noopener noreferrer">
      <Package :size="17" />
      {{ copy.npm }}
    </Button>
    <Button as="a" :href="projectLinks.repository" variant="outline" size="lg" class="ww-secondary-action" target="_blank" rel="noopener noreferrer">
      <Code2 :size="17" />
      {{ copy.repository }}
    </Button>
    <Button as="a" :href="contactHref" variant="ghost" size="lg" class="ww-contact-action">
      <Mail :size="17" />
      {{ copy.contact }}
    </Button>
  </div>
</template>
