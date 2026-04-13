/**
 * Post pass: horror through obscurity, not optical blur — crisp NEAREST sample, no chroma, no warp.
 * Darkness, strong vignette, corner crush, and luma-based shadow crushing — no radial/spoke patterns.
 */
export type GamePostUniforms = {
  time: number;
  playerX: number;
  playerY: number;
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

const FS = `
precision mediump float;
varying vec2 v_uv;
uniform sampler2D u_game;
uniform float u_time;
uniform vec2 u_playerUv;
uniform float u_reactive;
uniform vec2 u_moonOrigin;
uniform vec2 u_moonDir;
uniform float u_moonSpread;
uniform float u_moonStrength;

float hash21(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

vec3 tap(vec2 tc) {
  return texture2D(u_game, clamp(tc, vec2(0.001), vec2(0.999))).rgb;
}

void main() {
  float mood = u_reactive;
  float t = u_time;
  vec2 uv = v_uv;

  vec3 col;
  if (mood < 0.5) {
    vec2 tc = vec2(uv.x, 1.0 - uv.y);
    col = tap(tc);
    vec2 qv = uv - 0.5;
    // Keep the menu/title pass readable (less shadow crush).
    col *= 0.98;
    float vig = clamp(1.0 - dot(qv, qv) * 0.45, 0.86, 1.0);
    col *= vig;
  } else {
  float M = mood;
  vec2 tc0 = vec2(uv.x, 1.0 - uv.y);
  col = tap(tc0);

  vec2 q = uv - 0.5;
  float ql = length(q);

  float dCr = min(min(length(tc0), length(tc0 - vec2(1.0, 0.0))),
                  min(length(tc0 - vec2(0.0, 1.0)), length(tc0 - vec2(1.0, 1.0))));
  float cornerSh = mix(0.55, 1.0, smoothstep(0.012, 0.36, dCr));
  col *= cornerSh;

  float breathe = 0.96 + 0.04 * sin(t * 0.55 + ql * 1.8);
  float vigAmt = 0.92 * M * breathe;
  float vigFloor = 0.12;
  float vig = clamp(1.0 - dot(q, q) * vigAmt, vigFloor, 1.0);
  col *= vig;

  float peak = max(max(col.r, col.g), col.b);
  float inShadow = 1.0 - smoothstep(0.04, 0.28, peak);
  col *= mix(1.0, 0.7, inShadow * M);

  vec3 sick = col * vec3(0.82, 0.88, 0.74);
  vec3 bruise = col * vec3(0.76, 0.72, 0.86);
  col = mix(col, sick, 0.12 * M);
  col = mix(col, bruise, 0.1 * M);
  // Global lift so gameplay details survive on typical displays.
  col *= 0.85 * M + (1.0 - M);

  col = pow(max(col, vec3(0.0005)), vec3(1.02));

  float rf = hash21(uv * 350.0 + floor(t * 3.5));
  if (rf > 0.996) col *= 0.5;
  else if (rf > 0.99) col *= 0.78;

  vec2 pd = tc0 - u_playerUv;
  float d = length(pd) * 5.2;
  float rim = exp(-d * d * 0.42) * 0.055;
  col += rim * vec3(0.055, 0.05, 0.062);

  vec2 to = tc0 - u_moonOrigin;
  float along = dot(to, u_moonDir);
  vec2 perpV = vec2(-u_moonDir.y, u_moonDir.x);
  float across = dot(to, perpV);
  float spreadSq = u_moonSpread * u_moonSpread;
  float beam = exp(-across * across / max(spreadSq, 0.0001));
  float depth = 0.0;
  if (along > 0.0) {
    depth = beam * exp(-along * 1.55) * smoothstep(-0.02, 0.06, along);
  }
  col += depth * u_moonStrength * 0.45 * vec3(0.04, 0.044, 0.056);

  vec2 scr = gl_FragCoord.xy;
  float g = hash21(floor(scr * 0.5) + floor(t * 0.9));
  col += (g - 0.5) * 0.014 * M;

  col *= 1.05;
  }
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
    time: gl.getUniformLocation(program, 'u_time'),
    playerUv: gl.getUniformLocation(program, 'u_playerUv'),
    reactive: gl.getUniformLocation(program, 'u_reactive'),
    moonOrigin: gl.getUniformLocation(program, 'u_moonOrigin'),
    moonDir: gl.getUniformLocation(program, 'u_moonDir'),
    moonSpread: gl.getUniformLocation(program, 'u_moonSpread'),
    moonStrength: gl.getUniformLocation(program, 'u_moonStrength'),
  };

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
