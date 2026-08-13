// Thin WebGL2 helpers. Deliberately small — the renderer only needs programs,
// static buffers, and instanced attribute wiring.

export function createProgram(
  gl: WebGL2RenderingContext,
  vertSrc: string,
  fragSrc: string,
  label: string
): WebGLProgram {
  const vert = compile(gl, gl.VERTEX_SHADER, vertSrc, `${label}.vert`);
  const frag = compile(gl, gl.FRAGMENT_SHADER, fragSrc, `${label}.frag`);
  const program = gl.createProgram();
  if (!program) throw new Error(`${label}: could not create program`);
  gl.attachShader(program, vert);
  gl.attachShader(program, frag);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program);
    throw new Error(`${label}: link failed\n${log}`);
  }
  // Shaders are referenced by the program; drop our handles.
  gl.deleteShader(vert);
  gl.deleteShader(frag);
  return program;
}

function compile(
  gl: WebGL2RenderingContext,
  type: number,
  src: string,
  label: string
): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error(`${label}: could not create shader`);
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`${label}: compile failed\n${log}`);
  }
  return shader;
}

export function staticBuffer(
  gl: WebGL2RenderingContext,
  data: Float32Array
): WebGLBuffer {
  const buffer = gl.createBuffer();
  if (!buffer) throw new Error("could not create buffer");
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  return buffer;
}

export type AttribSpec = {
  name: string;
  size: number;
  /** Byte offset into the interleaved instance buffer. */
  offset: number;
  /** 1 = per instance, 0 = per vertex. */
  divisor: 0 | 1;
};

/** Wires an interleaved buffer into the currently bound VAO. */
export function bindAttribs(
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
  buffer: WebGLBuffer,
  stride: number,
  attribs: AttribSpec[]
): void {
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  for (const a of attribs) {
    const loc = gl.getAttribLocation(program, a.name);
    if (loc < 0) continue; // optimized out
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, a.size, gl.FLOAT, false, stride, a.offset);
    gl.vertexAttribDivisor(loc, a.divisor);
  }
}

export type UniformMap = Record<string, WebGLUniformLocation | null>;

export function uniforms(
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
  names: string[]
): UniformMap {
  const out: UniformMap = {};
  for (const n of names) out[n] = gl.getUniformLocation(program, n);
  return out;
}
