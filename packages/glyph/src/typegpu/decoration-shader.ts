import tgpu, { d, std, type TgpuFn } from 'typegpu';

export const TypeGpuDecorationInput: d.WgslStruct<{ rect: d.Vec4f; packed: d.Vec2u; unitPosition: d.Vec3f }> = d.struct(
  { rect: d.vec4f, packed: d.vec2u, unitPosition: d.vec3f },
);
export type TypeGpuDecorationInput = d.InferGPU<typeof TypeGpuDecorationInput>;

export const TypeGpuDecorationOutput: d.WgslStruct<{ position: d.Vec3f; color: d.Vec3f; opacity: d.F32 }> = d.struct({
  position: d.vec3f,
  color: d.vec3f,
  opacity: d.f32,
});
export type TypeGpuDecorationOutput = d.InferGPU<typeof TypeGpuDecorationOutput>;

export function decorationPosition(rect: d.v4f, unitPosition: d.v3f): d.v3f {
  'use gpu';
  return d.vec3f(rect.x + unitPosition.x * rect.z, -(rect.y + unitPosition.y * rect.w), 0);
}

/** Linear RGB and alpha packed as a vec4 for node-system adapters. */
export function decorationPaint(packed: d.v2u): d.v4f {
  'use gpu';
  const byte = 1 / 255;
  const encoded = d.vec3f(
    d.f32(packed.x & d.u32(0xff)) * byte,
    d.f32((packed.x >> d.u32(8)) & d.u32(0xff)) * byte,
    d.f32((packed.x >> d.u32(16)) & d.u32(0xff)) * byte,
  );
  return d.vec4f(
    srgbChannelToLinear(encoded.x),
    srgbChannelToLinear(encoded.y),
    srgbChannelToLinear(encoded.z),
    d.f32((packed.x >> d.u32(24)) & d.u32(0xff)) * byte,
  );
}

/** Decode the packed decoration record and place its unit quad in paragraph space. */
export const decorationShader: TgpuFn<(input: typeof TypeGpuDecorationInput) => typeof TypeGpuDecorationOutput> =
  tgpu.fn(
    [TypeGpuDecorationInput],
    TypeGpuDecorationOutput,
  )((input) => {
    'use gpu';
    const paint = decorationPaint(input.packed);
    return TypeGpuDecorationOutput({
      position: decorationPosition(input.rect, input.unitPosition),
      color: paint.rgb,
      opacity: paint.a,
    });
  });

function srgbChannelToLinear(encoded: number): number {
  'use gpu';
  if (encoded <= 0.04045) return encoded / 12.92;
  return std.pow((encoded + 0.055) / 1.055, 2.4);
}
