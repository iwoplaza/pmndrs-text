import tgpu from 'typegpu';
import * as d from 'typegpu/data';

import {
  bitmapFragment,
  bitmapCoverageSlot,
  bitmapVertex,
  bitmapVertexSnapped,
  msdfAtlasSizeAccessor,
  msdfFragment,
  msdfPixelRangeAccessor,
  msdfSampleSlot,
  type TypeGpuBitmapFragmentInput,
  type TypeGpuBitmapFragmentOutput,
  type TypeGpuBitmapInstance,
  type TypeGpuBitmapVertexInput,
  type TypeGpuBitmapVertexOutput,
} from '@pmndrs/glyph/typegpu';

// The `/typegpu` subpath is one shader library, importable without any renderer so
// WebGPU hosts reuse the canonical technique realizations instead of reimplementing
// coverage math.
declare const vertexInput: TypeGpuBitmapVertexInput;
const vertexOut: TypeGpuBitmapVertexOutput = bitmapVertex(vertexInput);
const snappedOut: TypeGpuBitmapVertexOutput = bitmapVertexSnapped(vertexInput);
void vertexOut.position;
void snappedOut.clipPosition;

declare const fragmentInput: TypeGpuBitmapFragmentInput;
const fragmentOut: TypeGpuBitmapFragmentOutput = bitmapFragment(fragmentInput);
void fragmentOut.coverage;
void fragmentOut.opacity;

// The stages are exact typed functions: their schemas are inspectable GPU data and the
// functions resolve to WGSL through TypeGPU, so a host can bind and compose them.
const instanceSchema: d.WgslStruct = null as unknown as typeof TypeGpuBitmapInstance;
void instanceSchema;

const vertexStage: typeof bitmapVertex = bitmapVertex;
void vertexStage;

// Resource ownership is supplied by the consumer: functions go through slots, while
// literal/uniform/buffer/function values go through schema-aware accessors.
const bitmapCoverage = tgpu.fn([d.vec2f, d.u32], d.f32)`(coordinate, layer) { return coordinate.x + f32(layer); }`;
bitmapFragment.with(bitmapCoverageSlot, bitmapCoverage);

const msdfSample = tgpu.fn([d.vec2f, d.u32], d.vec4f)`(coordinate, layer) {
  return vec4f(coordinate, f32(layer), 1.0);
}`;
msdfFragment
  .with(msdfSampleSlot, msdfSample)
  .with(msdfAtlasSizeAccessor, d.vec2f(1024, 1024))
  .with(msdfPixelRangeAccessor, d.f32(4));
