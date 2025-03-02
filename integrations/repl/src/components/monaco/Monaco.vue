<script lang="ts" setup>
import {
  type Ref,
  computed,
  inject,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  watch,
} from 'vue'
import * as monaco from 'monaco-editor-core'
import { loadTheme } from 'monaco-volar'
import type { Store } from '../../store'
import type { PreviewMode } from '../editor/types'
import { loadGrammars } from './grammars'
import { getOrCreateModel } from './utils'
import { initMonaco } from './env'

const props = withDefaults(
  defineProps<{
    filename: string
    value?: string
    readonly?: boolean
    mode?: PreviewMode
  }>(),
  {
    readonly: false,
  },
)

const emit = defineEmits<{
  (e: 'change', value: string): void
}>()

const containerRef = ref<HTMLDivElement>()
const ready = ref(false)
const editor = shallowRef<monaco.editor.IStandaloneCodeEditor>()
const store = inject<Store>('store')!
const lang = computed(() => (props.mode === 'css' ? 'css' : 'javascript'))
const replTheme = inject<Ref<'dark' | 'light'>>('theme')!

initMonaco(store)

onMounted(async () => {
  const theme = await loadTheme(monaco.editor as any)
  ready.value = true

  await nextTick()

  if (!containerRef.value) { return }

  const editorInstance = monaco.editor.create(containerRef.value, {
    ...(props.readonly
      ? { value: props.value, language: lang.value }
      : { model: null }),
    'fontSize': 12,
    'fontFamily': '\'JetBrains Mono\', monospace',
    'theme': replTheme.value === 'light' ? theme.light : theme.dark,
    'readOnly': props.readonly,
    'automaticLayout': true,
    'scrollBeyondLastLine': false,
    'minimap': {
      enabled: false,
    },
    'inlineSuggest': {
      enabled: false,
    },
    'semanticHighlighting.enabled': true,
    'fixedOverflowWidgets': true,
  })

  editor.value = editorInstance

  // Support for semantic highlighting
  const t = (editorInstance as any)._themeService._theme
  t.getTokenStyleMetadata = (
    type: string,
    modifiers: string[],
    _language: string,
  ) => {
    const _readonly = modifiers.includes('readonly')
    switch (type) {
      case 'function':
      case 'method':
        return { foreground: 12 }
      case 'class':
        return { foreground: 11 }
      case 'variable':
      case 'property':
        return { foreground: _readonly ? 21 : 9 }
      default:
        return { foreground: 0 }
    }
  }

  watch(
    () => props.value,
    (value) => {
      if (editorInstance.getValue() === value) { return }
      editorInstance.setValue(value || '')
    },
    { immediate: true },
  )

  watch(lang, (lang) => {
    monaco.editor.setModelLanguage(editorInstance.getModel()!, lang)
  })

  if (!props.readonly) {
    watch(
      () => props.filename,
      (_, oldFilename) => {
        if (!editorInstance) { return }
        const file = store.state.files[props.filename]
        if (!file) { return null }

        const model = getOrCreateModel(
          monaco.Uri.parse(`file:///${props.filename}`),
          file.language,
          file.code,
        )

        const oldFile = oldFilename ? store.state.files[oldFilename] : null
        if (oldFile) { oldFile.editorViewState = editorInstance.saveViewState() }

        editorInstance.setModel(model)

        if (file.editorViewState) {
          editorInstance.restoreViewState(file.editorViewState)
          editorInstance.focus()
        }
      },
      { immediate: true },
    )
  }

  await loadGrammars(monaco, editorInstance)

  editorInstance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
    // Ignore save event
  })

  editorInstance.onDidChangeModelContent(() => {
    emit('change', editorInstance.getValue())
  })

  // Update theme
  watch(replTheme, (n) => {
    editorInstance.updateOptions({
      theme: n === 'light' ? theme.light : theme.dark,
    })
  })
})

onBeforeUnmount(() => {
  editor.value?.dispose()
})
</script>

<template>
  <div ref="containerRef" />
</template>

<style lang="ts">
css({
  '@import': 'url(\'https://fonts.cdnfonts.com/css/jetbrains-mono\');',
})
</style>

<style scoped lang="ts">
styled({
  position: 'relative',
  height: '100%',
  width: '100%',
  overflow: 'hidden',
})
</style>
