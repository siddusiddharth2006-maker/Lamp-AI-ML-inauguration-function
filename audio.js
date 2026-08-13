/**
 * Web Audio API synthesizer for procedural ceremonial audio.
 * Zero external asset dependencies, lightweight, and zero latency.
 */
export class CeremonialAudio {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.ambientDrone = null;
    this.flameHiss = null;
    this.flameHissGain = null;
    this.bgAudioElement = null;
    this.bgSource = null;
    this.bgGain = null;
    this.droneGain = null;
    
    this.isMuted = false;
    this.isInitialized = false;
    this.proximityFactor = 0.0; // 0 (far) to 1 (touching wick)
    
    // Interval for procedural crackle pops
    this.crackleTimer = null;
  }

  /**
   * Initializes the AudioContext (must be called from a user interaction gesture)
   */
  init(silent = false) {
    if (this.isInitialized) return;

    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContextClass();
      
      // Master gain node
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(silent ? 0 : 0.85, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
      
      this.isMuted = silent;
      this.isInitialized = true;

      // Start the core sound components
      this.setupAmbientDrone();
      this.setupFlameHiss();
      this.startAmbientBellMotif();
      this.startCrackleLoop();

      // If a background audio element was registered before init, connect it now
      if (this.bgAudioElement) this._connectBackgroundElement();
    } catch (e) {
      console.warn("Failed to initialize Web Audio API:", e);
    }
  }

  /**
   * Register a background audio file (relative path) to play as looped background.
   * Use from `app.js` after user consent, for example:
   *   audioController.setBackgroundTrack('bg_music.mp3')
   */
  setBackgroundTrack(srcPath) {
    // Stop and remove existing element if present
    if (this.bgAudioElement) {
      try { this.bgAudioElement.pause(); } catch (e) {}
      this.bgAudioElement = null;
    }

    const audio = document.createElement('audio');
    audio.src = srcPath;
    audio.loop = true;
    audio.preload = 'auto';
    this.bgAudioElement = audio;

    // If audio context already initialized, connect immediately
    if (this.isInitialized) this._connectBackgroundElement();
  }

  _connectBackgroundElement() {
    if (!this.bgAudioElement || !this.ctx) return;

    // Make sure AudioContext is running
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().then(() => {
        console.log("AudioContext resumed successfully.");
      }).catch(err => {
        console.warn("Failed to resume AudioContext:", err);
      });
    }

    // Create / reuse gain node for background track (boosted to 0.85 for loud clear music)
    if (!this.bgGain) this.bgGain = this.ctx.createGain();
    this.bgGain.gain.setValueAtTime(0.85, this.ctx.currentTime);
    this.bgGain.connect(this.masterGain);

    // Create media element source and connect
    try {
      if (this.bgSource) {
        try { this.bgSource.disconnect(); } catch (e) {}
        this.bgSource = null;
      }
      this.bgSource = this.ctx.createMediaElementSource(this.bgAudioElement);
      this.bgSource.connect(this.bgGain);

      console.log("Background track loaded and connected. Attempting playback...");
      // Attempt to start playback (requires user gesture; init usually called on gesture)
      const playPromise = this.bgAudioElement.play();
      if (playPromise && playPromise.catch) {
        playPromise.then(() => {
          console.log("Background audio playback started successfully.");
        }).catch((e) => {
          console.error("Playback failed or was blocked by browser autoplay policy:", e);
        });
      }
      // Fade the procedural ambient drone down for a smoother mix
      try {
        if (this.droneGain) {
          // Smooth 3-second fade to a very low level
          this.droneGain.gain.cancelScheduledValues(this.ctx.currentTime);
          this.droneGain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 3.0);
        }
      } catch (e) {
        // ignore if automation isn't available
      }
    } catch (e) {
      console.warn('Background track connection failed:', e);
    }
  }

  /**
   * Set background audio volume directly (0.0 to 1.0)
   */
  setBackgroundVolume(vol = 0.85) {
    if (this.bgGain && this.ctx) {
      this.bgGain.gain.linearRampToValueAtTime(vol, this.ctx.currentTime + 0.1);
    }
  }

  /**
   * Set master mute state
   */
  setMute(mute) {
    this.isMuted = mute;
    if (!this.isInitialized) return;

    const targetGain = mute ? 0 : 0.85;
    this.masterGain.gain.linearRampToValueAtTime(targetGain, this.ctx.currentTime + 0.1);
    // Also pause/resume background HTML audio element for consistency
    if (this.bgAudioElement) {
      try {
        if (mute) this.bgAudioElement.pause();
        else this.bgAudioElement.play().catch(() => {});
      } catch (e) {}
    }
  }

  /**
   * Resumes AudioContext if suspended (browser security)
   */
  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  /**
   * Synthesizes a deep resonant background drone (temple bell humming atmosphere)
   */
  setupAmbientDrone() {
    const now = this.ctx.currentTime;
    this.droneGain = this.ctx.createGain();
    this.droneGain.gain.setValueAtTime(0.08, now); // soft background volume
    this.droneGain.connect(this.masterGain);

    // Ritual ambient soundscape: deep organ pad plus soft metallic shimmer.
    const baseChord = [55, 110, 165, 220]; // A1, A2, E3, A3
    const volumes = [0.45, 0.32, 0.22, 0.16];

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(900, now);
    filter.Q.setValueAtTime(1.1, now);
    filter.connect(droneGain);

    baseChord.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const oscGain = this.ctx.createGain();

      osc.type = idx === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq, now);

      const detune = this.ctx.createOscillator();
      const detuneGain = this.ctx.createGain();
      detune.frequency.value = 0.015 + idx * 0.005;
      detuneGain.gain.value = idx * 1.2;
      detune.connect(detuneGain);
      detuneGain.connect(osc.detune);
      detune.start(now);

      const volLfo = this.ctx.createOscillator();
      const volLfoGain = this.ctx.createGain();
      volLfo.frequency.value = 0.04 + idx * 0.01;
      volLfoGain.gain.value = volumes[idx] * 0.18;
      volLfo.connect(volLfoGain);
      volLfoGain.connect(oscGain.gain);
      volLfo.start(now);

      oscGain.gain.setValueAtTime(volumes[idx] * 0.22, now);
      osc.connect(oscGain);
      oscGain.connect(filter);
      osc.start(now);
    });

    // Add subtle metallic shimmer layer for ceremony
    const shimmerOsc = this.ctx.createOscillator();
    shimmerOsc.type = 'triangle';
    shimmerOsc.frequency.setValueAtTime(660, now);
    const shimmerGain = this.ctx.createGain();
    shimmerGain.gain.setValueAtTime(0.012, now);
    shimmerOsc.connect(shimmerGain);
    shimmerGain.connect(this.droneGain);
    shimmerOsc.start(now);

    const shimmerFilter = this.ctx.createBiquadFilter();
    shimmerFilter.type = 'bandpass';
    shimmerFilter.frequency.setValueAtTime(1200, now);
    shimmerFilter.Q.setValueAtTime(3.4, now);
    shimmerGain.connect(shimmerFilter);
    shimmerFilter.connect(this.droneGain);
  }

  startAmbientBellMotif() {
    // Disabled piano/bell tones per user request
    return;
  }

  /**
   * Updates flame hiss volume based on flame scale (0 to 1)
   */
  updateFlameHissVolume(scale) {
    if (!this.isInitialized) return;
    const now = this.ctx.currentTime;
    // Map scale to hiss volume (subtle, max 0.08)
    const targetGain = scale * 0.08;
    this.flameHissGain.gain.setTargetAtTime(targetGain, now, 0.1);
  }

  /**
   * Updates cursor proximity to wick to drive expectance crackling rate/volume
   */
  updateProximity(factor) {
    this.proximityFactor = Math.max(0, Math.min(1, factor));
  }

  /**
   * Procedural Crackle loop.
   * Generates organic click/pop sounds when cursor is near or when lamp is lit.
   */
  startCrackleLoop() {
    const triggerPop = () => {
      if (this.isMuted || !this.isInitialized) {
        this.crackleTimer = setTimeout(triggerPop, 100);
        return;
      }

      // Proximity range + small base crackle if lamp is lit (proximityFactor will be set to 0.4 by app post-ignition)
      const currentProximity = this.proximityFactor;
      if (currentProximity > 0.02) {
        const now = this.ctx.currentTime;
        
        // Synthesize single micro-spark crackle
        const popGain = this.ctx.createGain();
        popGain.gain.setValueAtTime(0, now);
        // Peak volume scales with proximity
        const maxVol = (0.01 + Math.random() * 0.035) * currentProximity;
        popGain.gain.linearRampToValueAtTime(maxVol, now + 0.001);
        popGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.004 + Math.random() * 0.012);

        // Bandpass filter to isolate high frequency ticks
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(1200 + Math.random() * 1500, now);
        filter.Q.setValueAtTime(6.0, now);

        // Simple short click oscillator
        const osc = this.ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(100 + Math.random() * 800, now);

        osc.connect(filter);
        filter.connect(popGain);
        popGain.connect(this.masterGain);
        
        osc.start(now);
        osc.stop(now + 0.03);
      }

      // Crackle frequency (interval between pops) is randomized and density depends on proximity
      const nextInterval = 40 + Math.random() * (400 - this.proximityFactor * 350);
      this.crackleTimer = setTimeout(triggerPop, nextInterval);
    };

    triggerPop();
  }

  /**
   * Plays a loud, clear fire ignition sound on each wick ignition.
   * Two layered noise bands: a low whoosh sweep + a mid crackle burst.
   * Connects directly to ctx.destination (bypasses masterGain attenuation)
   * so the fire sound is always clearly audible regardless of drone/bg levels.
   */
  triggerIgnitionWhoosh() {
    if (!this.isInitialized) return;

    // Resume context if browser suspended it
    if (this.ctx.state === 'suspended') this.ctx.resume();

    const now = this.ctx.currentTime;
    const sampleRate = this.ctx.sampleRate;

    // ── Layer 1: Low rumble & whoosh sweep ──────────────────────────
    const bufSize1 = Math.floor(1.8 * sampleRate);
    const noiseBuf1 = this.ctx.createBuffer(1, bufSize1, sampleRate);
    const data1 = noiseBuf1.getChannelData(0);
    for (let i = 0; i < bufSize1; i++) data1[i] = Math.random() * 2 - 1;

    const noise1 = this.ctx.createBufferSource();
    noise1.buffer = noiseBuf1;

    const filter1 = this.ctx.createBiquadFilter();
    filter1.type = 'lowpass';
    filter1.frequency.setValueAtTime(120, now);
    filter1.frequency.exponentialRampToValueAtTime(700, now + 0.30);
    filter1.frequency.exponentialRampToValueAtTime(200, now + 1.0);

    const gain1 = this.ctx.createGain();
    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(0.85, now + 0.10);  // sharp attack
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + 1.6);

    noise1.connect(filter1);
    filter1.connect(gain1);
    gain1.connect(this.ctx.destination);  // direct to speakers — always audible

    noise1.start(now);
    noise1.stop(now + 1.7);

    // ── Layer 2: Mid crackle burst (body of the fire catching) ──────
    const bufSize2 = Math.floor(0.8 * sampleRate);
    const noiseBuf2 = this.ctx.createBuffer(1, bufSize2, sampleRate);
    const data2 = noiseBuf2.getChannelData(0);
    for (let i = 0; i < bufSize2; i++) data2[i] = Math.random() * 2 - 1;

    const noise2 = this.ctx.createBufferSource();
    noise2.buffer = noiseBuf2;

    const filter2 = this.ctx.createBiquadFilter();
    filter2.type = 'bandpass';
    filter2.frequency.setValueAtTime(800, now);
    filter2.frequency.exponentialRampToValueAtTime(2200, now + 0.2);
    filter2.Q.value = 1.8;

    const gain2 = this.ctx.createGain();
    gain2.gain.setValueAtTime(0, now);
    gain2.gain.linearRampToValueAtTime(0.55, now + 0.05);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.75);

    noise2.connect(filter2);
    filter2.connect(gain2);
    gain2.connect(this.ctx.destination);

    noise2.start(now);
    noise2.stop(now + 0.8);

    // ── Layer 3: Sustained flame hiss after ignition ─────────────────
    const bufSize3 = Math.floor(1.2 * sampleRate);
    const noiseBuf3 = this.ctx.createBuffer(1, bufSize3, sampleRate);
    const data3 = noiseBuf3.getChannelData(0);
    for (let i = 0; i < bufSize3; i++) data3[i] = Math.random() * 2 - 1;

    const noise3 = this.ctx.createBufferSource();
    noise3.buffer = noiseBuf3;

    const filter3 = this.ctx.createBiquadFilter();
    filter3.type = 'highpass';
    filter3.frequency.setValueAtTime(3000, now + 0.1);

    const gain3 = this.ctx.createGain();
    gain3.gain.setValueAtTime(0, now + 0.1);
    gain3.gain.linearRampToValueAtTime(0.30, now + 0.4);
    gain3.gain.exponentialRampToValueAtTime(0.0001, now + 1.3);

    noise3.connect(filter3);
    filter3.connect(gain3);
    gain3.connect(this.ctx.destination);

    noise3.start(now + 0.1);
    noise3.stop(now + 1.4);
  }

  /**
   * Helper to trigger a single sharp spark click
   */
  triggerSparkClick(time) {
    // Disabled sine tone spark click per user request
    return;
  }

  /**
   * Plays a beautiful physical chime using additive sine wave synthesis.
   * Simulates a rich, premium bell toll.
   */
  playBell(freq, duration, volume) {
    // Disabled piano/bell tones per user request
    return;
  }

  /**
   * Triggers a gorgeous orchestral bell cascade — full 9-bell golden chord.
   * Called on final (9th) wick ignition.
   */
  triggerCelebrationChimes() {
    // Disabled piano/bell tones per user request
    return;
  }

  /**
   * Triggers a milestone-scaled chime for each wick ignition.
   * wickNumber: 1 (first wick lit) → 9 (all lit)
   * Each milestone is richer and brighter than the last.
   */
  triggerMilestoneChime(wickNumber) {
    // Disabled piano/bell tones per user request
    return;
  }

  /**
   * Updates the volume of the persistent flame hiss based on how many wicks are burning.
   * scale: 0.0 – 1.0 (fraction of burning progress)
   */
  updateFlameHissVolume(scale) {
    if (!this.isInitialized || !this.flameHissGain) return;
    const now = this.ctx.currentTime;
    const targetGain = scale * 0.09; // subtle, slightly louder with 9 wicks
    this.flameHissGain.gain.setTargetAtTime(targetGain, now, 0.15);
  }

  /**
   * Plays sound effect for AI & ML Department Name in specified style:
   * 'gong' | 'cyber' | 'shankh' | 'cinematic'
   */
  playDepartmentRevealSound(style = 'gong') {
    if (!this.isInitialized || this.isMuted) return;

    switch (style) {
      case 'cyber':
        this.playCyberStyle();
        break;
      case 'shankh':
        this.playShankhStyle();
        break;
      case 'cinematic':
        this.playCinematicStyle();
        break;
      case 'gong':
      default:
        this.playGongStyle();
        break;
    }
  }

  /**
   * Style 1: Sacred Temple Gong & Reverberation (Deep ceremonial resonance)
   */
  playGongStyle() {
    const now = this.ctx.currentTime;
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(70.0, now);
    osc1.frequency.exponentialRampToValueAtTime(65.0, now + 4.0);

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(141.5, now);
    osc2.frequency.exponentialRampToValueAtTime(138.0, now + 4.0);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(450, now);
    filter.frequency.exponentialRampToValueAtTime(120, now + 4.0);

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.55, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 4.2);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 4.3);
    osc2.stop(now + 4.3);
  }

  /**
   * Style 2: Futuristic AI Sci-Fi Cyber Pulse (Ascending energy rise & shimmer)
   */
  playCyberStyle() {
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 1.2);

    filter.type = 'bandpass';
    filter.Q.value = 4.5;
    filter.frequency.setValueAtTime(200, now);
    filter.frequency.exponentialRampToValueAtTime(2200, now + 1.2);

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.35, now + 0.9);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.5);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 2.6);

    setTimeout(() => {
      if (!this.ctx) return;
      const subTime = this.ctx.currentTime;
      const subOsc = this.ctx.createOscillator();
      const subGain = this.ctx.createGain();
      subOsc.type = 'sine';
      subOsc.frequency.setValueAtTime(110, subTime);
      subOsc.frequency.exponentialRampToValueAtTime(45, subTime + 1.2);

      subGain.gain.setValueAtTime(0.45, subTime);
      subGain.gain.exponentialRampToValueAtTime(0.0001, subTime + 1.3);

      subOsc.connect(subGain);
      subGain.connect(this.masterGain);
      subOsc.start(subTime);
      subOsc.stop(subTime + 1.4);
    }, 900);
  }

  /**
   * Style 3: Sacred Shankh / Ceremonial Conch Swell
   */
  playShankhStyle() {
    const now = this.ctx.currentTime;
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(165.0, now);
    osc1.frequency.linearRampToValueAtTime(174.6, now + 1.5);

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(247.5, now);
    osc2.frequency.linearRampToValueAtTime(261.6, now + 1.5);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(280, now);
    filter.frequency.linearRampToValueAtTime(850, now + 1.2);
    filter.frequency.exponentialRampToValueAtTime(200, now + 3.5);

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.42, now + 0.8);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 3.8);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 3.9);
    osc2.stop(now + 3.9);
  }

  /**
   * Style 4: Grand Fanfare & Cinematic Sub Impact
   */
  playCinematicStyle() {
    const now = this.ctx.currentTime;

    const impactOsc = this.ctx.createOscillator();
    const impactGain = this.ctx.createGain();
    impactOsc.type = 'sine';
    impactOsc.frequency.setValueAtTime(130, now);
    impactOsc.frequency.exponentialRampToValueAtTime(35, now + 0.8);

    impactGain.gain.setValueAtTime(0.60, now);
    impactGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.8);

    impactOsc.connect(impactGain);
    impactGain.connect(this.masterGain);
    impactOsc.start(now);
    impactOsc.stop(now + 1.9);

    const freqs = [146.83, 220.00, 369.99];
    freqs.forEach((f, idx) => {
      const osc = this.ctx.createOscillator();
      const gainNode = this.ctx.createGain();
      const filterNode = this.ctx.createBiquadFilter();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, now);

      filterNode.type = 'lowpass';
      filterNode.frequency.setValueAtTime(300, now);
      filterNode.frequency.exponentialRampToValueAtTime(1200, now + 0.6);
      filterNode.frequency.exponentialRampToValueAtTime(250, now + 3.0);

      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(0.25 - idx * 0.04, now + 0.35 + idx * 0.08);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 3.2);

      osc.connect(filterNode);
      filterNode.connect(gainNode);
      gainNode.connect(this.masterGain);

      osc.start(now + idx * 0.05);
      osc.stop(now + 3.3);
    });
  }
}
