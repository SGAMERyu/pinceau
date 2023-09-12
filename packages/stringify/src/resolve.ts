import { pathToVarName, referencesRegex } from '@pinceau/core/runtime'
import type { ColorSchemeModes, PinceauUtils, ThemeFunction } from '@pinceau/theme'
import type { StringifyContext } from './types'

const darkToken = '$dark'
const lightToken = '$light'
const initialToken = '$initial'

export interface CSSResolverContext {
  stringifyContext: StringifyContext
  localTokens?: string[]
  $theme?: ThemeFunction
  utils?: PinceauUtils
  colorSchemeMode?: ColorSchemeModes
}

/**
 * Resolve a CSS function argument to a stringifiable declaration.
 */
export function resolveCssProperty(ctx: CSSResolverContext) {
  const { stringifyContext } = ctx

  let { property, value } = stringifyContext

  // Resolve custom style directives
  const directive = resolveCustomDirectives(ctx)
  if (directive) { return directive }

  // Resolve custom properties
  const utilProperty = resolveUtilsProperties(ctx)
  if (utilProperty) { return utilProperty }

  // Resolve final value
  value = resolveValue(ctx)

  // Return proper declaration
  return {
    [property]: value,
  }
}

/**
 * Cast a value to a valid CSS unit.
 */
export function resolveValue(ctx: CSSResolverContext) {
  const { stringifyContext } = ctx

  const { value } = stringifyContext

  // Recurse through array values
  if (Array.isArray(value)) {
    return value.map(
      (v: string | number) => resolveValue({
        ...ctx,
        stringifyContext: { ...stringifyContext, value: v },
      }),
    )
  }

  // String / number values
  if (typeof value === 'string') { return resolveReferences(ctx) }
  if (typeof value === 'number') { return `${value}px` }

  return value
}

/**
 * Resolve token references
 */
export function resolveReferences(ctx: CSSResolverContext) {
  const { stringifyContext, $theme, localTokens } = ctx

  if (typeof stringifyContext.value !== 'string') { return stringifyContext.value }

  stringifyContext.value = stringifyContext.value.replace(
    referencesRegex,
    (_, tokenPath) => {
      const varName = pathToVarName(tokenPath)

      // Handle localTokens
      if (localTokens?.includes(varName)) { return `var(${varName})` }

      // Handle themeTokens or fallback
      const token = $theme?.(tokenPath)

      return (token?.variable ? token.variable : `var(${varName})`) as string
    },
  )

  return stringifyContext.value
}

/**
 * Resolve custom directives (@mq, @dark).
 */
export function resolveCustomDirectives(ctx: CSSResolverContext) {
  const { stringifyContext, $theme, colorSchemeMode } = ctx

  const { property, value } = stringifyContext

  const mode = colorSchemeMode || 'media'

  if (property.startsWith('$')) {
    const resolveColorScheme = (scheme: string) => {
      scheme = mode === 'class'
        ? `:root.${scheme}`
        : `@media (prefers-color-scheme: ${scheme})`

      return {
        [scheme.startsWith('@media') ? scheme : `${scheme} &`]: value,
      }
    }

    // @dark
    if (property === darkToken) { return resolveColorScheme('dark') }

    // @light
    if (property === lightToken) { return resolveColorScheme('light') }

    // @initial
    if (property === initialToken) { return { '@media': value } }

    // Support custom theme queries
    if ($theme) {
      // Handle all user supplied @directives
      const mediaQueries = $theme('media' as any)
      if (mediaQueries) {
        const query = property.replace('$', '')
        if (mediaQueries[query]) {
          return {
            [`@media ${mediaQueries[query].value}`]: value,
          }
        }
      }
    }

    return {
      [property]: value,
    }
  }
}

/**
 * Resolve utils properties coming from `utils` key of theme configuration.
 */
export function resolveUtilsProperties(ctx: CSSResolverContext) {
  const { utils, stringifyContext } = ctx

  const { property, value } = stringifyContext

  if (utils?.[property]) {
    // @ts-ignore - Custom property is a function, pass value and return result
    if (typeof utils[property] === 'function') { return utils[property](value) }

    // Custom property is an object, if value is true, return result
    return value ? utils[property] : {}
  }
}
