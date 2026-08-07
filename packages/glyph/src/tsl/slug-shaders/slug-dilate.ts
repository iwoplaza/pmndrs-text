/** Three.js/TSL boundary over the host-agnostic vertex dilation in `core/dilate.js`. */
import type { Node } from 'three/webgpu';
import { add, div, mul, normalize, sqrt, sub, vec2, vec4 } from 'three/tsl';
import { d } from 'typegpu';
import * as t3 from '@typegpu/three';
import { slugDilate as dilate } from './core/dilate.js';

export interface SlugDilationNodes {
  readonly position: Node<'vec2'>;
  readonly textureCoordinate: Node<'vec2'>;
}

/** Expand one glyph-quad vertex by a half-pixel antialiasing footprint. */
export function slugDilate(
  position: Node<'vec2'>,
  outwardNormal: Node<'vec2'>,
  textureCoordinate: Node<'vec2'>,
  inverseScale: Node<'float'>,
  mvpRow0: Node<'vec4'>,
  mvpRow1: Node<'vec4'>,
  mvpRow3: Node<'vec4'>,
  viewport: Node<'vec2'>,
): SlugDilationNodes {
  const dilated = t3.toTSL(() => {
    'use gpu';
    return dilate(
      t3.fromTSL(position, d.vec2f).$,
      t3.fromTSL(outwardNormal, d.vec2f).$,
      t3.fromTSL(textureCoordinate, d.vec2f).$,
      t3.fromTSL(inverseScale, d.f32).$,
      t3.fromTSL(mvpRow0, d.vec4f).$,
      t3.fromTSL(mvpRow1, d.vec4f).$,
      t3.fromTSL(mvpRow3, d.vec4f).$,
      t3.fromTSL(viewport, d.vec2f).$,
    );
  }) as Node<'vec4'>;

  return { position: dilated.xy, textureCoordinate: dilated.zw };
}

/** Expand a glyph quad using the exact per-instance model-view-projection matrix selected by a batched draw. */
export function slugDilateMatrix(
  position: Node<'vec2'>,
  outwardNormal: Node<'vec2'>,
  textureCoordinate: Node<'vec2'>,
  inverseScale: Node<'float'>,
  modelViewProjection: Node<'mat4'>,
  viewport: Node<'vec2'>,
): SlugDilationNodes {
  const normal = normalize(outwardNormal).toVar('slugDilateNormal');
  const clipPosition = modelViewProjection.mul(vec4(position, 0, 1)).toVar('slugDilateClipPosition');
  const clipNormal = modelViewProjection.mul(vec4(normal, 0, 0)).toVar('slugDilateClipNormal');
  return dilateFromProjection(
    position,
    normal,
    textureCoordinate,
    inverseScale,
    clipPosition.w,
    clipNormal.w,
    sub(mul(clipPosition.w, clipNormal.x), mul(clipNormal.w, clipPosition.x)),
    sub(mul(clipPosition.w, clipNormal.y), mul(clipNormal.w, clipPosition.y)),
    viewport,
  );
}

function dilateFromProjection(
  position: Node<'vec2'>,
  normal: Node<'vec2'>,
  textureCoordinate: Node<'vec2'>,
  inverseScale: Node<'float'>,
  homogeneousW: Node<'float'>,
  wGradient: Node<'float'>,
  projectedXValue: Node<'float'>,
  projectedYValue: Node<'float'>,
  viewport: Node<'vec2'>,
): SlugDilationNodes {
  const projectedX = mul(projectedXValue, viewport.x).toVar('slugDilateProjectedX');
  const projectedY = mul(projectedYValue, viewport.y).toVar('slugDilateProjectedY');
  const squaredW = mul(homogeneousW, homogeneousW).toVar('slugDilateSquaredW');
  const wTimesGradient = mul(homogeneousW, wGradient).toVar('slugDilateWTimesGradient');
  const projectedLengthSquared = add(mul(projectedX, projectedX), mul(projectedY, projectedY)).toVar(
    'slugDilateProjectedLengthSquared',
  );
  const denominator = sub(projectedLengthSquared, mul(squaredW, wGradient, wGradient));
  const distance = div(mul(squaredW, add(wTimesGradient, sqrt(projectedLengthSquared))), denominator);
  const dx = mul(normal.x, distance);
  const dy = mul(normal.y, distance);

  return {
    position: vec2(add(position.x, dx), add(position.y, dy)),
    textureCoordinate: vec2(
      add(textureCoordinate.x, mul(dx, inverseScale)),
      add(textureCoordinate.y, mul(dy, inverseScale)),
    ),
  };
}
