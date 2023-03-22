import type MagicString from 'magic-string'
import type { SourceMapCompact } from 'unplugin'
import type { SourceMapInput } from 'rollup'
import type { SourceLocation } from '@vue/compiler-core'
import type { SFCParseResult } from 'vue/compiler-sfc'
import type { PinceauQuery } from './utils'

export interface PinceauTransformContext {
  magicString: MagicString
  code: string
  computedStyles: Record<string, any>
  localTokens: Record<string, any>
  variants: Record<string, any>
  query: PinceauQuery
  result: () => { code: string; map: SourceMapInput | SourceMapCompact | null }
  loc?: SourceLocation
  sfc?: SFCParseResult
}

export interface StringifyContext {
  property: string
  value: any
  style: any
  selectors: any
}
