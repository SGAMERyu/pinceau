import { resolve } from 'path'
import { existsSync } from 'fs'
import { defu } from 'defu'
import jiti from 'jiti'
import type { ConfigLayer, LoadConfigResult, PinceauOptions, PinceauTheme, ResolvedConfigLayer } from '../types'

const extensions = ['.js', '.ts', '.mjs', '.cjs']

export async function loadConfig<U extends PinceauTheme>(
  {
    cwd = process.cwd(),
    configOrPaths = [cwd],
    configFileName = 'pinceau.config',
  }: PinceauOptions,
): Promise<LoadConfigResult<U>> {
  let _sources: string[] = []
  let inlineConfig = {} as U

  if (Array.isArray(configOrPaths)) { _sources = configOrPaths }

  if (typeof configOrPaths === 'string') { _sources = [configOrPaths] }

  // Inline config; overwrites any other configuration
  if (Object.prototype.toString.call(configOrPaths) === '[object Object]') {
    inlineConfig = configOrPaths as U
    return { config: inlineConfig, sources: [] }
  }

  let sources: ConfigLayer[] = [
    {
      cwd,
      configFileName,
    },
    ..._sources.reduce(
      (acc: ConfigLayer[], layerOrPath: string | ConfigLayer) => {
        if (typeof layerOrPath === 'object') {
          acc.push(layerOrPath as ConfigLayer)
          return acc
        }

        // process.cwd() already gets scanned by default
        if (resolve(cwd, layerOrPath) === resolve(cwd)) { return acc }

        acc.push({
          cwd: layerOrPath,
          configFileName,
        })

        return acc
      },
      [],
    ),
  ].reverse()

  // Dedupe sources
  sources = sources.reduce<ConfigLayer[]>(
    (acc, source) => {
      let searchable: string
      if (typeof source === 'string') {
        searchable = source
      }
      else {
        searchable = source?.cwd || ''
      }

      if (!acc.find((s: any) => s.cwd === searchable)) {
        acc.push({
          cwd: searchable,
          configFileName,
        })
      }

      return acc
    },
    [],
  )

  const resolveConfig = <U extends PinceauTheme>(layer: ConfigLayer): ResolvedConfigLayer<U> => {
    const empty = () => ({ path: undefined, config: {} as any })

    let path = ''

    // Resolve config path from layer
    if (typeof layer === 'string') {
      path = resolve(layer)
    }
    else if (typeof layer === 'object') {
      path = resolve(layer?.cwd || cwd, layer?.configFileName || configFileName)
    }
    else {
      return empty()
    }

    let filePath = ''
    extensions.some((ext) => {
      if (existsSync(path + ext)) {
        filePath = path + ext
        return true
      }
      return false
    })

    if (!filePath) { return empty() }

    if (filePath) {
      try {
        return loadConfigFile(filePath) as ResolvedConfigLayer<U>
      }
      catch (e) {
        return empty()
      }
    }

    return empty()
  }

  const result: LoadConfigResult<U> = {
    config: {} as any,
    sources: [] as string[],
  }

  for (const layer of sources) {
    const { path, config } = resolveConfig(layer)

    if (path) {
      result.sources.push(path)
    }

    if (config) {
      result.config = defu(config, result.config) as U
    }
  }

  return result
}

function loadConfigFile(path: string) {
  return {
    config: jiti(path, {
      interopDefault: true,
      requireCache: false,
      esmResolve: true,
    })(path),
    path,
  }
}
