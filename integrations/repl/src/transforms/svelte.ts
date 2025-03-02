import { MagicSFC } from 'sfc-composer/svelte'
import type { File, Store } from '..'
import { transformTS } from './typescript'

export async function compileSvelteFile(
  store: Store,
  { filename, code, compiled }: File,
) {
  const sfc = new MagicSFC(code, { parser: store.transformer.compiler.preprocess })

  await sfc.parse()

  if (sfc.scripts?.[0]) {
    const script = sfc.scripts[0]

    const content = script.loc.source

    script.overwrite(0, content.length, await transformTS(content))
  }

  /**
   * Very ugly fix to make svelte/compiler happy
   */
  // @ts-ignore
  // eslint-disable-next-line node/prefer-global/process
  const _cwd = process?.cwd
  // @ts-ignore
  // eslint-disable-next-line node/prefer-global/process
  process.cwd = () => 'src/'

  const result = store.transformer.compiler.compile(sfc.toString(), {
    filename,
    discloseVersion: false,
    dev: true,
  })

  const resultSsr = store.transformer.compiler.compile(sfc.toString(), {
    filename,
    generate: 'ssr',
    discloseVersion: false,
    hydratable: true,
  })

  // @ts-ignore
  // eslint-disable-next-line node/prefer-global/process
  process.cwd = _cwd

  if (result.js.code) { compiled.js = result.js.code }

  if (resultSsr.js.code) { compiled.ssr = resultSsr.js.code }

  if (result.css) { compiled.css = result.css.code }

  return []
}
