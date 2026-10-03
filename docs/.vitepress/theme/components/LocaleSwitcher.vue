<script setup lang="ts">
import { computed } from 'vue'
import { useData, withBase } from 'vitepress'
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger,
} from 'reka-ui'
import { ChevronDown, Languages } from '@lucide/vue'

const { site, localeIndex } = useData()
const languages = computed(() => Object.entries(site.value.locales).map(([key, locale]) => ({
  key,
  label: locale.label,
  lang: locale.lang,
  href: withBase(locale.link || (key === 'root' ? '/' : `/${key}/`)),
  current: key === localeIndex.value,
})))
const currentLanguage = computed(() => languages.value.find((language) => language.current) || languages.value[0])
const alternatives = computed(() => languages.value.filter((language) => !language.current))
const ariaLabels: Record<string, string> = {
  root: 'Pilih bahasa dokumentasi',
  en: 'Choose documentation language',
  zh: '选择文档语言',
}
const ariaLabel = computed(() => ariaLabels[localeIndex.value] || ariaLabels.en)
</script>

<template>
  <DropdownMenuRoot>
    <DropdownMenuTrigger as-child>
      <button type="button" class="doc-locale-trigger" :aria-label="ariaLabel">
        <Languages :size="16" :stroke-width="1.8" aria-hidden="true" />
        <span class="doc-locale-label">{{ currentLanguage?.label }}</span>
        <ChevronDown class="doc-locale-chevron" :size="14" :stroke-width="1.8" aria-hidden="true" />
      </button>
    </DropdownMenuTrigger>
    <DropdownMenuPortal>
      <DropdownMenuContent class="doc-locale-menu" align="end" :side-offset="8">
        <DropdownMenuItem v-for="language in alternatives" :key="language.key" as-child>
          <a class="doc-locale-item" :href="language.href" :lang="language.lang">{{ language.label }}</a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
