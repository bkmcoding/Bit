import { GAME } from '../utils/constants';

/**
 * Uniforms for the post pass: mild CRT/chroma/static, corner vignette, moon shaft, player rim.
 */
export type GamePostUniforms = {
  time: number;
  playerX: number;
  playerY: number;
  /** 1 = apply player + moon; 0 = raw-ish (e.g. menu). */
  reactiveMood: number;
  moonOriginX: number;
  moonOriginY: number;
  moonDirX: number;
  moonDirY: number;
  moonSpread: number;
  moonStrength: number;
};

function compileShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const sh = gl.createShader(type);
  if (!sh) return null;
  gl.shaderSource(sh, source);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    console.warn('[webglHorrorPresent] shader compile:', gl.getShaderInfoLog(sh));
    gl.deleteShader(sh);
    return null;
  }
  return sh;
}

function linkProgram(gl: WebGLRenderingContext, vs: WebGLShader, fs: WebGLShader): WebGLProgram | null {
  const prog = gl.createProgram();
  if (!prog) return null;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.bindAttribLocation(prog, 0, 'a_pos');
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.warn('[webglHorrorPresent] program link:', gl.getProgramInfoLog(prog));
    gl.deleteProgram(prog);
    return null;
  }
  return prog;
}

const VS = `
attribute vec2 a_pos;
varying vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

/**
 * No barrel warp (avoids edge stretch / clamp artifacts). Mild grade, light CRT hints,
 * soft corner-only shading (does not darken whole walls — doors stay readable).
 */
const FS = `
precision mediump float;
varying vec2 v_uv;
uniform sampler2D u_game;
uniform vec2 u_texel;
uniform float u_time;
uniform vec2 u_playerUv;
uniform float u_reactive;
uniform vec2 u_moonOrigin;
uniform vec2 u_moonDir;
uniform float u_moonSpread;
uniform float u_moonStrength;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float hash3(vec3 p) {
  return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
}

// Horizontal-only fringing — no radial Y offsets (cleaner edges than full radial CA).
vec3 sampleChroma(vec2 tc, vec2 vuv) {
  float ab = length(vuv - 0.5) * 0.0038 + 0.0006;
  float r = texture2D(u_game, vec2(clamp(tc.x - ab, 0.001, 0.999), tc.y)).r;
  float g = texture2D(u_game, tc).g;
  float b = texture2D(u_game, vec2(clamp(tc.x + ab, 0.001, 0.999), tc.y)).b;
  return vec3(r, g, b);
}

void main() {
  vec2 uv = v_uv;
  vec2 tc = vec2(uv.x, 1.0 - uv.y);

  vec3 col = sampleChroma(tc, uv);

  // Subtle corner shading only (short range — not full wall bands, so doors stay visible)
  float dCr = min(min(length(tc), length(tc - vec2(1.0, 0.0))),
                  min(length(tc - vec2(0.0, 1.0)), length(tc - vec2(1.0, 1.0))));
  float cornerSh = mix(0.9, 1.0, smoothstep(0.02, 0.28, dCr));
  col *= cornerSh;

  // Light vignette (floor never crushed)
  vec2 qv = uv - 0.5;
  float vig = clamp(1.0 - dot(qv, qv) * 0.55, 0.72, 1.0);
  col *= vig;

  // Slight cool cast, modest darken
  vec3 cool = col * vec3(0.88, 0.9, 0.98);
  col = mix(col, cool, 0.28);
  col *= 0.9;

  if (u_reactive > 0.5) {
    vec2 pd = tc - u_playerUv;
    float d = length(pd) * 5.2;
    float pulse = 0.88 + 0.12 * sin(u_time * 2.0);
    float rim = exp(-d * d * 0.42) * 0.2 * pulse;
    col += rim * vec3(0.12, 0.11, 0.1);

    vec2 to = tc - u_moonOrigin;
    float along = dot(to, u_moonDir);
    vec2 perpV = vec2(-u_moonDir.y, u_moonDir.x);
    float across = dot(to, perpV);
    float spreadSq = u_moonSpread * u_moonSpread;
    float beam = exp(-across * across / max(spreadSq, 0.0001));
    float depth = 0.0;
    if (along > 0.0) {
      depth = beam * exp(-along * 1.25) * smoothstep(-0.02, 0.06, along);
    }
    float drift = 0.92 + 0.08 * sin(u_time * 0.4);
    col += depth * u_moonStrength * drift * vec3(0.1, 0.11, 0.16);
  }

  // Light static
  vec2 scr = gl_FragCoord.xy;
  vec2 crawl = u_time * vec2(48.0, 37.0);
  float n1 = hash3(vec3(floor(scr * 0.85 + crawl), floor(u_time * 20.0)));
  float n2 = hash3(vec3(floor(scr * 1.4 - crawl * 0.45), floor(u_time * 15.0)));
  float n3 = hash(floor(tc / u_texel + u_time * vec2(5.0, 7.0)));
  float snow = (n1 * 0.4 + n2 * 0.35 + n3 * 0.25 - 0.5) * 0.045;
  col += vec3(snow);

  float fl = 0.022 * sin(u_time * 6.5) + 0.012 * sin(u_time * 12.0);
  col *= 1.0 - fl;

  // TV scanlines (full frame: title, gameplay, pause — anything through this pass)
  float py = gl_FragCoord.y;
  float oddRow = step(0.5, mod(py, 2.0));
  float triple = step(0.5, mod(py, 3.0));
  float scanMul = mix(0.9, 1.0, oddRow) * mix(0.965, 1.0, triple);
  col *= scanMul;

  float ph = mod(gl_FragCoord.x + gl_FragCoord.y * 0.5, 3.0);
  vec3 mask = ph < 1.0 ? vec3(1.015, 0.992, 0.992) : (ph < 2.0 ? vec3(0.992, 1.012, 0.992) : vec3(0.992, 0.992, 1.015));
  col *= mask;

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

export type GameGlPresenter = {
  present(source: HTMLCanvasElement | OffscreenCanvas, uniforms: GamePostUniforms): void;
  dispose(): void;
};

export function createGameGlPresenter(displayCanvas: HTMLCanvasElement): GameGlPresenter | null {
  const gl = displayCanvas.getContext('webgl', {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    preserveDrawingBuffer: false,
    powerPreference: 'low-power',
  }) as WebGLRenderingContext | null;

  if (!gl) {
    console.warn('[webglHorrorPresent] WebGL unavailable');
    return null;
  }

  const vs = compileShader(gl, gl.VERTEX_SHADER, VS);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, FS);
  if (!vs || !fs) {
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    return null;
  }

  const program = linkProgram(gl, vs, fs);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!program) return null;

  const buf = gl.createBuffer();
  if (!buf) {
    gl.deleteProgram(program);
    return null;
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
    gl.STATIC_DRAW
  );

  const tex = gl.createTexture();
  if (!tex) {
    gl.deleteBuffer(buf);
    gl.deleteProgram(program);
    return null;
  }

  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

  const loc = {
    game: gl.getUniformLocation(program, 'u_game'),
    texel: gl.getUniformLocation(program, 'u_texel'),
    time: gl.getUniformLocation(program, 'u_time'),
    playerUv: gl.getUniformLocation(program, 'u_playerUv'),
    reactive: gl.getUniformLocation(program, 'u_reactive'),
    moonOrigin: gl.getUniformLocation(program, 'u_moonOrigin'),
    moonDir: gl.getUniformLocation(program, 'u_moonDir'),
    moonSpread: gl.getUniformLocation(program, 'u_moonSpread'),
    moonStrength: gl.getUniformLocation(program, 'u_moonStrength'),
  };

  const texelW = 1 / GAME.NATIVE_WIDTH;
  const texelH = 1 / GAME.NATIVE_HEIGHT;

  return {
    present(source: HTMLCanvasElement | OffscreenCanvas, uniforms: GamePostUniforms): void {
      gl.viewport(0, 0, displayCanvas.width, displayCanvas.height);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);

      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source as TexImageSource);
      gl.uniform1i(loc.game, 0);
      gl.uniform2f(loc.texel, texelW, texelH);
      gl.uniform1f(loc.time, uniforms.time);
      gl.uniform2f(loc.playerUv, uniforms.playerX, uniforms.playerY);
      gl.uniform1f(loc.reactive, uniforms.reactiveMood);
      gl.uniform2f(loc.moonOrigin, uniforms.moonOriginX, uniforms.moonOriginY);
      gl.uniform2f(loc.moonDir, uniforms.moonDirX, uniforms.moonDirY);
      gl.uniform1f(loc.moonSpread, uniforms.moonSpread);
      gl.uniform1f(loc.moonStrength, uniforms.moonStrength);

      gl.drawArrays(gl.TRIANGLES, 0, 6);
    },

    dispose(): void {
      gl.deleteTexture(tex);
      gl.deleteBuffer(buf);
      gl.deleteProgram(program);
    },
  };
}

/** @deprecated alias */
export const createHorrorGlPresenter = createGameGlPresenter;
export type HorrorGlPresenter = GameGlPresenter;
