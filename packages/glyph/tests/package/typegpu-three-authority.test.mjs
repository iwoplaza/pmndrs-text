import assert from 'node:assert/strict';
import test from 'node:test';

import * as TSL from 'three/tsl';
import * as THREE from 'three/webgpu';

import { decorationShader, msdfShader } from '../../dist/tsl.js';
import { compileNodeMaterialBackends } from '../support/node-material-shaders.mjs';

test('the MTSDF Three adapter compiles the canonical TypeGPU functions on both backends', () => {
  const atlas = new THREE.DataArrayTexture(new Uint8Array(4 * 4 * 4), 4, 4, 1);
  atlas.format = THREE.RGBAFormat;
  const output = msdfShader(
    {
      origin: TSL.vec2(0),
      size: TSL.vec2(1),
      uvOrigin: TSL.vec2(0),
      uvSize: TSL.vec2(1),
      uvBounds: TSL.vec4(0, 0, 1, 1),
      fillColor: TSL.vec4(1),
      effectColor: TSL.uvec2(0xffffffff, 0),
      shadowOffset: TSL.vec2(0),
      outlineWidth: TSL.float(0),
      pageIndex: TSL.float(0),
    },
    { atlas, atlasWidth: 4, atlasHeight: 4, pixelRange: 4 },
  );
  withMaterial(output, (mesh) => {
    for (const [backend, source] of Object.entries(compileNodeMaterialBackends(mesh))) {
      for (const name of [
        'msdfPosition',
        'msdfAtlasCoordinate',
        'msdfClampedCoordinates',
        'msdfCoverage',
        'msdfComposite',
      ]) {
        assert.equal(declarationCount(`${source.vertex}\n${source.fragment}`, name, backend), 1);
      }
    }
  });
  atlas.dispose();
});

test('the decoration Three adapter compiles the canonical TypeGPU functions on both backends', () => {
  const output = decorationShader({ rect: TSL.vec4(0, 0, 1, 1), packed: TSL.uvec2(0xffffffff, 0) });
  withMaterial(output, (mesh) => {
    for (const [backend, source] of Object.entries(compileNodeMaterialBackends(mesh))) {
      const program = `${source.vertex}\n${source.fragment}`;
      for (const name of ['decorationPosition', 'decorationPaint', 'srgbChannelToLinear']) {
        assert.equal(declarationCount(program, name, backend), 1);
      }
    }
  });
});

function withMaterial(output, body) {
  const material = new THREE.MeshBasicNodeMaterial({ transparent: true });
  material.positionNode = output.position;
  material.colorNode = output.color;
  material.opacityNode = output.opacity;
  const geometry = new THREE.PlaneGeometry(1, 1);
  const mesh = new THREE.Mesh(geometry, material);
  try {
    body(mesh);
  } finally {
    geometry.dispose();
    material.dispose();
  }
}

function declarationCount(source, name, backend) {
  const declaration = backend === 'webgpu' ? `^fn ${name}\\(` : `^\\w+ ${name}\\(`;
  return (source.match(new RegExp(declaration, 'gm')) ?? []).length;
}
