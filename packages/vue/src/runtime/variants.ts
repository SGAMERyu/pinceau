import type { ComponentPublicInstance } from 'vue'
import { computed, getCurrentInstance, onScopeDispose, ref, unref, watch } from 'vue'
import type { Variants, VariantsProps } from '@pinceau/style'
import { variantsToDeclaration } from '@pinceau/runtime'
import { useRuntimeSheet } from './exports'

export function useVariants(
  variants: Variants,
  props?: ComponentPublicInstance['$props'],
) {
  const runtimeSheet = useRuntimeSheet()

  /**
   * Current variants className
   */
  const className = ref<string | undefined>('')

  /**
   * Variants classes support; via $class key or string variants.
   */
  const variantsClasses = ref<string[]>([])

  /**
   * Cast `component.props` to only the props generated by variants.
   */
  const variantsProps = computed<VariantsProps>(() => {
    const keys = Object.keys(variants)

    return Object.entries(unref(props) || getCurrentInstance()?.props || {}).reduce(
      (acc, [propName, value]) => {
        if (keys.includes(propName)) { acc[propName] = value }
        return acc
      },
      {},
    )
  })

  watch(
    variantsProps,
    (newProps) => {
      if (!runtimeSheet) { return }

      const { classes, declaration } = variantsToDeclaration(variants, newProps)
      if (classes !== variantsClasses.value) { variantsClasses.value = classes }

      className.value = runtimeSheet.getRule(declaration, className.value)
    },
    {
      immediate: true,
    },
  )

  onScopeDispose(() => className?.value && runtimeSheet.deleteMember(className.value))

  return computed(() => [className.value, ...variantsClasses.value].join(' '))
}
