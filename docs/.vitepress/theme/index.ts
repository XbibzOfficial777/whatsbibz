import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'
import Layout from './Layout.vue'
import { Badge } from './components/ui/badge'
import { Button } from './components/ui/button'
import { Card } from './components/ui/card'
import WorkflowCanvas from './components/WorkflowCanvas.vue'
import './shadcn.css'
import './custom.css'

export default {
  extends: DefaultTheme,
  Layout,
  enhanceApp({ app }) {
    app.component('ShadcnBadge', Badge)
    app.component('ShadcnButton', Button)
    app.component('ShadcnCard', Card)
    app.component('WorkflowCanvas', WorkflowCanvas)
  },
} satisfies Theme
