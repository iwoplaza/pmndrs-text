import * as t3 from '@typegpu/three';
import tgpu, { d } from 'typegpu';
import * as TSL from 'three/tsl';
import type { Node, Texture } from 'three/webgpu';

import {
  bitmapAtlasUv,
  bitmapCoverageSlot,
  bitmapCoverageOpacity,
  bitmapPageCoverage,
  bitmapQuadPosition,
  snapClipAxis,
  TypeGpuBitmapFragmentInput,
} from '../typegpu/bitmap-shader.js';

const modelViewProjection = TSL.modelViewProjection as Node<'vec4'>;

export interface TslBitmapInstanceNodes {
  readonly origin: Node<'vec2'>;
  readonly size: Node<'vec2'>;
  readonly uvOrigin: Node<'vec2'>;
  readonly uvSize: Node<'vec2'>;
  readonly color: Node<'vec4'>;
  readonly pageIndex: Node<'uint'>;
}

export interface TslBitmapShaderResources {
  readonly page: Texture;
}

export interface TslBitmapShaderOptions {
  readonly pixelSnapping?: boolean;
}

export interface TslBitmapShaderOutput {
  readonly position: Node<'vec3'>;
  readonly clipPosition: Node<'vec4'>;
  readonly atlasUv: Node<'vec2'>;
  readonly coverage: Node<'float'>;
  readonly color: Node<'vec3'>;
  readonly opacity: Node<'float'>;
}

/** Adapt the canonical TypeGPU Bitmap functions to Three's node graph. */
export function bitmapShader(
  instance: TslBitmapInstanceNodes,
  resources: TslBitmapShaderResources,
  options: TslBitmapShaderOptions = {},
): TslBitmapShaderOutput {
  const position = t3.toTSL(() => {
    'use gpu';
    return bitmapQuadPosition(
      t3.fromTSL(instance.origin, d.vec2f).$,
      t3.fromTSL(instance.size, d.vec2f).$,
      t3.positionLocal.$.xy,
    );
  }) as Node<'vec3'>;
  const atlasUv = t3.toTSL(() => {
    'use gpu';
    return bitmapAtlasUv(t3.fromTSL(instance.uvOrigin, d.vec2f).$, t3.fromTSL(instance.uvSize, d.vec2f).$, t3.uv().$);
  }) as Node<'vec2'>;
  const page = t3.fromTSL(resources.page, d.texture2dArray(d.f32));
  const sampleCoverage = (coordinate: d.v2f, layer: number): number => {
    'use gpu';
    return bitmapPageCoverageForThree(page.$, coordinate, layer);
  };
  const fragment = tgpu.fn(bitmapCoverageOpacity).with(bitmapCoverageSlot, sampleCoverage);
  const coverageOpacity = t3.toTSL(() => {
    'use gpu';
    return fragment(
      TypeGpuBitmapFragmentInput({
        atlasUv: t3.fromTSL(atlasUv, d.vec2f).$,
        color: t3.fromTSL(instance.color, d.vec4f).$,
        pageLayer: t3.fromTSL(instance.pageIndex, d.u32).$,
      }),
    );
  }) as Node<'vec2'>;

  return {
    position,
    clipPosition: options.pixelSnapping === true ? pixelSnappedClipPosition() : modelViewProjection,
    atlasUv,
    coverage: coverageOpacity.x,
    color: instance.color.rgb,
    opacity: coverageOpacity.y,
  };
}

function bitmapPageCoverageForThree(page: d.texture2dArray<d.F32>, atlasUv: d.v2f, pageLayer: number): number {
  'use gpu';
  // Keep the algorithm in the public TypeGPU helper; this wrapper only supplies Three's texture resource.
  return bitmapPageCoverage(page, atlasUv, pageLayer);
}

function pixelSnappedClipPosition(): Node<'vec4'> {
  const snapped = t3.toTSL(() => {
    'use gpu';
    const clip = t3.modelViewProjection.$;
    return d.vec4f(
      snapClipAxis(clip.x, clip.w, t3.screenSize.$.x),
      snapClipAxis(clip.y, clip.w, t3.screenSize.$.y),
      clip.z,
      clip.w,
    );
  });
  return snapped as Node<'vec4'>;
}
