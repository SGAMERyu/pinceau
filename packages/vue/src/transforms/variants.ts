import type { ASTNode } from 'ast-types'
import type { PinceauSFCTransformContext } from '@pinceau/core'
import { astTypes, expressionToAst, parseAst, printAst, visitAst } from '@pinceau/core'

export interface PropOptions {
  type?: any
  required?: boolean
  default?: any
  validator?: (value: unknown) => boolean
}

/**
 * Takes variants object and turns it into a `const` inside `<script setup>`
 */
export function transformVariants(transformContext: PinceauSFCTransformContext, isTs?: boolean) {
  if (!transformContext?.sfc || !transformContext?.sfc?.scriptSetup) { return }

  const scriptSetupBlock = transformContext.sfc.scriptSetup

  isTs = typeof isTs === 'undefined'
    ? (
        transformContext.sfc.scriptSetup.lang === 'ts'
        || transformContext.sfc.scriptSetup.attrs.lang === 'ts'
      )
    : isTs

  const variantsProps = resolveVariantsProps(transformContext, isTs)

  const sanitizedVariants = Object.entries(transformContext.variants || {}).reduce(
    (acc, [key, variant]: any) => {
      delete variant.options
      acc[key] = variant
      return acc
    },
    {},
  )

  transformContext.magicString.prependLeft(
    scriptSetupBlock.loc.end.offset,
    `\nconst __$pVariants = ${JSON.stringify(sanitizedVariants)}\n`,
  )

  if (variantsProps) { pushVariantsProps(transformContext, variantsProps, isTs) }

  return transformContext
}

/**
 * Push variants object to components props.
 *
 * Only work with `defineProps()`.
 */
export function pushVariantsProps(transformContext: PinceauSFCTransformContext, variantsProps: any, isTs: boolean) {
  let scriptAst = parseAst(transformContext.code)

  let propsAst = expressionToAst(JSON.stringify(variantsProps))

  propsAst = castVariantsPropsAst(propsAst, isTs)

  // Push to defineProps
  propsAst = visitAst(
    scriptAst,
    {
      visitCallExpression(path) {
        if (path?.value?.callee?.name === 'defineProps') {
          path.value.arguments[0].properties.push(
            astTypes.builders.spreadElement(propsAst),
          )
        }
        return this.traverse(path)
      },
    },
  )

  scriptAst = parseAst(printAst(scriptAst).code)

  visitAst(
    scriptAst,
    {
      visitSpreadElement(path) {
        console.log({ path })
      },
    },
  )
}

/**
 * Resolve a Vue component props object from css() variant.
 */
export function resolveVariantsProps(transformContext: PinceauSFCTransformContext, isTs: boolean) {
  const props: Record<string, PropOptions> = {}

  Object.entries(transformContext.variants).forEach(
    ([key, variant]: [string, any]) => {
      const prop: any = {
        required: false,
      }

      const isBooleanVariant = Object.keys(variant).some(key => (key === 'true' || key === 'false'))
      if (isBooleanVariant) {
        prop.type = isTs ? ' [Boolean, Object] as import(\'vue\').PropType<boolean | { [key in import(\'pinceau\').PinceauMediaQueries]?: boolean }>' : ' [Boolean, Object]'
        prop.default = false
      }
      else {
        const possibleValues = `\'${Object.keys(variant).filter(key => key !== 'options').join('\' | \'')}\'`
        prop.type = isTs ? ` [String, Object] as import(\'vue\').PropType<${possibleValues} | { [key in import(\'pinceau\').PinceauMediaQueries]?: ${possibleValues} }>` : ' [String, Object]'
        prop.default = undefined
      }

      // Merge options from user definition
      if (variant?.options) {
        const options = variant.options
        if (options.default) { prop.default = options.default }
        if (options.required) { prop.required = options.required }
        if (options.type) { prop.type = options.type }
        if (options.validator) { prop.validator = options.validator?.toString() }
      }

      props[key] = prop
    },
  )

  return props
}

/**
 * Cast a variants props AST output to a type-safe props object.
 */
export function castVariantsPropsAst(ast: ASTNode, isTs?: boolean) {
  // Cast stringified values
  visitAst(
    ast,
    {
      visitObjectProperty(path) {
        const key = path.value?.key?.value
        // Cast `type` string
        if (key === 'type') { path.value.value = expressionToAst(path.value.value.value) }
        // Cast `validator` string
        if (key === 'validator') { path.value.value = expressionToAst(path.value.value.value) }
        // Cast required & default to `{value} as const`
        if ((key === 'required' || key === 'default') && isTs) {
          const printedAst = printAst(path.value.value).code
          path.value.value = expressionToAst(`${printedAst} as const`)
        }
        return this.traverse(path)
      },
    },
  )
  return ast
}
