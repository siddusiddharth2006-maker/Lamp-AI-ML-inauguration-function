import * as THREE from 'three';

// 3D Simplex Noise GLSL Code (Ashima Arts / Stefan Gustavson)
const simplexNoiseGLSL = `
vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}

float snoise(vec3 v){
  const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
  const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);

  // First corner
  vec3 i  = floor(v + dot(v, C.yyy) );
  vec3 x0 =   v - i + dot(i, C.xxx) ;

  // Other corners
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min( g.xyz, l.zxy );
  vec3 i2 = max( g.xyz, l.zxy );

  //  x0 = x0 - 0. + 0.0 * C 
  vec3 x1 = x0 - i1 + 1.0 * C.xxx;
  vec3 x2 = x0 - i2 + 2.0 * C.xxx;
  vec3 x3 = x0 - D.yyy;      // Box coordinates [0, 1]

  // Permutations
  i = mod(i, 289.0 );
  vec4 p = permute( permute( permute(
             i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0 ))
           + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));

  // Gradients
  // ( N*N points project uniformly on a square, mapped onto an octahedron.)
  float n_ = 1.0/7.0; // N=7
  vec3  ns = n_ * D.wyz - D.xzx;

  vec4 j = p - 49.0 * floor(p * ns.z *ns.z);  //  mod(p,N*N)

  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_ );    // mod(j,N)

  vec4 x = x_ *ns.x + ns.yyyy;
  vec4 y = y_ *ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);

  vec4 b0 = vec4( x.xy, y.xy );
  vec4 b1 = vec4( x.zw, y.zw );

  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));

  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;

  vec3 p0 = vec3(a0.xy,h.x);
  vec3 p1 = vec3(a0.zw,h.y);
  vec3 p2 = vec3(a1.xy,h.z);
  vec3 p3 = vec3(a1.zw,h.w);

  // Normalise gradients
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;

  // Mix final noise value
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1),
                                dot(p2,x2), dot(p3,x3) ) );
}
`;

/**
 * Flame Material Shader Definition
 */
export const FlameShader = {
  uniforms: {
    uTime: { value: 0.0 },
    uProgress: { value: 1.0 }, // Ignition growth factor (0 to 1)
    uIntensity: { value: 1.5 },
    uColorCore: { value: new THREE.Color(1.0, 0.98, 0.78) },  // Zone 1: White-yellow (RGB 255, 250, 200)
    uColorInner: { value: new THREE.Color(1.0, 0.82, 0.31) }, // Zone 2: Bright yellow (RGB 255, 210, 80)
    uColorMid: { value: new THREE.Color(1.0, 0.58, 0.12) },   // Zone 3: Orange (RGB 255, 150, 30)
    uColorOuter: { value: new THREE.Color(0.78, 0.24, 0.08) }, // Zone 4: Red-orange (RGB 200, 60, 20)
    uColorCool: { value: new THREE.Color(0.47, 0.12, 0.04) },  // Zone 5: Dark red (RGB 120, 30, 10)
  },

  vertexShader: `
    uniform float uTime;
    uniform float uProgress;
    varying vec3 vPosition;
    varying vec3 vLocalPosition;
    varying float vHeightFactor;

    ${simplexNoiseGLSL}

    void main() {
      vLocalPosition = position;
      
      // Calculate normal height factor (0 at bottom, 1 at tip)
      // Standard flame height is ~45 units
      vHeightFactor = position.y / 45.0;

      // Displacement noise - combined 3 octaves (0.5Hz, 2Hz, 4Hz)
      // Fades out at the base (Y = 0) so the flame stays anchored to the wick
      float anchor = smoothstep(0.0, 0.15, vHeightFactor);
      
      vec3 noiseInput1 = vec3(position.x * 0.08, position.y * 0.04 - uTime * 2.5, position.z * 0.08);
      vec3 noiseInput2 = vec3(position.x * 0.25, position.y * 0.12 - uTime * 6.0, position.z * 0.25);
      vec3 noiseInput3 = vec3(position.x * 0.50, position.y * 0.25 - uTime * 12.0, position.z * 0.50);

      float noise = snoise(noiseInput1) * 0.65 +
                    snoise(noiseInput2) * 0.25 +
                    snoise(noiseInput3) * 0.10;

      // Displace position: 70% upward bias, 30% horizontal wobble
      vec3 displacement = vec3(
        noise * 3.5 * anchor,
        noise * 1.5 * anchor + (snoise(vec3(0.0, uTime * 1.5, 0.0)) * 2.0 * anchor), // vertical bobbing
        noise * 3.5 * anchor
      );

      // Scale flame dynamically during ignition
      vec3 scaledPosition = position;
      scaledPosition.y *= uProgress;
      scaledPosition.xz *= (0.4 + 0.6 * uProgress); // Thinner base during ignition

      vec3 newPosition = scaledPosition + displacement * uProgress;
      
      vPosition = newPosition;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
    }
  `,

  fragmentShader: `
    uniform float uProgress;
    uniform float uIntensity;
    uniform vec3 uColorCore;
    uniform vec3 uColorInner;
    uniform vec3 uColorMid;
    uniform vec3 uColorOuter;
    uniform vec3 uColorCool;
    uniform float uTime;

    varying vec3 vPosition;
    varying vec3 vLocalPosition;
    varying float vHeightFactor;

    ${simplexNoiseGLSL}

    void main() {
      // Calculate radial distance from central axis (tapered towards top)
      float maxRadius = 5.0 * (1.0 - vHeightFactor * 0.8);
      float radialDistance = length(vPosition.xz);
      float radialFactor = radialDistance / maxRadius;

      // Base temperature: hot in center and bottom, cooler at tip and edges
      float temp = (1.0 - radialFactor) * (1.0 - vHeightFactor * 0.35);

      // Add high-frequency edge shimmer turbulence using noise
      float shimmer = snoise(vec3(vPosition.x * 0.2, vPosition.y * 0.2 - uTime * 8.0, vPosition.z * 0.2)) * 0.12;
      temp += shimmer;
      
      // Scale temperature by ignition progress
      temp *= uProgress;

      // Map temperature to core-to-edge color zones
      vec3 finalColor = vec3(0.0);
      float alpha = 1.0;

      if (temp > 0.75) {
        // Hottest Core (white-yellow)
        float t = (temp - 0.75) / 0.25;
        finalColor = mix(uColorInner, uColorCore, t);
        alpha = 1.0;
      } else if (temp > 0.50) {
        // Inner Flame (bright yellow-orange)
        float t = (temp - 0.50) / 0.25;
        finalColor = mix(uColorMid, uColorInner, t);
        alpha = 0.98;
      } else if (temp > 0.25) {
        // Mid Flame (vibrant orange-red)
        float t = (temp - 0.25) / 0.25;
        finalColor = mix(uColorOuter, uColorMid, t);
        alpha = 0.92;
      } else if (temp > 0.05) {
        // Outer Edges (dark red cooling)
        float t = (temp - 0.05) / 0.20;
        finalColor = mix(uColorCool, uColorOuter, t);
        // Soft opacity falloff at the boundaries
        alpha = smoothstep(0.0, 1.0, t * 1.3) * 0.85;
      } else {
        // Fully cooled/transparent smoke edges
        discard;
      }

      // Smooth step transparent fade at the base (y=0) to sit on the wick cleanly
      float baseFade = smoothstep(0.0, 0.1, vHeightFactor);
      alpha *= baseFade;

      // Accentuate blue undertones at the very base of the flame (combustion starting)
      if (vHeightFactor < 0.18) {
        float blueMix = (1.0 - (vHeightFactor / 0.18)) * (1.0 - radialFactor) * 0.65;
        vec3 blueBase = vec3(0.1, 0.25, 0.9);
        finalColor = mix(finalColor, blueBase, blueMix);
        alpha = mix(alpha, 0.9, blueMix);
      }

      gl_FragColor = vec4(finalColor * uIntensity, alpha);
    }
  `
};

/**
 * Screen Space Heat Distortion / Refraction Post-processing Shader
 */
export const HeatDistortionShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0.0 },
    uFlameScreenPos: { value: new THREE.Vector2(0.5, 0.5) }, // Screen coordinates [0, 1]
    uStrength: { value: 1.0 },                              // Master multiplier
    uAspectRatio: { value: 1.7777 }                         // Viewport width/height
  },

  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,

  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform vec2 uFlameScreenPos;
    uniform float uStrength;
    uniform float uAspectRatio;
    varying vec2 vUv;

    // Fast, lightweight 2D Sine-wave noise for organic air ripples
    vec2 getRipples(vec2 p, float time) {
      float nx = sin(p.x * 32.0 + time * 14.0) * cos(p.y * 24.0 + time * 8.0);
      float ny = sin(p.x * 18.0 - time * 10.0) * cos(p.y * 36.0 + time * 16.0);
      return vec2(nx, ny);
    }

    void main() {
      // The heat distortion rises UPWARDS from the flame, 
      // so we offset the plume center slightly above the actual flame hot spot.
      vec2 plumeCenter = uFlameScreenPos + vec2(0.0, 0.06); 
      vec2 diff = vUv - plumeCenter;

      // Compensate for viewport aspect ratio to keep the distortion circle round
      diff.x *= uAspectRatio;

      float dist = length(diff);

      // Define a vertical tear-drop shaped distortion region (convective plume)
      // Width: narrow, Height: extends upwards
      float verticalWeight = smoothstep(0.18, 0.0, dist) * smoothstep(-0.02, 0.16, diff.y);

      if (verticalWeight > 0.001 && uStrength > 0.0) {
        // Compute shimmer offset vectors based on 3.5Hz undulation
        vec2 ripple = getRipples(vUv, uTime);

        // Displace the UVs: stronger displacement in vertical direction (rising heat)
        // Max shimmer is ~6-8 pixels (approx 0.004 of UV coordinate space)
        vec2 offset = ripple * vec2(0.004, 0.007) * verticalWeight * uStrength;

        // Sample the scene texture with distorted UVs
        gl_FragColor = texture2D(tDiffuse, vUv + offset);
      } else {
        // Standard non-distorted rendering
        gl_FragColor = texture2D(tDiffuse, vUv);
      }
    }
  `
};
