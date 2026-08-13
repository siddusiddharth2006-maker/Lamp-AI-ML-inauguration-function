import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * Creates the complete Kuthuvilakku (brass lamp) geometry.
 * Combined base, stem with fluting, bowl with inner chamber, central finial, and spout.
 */
export function createLampGeometry() {
  // 1. Define the Lathe profile points (2D profile: X=radius, Y=height)
  // Dimensions match the master prompt (Height ~180-200mm, Base ~140mm diameter)
  const profilePoints = [];

  // --- BASE / PEETHAM (y: 0 -> 28) ---
  profilePoints.push(new THREE.Vector2(0, 0));            // Center bottom
  profilePoints.push(new THREE.Vector2(70, 0));           // Outer edge bottom (140mm diameter)
  profilePoints.push(new THREE.Vector2(70, 4));           // Vertical rim edge
  profilePoints.push(new THREE.Vector2(67, 5));           // Beveled indent
  profilePoints.push(new THREE.Vector2(67, 7));           // Step up
  profilePoints.push(new THREE.Vector2(69, 7));           // Flared lip
  profilePoints.push(new THREE.Vector2(69, 9));           // Lip top
  profilePoints.push(new THREE.Vector2(62, 13));          // Inward slope
  profilePoints.push(new THREE.Vector2(62, 15));          // Small vertical rise
  profilePoints.push(new THREE.Vector2(60, 15));          // Inward groove
  profilePoints.push(new THREE.Vector2(58, 17));          // Inward taper
  profilePoints.push(new THREE.Vector2(50, 22));          // Convex curve transition
  profilePoints.push(new THREE.Vector2(40, 25));          // Slope in
  profilePoints.push(new THREE.Vector2(26, 28));          // Transition to stem junction

  // --- STEM / NECK (y: 28 -> 125, Tapers 22.5mm -> 17.5mm with 3 horizontal bands) ---
  profilePoints.push(new THREE.Vector2(22.5, 28));        // Stem base
  profilePoints.push(new THREE.Vector2(22.0, 38));
  profilePoints.push(new THREE.Vector2(21.5, 47));        // Stem narrowing

  // Decorative Ridge Band 1 (y: 49 -> 53)
  profilePoints.push(new THREE.Vector2(21.0, 49));        // Base of ring 1
  profilePoints.push(new THREE.Vector2(23.5, 51));        // Outer ring 1 curve
  profilePoints.push(new THREE.Vector2(21.0, 53));        // Top of ring 1
  
  profilePoints.push(new THREE.Vector2(20.0, 62));
  profilePoints.push(new THREE.Vector2(19.2, 71));

  // Decorative Ridge Band 2 (y: 73 -> 77)
  profilePoints.push(new THREE.Vector2(18.8, 73));        // Base of ring 2
  profilePoints.push(new THREE.Vector2(21.0, 75));        // Outer ring 2 curve
  profilePoints.push(new THREE.Vector2(18.8, 77));        // Top of ring 2

  profilePoints.push(new THREE.Vector2(18.2, 86));
  profilePoints.push(new THREE.Vector2(17.8, 95));

  // Decorative Ridge Band 3 (y: 97 -> 101)
  profilePoints.push(new THREE.Vector2(17.5, 97));        // Base of ring 3
  profilePoints.push(new THREE.Vector2(19.5, 99));        // Outer ring 3 curve
  profilePoints.push(new THREE.Vector2(17.5, 101));       // Top of ring 3

  profilePoints.push(new THREE.Vector2(17.2, 110));
  profilePoints.push(new THREE.Vector2(17.5, 118));
  profilePoints.push(new THREE.Vector2(19.0, 125));       // Top stem transition to bowl

  // --- OIL RESERVOIR / BOWL (y: 125 -> 165, Diameter ~90mm) ---
  profilePoints.push(new THREE.Vector2(24.0, 128));       // Flare start
  profilePoints.push(new THREE.Vector2(32.0, 132));
  profilePoints.push(new THREE.Vector2(40.0, 137));
  profilePoints.push(new THREE.Vector2(45.0, 144));       // Outer mid-bowl curve
  profilePoints.push(new THREE.Vector2(47.0, 152));       // Outer widest diameter (~94mm)
  profilePoints.push(new THREE.Vector2(46.0, 160));
  profilePoints.push(new THREE.Vector2(44.0, 165));       // Outer rim top edge

  // --- HOLLOW CHAMBER & CENTRAL FINIAL (y: 165 -> 135 -> 185) ---
  profilePoints.push(new THREE.Vector2(42.0, 165));       // Inner rim top edge (2mm thick)
  profilePoints.push(new THREE.Vector2(43.5, 160));       // Inner wall
  profilePoints.push(new THREE.Vector2(42.0, 150));
  profilePoints.push(new THREE.Vector2(36.0, 143));
  profilePoints.push(new THREE.Vector2(28.0, 138));       // Bowl bottom outer
  profilePoints.push(new THREE.Vector2(14.0, 135));       // Bowl bottom inner
  profilePoints.push(new THREE.Vector2(8.0, 134));        // Bottom of inner bowl, starting finial neck

  // Central Lotus Bud Finial/Pillar (y: 134 -> 185)
  profilePoints.push(new THREE.Vector2(7.5, 142));        // Finial neck base
  profilePoints.push(new THREE.Vector2(10.0, 150));       // Finial bulge 1
  profilePoints.push(new THREE.Vector2(8.0, 158));        // Finial neck 2
  profilePoints.push(new THREE.Vector2(13.0, 166));       // Lotus bud flare start
  profilePoints.push(new THREE.Vector2(15.0, 175));       // Lotus bud widest bulge
  profilePoints.push(new THREE.Vector2(10.0, 182));       // Tapering to tip
  profilePoints.push(new THREE.Vector2(0, 185));          // Center tip

  // 2. Create the Lathe Geometry (64 radial segments for ultra-smoothness)
  const latheGeo = new THREE.LatheGeometry(profilePoints, 64);

  // 3. Deform Stem Vertices to add vertical fluting
  // We apply 24 vertical grooves, 0.4mm deep, faded at stem boundaries.
  const position = latheGeo.attributes.position;
  const tempV = new THREE.Vector3();

  for (let i = 0; i < position.count; i++) {
    tempV.fromBufferAttribute(position, i);

    // Apply fluting only in the stem region (y between 28 and 125)
    if (tempV.y > 28 && tempV.y < 125) {
      const radius = Math.sqrt(tempV.x * tempV.x + tempV.z * tempV.z);
      const theta = Math.atan2(tempV.z, tempV.x);

      // Smooth step fade at the top/bottom junctions of the stem
      let fade = 1.0;
      if (tempV.y < 35) {
        fade = (tempV.y - 28) / 7;
      } else if (tempV.y > 118) {
        fade = (125 - tempV.y) / 7;
      }
      fade = Math.max(0, Math.min(1, fade));

      // Calculate fluted radius (24 vertical grooves, 0.4mm deep)
      const fluteDepth = 0.4;
      const perturbedRadius = radius - fade * fluteDepth * (0.5 + 0.5 * Math.cos(24 * theta));

      // Update geometry positions
      tempV.x = perturbedRadius * Math.cos(theta);
      tempV.z = perturbedRadius * Math.sin(theta);
      position.setXYZ(i, tempV.x, tempV.y, tempV.z);
    }
  }
  latheGeo.computeVertexNormals();

  // 4. Create the Spout Geometry (Mukham / Wick Mount)
  // We model this using a deformed cylinder and align it to the rim.
  // Cylinder height: 26, top radius: 6, bottom radius: 13
  const spoutGeo = new THREE.CylinderGeometry(5.5, 12.0, 26.0, 32, 16);
  const spoutPos = spoutGeo.attributes.position;

  for (let i = 0; i < spoutPos.count; i++) {
    let x = spoutPos.getX(i);
    let y = spoutPos.getY(i); // ranges from -13 to 13
    let z = spoutPos.getZ(i);

    const t = (y + 13) / 26; // normalized vertical span from 0 (bottom) to 1 (top)

    // Bend the spout forward along the Z axis (quadratic curve)
    const bend = 11.5 * Math.pow(t, 2);
    z += bend;

    // Flatten sides for an organic "duck head" funnel silhouette
    const flattenX = 1.0 - 0.22 * Math.sin(t * Math.PI);
    x *= flattenX;

    // Flatten/tilt the top opening (t=1) to be horizontal (parallel to XZ)
    // To achieve this, compensate the vertical position based on tilt offset
    if (t > 0.4) {
      const levelFactor = (t - 0.4) * 1.66; // 0 to 1
      y -= levelFactor * z * 0.42;
    }

    spoutPos.setXYZ(i, x, y, z);
  }
  spoutGeo.computeVertexNormals();

  // 5. Position and orient 4 spouts around the bowl (90° spacing)
  const spouts = [];
  const spoutAngles = [0, Math.PI * 0.5, Math.PI, Math.PI * 1.5];
  for (let i = 0; i < spoutAngles.length; i++) {
    const angle = spoutAngles[i];
    const spout = spoutGeo.clone();
    spout.rotateX(Math.PI / 3.2);
    spout.translate(0, 150.0, 37.0);
    spout.rotateY(angle);
    spouts.push(spout);
  }

  // 6. Decorative accent ring and beadwork around the bowl
  const accentRing = new THREE.TorusGeometry(46.0, 2.0, 18, 84);
  accentRing.rotateX(Math.PI / 2);
  accentRing.translate(0, 151.8, 0);

  const beadCount = 8;
  const beadRadius = 44.5;
  const beadGeo = new THREE.SphereGeometry(2.0, 10, 10);
  const beadDetails = [];
  for (let i = 0; i < beadCount; i++) {
    const bead = beadGeo.clone();
    const angle = (i / beadCount) * Math.PI * 2;
    bead.translate(Math.cos(angle) * beadRadius, 151.8, Math.sin(angle) * beadRadius);
    beadDetails.push(bead);
  }

  // 7. Merge Lathe, spouts, ring, and bead details
  const mergedGeo = BufferGeometryUtils.mergeGeometries([latheGeo, accentRing, ...spouts, ...beadDetails], true);
  mergedGeo.computeVertexNormals();
  mergedGeo.computeBoundingBox();

  return mergedGeo;
}

/**
 * Creates a ceremonial brass oil bottle geometry.
 */
export function createBottleGeometry() {
  const profile = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(14.0, 0),
    new THREE.Vector2(14.5, 14),
    new THREE.Vector2(16.0, 24),
    new THREE.Vector2(15.0, 40),
    new THREE.Vector2(12.0, 62),
    new THREE.Vector2(11.0, 92),
    new THREE.Vector2(12.0, 118),
    new THREE.Vector2(11.5, 134),
    new THREE.Vector2(8.0, 144),
    new THREE.Vector2(5.0, 152),
    new THREE.Vector2(4.0, 160),
    new THREE.Vector2(4.0, 170),
    new THREE.Vector2(0, 170)
  ];
  const bottle = new THREE.LatheGeometry(profile, 56);
  bottle.computeVertexNormals();
  bottle.translate(0, 14, 0);
  return bottle;
}

/**
 * Creates a polished wooden matchbox with sliding lid.
 */
export function createMatchboxGeometry() {
  const base = new THREE.BoxGeometry(70, 18, 46);
  const lid  = new THREE.BoxGeometry(70, 10, 46);
  base.translate(0, 9, 0);
  lid.translate(0, 23, 0);
  const group = new THREE.BufferGeometry();
  // Return both geometries separately using a convenience object in app.js
  return { base, lid };
}

/**
 * Creates a single matchstick geometry.
 */
export function createMatchstickGeometry() {
  const stick = new THREE.CylinderGeometry(1.8, 1.8, 86, 12);
  stick.translate(0, 43, 0);
  const head = new THREE.SphereGeometry(3.5, 10, 10);
  head.translate(0, 86, 0);
  const merged = BufferGeometryUtils.mergeGeometries([stick, head], true);
  merged.computeVertexNormals();
  return merged;
}

/**
 * Creates a ceremonial wax candle geometry.
 */
export function createCandleGeometry() {
  const wax = new THREE.CylinderGeometry(12.0, 12.0, 96.0, 32, 1, true);
  wax.translate(0, 48, 0);
  const wick = new THREE.CylinderGeometry(0.9, 0.9, 16.0, 8);
  wick.translate(0, 97, 0);
  const merged = BufferGeometryUtils.mergeGeometries([wax, wick], true);
  merged.computeVertexNormals();
  return merged;
}

/**
 * Creates a tall curved glass panel for the final AI reveal.
 */
export function createRevealPanelGeometry() {
  const geometry = new THREE.PlaneGeometry(220, 340, 32, 1);
  geometry.translate(0, 170, -80);
  return geometry;
}

/**
 * Creates the Stage Platform geometry.
 * A twisted, slightly tapered cylinder bent forward.
 * Retains its baseline forward translation; rotating the parent Mesh around the Y-axis
 * will swing it into alignment with the respective spout.
 */
export function createWickGeometry() {
  // Height: 26, Radius: 3.5 at bottom, 2.0 at top.
  const wickGeo = new THREE.CylinderGeometry(2.0, 3.5, 26.0, 16, 32);
  const position = wickGeo.attributes.position;
  const tempV = new THREE.Vector3();

  for (let i = 0; i < position.count; i++) {
    tempV.fromBufferAttribute(position, i);

    // Height parameter: t goes from 0 (base) to 1 (tip)
    const t = (tempV.y + 13) / 26;

    // 1. Tapering
    const scale = 1.0 - 0.35 * t;

    // 2. Apply helical twist (4 full twists around Y-axis)
    const twistAngle = t * Math.PI * 8.0;
    const xNew = (tempV.x * Math.cos(twistAngle) - tempV.z * Math.sin(twistAngle)) * scale;
    const zNew = (tempV.x * Math.sin(twistAngle) + tempV.z * Math.cos(twistAngle)) * scale;

    // 3. Add high-frequency cotton thread noise
    const noiseX = 0.25 * Math.sin(tempV.y * 3.5) * Math.cos(tempV.x * 6.0);
    const noiseZ = 0.25 * Math.cos(tempV.y * 3.5) * Math.sin(tempV.z * 6.0);

    tempV.x = xNew + noiseX;
    tempV.z = zNew + noiseZ;

    // 4. Bend the wick forward to align with the tilted spout angle
    tempV.z += 4.5 * Math.pow(t, 1.8);

    position.setXYZ(i, tempV.x, tempV.y, tempV.z);
  }

  wickGeo.computeVertexNormals();

  // Position the wick inside the spout tip.
  // The spout tip lies at z=53.5, y=161.5.
  // Move the center of the wick (length 26) so the bottom is inside the spout, and the top projects out.
  wickGeo.translate(0, 164.5, 52.5);

  return wickGeo;
}

/**
 * Creates the Stage Platform geometry.
 * A flat octagonal platform with beveled edges.
 */
export function createStageGeometry() {
  // Radius: 420mm, Height: 12mm, 8 segments (Octagonal)
  const stageGeo = new THREE.CylinderGeometry(400, 410, 12, 8);
  
  // Translate down so its top surface sits exactly at Y=0
  stageGeo.translate(0, -6, 0);
  
  // Rotate by 22.5 degrees so the flat edges face the camera beautifully
  stageGeo.rotateY(Math.PI / 8);
  
  return stageGeo;
}

/**
 * Creates the backdrop wall plane geometry.
 * Sits at z = -180 and covers the entire background.
 */
export function createBackdropGeometry() {
  const backdropGeo = new THREE.PlaneGeometry(1800, 1200);
  // Position it behind the lamp and shift it up so it stands vertically
  backdropGeo.translate(0, 400, -180);
  return backdropGeo;
}
