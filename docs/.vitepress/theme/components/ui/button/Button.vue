<script setup lang="ts">
import { Primitive } from 'reka-ui'
import { cn } from '@/lib/utils'
import { buttonVariants, type ButtonVariants } from '.'

interface Props {
  as?: string
  variant?: ButtonVariants['variant']
  size?: ButtonVariants['size']
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  as: 'button',
  variant: 'default',
  size: 'default',
})
</script>

<template>
  <Primitive
    :as="props.as"
    :class="cn(buttonVariants({ variant: props.variant, size: props.size }), props.class)"
    v-bind="$attrs"
  >
    <slot />
  </Primitive>
</template>
