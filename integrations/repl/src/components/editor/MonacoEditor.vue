<script setup lang="ts">
import Monaco from '../monaco/Monaco.vue'
import type { EditorEmits, EditorProps } from './types'

defineOptions({
  editorType: 'monaco',
})
defineProps<EditorProps>()
const emit = defineEmits<EditorEmits>()

function onChange(code: string) {
  emit('change', code)
}
</script>

<template>
  <Monaco
    :filename="filename"
    :value="value || ''"
    :readonly="readonly"
    :mode="mode"
    @change="onChange"
  />
</template>
