import * as THREE from 'three';

/**
 * Helper to run Sobel filter on a heightmap canvas to produce a normal map.
 */
function createNormalMapFromHeightmap(heightmapCanvas, strength = 12.0) {
  const width = heightmapCanvas.width;
  const height = heightmapCanvas.height;
  const hCtx = heightmapCanvas.getContext('2d');
  const hData = hCtx.getImageData(0, 0, width, height);
  const hPixels = hData.data;

  const normCanvas = document.createElement('canvas');
  normCanvas.width = width;
  normCanvas.height = height;
  const nCtx = normCanvas.getContext('2d');
  const nData = nCtx.createImageData(width, height);
  const nPixels = nData.data;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Sample heights in red channel of adjacent pixels with wrapping
      const getVal = (px, py) => {
        const cx = (px + width) % width;
        const cy = (py + height) % height;
        return hPixels[(cy * width + cx) * 4] / 255.0;
      };

      // 3x3 Sobel kernels
      const topLeft  = getVal(x - 1, y - 1);
      const top      = getVal(x,     y - 1);
      const topRight = getVal(x + 1, y - 1);
      const left     = getVal(x - 1, y);
      const right    = getVal(x + 1, y);
      const botLeft  = getVal(x - 1, y + 1);
      const bot      = getVal(x,     y + 1);
      const botRight = getVal(x + 1, y + 1);

      // Gradient vectors
      const dx = (topRight + 2.0 * right + botRight) - (topLeft + 2.0 * left + botLeft);
      const dy = (botLeft + 2.0 * bot + botRight) - (topLeft + 2.0 * top + topRight);

      // Calculate normal vector coordinates (nx, ny, nz)
      const nx = -dx * strength;
      const ny = -dy * strength;
      const nz = 1.0;

      // Normalize normal vector
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
      const r = (nx / len * 0.5 + 0.5) * 255;
      const g = (ny / len * 0.5 + 0.5) * 255;
      const b = (nz / len * 0.5 + 0.5) * 255;

      const idx = (y * width + x) * 4;
      nPixels[idx]     = r;
      nPixels[idx + 1] = g;
      nPixels[idx + 2] = b;
      nPixels[idx + 3] = 255;
    }
  }

  nCtx.putImageData(nData, 0, 0);
  return normCanvas;
}

/**
 * Creates the high-fidelity procedural PBR Antique Brass material.
 */
export function createBrassMaterial(onProgress) {
  // Use 2048x2048 for high-performance loading with rich details
  const size = 2048;
  const width = size;
  const height = size;

  if (onProgress) onProgress(0.2, "Generating heightmaps...");

  // 1. HEIGHTMAP CANVAS
  const hCanvas = document.createElement('canvas');
  hCanvas.width = width;
  hCanvas.height = height;
  const hCtx = hCanvas.getContext('2d');

  // Fill neutral gray (neutral height)
  hCtx.fillStyle = '#808080';
  hCtx.fillRect(0, 0, width, height);

  // Draw concentric groves/ridges (horizontal bands in cylindrical UV space)
  const drawGroove = (y, thickness, depth) => {
    const colorVal = Math.floor(128 - depth * 127);
    const hex = '#' + colorVal.toString(16).padStart(2, '0').repeat(3);
    hCtx.fillStyle = hex;
    hCtx.fillRect(0, y, width, thickness);
  };

  const drawRidge = (y, thickness, heightVal) => {
    const colorVal = Math.floor(128 + heightVal * 127);
    const hex = '#' + colorVal.toString(16).padStart(2, '0').repeat(3);
    hCtx.fillStyle = hex;
    hCtx.fillRect(0, y, width, thickness);
  };

  const drawBeveledBand = (y, thickness, depth) => {
    const grad = hCtx.createLinearGradient(0, y, 0, y + thickness);
    const c1 = Math.floor(128 - depth * 127);
    const c2 = Math.floor(128 + depth * 127);
    grad.addColorStop(0, `rgb(${c1},${c1},${c1})`);
    grad.addColorStop(0.5, `rgb(${c2},${c2},${c2})`);
    grad.addColorStop(1, `rgb(${c1},${c1},${c1})`);
    hCtx.fillStyle = grad;
    hCtx.fillRect(0, y, width, thickness);
  };

  // --- Draw Base mold Details (v = 0.0 -> 0.15 => Y = 0 -> 300) ---
  drawGroove(15, 8, 0.4);
  drawRidge(23, 12, 0.5);
  drawGroove(35, 4, 0.3);
  drawBeveledBand(60, 20, 0.6);
  drawGroove(100, 10, 0.45);
  drawRidge(110, 15, 0.5);
  drawBeveledBand(180, 40, 0.5);

  // Lotus Petal Carving (scalloped motif on base, Y: 210 -> 270)
  hCtx.fillStyle = '#656565'; // slightly recessed
  hCtx.beginPath();
  for (let x = 0; x <= width; x++) {
    const u = x / width;
    const wave = Math.abs(Math.sin(16 * Math.PI * u)); // 16 repeating petals
    const petalY = 210 + 35 * wave;
    if (x === 0) hCtx.moveTo(x, petalY);
    else hCtx.lineTo(x, petalY);
  }
  hCtx.lineTo(width, 270);
  hCtx.lineTo(0, 270);
  hCtx.closePath();
  hCtx.fill();

  // --- Draw Stem moldings (v = 0.15 -> 0.65 => Y = 300 -> 1300) ---
  // Horizontal grooves matching stem ridges
  drawGroove(460, 10, 0.35); // junction ring 1
  drawRidge(470, 15, 0.4);
  drawGroove(485, 10, 0.35);

  drawGroove(740, 10, 0.35); // junction ring 2
  drawRidge(750, 15, 0.4);
  drawGroove(765, 10, 0.35);

  drawGroove(1010, 8, 0.35); // junction ring 3
  drawRidge(1018, 12, 0.4);
  drawGroove(1030, 8, 0.35);

  // --- Draw Bowl details (v = 0.65 -> 0.90 => Y = 1300 -> 1800) ---
  drawGroove(1340, 15, 0.4); // bottom curve of bowl
  drawRidge(1355, 10, 0.4);
  drawBeveledBand(1480, 50, 0.5); // outer mid-bowl bulge

  // Floral Panel Pattern on Bowl (Y: 1530 -> 1600, 8 panels)
  hCtx.fillStyle = '#6a6a6a';
  hCtx.beginPath();
  for (let x = 0; x <= width; x++) {
    const u = x / width;
    const wave = Math.abs(Math.sin(8 * Math.PI * u)); // 8 repeating panels
    const petalY = 1530 + 30 * wave;
    if (x === 0) hCtx.moveTo(x, petalY);
    else hCtx.lineTo(x, petalY);
  }
  hCtx.lineTo(width, 1600);
  hCtx.lineTo(0, 1600);
  hCtx.closePath();
  hCtx.fill();

  drawGroove(1640, 12, 0.65); // deep groove under rim

  // --- Draw Finial details (v = 0.90 -> 1.0 => Y = 1800 -> 2048) ---
  drawBeveledBand(1820, 20, 0.4);
  drawGroove(1910, 6, 0.3);
  drawRidge(1916, 10, 0.3);

  // --- Add Fine Brushed Metal Scratches to Heightmap ---
  hCtx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
  hCtx.lineWidth = 1;
  for (let i = 0; i < 4000; i++) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    const len = Math.random() * 60 + 20;
    hCtx.beginPath();
    hCtx.moveTo(x, y);
    hCtx.lineTo(x + len, y); // Horizontal brush marks wrapping cylindrically
    hCtx.stroke();
  }

  // Draw some micro-indentations (hammer marks)
  hCtx.fillStyle = 'rgba(0, 0, 0, 0.08)';
  for (let i = 0; i < 1500; i++) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    const r = Math.random() * 4 + 2;
    hCtx.beginPath();
    hCtx.arc(x, y, r, 0, Math.PI * 2);
    hCtx.fill();
  }

  if (onProgress) onProgress(0.5, "Generating normal maps...");

  // 2. NORMAL MAP GENERATION
  const normCanvas = createNormalMapFromHeightmap(hCanvas, 8.0);

  if (onProgress) onProgress(0.7, "Baking albedo and roughness...");

  // 3. ALBEDO (BASE COLOR) CANVAS
  const aCanvas = document.createElement('canvas');
  aCanvas.width = width;
  aCanvas.height = height;
  const aCtx = aCanvas.getContext('2d');

  // Base Brass color: warm antique gold
  aCtx.fillStyle = '#b68e4a'; 
  aCtx.fillRect(0, 0, width, height);

  // Create subtle vertical gradient to simulate gravity-based aging (darker at base/bottom)
  const vGrad = aCtx.createLinearGradient(0, 0, 0, height);
  vGrad.addColorStop(0, 'rgba(30, 20, 5, 0.25)');   // Darker at very top center
  vGrad.addColorStop(0.15, 'rgba(100, 75, 30, 0.0)');
  vGrad.addColorStop(0.85, 'rgba(100, 75, 30, 0.0)');
  vGrad.addColorStop(1.0, 'rgba(35, 25, 5, 0.35)');  // Darker base
  aCtx.fillStyle = vGrad;
  aCtx.fillRect(0, 0, width, height);

  // Bake heightmap details directly into Albedo as contact shadows (AO simulation)
  aCtx.globalCompositeOperation = 'multiply';
  aCtx.drawImage(hCanvas, 0, 0); // multiply heightmap to darken crevices
  aCtx.globalCompositeOperation = 'source-over';

  // Apply patina weathering (cool green-brown oxidation) in deep crevices
  // crevices correspond to dark areas in heightmap (<100)
  const hData = hCtx.getImageData(0, 0, width, height);
  const hPixels = hData.data;
  const aData = aCtx.getImageData(0, 0, width, height);
  const aPixels = aData.data;

  for (let i = 0; i < hPixels.length; i += 4) {
    const h = hPixels[i]; // Height value (0 to 255)
    if (h < 110) {
      // crevices: blend toward patina color (green-brown: R=110, G=125, B=100)
      const blend = (110 - h) / 110 * 0.32; // blend up to 32%
      aPixels[i]     = aPixels[i]     * (1 - blend) + 98 * blend;
      aPixels[i + 1] = aPixels[i + 1] * (1 - blend) + 115 * blend;
      aPixels[i + 2] = aPixels[i + 2] * (1 - blend) + 90 * blend;
    } else if (h > 150) {
      // ridges/highlights: blend toward polished golden highlights (R=235, G=200, B=125)
      const blend = (h - 150) / 105 * 0.15; // blend up to 15%
      aPixels[i]     = aPixels[i]     * (1 - blend) + 245 * blend;
      aPixels[i + 1] = aPixels[i + 1] * (1 - blend) + 215 * blend;
      aPixels[i + 2] = aPixels[i + 2] * (1 - blend) + 140 * blend;
    }
  }
  aCtx.putImageData(aData, 0, 0);

  // 4. ROUGHNESS CANVAS
  const rCanvas = document.createElement('canvas');
  rCanvas.width = width;
  rCanvas.height = height;
  const rCtx = rCanvas.getContext('2d');

  // Base roughness around 0.28 (polished but not perfect mirror)
  rCtx.fillStyle = '#484848'; // 0.28 roughness
  rCtx.fillRect(0, 0, width, height);

  // Recesses (heightmap < 128) are rougher due to oxidation/dust (up to 0.55)
  // Exposed ridges (heightmap > 128) are shinier due to hand polishing (down to 0.18)
  const rData = rCtx.getImageData(0, 0, width, height);
  const rPixels = rData.data;

  for (let i = 0; i < hPixels.length; i += 4) {
    const h = hPixels[i];
    let roughness;
    if (h < 128) {
      // Crevice: rougher (0.28 -> 0.55)
      roughness = 0.28 + (128 - h) / 128 * 0.27;
    } else {
      // Ridge: shinier (0.28 -> 0.16)
      roughness = 0.28 - (h - 128) / 127 * 0.12;
    }
    // Convert float roughness to byte color
    const byteVal = Math.floor(roughness * 255);
    rPixels[i]     = byteVal;
    rPixels[i + 1] = byteVal;
    rPixels[i + 2] = byteVal;
    rPixels[i + 3] = 255;
  }
  rCtx.putImageData(rData, 0, 0);

  // Overlay micro-scratches onto roughness to break specular highlights
  rCtx.strokeStyle = 'rgba(255, 255, 255, 0.08)'; // adds rough scratches
  rCtx.lineWidth = 1;
  for (let i = 0; i < 2000; i++) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    const len = Math.random() * 40 + 10;
    rCtx.beginPath();
    rCtx.moveTo(x, y);
    rCtx.lineTo(x + len, y);
    rCtx.stroke();
  }

  // 5. AMBIENT OCCLUSION (AO) CANVAS
  // Recesses get ambient shadowing. We invert and scale the heightmap for this.
  const aoCanvas = document.createElement('canvas');
  aoCanvas.width = width;
  aoCanvas.height = height;
  const aoCtx = aoCanvas.getContext('2d');
  
  const aoData = aoCtx.createImageData(width, height);
  const aoPixels = aoData.data;
  for (let i = 0; i < hPixels.length; i += 4) {
    const h = hPixels[i];
    // Darken crevices in AO, keep highlights fully white (1.0 AO)
    let aoVal = 1.0;
    if (h < 128) {
      aoVal = 0.5 + (h / 128) * 0.5; // ranges from 0.5 (crevice) to 1.0 (flat)
    }
    const byteVal = Math.floor(aoVal * 255);
    aoPixels[i]     = byteVal;
    aoPixels[i + 1] = byteVal;
    aoPixels[i + 2] = byteVal;
    aoPixels[i + 3] = 255;
  }
  aoCtx.putImageData(aoData, 0, 0);

  if (onProgress) onProgress(0.9, "Assembling Three.js textures...");

  // Convert canvases to Three.js Textures
  const albedoTex = new THREE.CanvasTexture(aCanvas);
  const normalTex = new THREE.CanvasTexture(normCanvas);
  const roughnessTex = new THREE.CanvasTexture(rCanvas);
  const aoTex = new THREE.CanvasTexture(aoCanvas);

  // Set wrapping modes
  const textures = [albedoTex, normalTex, roughnessTex, aoTex];
  textures.forEach(tex => {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping; // Keep Y clamp for lathe mapping
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.anisotropy = 8; // Sharp textures at steep angles
  });

  // Create PBR Material
  const material = new THREE.MeshPhysicalMaterial({
    map: albedoTex,
    normalMap: normalTex,
    normalScale: new THREE.Vector2(1.0, 1.0),
    roughnessMap: roughnessTex,
    aoMap: aoTex,
    aoMapIntensity: 1.0,
    metalness: 0.96,
    roughness: 1.0, // Multiplied by roughnessMap values
    envMapIntensity: 1.0,
    clearcoat: 0.16,
    clearcoatRoughness: 0.22,
    reflectivity: 0.65,
  });

  if (onProgress) onProgress(1.0, "Materials compiled!");

  return material;
}

/**
 * Creates a beautiful procedural slate/stone material for the stage platform.
 */
export function createSlateMaterial() {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  // Base dark charcoal color
  ctx.fillStyle = '#222428';
  ctx.fillRect(0, 0, size, size);

  // Generate dynamic slate stone noise (layers of gray blotches)
  for (let i = 0; i < 400; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = Math.random() * 80 + 30;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    const alpha = Math.random() * 0.08;
    const shade = Math.floor(Math.random() * 60 + 10);
    grad.addColorStop(0, `rgba(${shade},${shade},${shade},${alpha})`);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Draw fine horizontal/diagonal fractures
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 15; i++) {
    let px = Math.random() * size;
    let py = Math.random() * size;
    ctx.beginPath();
    ctx.moveTo(px, py);
    for (let j = 0; j < 5; j++) {
      px += Math.random() * 100 - 50;
      py += Math.random() * 40 - 20;
      ctx.lineTo(px, py);
    }
    ctx.stroke();
  }

  // Create normal map from the slate grain height
  // We'll reuse the canvas as a heightmap
  const hData = ctx.getImageData(0, 0, size, size);
  const hPixels = hData.data;

  const nCanvas = document.createElement('canvas');
  nCanvas.width = size;
  nCanvas.height = size;
  const nCtx = nCanvas.getContext('2d');
  const nData = nCtx.createImageData(size, size);
  const nPixels = nData.data;

  // Sobel strength for stone roughness
  const strength = 6.0;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const getVal = (px, py) => {
        const cx = (px + size) % size;
        const cy = (py + size) % size;
        return hPixels[(cy * size + cx) * 4] / 255.0;
      };

      const topLeft  = getVal(x - 1, y - 1);
      const top      = getVal(x,     y - 1);
      const topRight = getVal(x + 1, y - 1);
      const left     = getVal(x - 1, y);
      const right    = getVal(x + 1, y);
      const botLeft  = getVal(x - 1, y + 1);
      const bot      = getVal(x,     y + 1);
      const botRight = getVal(x + 1, y + 1);

      const dx = (topRight + 2.0 * right + botRight) - (topLeft + 2.0 * left + botLeft);
      const dy = (botLeft + 2.0 * bot + botRight) - (topLeft + 2.0 * top + topRight);

      const nx = -dx * strength;
      const ny = -dy * strength;
      const nz = 1.0;

      const len = Math.sqrt(nx*nx + ny*ny + nz*nz);
      nPixels[(y * size + x) * 4]     = (nx / len * 0.5 + 0.5) * 255;
      nPixels[(y * size + x) * 4 + 1] = (ny / len * 0.5 + 0.5) * 255;
      nPixels[(y * size + x) * 4 + 2] = (nz / len * 0.5 + 0.5) * 255;
      nPixels[(y * size + x) * 4 + 3] = 255;
    }
  }
  nCtx.putImageData(nData, 0, 0);

  const albedoTex = new THREE.CanvasTexture(canvas);
  const normalTex = new THREE.CanvasTexture(nCanvas);
  
  albedoTex.wrapS = THREE.RepeatWrapping;
  albedoTex.wrapT = THREE.RepeatWrapping;
  normalTex.wrapS = THREE.RepeatWrapping;
  normalTex.wrapT = THREE.RepeatWrapping;

  const slateMat = new THREE.MeshStandardMaterial({
    map: albedoTex,
    normalMap: normalTex,
    normalScale: new THREE.Vector2(0.8, 0.8),
    roughness: 0.72,
    metalness: 0.05
  });

  return slateMat;
}
