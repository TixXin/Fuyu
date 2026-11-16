import type { GlassPalette } from "../../lib/theme/glassPalette";

const VERTEX = "attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}";
const FRAGMENT = `precision mediump float;uniform vec2 res;uniform float t;uniform vec3 c1,c2,c3;uniform float op;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*n(p);p*=2.;a*=.5;}return v;}
void main(){vec2 uv=gl_FragCoord.xy/res.y*1.6;float s=t*.06;vec2 q=vec2(fbm(uv+s),fbm(uv+vec2(5.2,1.3)-s));
vec2 r=vec2(fbm(uv+2.*q+vec2(1.7,9.2)+s*.7),fbm(uv+2.*q+vec2(8.3,2.8)-s*.5));float f=fbm(uv+2.*r);
vec3 col=mix(c1,c2,clamp(f*1.6,0.,1.));col=mix(col,c3,clamp(length(q)*.8,0.,1.));float a=clamp(f*f*2.2+.15,0.,1.)*op;gl_FragColor=vec4(col*a,a);}`;

export type GlassShader = {
  draw: (seconds: number, palette: GlassPalette, opacity: number) => void;
  dispose: () => void;
};

function toVec3(hex: string) {
  return [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16) / 255);
}

export function createGlassShader(canvas: HTMLCanvasElement): GlassShader | null {
  const gl = canvas.getContext("webgl", { premultipliedAlpha: true, alpha: true, antialias: false });
  if (!gl) return null;
  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null;
  };
  const vertex = compile(gl.VERTEX_SHADER, VERTEX);
  const fragment = compile(gl.FRAGMENT_SHADER, FRAGMENT);
  const program = gl.createProgram();
  if (!vertex || !fragment || !program) return null;
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
  gl.useProgram(program);
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const location = gl.getAttribLocation(program, "p");
  gl.enableVertexAttribArray(location);
  gl.vertexAttribPointer(location, 2, gl.FLOAT, false, 0, 0);
  const uniform = (name: string) => gl.getUniformLocation(program, name);
  const u = { res: uniform("res"), t: uniform("t"), c1: uniform("c1"), c2: uniform("c2"), c3: uniform("c3"), op: uniform("op") };

  return {
    draw(seconds, palette, opacity) {
      const width = Math.max(1, Math.round(canvas.clientWidth));
      const height = Math.max(1, Math.round(canvas.clientHeight));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      gl.viewport(0, 0, width, height);
      gl.uniform2f(u.res, width, height);
      gl.uniform1f(u.t, seconds);
      gl.uniform3fv(u.c1, toVec3(palette[0]));
      gl.uniform3fv(u.c2, toVec3(palette[1]));
      gl.uniform3fv(u.c3, toVec3(palette[2]));
      gl.uniform1f(u.op, opacity);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    },
    dispose() {
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
    },
  };
}
