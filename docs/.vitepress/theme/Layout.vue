<script setup lang="ts">
import DefaultTheme from 'vitepress/theme'
import HomeActions from './components/HomeActions.vue'
import MobileSheet from './components/MobileSheet.vue'

const Layout = DefaultTheme.Layout
</script>

<template>
  <Layout>
    <template #nav-bar-content-after>
      <MobileSheet />
    </template>
    <template #home-hero-actions-after>
      <HomeActions />
    </template>
  </Layout>
</template>
