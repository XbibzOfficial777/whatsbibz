<script setup lang="ts">
import { computed, ref, watch } from 'vue'

type Locale = 'id' | 'en' | 'zh'
type FlowKind = 'whatsbibz' | 'telebibz'
type Tone = 'teal' | 'blue' | 'violet' | 'amber' | 'green' | 'slate' | 'rose'
type Localized = Record<Locale, string>
type FlowNode = {
  id: string
  x: number
  y: number
  title: Localized
  subtitle: Localized
  detail: Localized
  tone: Tone
}
type FlowEdge = {
  from: string
  to: string
  label?: Localized
  bend?: number
  labelDx?: number
  labelDy?: number
}
type FlowDefinition = {
  title: Localized
  summary: Localized
  nodes: FlowNode[]
  edges: FlowEdge[]
}
type Gesture =
  | { kind: 'pan'; pointerX: number; pointerY: number; originX: number; originY: number }
  | { kind: 'node'; id: string; pointerX: number; pointerY: number; originX: number; originY: number }

type UiCopy = {
  interactive: string
  hint: string
  controls: string
  zoomIn: string
  zoomOut: string
  reset: string
  selected: string
  empty: string
  canvas: string
  zoom: string
}

const props = withDefaults(defineProps<{ flow: FlowKind; locale?: Locale }>(), { locale: 'id' })
const locale = computed(() => props.locale)
const NODE_WIDTH = 210
const NODE_HEIGHT = 90

const ui: Record<Locale, UiCopy> = {
  id: {
    interactive: 'Peta alur interaktif',
    hint: 'Seret kartu untuk mengatur ulang. Seret area kosong untuk menggeser kanvas; gunakan roda mouse atau kontrol zoom untuk memperbesar.',
    controls: 'Kontrol kanvas',
    zoomIn: 'Perbesar diagram',
    zoomOut: 'Perkecil diagram',
    reset: 'Atur ulang diagram',
    selected: 'Langkah terpilih',
    empty: 'Pilih satu langkah untuk melihat penjelasannya.',
    canvas: 'Kanvas workflow interaktif',
    zoom: 'Zoom',
  },
  en: {
    interactive: 'Interactive workflow map',
    hint: 'Drag a card to rearrange it. Drag empty space to pan; use the mouse wheel or zoom controls to scale the canvas.',
    controls: 'Canvas controls',
    zoomIn: 'Zoom in',
    zoomOut: 'Zoom out',
    reset: 'Reset diagram',
    selected: 'Selected step',
    empty: 'Select a step to read its explanation.',
    canvas: 'Interactive workflow canvas',
    zoom: 'Zoom',
  },
  zh: {
    interactive: '交互式流程图',
    hint: '拖动卡片可重新排列；拖动空白处可平移画布；使用鼠标滚轮或缩放按钮调整大小。',
    controls: '画布控件',
    zoomIn: '放大流程图',
    zoomOut: '缩小流程图',
    reset: '重置流程图',
    selected: '当前步骤',
    empty: '选择一个步骤以查看说明。',
    canvas: '交互式工作流画布',
    zoom: '缩放',
  },
}
const copy = computed(() => ui[locale.value])

const flows: Record<FlowKind, FlowDefinition> = {
  whatsbibz: {
    title: {
      id: 'Siklus hidup client WhatsBibz',
      en: 'WhatsBibz client lifecycle',
      zh: 'WhatsBibz 客户端生命周期',
    },
    summary: {
      id: 'Dari inisialisasi hingga pairing, reconnect, dan pemulihan sesi.',
      en: 'From client initialization through pairing, reconnects, and session recovery.',
      zh: '从客户端初始化到配对、重连和会话恢复。',
    },
    nodes: [
      {
        id: 'client', x: 145, y: 150, tone: 'teal',
        title: { id: 'Inisialisasi client', en: 'Initialize client', zh: '初始化客户端' },
        subtitle: { id: 'createBibzWhats(options)', en: 'createBibzWhats(options)', zh: 'createBibzWhats(options)' },
        detail: {
          id: 'Wrapper menggabungkan opsi, menyiapkan controller pairing, dan mengelola lifecycle client.',
          en: 'The wrapper merges options, prepares pairing control, and owns the client lifecycle.',
          zh: 'Wrapper 合并配置、准备配对控制器并管理客户端生命周期。',
        },
      },
      {
        id: 'auth', x: 400, y: 150, tone: 'blue',
        title: { id: 'Auth & identitas', en: 'Auth & identity', zh: '认证与设备身份' },
        subtitle: { id: 'authDir + identity.json', en: 'authDir + identity.json', zh: 'authDir + identity.json' },
        detail: {
          id: 'Credentials dan identitas stabil dimuat. Mode auto atau identitas eksplisit menentukan profil perangkat.',
          en: 'Credentials and the stable device identity are loaded. Auto mode or an explicit identity selects the device profile.',
          zh: '加载凭据与稳定设备身份；自动模式或显式配置决定设备资料。',
        },
      },
      {
        id: 'socket', x: 655, y: 150, tone: 'violet',
        title: { id: 'Buat socket', en: 'Create socket', zh: '创建 Socket' },
        subtitle: { id: 'makeWASocket(...)', en: 'makeWASocket(...)', zh: 'makeWASocket(...)' },
        detail: {
          id: 'Socket baru mengamati connection.update dan creds.update. Reconnect memakai socket baru.',
          en: 'A new socket observes connection.update and creds.update. A reconnect uses a replacement socket.',
          zh: '新 Socket 监听 connection.update 和 creds.update；重连时会创建替代 Socket。',
        },
      },
      {
        id: 'pairing', x: 910, y: 150, tone: 'amber',
        title: { id: 'Tautkan perangkat', en: 'Link device', zh: '关联设备' },
        subtitle: { id: 'QR atau pairing code', en: 'QR or pairing code', zh: '二维码或配对码' },
        detail: {
          id: 'Pairing berlangsung asynchronous. Isi phone untuk kode; tanpa phone, tangani QR.',
          en: 'Pairing is asynchronous. Set phone for a code; without phone, handle the QR event.',
          zh: '配对是异步流程。设置 phone 获取配对码；否则处理 QR 事件。',
        },
      },
      {
        id: 'ready', x: 910, y: 420, tone: 'green',
        title: { id: 'Socket siap', en: 'Socket ready', zh: 'Socket 就绪' },
        subtitle: { id: 'ready(sock)', en: 'ready(sock)', zh: 'ready(sock)' },
        detail: {
          id: 'Pasang listener sock.ev pada setiap event ready karena reconnect menghasilkan event emitter baru.',
          en: 'Attach sock.ev listeners on every ready event because reconnects create a new event emitter.',
          zh: '每次 ready 都要绑定 sock.ev 监听器，因为重连会产生新的事件发射器。',
        },
      },
      {
        id: 'close', x: 655, y: 420, tone: 'slate',
        title: { id: 'Koneksi ditutup', en: 'Connection closed', zh: '连接已关闭' },
        subtitle: { id: 'connection.update', en: 'connection.update', zh: 'connection.update' },
        detail: {
          id: 'Wrapper mengklasifikasikan alasan disconnect. Status 515 dapat menjadi restart normal setelah pairing.',
          en: 'The wrapper classifies the disconnect reason. Status 515 can be a normal restart after pairing.',
          zh: 'Wrapper 会分类断开原因；配对后的 515 可能是正常重启。',
        },
      },
      {
        id: 'retry', x: 400, y: 420, tone: 'blue',
        title: { id: 'Reconnect terukur', en: 'Bounded reconnect', zh: '受控重连' },
        subtitle: { id: 'back-off + batas percobaan', en: 'back-off + attempt limit', zh: '退避 + 尝试次数上限' },
        detail: {
          id: 'Gangguan yang dapat dicoba ulang memakai jeda bertahap. Controller kemudian membuat socket baru.',
          en: 'Retryable failures use bounded back-off. The controller then creates a fresh socket.',
          zh: '可重试故障使用有上限的退避策略，随后控制器会创建新 Socket。',
        },
      },
      {
        id: 'operator', x: 655, y: 555, tone: 'rose',
        title: { id: 'Perlu tindakan operator', en: 'Operator action', zh: '需要运维人员处理' },
        subtitle: { id: 'session-wiped / give-up', en: 'session-wiped / give-up', zh: 'session-wiped / give-up' },
        detail: {
          id: 'Jika percobaan habis atau sesi tidak valid, periksa log tersanitasi dan lakukan pairing ulang bila perlu.',
          en: 'When attempts are exhausted or auth is invalid, inspect sanitized logs and relink the device if needed.',
          zh: '尝试次数耗尽或认证无效时，请检查已脱敏日志，并在必要时重新配对。',
        },
      },
    ],
    edges: [
      { from: 'client', to: 'auth', label: { id: 'opsi', en: 'options', zh: '配置' } },
      { from: 'auth', to: 'socket', label: { id: 'muat state', en: 'load state', zh: '加载状态' } },
      { from: 'socket', to: 'pairing', label: { id: 'connect', en: 'connect', zh: '连接' } },
      { from: 'pairing', to: 'ready', label: { id: 'tertaut', en: 'linked', zh: '已关联' } },
      { from: 'ready', to: 'close' },
      { from: 'close', to: 'retry', label: { id: 'retryable', en: 'retryable', zh: '可重试' } },
      { from: 'retry', to: 'socket', label: { id: 'socket baru', en: 'new socket', zh: '新 Socket' } },
      { from: 'close', to: 'operator', label: { id: 'batas / auth', en: 'limit / auth', zh: '上限 / 认证' }, labelDx: 34, labelDy: 0 },
    ],
  },
  telebibz: {
    title: {
      id: 'Siklus pemrosesan update TeleBibz',
      en: 'TeleBibz update pipeline',
      zh: 'TeleBibz 更新处理流程',
    },
    summary: {
      id: 'Update masuk melalui polling atau webhook, lalu melewati Context, middleware, handler, dan Bot API.',
      en: 'Updates arrive through polling or webhooks, then pass through Context, middleware, handlers, and the Bot API.',
      zh: '更新通过轮询或 Webhook 进入，再经过 Context、中间件、处理器和 Bot API。',
    },
    nodes: [
      {
        id: 'update', x: 145, y: 150, tone: 'teal',
        title: { id: 'Telegram update', en: 'Telegram update', zh: 'Telegram 更新' },
        subtitle: { id: 'pesan / callback / query', en: 'message / callback / query', zh: '消息 / 回调 / 查询' },
        detail: {
          id: 'Telegram mengirim update melalui getUpdates atau POST webhook. Pilih satu transport per token.',
          en: 'Telegram delivers updates through getUpdates or a webhook POST. Use one transport per bot token.',
          zh: 'Telegram 通过 getUpdates 或 Webhook POST 发送更新；每个 Bot Token 只使用一种传输方式。',
        },
      },
      {
        id: 'transport', x: 400, y: 150, tone: 'blue',
        title: { id: 'Transport', en: 'Transport', zh: '传输层' },
        subtitle: { id: 'polling / webhook', en: 'polling / webhook', zh: '轮询 / Webhook' },
        detail: {
          id: 'Transport menormalkan update dan meneruskannya ke handleUpdate(). Validasi request webhook di server aplikasi.',
          en: 'The transport normalizes an update and forwards it to handleUpdate(). Validate webhook requests in your server.',
          zh: '传输层规范化更新并交给 handleUpdate()；请在应用服务器验证 Webhook 请求。',
        },
      },
      {
        id: 'context', x: 655, y: 150, tone: 'violet',
        title: { id: 'Buat Context', en: 'Create Context', zh: '创建 Context' },
        subtitle: { id: 'update + api + botInfo', en: 'update + api + botInfo', zh: 'update + api + botInfo' },
        detail: {
          id: 'Satu Context mewakili satu update. Field seperti ctx.chat atau ctx.msg bergantung pada jenis update.',
          en: 'One Context represents one update. Fields such as ctx.chat or ctx.msg depend on the update type.',
          zh: '一个 Context 对应一个更新；ctx.chat 或 ctx.msg 等字段取决于更新类型。',
        },
      },
      {
        id: 'middleware', x: 910, y: 150, tone: 'amber',
        title: { id: 'Middleware pipeline', en: 'Middleware pipeline', zh: '中间件管线' },
        subtitle: { id: 'session, wizard, error boundary', en: 'session, wizard, error boundary', zh: 'session、wizard、error boundary' },
        detail: {
          id: 'Middleware berjalan sesuai urutan pendaftaran. next() meneruskan update; error boundary meneruskan error ke onError.',
          en: 'Middleware runs in registration order. next() continues the update; the error boundary forwards failures to onError.',
          zh: '中间件按注册顺序执行。next() 继续处理；错误边界将异常交给 onError。',
        },
      },
      {
        id: 'handler', x: 910, y: 420, tone: 'green',
        title: { id: 'Handler cocok', en: 'Matching handler', zh: '匹配的处理器' },
        subtitle: { id: 'cmd / hears / on / action', en: 'cmd / hears / on / action', zh: 'cmd / hears / on / action' },
        detail: {
          id: 'Handler menerima Context. Jika tidak memanggil next(), update berhenti pada handler tersebut.',
          en: 'Handlers receive Context. If a handler does not call next(), dispatch stops there.',
          zh: '处理器接收 Context；如果不调用 next()，更新处理会在此处停止。',
        },
      },
      {
        id: 'api', x: 655, y: 420, tone: 'blue',
        title: { id: 'Panggilan Bot API', en: 'Bot API call', zh: '调用 Bot API' },
        subtitle: { id: 'ctx.reply() / ctx.api.*', en: 'ctx.reply() / ctx.api.*', zh: 'ctx.reply() / ctx.api.*' },
        detail: {
          id: 'Context helper membentuk payload; ApiClient menjalankan transformer dan mengirim request ke Telegram.',
          en: 'Context helpers build the payload; ApiClient runs transformers and sends the request to Telegram.',
          zh: 'Context helper 构造 payload；ApiClient 执行 transformer 并向 Telegram 发送请求。',
        },
      },
      {
        id: 'telegram', x: 400, y: 420, tone: 'slate',
        title: { id: 'Respons Telegram', en: 'Telegram response', zh: 'Telegram 响应' },
        subtitle: { id: 'result atau ApiError', en: 'result or ApiError', zh: 'result 或 ApiError' },
        detail: {
          id: 'Request berhasil menghasilkan object respons; kegagalan melempar ApiError berisi method, code, dan parameter terkait.',
          en: 'Successful requests resolve with a response object; failures throw ApiError with method, code, and related parameters.',
          zh: '成功请求返回响应对象；失败时抛出包含 method、code 和相关参数的 ApiError。',
        },
      },
      {
        id: 'error', x: 910, y: 555, tone: 'rose',
        title: { id: 'Error handler', en: 'Error handler', zh: '错误处理器' },
        subtitle: { id: 'onError / reporter', en: 'onError / reporter', zh: 'onError / reporter' },
        detail: {
          id: 'Tangani exception, catat konteks yang sudah disanitasi, lalu putuskan apakah update aman dicoba ulang.',
          en: 'Handle exceptions, log sanitized context, and decide whether an update can safely be retried.',
          zh: '处理异常、记录已脱敏的上下文，并判断是否可以安全重试该更新。',
        },
      },
    ],
    edges: [
      { from: 'update', to: 'transport' },
      { from: 'transport', to: 'context' },
      { from: 'context', to: 'middleware' },
      { from: 'middleware', to: 'handler' },
      { from: 'handler', to: 'api' },
      { from: 'api', to: 'telegram' },
      { from: 'handler', to: 'error', label: { id: 'exception', en: 'exception', zh: '异常' }, labelDx: 40, labelDy: 0 },
    ],
  },
}

const definition = computed(() => flows[props.flow])
const nodes = ref<FlowNode[]>([])
const selectedId = ref('')
const viewport = ref({ x: 0, y: 0, scale: 1 })
const svg = ref<SVGSVGElement | null>(null)
const zoomLabel = computed(() => `${Math.round(viewport.value.scale * 100)}%`)
const selectedNode = computed(() => nodes.value.find((node) => node.id === selectedId.value))
let gesture: Gesture | null = null

function resetCanvas() {
  nodes.value = definition.value.nodes.map((node) => ({ ...node }))
  selectedId.value = nodes.value[0]?.id ?? ''
  viewport.value = { x: 0, y: 0, scale: 1 }
  gesture = null
}
watch(() => [props.flow, locale.value] as const, resetCanvas, { immediate: true })

function text(value: Localized) {
  return value[locale.value]
}
function findNode(id: string) {
  return nodes.value.find((node) => node.id === id)
}
function edgeEnds(edge: FlowEdge) {
  const from = findNode(edge.from)
  const to = findNode(edge.to)
  if (!from || !to) return null
  const dx = to.x - from.x
  const dy = to.y - from.y
  const startScale = 1 / Math.max(Math.abs(dx) / (NODE_WIDTH / 2), Math.abs(dy) / (NODE_HEIGHT / 2))
  const endScale = 1 / Math.max(Math.abs(dx) / (NODE_WIDTH / 2), Math.abs(dy) / (NODE_HEIGHT / 2))
  return {
    x1: from.x + dx * startScale,
    y1: from.y + dy * startScale,
    x2: to.x - dx * endScale,
    y2: to.y - dy * endScale,
    dx,
    dy,
  }
}
function edgePath(edge: FlowEdge) {
  const ends = edgeEnds(edge)
  if (!ends) return ''
  if (edge.bend) {
    const length = Math.hypot(ends.dx, ends.dy) || 1
    const cx = (ends.x1 + ends.x2) / 2 - (ends.dy / length) * edge.bend
    const cy = (ends.y1 + ends.y2) / 2 + (ends.dx / length) * edge.bend
    return `M ${ends.x1} ${ends.y1} Q ${cx} ${cy} ${ends.x2} ${ends.y2}`
  }
  return `M ${ends.x1} ${ends.y1} L ${ends.x2} ${ends.y2}`
}
function edgeLabelPosition(edge: FlowEdge) {
  const ends = edgeEnds(edge)
  if (!ends) return { x: 0, y: 0 }
  let x = (ends.x1 + ends.x2) / 2
  let y = (ends.y1 + ends.y2) / 2
  if (edge.bend) {
    const length = Math.hypot(ends.dx, ends.dy) || 1
    const cx = (ends.x1 + ends.x2) / 2 - (ends.dy / length) * edge.bend
    const cy = (ends.y1 + ends.y2) / 2 + (ends.dx / length) * edge.bend
    x = (ends.x1 + 2 * cx + ends.x2) / 4
    y = (ends.y1 + 2 * cy + ends.y2) / 4
  }
  return { x: x + (edge.labelDx ?? 0), y: y + (edge.labelDy ?? -12) }
}
function localPoint(event: PointerEvent | WheelEvent) {
  const element = svg.value
  if (!element) return { x: 0, y: 0 }
  const point = element.createSVGPoint()
  point.x = event.clientX
  point.y = event.clientY
  const matrix = element.getScreenCTM()
  return matrix ? point.matrixTransform(matrix.inverse()) : { x: 0, y: 0 }
}
function startPan(event: PointerEvent) {
  if (event.button !== 0 || !svg.value) return
  const point = localPoint(event)
  gesture = {
    kind: 'pan', pointerX: point.x, pointerY: point.y,
    originX: viewport.value.x, originY: viewport.value.y,
  }
  svg.value.setPointerCapture(event.pointerId)
}
function startNodeDrag(event: PointerEvent, node: FlowNode) {
  if (event.button !== 0) return
  event.preventDefault()
  const point = localPoint(event)
  gesture = {
    kind: 'node', id: node.id, pointerX: point.x, pointerY: point.y,
    originX: node.x, originY: node.y,
  }
  selectedId.value = node.id
  ;(event.currentTarget as SVGElement).setPointerCapture(event.pointerId)
}
function moveGesture(event: PointerEvent) {
  if (!gesture) return
  const point = localPoint(event)
  if (gesture.kind === 'pan') {
    viewport.value.x = gesture.originX + point.x - gesture.pointerX
    viewport.value.y = gesture.originY + point.y - gesture.pointerY
    return
  }
  const node = findNode(gesture.id)
  if (!node) return
  node.x = Math.max(110, Math.min(990, gesture.originX + (point.x - gesture.pointerX) / viewport.value.scale))
  node.y = Math.max(60, Math.min(575, gesture.originY + (point.y - gesture.pointerY) / viewport.value.scale))
}
function endGesture() {
  gesture = null
}
function zoomAt(point: { x: number; y: number }, factor: number) {
  const oldScale = viewport.value.scale
  const newScale = Math.max(0.65, Math.min(1.65, oldScale * factor))
  const worldX = (point.x - viewport.value.x) / oldScale
  const worldY = (point.y - viewport.value.y) / oldScale
  viewport.value = {
    x: point.x - worldX * newScale,
    y: point.y - worldY * newScale,
    scale: newScale,
  }
}
function zoomBy(factor: number) {
  zoomAt({ x: 550, y: 310 }, factor)
}
function onWheel(event: WheelEvent) {
  event.preventDefault()
  zoomAt(localPoint(event), event.deltaY < 0 ? 1.1 : 1 / 1.1)
}
function chooseNode(node: FlowNode) {
  selectedId.value = node.id
}
</script>

<template>
  <section class="wf-shell" :aria-label="definition.title[locale]">
    <header class="wf-header">
      <div class="wf-heading">
        <span class="wf-eyebrow">{{ copy.interactive }}</span>
        <h3>{{ definition.title[locale] }}</h3>
        <p>{{ definition.summary[locale] }}</p>
      </div>
      <div class="wf-toolbar" role="group" :aria-label="copy.controls">
        <button type="button" :aria-label="copy.zoomOut" :title="copy.zoomOut" @click="zoomBy(1 / 1.15)">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.5"/><path d="m16 16 4.5 4.5M8 10.8h5.6"/></svg>
        </button>
        <span class="wf-zoom" :aria-label="`${copy.zoom}: ${zoomLabel}`">{{ zoomLabel }}</span>
        <button type="button" :aria-label="copy.zoomIn" :title="copy.zoomIn" @click="zoomBy(1.15)">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.5"/><path d="m16 16 4.5 4.5M8 10.8h5.6m-2.8-2.8v5.6"/></svg>
        </button>
        <button type="button" class="wf-reset" :aria-label="copy.reset" :title="copy.reset" @click="resetCanvas">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 11a8.5 8.5 0 1 1 2.3 6M3.5 4.5V11h6.3"/><path d="M12 7v5l3.2 1.8"/></svg>
          <span>{{ copy.reset }}</span>
        </button>
      </div>
    </header>

    <p class="wf-hint">{{ copy.hint }}</p>

    <div class="wf-viewport">
      <svg
        ref="svg"
        class="wf-svg"
        viewBox="0 0 1100 620"
        role="group"
        :aria-label="copy.canvas"
        @pointerdown="startPan"
        @pointermove="moveGesture"
        @pointerup="endGesture"
        @pointercancel="endGesture"
        @wheel="onWheel"
      >
        <defs>
          <marker id="workflow-arrowhead" markerWidth="9" markerHeight="9" refX="7.5" refY="4.5" orient="auto" markerUnits="strokeWidth">
            <path d="M0,0 L9,4.5 L0,9 Z" class="wf-arrowhead" />
          </marker>
        </defs>
        <g :transform="`translate(${viewport.x} ${viewport.y}) scale(${viewport.scale})`">
          <g class="wf-edges" aria-hidden="true">
            <g v-for="(edge, index) in definition.edges" :key="`${edge.from}-${edge.to}-${index}`">
              <path class="wf-edge" :d="edgePath(edge)" marker-end="url(#workflow-arrowhead)" />
              <text v-if="edge.label" class="wf-edge-label" text-anchor="middle" :x="edgeLabelPosition(edge).x" :y="edgeLabelPosition(edge).y">{{ text(edge.label) }}</text>
            </g>
          </g>
          <g
            v-for="node in nodes"
            :key="node.id"
            class="wf-node"
            :class="[`wf-node--${node.tone}`, { 'is-active': selectedId === node.id }]"
            role="button"
            tabindex="0"
            :aria-label="`${text(node.title)}. ${text(node.subtitle)}`"
            :aria-pressed="selectedId === node.id"
            @pointerdown.stop="startNodeDrag($event, node)"
            @click.stop="chooseNode(node)"
            @keydown.enter.prevent="chooseNode(node)"
            @keydown.space.prevent="chooseNode(node)"
          >
            <rect class="wf-node-card" :x="node.x - NODE_WIDTH / 2" :y="node.y - NODE_HEIGHT / 2" :width="NODE_WIDTH" :height="NODE_HEIGHT" rx="16" />
            <rect class="wf-node-accent" :x="node.x - NODE_WIDTH / 2" :y="node.y - NODE_HEIGHT / 2 + 10" width="5" :height="NODE_HEIGHT - 20" rx="2.5" />
            <text class="wf-node-title" text-anchor="middle" :x="node.x" :y="node.y - 5">{{ text(node.title) }}</text>
            <text class="wf-node-subtitle" text-anchor="middle" :x="node.x" :y="node.y + 20">{{ text(node.subtitle) }}</text>
          </g>
        </g>
      </svg>
    </div>

    <footer class="wf-footer" aria-live="polite">
      <div class="wf-selected-label">{{ copy.selected }}</div>
      <div v-if="selectedNode" class="wf-selected-copy">
        <strong>{{ text(selectedNode.title) }}</strong>
        <span>{{ text(selectedNode.detail) }}</span>
      </div>
      <span v-else class="wf-empty">{{ copy.empty }}</span>
    </footer>
  </section>
</template>

<style scoped>
.wf-shell {
  --wf-panel: #f8fafc;
  --wf-card: #ffffff;
  --wf-border: #dbe4ec;
  --wf-text: #172b3a;
  --wf-muted: #647687;
  --wf-line: #93a4b5;
  --wf-focus: #13786c;
  margin: 1.5rem 0 2rem;
  overflow: hidden;
  border: 1px solid var(--wf-border);
  border-radius: 20px;
  background: var(--wf-panel);
  color: var(--wf-text);
  box-shadow: 0 18px 48px rgba(16, 42, 57, .07);
}
.wf-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.1rem 1.25rem .5rem;
}
.wf-heading { min-width: 0; }
.wf-eyebrow {
  display: inline-block;
  margin-bottom: .35rem;
  color: #14786c;
  font-size: .7rem;
  font-weight: 750;
  letter-spacing: .12em;
  text-transform: uppercase;
}
.wf-heading h3 {
  margin: 0;
  color: var(--wf-text);
  font-size: 1.08rem;
  font-weight: 720;
  line-height: 1.35;
}
.wf-heading p {
  margin: .28rem 0 0;
  color: var(--wf-muted);
  font-size: .88rem;
  line-height: 1.5;
}
.wf-toolbar {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: .35rem;
}
.wf-toolbar button {
  display: inline-flex;
  min-width: 36px;
  height: 36px;
  align-items: center;
  justify-content: center;
  gap: .38rem;
  padding: 0 .55rem;
  border: 1px solid var(--wf-border);
  border-radius: 10px;
  background: var(--wf-card);
  color: var(--wf-text);
  cursor: pointer;
  transition: border-color .15s ease, background .15s ease, transform .15s ease;
}
.wf-toolbar button:hover { border-color: #80aaa5; background: #eff8f6; }
.wf-toolbar button:active { transform: translateY(1px); }
.wf-toolbar button:focus-visible { outline: 3px solid rgba(19,120,108,.28); outline-offset: 2px; }
.wf-toolbar svg {
  width: 17px;
  height: 17px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.7;
}
.wf-toolbar .wf-reset { font-size: .77rem; font-weight: 650; }
.wf-zoom { min-width: 2.8rem; color: var(--wf-muted); text-align: center; font-size: .76rem; font-variant-numeric: tabular-nums; }
.wf-hint { margin: .15rem 1.25rem .7rem; color: var(--wf-muted); font-size: .79rem; line-height: 1.5; }
.wf-viewport {
  margin: 0 .75rem;
  overflow: auto;
  border: 1px solid var(--wf-border);
  border-radius: 15px;
  background-color: var(--wf-card);
  background-image: radial-gradient(#c9d5df 1px, transparent 1px);
  background-position: 9px 9px;
  background-size: 19px 19px;
  scrollbar-color: #aab8c5 transparent;
}
.wf-svg {
  display: block;
  width: 100%;
  min-width: 900px;
  height: 520px;
  touch-action: none;
  user-select: none;
  cursor: grab;
}
.wf-svg:active { cursor: grabbing; }
.wf-arrowhead { fill: var(--wf-line); }
.wf-edge { fill: none; stroke: var(--wf-line); stroke-width: 2.25; vector-effect: non-scaling-stroke; }
.wf-edge-label {
  fill: var(--wf-muted);
  stroke: var(--wf-card);
  stroke-width: 6px;
  paint-order: stroke;
  font-size: 12px;
  font-weight: 650;
  letter-spacing: .01em;
}
.wf-node { cursor: grab; outline: none; }
.wf-node:active { cursor: grabbing; }
.wf-node-card {
  fill: var(--wf-card);
  stroke: var(--wf-border);
  stroke-width: 1.6;
  filter: drop-shadow(0 5px 8px rgba(20, 40, 55, .08));
  transition: stroke .15s ease, filter .15s ease;
  vector-effect: non-scaling-stroke;
}
.wf-node:hover .wf-node-card,
.wf-node:focus-visible .wf-node-card { stroke: #8aa9a7; }
.wf-node.is-active .wf-node-card { stroke: var(--wf-focus); stroke-width: 2.5; filter: drop-shadow(0 7px 12px rgba(19, 120, 108, .18)); }
.wf-node-accent { fill: currentColor; }
.wf-node--teal { color: #13786c; }
.wf-node--blue { color: #3975c5; }
.wf-node--violet { color: #7660bd; }
.wf-node--amber { color: #bb7a21; }
.wf-node--green { color: #25845d; }
.wf-node--slate { color: #607385; }
.wf-node--rose { color: #c04e62; }
.wf-node-title { fill: var(--wf-text); font-size: 15px; font-weight: 720; pointer-events: none; }
.wf-node-subtitle { fill: var(--wf-muted); font-size: 11.5px; font-weight: 550; pointer-events: none; }
.wf-footer {
  display: grid;
  grid-template-columns: minmax(100px, 150px) 1fr;
  gap: .35rem 1rem;
  padding: .9rem 1.25rem 1.05rem;
}
.wf-selected-label { color: #14786c; font-size: .7rem; font-weight: 750; letter-spacing: .09em; text-transform: uppercase; }
.wf-selected-copy { display: flex; flex-direction: column; gap: .15rem; font-size: .86rem; line-height: 1.5; }
.wf-selected-copy strong { color: var(--wf-text); font-weight: 700; }
.wf-selected-copy span, .wf-empty { color: var(--wf-muted); }
.wf-empty { font-size: .86rem; }
@media (max-width: 760px) {
  .wf-header { flex-direction: column; }
  .wf-toolbar { align-self: flex-end; }
  .wf-svg { min-width: 840px; height: 470px; }
  .wf-footer { grid-template-columns: 1fr; gap: .3rem; }
}
@media (prefers-reduced-motion: reduce) {
  .wf-toolbar button, .wf-node-card { transition: none; }
}
:global(.dark) .wf-shell {
  --wf-panel: #101a24;
  --wf-card: #14212d;
  --wf-border: #2c3d4d;
  --wf-text: #e7eef4;
  --wf-muted: #a2b2c0;
  --wf-line: #647789;
  --wf-focus: #55c2ae;
  box-shadow: 0 18px 48px rgba(0, 0, 0, .2);
}
:global(.dark) .wf-toolbar button:hover { background: #1b3436; border-color: #4b8b83; }
:global(.dark) .wf-viewport {
  background-image: radial-gradient(#3b4b59 1px, transparent 1px);
}
</style>
