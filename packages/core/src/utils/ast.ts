import * as recast from 'recast'
import type { Options as RecastOptions } from 'recast'
import { parse as tsParse } from 'recast/parsers/typescript.js'
import { parse as htmlParse, walkSync as walkHtml } from 'ultrahtml'
import type { File } from '@babel/types'
import type { ASTNode, namedTypes } from 'ast-types'
import type { NodePath } from 'ast-types/lib/node-path'
import type { PathMatch } from '../types/ast'

/**
 * Parse AST with TypeScript parser.
 */
export function parseAst(source: string, options?: Partial<RecastOptions>): File {
  return recast.parse(source, { ...options, parser: { parse: tsParse, ...(options?.parser || {}) } })
}

/**
 * Parse HTML/<template> to AST using ultrahtml.
 */
export function parseTemplate(source: string) {
  return htmlParse(source)
}

/**
 * Cast any JS string into an AST declaration.
 */
export function expressionToAst(type: string, leftSide = 'const toAst = ') {
  const parsed = recast.parse(`${leftSide}${type}`, { parser: { parse: tsParse } })
  return parsed.program.body[0].declarations[0].init
}

/**
 * Gets the default export from an AST node.
 */
export function findDefaultExport(node: File): NodePath<namedTypes.ExportDefaultDeclaration> & ASTNode {
  return (node.program.body.find(n => n.type === 'ExportDefaultDeclaration') as any)?.declaration
}

/**
 * Find all calls of css() and call a callback on each.
 */
export function findCallees(ast: ASTNode, functionName: string | RegExp) {
  const isRegexMatch = !(typeof functionName === 'string')
  const paths: PathMatch[] = []

  recast.visit(
    ast,
    {
      visitCallExpression(path: PathMatch) {
        const isMatch = isRegexMatch
          ? path?.value?.callee?.name?.match(functionName)
          : path?.value?.callee?.name === functionName

        if (isMatch) {
          path.match = isRegexMatch ? isMatch : functionName
          paths.push(path as PathMatch)
        }

        return this.traverse(path)
      },
    },
  )

  return paths
}

/**
 * Re-exports from recast.
 *
 * Might be useful in case Pinceau changes of AST parser.
 */

/* c8 ignore start */
export const walkTemplate = walkHtml
export const visitAst = recast.visit
export const printAst = recast.print
export const astTypes = recast.types
