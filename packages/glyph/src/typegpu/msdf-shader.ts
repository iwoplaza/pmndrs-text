import { d, std } from 'typegpu';

export const MsdfRenderInput: d.WgslStruct<{
  atlasCoordinate: d.Vec2f;
  shadowCoordinate: d.Vec2f;
  uvBounds: d.Vec4f;
  atlasSize: d.Vec2f;
  pixelRange: d.F32;
  baseSample: d.Vec4f;
  shadowSample: d.Vec4f;
  fillColor: d.Vec4f;
  outlineColor: d.Vec4f;
  outlineWidth: d.F32;
  shadowColor: d.Vec4f;
}> = d.struct({
  atlasCoordinate: d.vec2f,
  shadowCoordinate: d.vec2f,
  uvBounds: d.vec4f,
  atlasSize: d.vec2f,
  pixelRange: d.f32,
  baseSample: d.vec4f,
  shadowSample: d.vec4f,
  fillColor: d.vec4f,
  outlineColor: d.vec4f,
  outlineWidth: d.f32,
  shadowColor: d.vec4f,
});

export type MsdfRenderInput = d.InferGPU<typeof MsdfRenderInput>;

/** Position one unit-quad vertex in the paragraph plane. */
export function msdfPosition(origin: d.v2f, size: d.v2f, unitPosition: d.v3f): d.v3f {
  'use gpu';
  return d.vec3f(origin.add(unitPosition.xy.mul(size)), 0);
}

/** Reconstruct and composite one filtered MTSDF fragment from renderer-supplied samples. */
export function msdfRender(input: MsdfRenderInput): d.v4f {
  'use gpu';

  const fillDistance = median3(input.baseSample.rgb) - 0.5;
  const trueDistance = input.baseSample.a - 0.5;
  const pixelsPerDistanceUnit = screenPixelRange(input.atlasCoordinate, input.atlasSize, input.pixelRange);
  const fillCoverage =
    distanceCoverage(fillDistance, pixelsPerDistanceUnit) * insideRectangle(input.atlasCoordinate, input.uvBounds);
  const outlineCoverage =
    distanceCoverage(trueDistance + input.outlineWidth, pixelsPerDistanceUnit) *
    insideRectangle(input.atlasCoordinate, input.uvBounds);
  const outlineOnly = std.max(outlineCoverage - fillCoverage, 0);
  const shadowCoverage =
    distanceCoverage(input.shadowSample.a - 0.5, pixelsPerDistanceUnit) *
    insideRectangle(input.shadowCoordinate, input.uvBounds);

  const fillAlpha = input.fillColor.a * fillCoverage;
  const outlineAlpha = input.outlineColor.a * outlineOnly;
  const shadowAlpha = input.shadowColor.a * shadowCoverage;

  // Fill and outlineOnly are disjoint geometric coverages. Summing them forms the
  // complete expanded glyph silhouette without attenuating the outline twice.
  const glyphAlpha = fillAlpha + outlineAlpha;
  const glyphPremultiplied = input.fillColor.rgb.mul(fillAlpha).add(input.outlineColor.rgb.mul(outlineAlpha));
  const shadowRemainder = shadowAlpha * (1 - glyphAlpha);
  const outputAlpha = glyphAlpha + shadowRemainder;
  const outputPremultiplied = glyphPremultiplied.add(input.shadowColor.rgb.mul(shadowRemainder));

  return d.vec4f(outputPremultiplied.div(std.max(outputAlpha, 1e-6)), outputAlpha);
}

function median3(value: d.v3f): number {
  'use gpu';

  return std.max(std.min(value.r, value.g), std.min(std.max(value.r, value.g), value.b));
}

function screenPixelRange(atlasCoordinate: d.v2f, atlasSize: d.v2f, pixelRange: number): number {
  'use gpu';

  const atlasUnitsPerPixel = std.max(std.fwidth(atlasCoordinate), d.vec2f(1e-6));
  const screenTexels = d.vec2f(1).div(atlasUnitsPerPixel);
  return std.max(0.5 * std.dot(d.vec2f(pixelRange).div(atlasSize), screenTexels), 1);
}

function distanceCoverage(distance: number, pixelsPerDistanceUnit: number): number {
  'use gpu';

  return std.clamp(distance * pixelsPerDistanceUnit + 0.5, 0, 1);
}

function insideRectangle(point: d.v2f, bounds: d.v4f): number {
  'use gpu';

  const inside = std.step(bounds.xy, point).mul(std.step(point, bounds.zw));
  return inside.x * inside.y;
}
