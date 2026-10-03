<script setup lang="ts">
import { cn } from '@/lib/utils'

withDefaults(defineProps<{
  variant?: 'default' | 'secondary' | 'outline' | 'destructive'
  class?: string
}>(), { variant: 'default' })
</script>

<template>
  <span
    :class="cn(
      'inline-flex w-fit items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
      {
        'border-transparent bg-primary text-primary-foreground': variant === 'default',
        'border-transparent bg-secondary text-secondary-foreground': variant === 'secondary',
        'border-border bg-transparent text-foreground': variant === 'outline',
        'border-transparent bg-destructive text-white': variant === 'destructive',
      },
      $props.class,
    )"
  >
    <slot />
  </span>
</template>
