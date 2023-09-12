import type { ASTNode } from 'ast-types'
import type { PinceauTransformContext, PinceauTransformFunction } from '@pinceau/core'
import { astTypes, expressionToAst, printAst } from '@pinceau/core/utils'

const PINCEAU_CLASS_NAME = '$pcClass'

/**
 * Adds `$pinceau` to the root element class via transform
 *
 * - Grab all the `<template>` child nodes
 * - Search for root <tags> in the <template> content
 * * Then, for each thags:
 * - Find the `:class` attribute if it exists
 * - Parse `:class` content with recast and inject `$pinceau`
 * - If no `:class` found, just push it at the end of the first tag
 * - If `$pinceau` is already present somewhere in the template, just skip this transform
 */
export const transformAddPinceauClass: PinceauTransformFunction = (
  transformContext: PinceauTransformContext,
) => {
  const { target } = transformContext

  const content = target.toString()

  // $pinceau class already here
  if (content.includes(PINCEAU_CLASS_NAME)) { return }

  // Grab first node location offset, the `ast` key from Vue parser includes the `<template>` tag in location
  // As this transform willy be applied on top of `target`, that offset needs to be dropped from source location.
  const startOffset = target?.ast?.children?.[0]?.loc.start.offset

  // Loop through all child nodes of the <template> tag, transforming the first thing that looks like a tag
  target.ast.children.forEach((node) => {
    const { start, source } = node.loc

    const tagMatch = source.match(/<([a-zA-Z]+)([^>]+)*>/)

    if (tagMatch?.[0]) {
      let result = ''

      const source = String(tagMatch[0])

      if (source.includes(':class')) {
      // Check for existing class, inject into it via AST if needed
        const existingAttr: ASTNode = source.match(/:class="([^"]+)"/) as any
        if (existingAttr) {
          let attrAst = expressionToAst(existingAttr[1])
          const newAttrAst = astTypes.builders.identifier(PINCEAU_CLASS_NAME)
          switch (attrAst.type) {
            case 'ArrayExpression':
              attrAst.elements.unshift(newAttrAst)
              break
            case 'StringLiteral':
            case 'Literal':
            case 'ObjectExpression':
              attrAst = astTypes.builders.arrayExpression([
                newAttrAst,
                attrAst,
              ])
              break
          }

          result = source.replace(existingAttr[1], printAst(attrAst).code)
        }
      }
      else if (source.includes('/>')) {
      // Self closing tag
        result = source.replace('/>', ` :class="[${PINCEAU_CLASS_NAME}]" />`)
      }
      else {
      // Regular tag
        result = source.replace('>', ` :class="[${PINCEAU_CLASS_NAME}]">`)
      }

      target.overwrite(
        // (AST First tag offset + tag offset) - <template> tag offset location
        (start.offset + tagMatch.index) - startOffset,
        // (AST First tag offset + tag offset + source tag length) - <template> tag offset location
        (start.offset + tagMatch.index + tagMatch[0].length) - startOffset,
        // Transformed first tag
        result,
      )
    }
  })
}
