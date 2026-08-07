import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Embeds TypeGPU's shader metadata into emitted JavaScript that contains GPU functions.
 *
 * JavaScript-authored TypeGPU functions carry a `'use gpu'` directive that the TypeGPU
 * compiler normally consumes through a consumer-side bundler plugin
 * (`unplugin-typegpu`). A published subpath cannot demand that every consumer runs a
 * transform over this package's `dist`, so the build applies the same transform here,
 * once, over the staged TypeGPU library and the TSL modules that bridge TypeGPU
 * functions into Three.js. The emitted
 * functions then resolve to WGSL in any host without extra tooling.
 *
 * The transform is additive: it wraps each shader function with its parsed syntax tree
 * and external-name table and never rewrites surrounding code.
 *
 * @param {string} stagingDirectory The staged distribution whose `typegpu` outputs are rewritten in place.
 */
export async function embedTypeGpuMetadata(stagingDirectory) {
  const { default: typegpuPlugin } = await import('unplugin-typegpu/rollup');
  const plugin = typegpuPlugin();
  const typegpuDirectory = join(stagingDirectory, 'typegpu');
  const slugShaderDirectory = join(stagingDirectory, 'tsl', 'slug-shaders');
  const slugCoreDirectory = join(slugShaderDirectory, 'core');
  const entries = [
    'typegpu.js',
    join('tsl', 'slug-shader.js'),
    ...(await readdir(typegpuDirectory)).filter((name) => name.endsWith('.js')).map((name) => join('typegpu', name)),
    ...(await readdir(slugShaderDirectory))
      .filter((name) => name.endsWith('.js'))
      .map((name) => join('tsl', 'slug-shaders', name)),
    ...(await readdir(slugCoreDirectory))
      .filter((name) => name.endsWith('.js'))
      .map((name) => join('tsl', 'slug-shaders', 'core', name)),
  ];
  const { default: typegpuPlugin } = await import('unplugin-typegpu/rollup');
  const plugin = typegpuPlugin();
  for (const entry of entries) {
    const file = join(stagingDirectory, entry);
    const source = await readFile(file, 'utf8');
    if (!source.includes('use gpu')) continue;
    const transformed = await plugin.transform.handler.call({}, source, file);
    if (transformed && typeof transformed.code === 'string' && transformed.code !== source) {
      await writeFile(file, transformed.code);
    }
    const output = transformed?.code ?? source;
    if (output.includes('use gpu') && !output.includes('__TYPEGPU_META__')) {
      throw new Error(`${file} contains TypeGPU directives without compiler metadata`);
    }
  }
}
