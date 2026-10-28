/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * COSMIC ERA // ORBITRA 2026 // MMMUT Gorakhpur
 * Interactive 3D Space-Themed Launch Interface & Warp Transition
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import {
  Satellite,
  Radio,
  Compass,
  Zap,
  Volume2,
  VolumeX,
  Play,
  ArrowRight,
  Sparkles,
  Layers,
  Activity,
  Globe,
  RotateCw,
} from 'lucide-react';
import { ConnectionState, ConnectionMode } from '../types/telemetry';

interface SpaceIntro3DProps {
  onEnterHUD: () => void;
  connectionState: ConnectionState;
  connectionMode: ConnectionMode;
  onConnectSerial?: () => void;
  onToggleDemo?: () => void;
}

export const SpaceIntro3D: React.FC<SpaceIntro3DProps> = ({
  onEnterHUD,
  connectionState,
  connectionMode,
  onConnectSerial,
  onToggleDemo,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isWarping, setIsWarping] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(true);
  const [warpProgress, setWarpProgress] = useState<number>(0);
  const [interactiveMode, setInteractiveMode] = useState<'inspect' | 'orbit'>('inspect');
  const [satelliteRotationSpeed, setSatelliteRotationSpeed] = useState<number>(1);

  // Audio synthesis refs (zero-dependency Web Audio API)
  const audioCtxRef = useRef<AudioContext | null>(null);
  const droneOscRef = useRef<OscillatorNode | null>(null);
  const droneGainRef = useRef<GainNode | null>(null);

  // Three.js object references
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const starsRef = useRef<THREE.Points | null>(null);
  const starVelocitiesRef = useRef<Float32Array | null>(null);
  const satGroupRef = useRef<THREE.Group | null>(null);
  const earthGroupRef = useRef<THREE.Group | null>(null);
  const thrustersRef = useRef<THREE.Points | null>(null);
  const orbitRingsRef = useRef<THREE.Group | null>(null);

  // Mouse & interaction state
  const mouseRef = useRef<{ x: number; y: number; targetX: number; targetY: number }>({
    x: 0,
    y: 0,
    targetX: 0,
    targetY: 0,
  });
  const isDraggingRef = useRef<boolean>(false);
  const prevMousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const satManualEulerRef = useRef<{ x: number; y: number }>({ x: 0.3, y: 0.8 });
  const warpStartTimeRef = useRef<number | null>(null);

  // Initialize Web Audio ambient deep space drone & atmospheric soundscape
  const initAudio = useCallback(() => {
    try {
      if (audioCtxRef.current) return;
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioContextClass();
      audioCtxRef.current = ctx;

      // Ambient deep-space binaural pulse (two detuned sine waves creating 0.6 Hz cosmic pulse)
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const droneGain = ctx.createGain();
      const droneFilter = ctx.createBiquadFilter();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(46.0, ctx.currentTime); // Low F#1
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(46.6, ctx.currentTime); // Slight 0.6Hz binaural beat

      droneFilter.type = 'lowpass';
      droneFilter.frequency.setValueAtTime(140, ctx.currentTime);

      droneGain.gain.setValueAtTime(isMuted ? 0 : 0.07, ctx.currentTime);

      osc1.connect(droneFilter);
      osc2.connect(droneFilter);
      droneFilter.connect(droneGain);
      droneGain.connect(ctx.destination);

      osc1.start();
      osc2.start();

      droneOscRef.current = osc1;
      droneGainRef.current = droneGain;
    } catch {
      // Audio might be blocked until user interaction
    }
  }, [isMuted]);

  const toggleSound = () => {
    if (!audioCtxRef.current) {
      initAudio();
    }
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (droneGainRef.current && audioCtxRef.current) {
      droneGainRef.current.gain.setTargetAtTime(nextMuted ? 0 : 0.07, audioCtxRef.current.currentTime, 0.1);
    }
  };

  // Play cinematic deep space / warp transition audio
  const playWarpSFX = () => {
    if (isMuted || !audioCtxRef.current) return;
    try {
      const ctx = audioCtxRef.current;
      const now = ctx.currentTime;

      // Layer 1: Sub-bass warp drive thrum (deep atmospheric engine rumble)
      const subOsc = ctx.createOscillator();
      const subGain = ctx.createGain();
      const subFilter = ctx.createBiquadFilter();

      subOsc.type = 'triangle';
      subOsc.frequency.setValueAtTime(60, now);
      subOsc.frequency.exponentialRampToValueAtTime(32, now + 1.2);

      subFilter.type = 'lowpass';
      subFilter.frequency.setValueAtTime(120, now);

      subGain.gain.setValueAtTime(0.001, now);
      subGain.gain.linearRampToValueAtTime(0.25, now + 0.3);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + 1.3);

      subOsc.connect(subFilter);
      subFilter.connect(subGain);
      subGain.connect(ctx.destination);

      subOsc.start(now);
      subOsc.stop(now + 1.4);

      // Layer 2: Cosmic solar-wind / nebula resonant sweep (sweeping bandpass sound)
      const bufferSize = ctx.sampleRate * 1.4;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }
      const whiteNoise = ctx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;

      const bandpass = ctx.createBiquadFilter();
      bandpass.type = 'bandpass';
      bandpass.Q.setValueAtTime(6.0, now);
      bandpass.frequency.setValueAtTime(260, now);
      bandpass.frequency.exponentialRampToValueAtTime(1800, now + 0.7);
      bandpass.frequency.exponentialRampToValueAtTime(400, now + 1.3);

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.001, now);
      noiseGain.gain.linearRampToValueAtTime(0.18, now + 0.4);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 1.35);

      whiteNoise.connect(bandpass);
      bandpass.connect(noiseGain);
      noiseGain.connect(ctx.destination);

      whiteNoise.start(now);
      whiteNoise.stop(now + 1.4);

      // Layer 3: Celestial chime / pulsar harmonics (ethereal cosmic chime)
      const chimeFreqs = [587.3, 880.0, 1174.6]; // D5, A5, D6 harmonic chord
      chimeFreqs.forEach((freq, idx) => {
        const chimeOsc = ctx.createOscillator();
        const chimeGain = ctx.createGain();
        chimeOsc.type = 'sine';
        chimeOsc.frequency.setValueAtTime(freq, now + idx * 0.12);

        chimeGain.gain.setValueAtTime(0.0001, now + idx * 0.12);
        chimeGain.gain.linearRampToValueAtTime(0.07, now + idx * 0.12 + 0.05);
        chimeGain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.12 + 0.9);

        chimeOsc.connect(chimeGain);
        chimeGain.connect(ctx.destination);

        chimeOsc.start(now + idx * 0.12);
        chimeOsc.stop(now + idx * 0.12 + 1.0);
      });

      // Layer 4: Satellite telemetry carrier lock-on ping
      const pingOsc = ctx.createOscillator();
      const pingGain = ctx.createGain();
      pingOsc.type = 'sine';
      pingOsc.frequency.setValueAtTime(1760, now + 0.85); // A6 ping
      pingOsc.frequency.setValueAtTime(2349, now + 0.95); // D7 harmonic ping

      pingGain.gain.setValueAtTime(0.0001, now + 0.85);
      pingGain.gain.linearRampToValueAtTime(0.09, now + 0.88);
      pingGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.25);

      pingOsc.connect(pingGain);
      pingGain.connect(ctx.destination);
      pingOsc.start(now + 0.85);
      pingOsc.stop(now + 1.3);
    } catch {
      // Audio playback fallback
    }
  };

  // Launch transition trigger
  const handleLaunchTransition = useCallback(() => {
    if (isWarping) return;
    setIsWarping(true);
    warpStartTimeRef.current = performance.now();
    playWarpSFX();

    // After warp duration, transition to main telemetry HUD
    setTimeout(() => {
      if (audioCtxRef.current && droneOscRef.current) {
        try {
          droneOscRef.current.stop();
        } catch {
          // Ignore
        }
      }
      onEnterHUD();
    }, 1250);
  }, [isWarping, onEnterHUD]);

  // Build Three.js 3D Scene
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    // 1. Scene
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x040814, 0.012);
    sceneRef.current = scene;

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    camera.position.set(0, 1.5, 6.2);
    cameraRef.current = camera;

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    renderer.setClearColor(0x040711, 1);
    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 4. Lighting
    const ambientLight = new THREE.AmbientLight(0x0f2038, 1.4);
    scene.add(ambientLight);

    // Sun directional light (intense warm white solar illumination)
    const sunLight = new THREE.DirectionalLight(0xfff5e6, 3.2);
    sunLight.position.set(12, 8, 10);
    scene.add(sunLight);

    // Atmospheric Earth cyan bounce light from below
    const earthBounceLight = new THREE.DirectionalLight(0x00e5ff, 1.6);
    earthBounceLight.position.set(-6, -10, -4);
    scene.add(earthBounceLight);

    // Accent magenta rim light
    const rimLight = new THREE.PointLight(0xa855f7, 2.5, 30);
    rimLight.position.set(-8, 5, -5);
    scene.add(rimLight);

    // 5. Starfield Generation (3,500 particles with depth & velocity)
    const starCount = 3500;
    const starGeo = new THREE.BufferGeometry();
    const starPositions = new Float32Array(starCount * 3);
    const starColors = new Float32Array(starCount * 3);
    const starVelocities = new Float32Array(starCount);

    const colorPalette = [
      new THREE.Color(0x00e5ff), // cyan
      new THREE.Color(0xffffff), // pure white
      new THREE.Color(0xa78bfa), // violet
      new THREE.Color(0x38bdf8), // light sky blue
      new THREE.Color(0xfef08a), // warm star yellow
    ];

    for (let i = 0; i < starCount; i++) {
      const i3 = i * 3;
      // Spread stars in a deep volumetric cylinder around the camera path
      const radius = 2 + Math.random() * 45;
      const theta = Math.random() * Math.PI * 2;
      starPositions[i3] = Math.cos(theta) * radius;
      starPositions[i3 + 1] = Math.sin(theta) * radius;
      starPositions[i3 + 2] = (Math.random() - 0.5) * 120; // Z depth

      const c = colorPalette[Math.floor(Math.random() * colorPalette.length)];
      starColors[i3] = c.r;
      starColors[i3 + 1] = c.g;
      starColors[i3 + 2] = c.b;

      starVelocities[i] = 0.2 + Math.random() * 0.8;
    }

    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    starGeo.setAttribute('color', new THREE.BufferAttribute(starColors, 3));
    starVelocitiesRef.current = starVelocities;

    // Star point texture with soft circular radial gradient
    const starCanvas = document.createElement('canvas');
    starCanvas.width = 32;
    starCanvas.height = 32;
    const sCtx = starCanvas.getContext('2d');
    if (sCtx) {
      const grad = sCtx.createRadialGradient(16, 16, 0, 16, 16, 16);
      grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
      grad.addColorStop(0.3, 'rgba(100, 220, 255, 0.9)');
      grad.addColorStop(0.7, 'rgba(30, 100, 220, 0.3)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      sCtx.fillStyle = grad;
      sCtx.fillRect(0, 0, 32, 32);
    }
    const starTexture = new THREE.CanvasTexture(starCanvas);

    const starMat = new THREE.PointsMaterial({
      size: 0.45,
      map: starTexture,
      transparent: true,
      blending: THREE.AdditiveBlending,
      vertexColors: true,
      depthWrite: false,
    });

    const starPoints = new THREE.Points(starGeo, starMat);
    scene.add(starPoints);
    starsRef.current = starPoints;

    // 6. Earth & Atmosphere Sphere (Below in Low Earth Orbit)
    const earthGroup = new THREE.Group();
    earthGroup.position.set(0, -28, -8);
    scene.add(earthGroup);
    earthGroupRef.current = earthGroup;

    // Earth surface sphere
    const earthRadius = 24;
    const earthGeo = new THREE.SphereGeometry(earthRadius, 64, 48);

    // Procedural Earth surface canvas with oceans and continents
    const earthCanvas = document.createElement('canvas');
    earthCanvas.width = 1024;
    earthCanvas.height = 512;
    const eCtx = earthCanvas.getContext('2d');
    if (eCtx) {
      // Deep ocean base
      eCtx.fillStyle = '#06162d';
      eCtx.fillRect(0, 0, 1024, 512);

      // Continent shapes simulation
      eCtx.fillStyle = '#0f384c';
      for (let i = 0; i < 40; i++) {
        const cx = Math.random() * 1024;
        const cy = 100 + Math.random() * 312;
        const r = 40 + Math.random() * 100;
        eCtx.beginPath();
        eCtx.arc(cx, cy, r, 0, Math.PI * 2);
        eCtx.fill();
      }

      // City light clusters on night side
      eCtx.fillStyle = '#fbbf24';
      for (let i = 0; i < 300; i++) {
        const lx = Math.random() * 1024;
        const ly = 120 + Math.random() * 270;
        eCtx.fillRect(lx, ly, 1.5, 1.5);
      }
    }
    const earthTexture = new THREE.CanvasTexture(earthCanvas);

    const earthMat = new THREE.MeshStandardMaterial({
      map: earthTexture,
      roughness: 0.7,
      metalness: 0.1,
      color: 0x2266aa,
    });
    const earthMesh = new THREE.Mesh(earthGeo, earthMat);
    earthGroup.add(earthMesh);

    // Atmospheric limb glow layer
    const atmoGeo = new THREE.SphereGeometry(earthRadius + 0.35, 64, 48);
    const atmoMat = new THREE.MeshBasicMaterial({
      color: 0x00e5ff,
      transparent: true,
      opacity: 0.28,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
    });
    const atmoMesh = new THREE.Mesh(atmoGeo, atmoMat);
    earthGroup.add(atmoMesh);

    // Outer faint blue airglow halo
    const haloGeo = new THREE.SphereGeometry(earthRadius + 0.9, 48, 36);
    const haloMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.12,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
    });
    earthGroup.add(new THREE.Mesh(haloGeo, haloMat));

    // 7. Orbital Trajectory Rings & Ground Tracks
    const orbitRings = new THREE.Group();
    scene.add(orbitRings);
    orbitRingsRef.current = orbitRings;

    const orbitPathGeo = new THREE.BufferGeometry();
    const orbitPointsCount = 120;
    const orbitPts: THREE.Vector3[] = [];
    for (let i = 0; i <= orbitPointsCount; i++) {
      const a = (i / orbitPointsCount) * Math.PI * 2;
      orbitPts.push(new THREE.Vector3(Math.cos(a) * 4.8, Math.sin(a) * 0.9, Math.sin(a) * 4.8));
    }
    orbitPathGeo.setFromPoints(orbitPts);
    const orbitLineMat = new THREE.LineBasicMaterial({
      color: 0x00e5ff,
      transparent: true,
      opacity: 0.45,
    });
    const orbitLine = new THREE.Line(orbitPathGeo, orbitLineMat);
    orbitLine.rotation.x = 0.3;
    orbitLine.rotation.z = -0.2;
    orbitRings.add(orbitLine);

    // Secondary inclination ellipse
    const orbit2Geo = new THREE.BufferGeometry();
    const orbit2Pts: THREE.Vector3[] = [];
    for (let i = 0; i <= orbitPointsCount; i++) {
      const a = (i / orbitPointsCount) * Math.PI * 2;
      orbit2Pts.push(new THREE.Vector3(Math.cos(a) * 5.6, Math.sin(a) * -0.6, Math.sin(a) * 5.2));
    }
    orbit2Geo.setFromPoints(orbit2Pts);
    const orbit2Mat = new THREE.LineBasicMaterial({
      color: 0xa855f7,
      transparent: true,
      opacity: 0.3,
    });
    const orbitLine2 = new THREE.Line(orbit2Geo, orbit2Mat);
    orbitRings.add(orbitLine2);

    // 8. 3D ORBITRA-1 CubeSat Model
    const satGroup = new THREE.Group();
    satGroup.position.set(0, 0, 0);
    scene.add(satGroup);
    satGroupRef.current = satGroup;

    // Materials
    // Gold Kapton / MLI multi-layer insulation foil
    const goldKaptonMat = new THREE.MeshStandardMaterial({
      color: 0xe5a93c,
      metalness: 0.95,
      roughness: 0.22,
      emissive: 0x331c00,
      emissiveIntensity: 0.2,
    });

    // Dark space-grade anodized aluminum chassis
    const chassisMat = new THREE.MeshStandardMaterial({
      color: 0x181e28,
      metalness: 0.85,
      roughness: 0.35,
    });

    // Solar panel cells (photovoltaic silicon with blue sheen)
    const solarCanvas = document.createElement('canvas');
    solarCanvas.width = 256;
    solarCanvas.height = 256;
    const sCellCtx = solarCanvas.getContext('2d');
    if (sCellCtx) {
      sCellCtx.fillStyle = '#061329';
      sCellCtx.fillRect(0, 0, 256, 256);
      sCellCtx.strokeStyle = '#00f0ff';
      sCellCtx.lineWidth = 1.5;
      for (let x = 0; x <= 256; x += 32) {
        sCellCtx.beginPath();
        sCellCtx.moveTo(x, 0);
        sCellCtx.lineTo(x, 256);
        sCellCtx.stroke();
      }
      for (let y = 0; y <= 256; y += 32) {
        sCellCtx.beginPath();
        sCellCtx.moveTo(0, y);
        sCellCtx.lineTo(256, y);
        sCellCtx.stroke();
      }
    }
    const solarTex = new THREE.CanvasTexture(solarCanvas);
    const solarCellMat = new THREE.MeshStandardMaterial({
      map: solarTex,
      metalness: 0.7,
      roughness: 0.25,
      color: 0x00a8e8,
      emissive: 0x002844,
      emissiveIntensity: 0.35,
    });

    // CubeSat 3U Core Body (1.2 x 2.4 x 1.2)
    const bodyGeo = new THREE.BoxGeometry(1.2, 2.4, 1.2);
    const bodyMesh = new THREE.Mesh(bodyGeo, chassisMat);
    satGroup.add(bodyMesh);

    // Kapton foil patch panels on front & back faces
    const foilGeo = new THREE.BoxGeometry(1.05, 2.25, 0.04);
    const foilFront = new THREE.Mesh(foilGeo, goldKaptonMat);
    foilFront.position.z = 0.61;
    satGroup.add(foilFront);

    const foilBack = new THREE.Mesh(foilGeo, goldKaptonMat);
    foilBack.position.z = -0.61;
    satGroup.add(foilBack);

    // Aluminum frame edge rails (chassis skeleton)
    const railMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.9, roughness: 0.2 });
    const cornerOffsets = [
      [-0.6, 0, -0.6],
      [0.6, 0, -0.6],
      [-0.6, 0, 0.6],
      [0.6, 0, 0.6],
    ];
    cornerOffsets.forEach(([cx, cy, cz]) => {
      const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.45, 8), railMat);
      rail.position.set(cx, cy, cz);
      satGroup.add(rail);
    });

    // Deployable Solar Array Wings (Left & Right)
    const wingWidth = 1.6;
    const wingHeight = 2.2;
    const wingThickness = 0.05;
    const wingGeo = new THREE.BoxGeometry(wingWidth, wingHeight, wingThickness);

    // Left Solar Panel
    const leftWing = new THREE.Mesh(wingGeo, solarCellMat);
    leftWing.position.set(-1.45, 0, 0);
    satGroup.add(leftWing);

    // Left hinge connector
    const leftHinge = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.0, 8), railMat);
    leftHinge.position.set(-0.63, 0, 0);
    satGroup.add(leftHinge);

    // Right Solar Panel
    const rightWing = new THREE.Mesh(wingGeo, solarCellMat);
    rightWing.position.set(1.45, 0, 0);
    satGroup.add(rightWing);

    // Right hinge connector
    const rightHinge = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.0, 8), railMat);
    rightHinge.position.set(0.63, 0, 0);
    satGroup.add(rightHinge);

    // Nadir Earth-Observation Aperture / Camera Lens on bottom face
    const lensRing = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.32, 0.1, 24),
      new THREE.MeshStandardMaterial({ color: 0x090e17, metalness: 0.9, roughness: 0.1 })
    );
    lensRing.position.set(0, -1.25, 0);
    satGroup.add(lensRing);

    const lensGlass = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.24, 0.12, 24),
      new THREE.MeshStandardMaterial({
        color: 0x00f0ff,
        metalness: 0.9,
        roughness: 0.05,
        emissive: 0x004466,
        emissiveIntensity: 0.8,
      })
    );
    lensGlass.position.set(0, -1.26, 0);
    satGroup.add(lensGlass);

    // Telemetry Whip Antennas (Deployed from top face)
    const antennaMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff });
    const ant1 = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.4, 6), antennaMat);
    ant1.position.set(0.4, 1.8, 0.4);
    ant1.rotation.z = -0.3;
    ant1.rotation.x = 0.2;
    satGroup.add(ant1);

    const ant2 = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.4, 6), antennaMat);
    ant2.position.set(-0.4, 1.8, -0.4);
    ant2.rotation.z = 0.3;
    ant2.rotation.x = -0.2;
    satGroup.add(ant2);

    // Flashing Beacon LED on antenna tip
    const beaconGeo = new THREE.SphereGeometry(0.06, 12, 12);
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0x10b981 });
    const beaconMesh = new THREE.Mesh(beaconGeo, beaconMat);
    beaconMesh.position.set(0.6, 2.4, 0.55);
    satGroup.add(beaconMesh);

    // RCS Thruster Plumes / Attitude particles
    const thrusterGeo = new THREE.BufferGeometry();
    const thrusterCount = 40;
    const thrusterPos = new Float32Array(thrusterCount * 3);
    for (let i = 0; i < thrusterCount; i++) {
      const i3 = i * 3;
      thrusterPos[i3] = (Math.random() - 0.5) * 0.2;
      thrusterPos[i3 + 1] = -1.3 - Math.random() * 0.8;
      thrusterPos[i3 + 2] = (Math.random() - 0.5) * 0.2;
    }
    thrusterGeo.setAttribute('position', new THREE.BufferAttribute(thrusterPos, 3));
    const thrusterMat = new THREE.PointsMaterial({
      color: 0x00e5ff,
      size: 0.12,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
    });
    const thrusterPoints = new THREE.Points(thrusterGeo, thrusterMat);
    satGroup.add(thrusterPoints);
    thrustersRef.current = thrusterPoints;

    // Initial orientation
    satGroup.rotation.x = 0.35;
    satGroup.rotation.y = 0.8;
    satGroup.rotation.z = 0.1;

    // 9. Resize Handler
    const handleResize = () => {
      if (!containerRef.current || !renderer || !camera) return;
      const w = containerRef.current.clientWidth || window.innerWidth;
      const h = containerRef.current.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // 10. Animation Loop
    let animationFrameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      const elapsedTime = clock.getElapsedTime();

      // Earth rotation
      if (earthGroupRef.current) {
        earthGroupRef.current.rotation.y += delta * 0.02;
      }

      // Orbit rings subtle rotation
      if (orbitRingsRef.current) {
        orbitRingsRef.current.rotation.y += delta * 0.05;
      }

      // Beacon LED blink
      beaconMat.color.setHex(Math.sin(elapsedTime * 6) > 0.2 ? 0x10b981 : 0x034e32);

      // Mouse smooth interpolation
      mouseRef.current.x += (mouseRef.current.targetX - mouseRef.current.x) * 0.08;
      mouseRef.current.y += (mouseRef.current.targetY - mouseRef.current.y) * 0.08;

      // Satellite orientation
      if (satGroupRef.current) {
        if (!isDraggingRef.current) {
          // Automatic orbital drift + mouse parallax response
          satManualEulerRef.current.y += delta * 0.35 * satelliteRotationSpeed;
          satManualEulerRef.current.x = 0.25 + Math.sin(elapsedTime * 0.5) * 0.15;

          satGroupRef.current.rotation.x = satManualEulerRef.current.x + mouseRef.current.y * 0.4;
          satGroupRef.current.rotation.y = satManualEulerRef.current.y + mouseRef.current.x * 0.5;
          satGroupRef.current.rotation.z = Math.sin(elapsedTime * 0.8) * 0.08;

          // Gentle floating motion
          satGroupRef.current.position.y = Math.sin(elapsedTime * 1.2) * 0.12;
        } else {
          // Direct drag control
          satGroupRef.current.rotation.x = satManualEulerRef.current.x;
          satGroupRef.current.rotation.y = satManualEulerRef.current.y;
        }
      }

      // Starfield motion & Warp Drive logic
      if (starsRef.current && starVelocitiesRef.current) {
        const positions = starsRef.current.geometry.attributes.position.array as Float32Array;
        const count = starCount;

        // Check if warp transition is active
        let speedMultiplier = 1.0;
        if (warpStartTimeRef.current !== null) {
          const warpElapsed = (performance.now() - warpStartTimeRef.current) / 1000;
          const progress = Math.min(warpElapsed / 1.2, 1.0);
          setWarpProgress(progress);

          // Exponential acceleration curve
          speedMultiplier = 1.0 + Math.pow(progress * 4.5, 3.2);

          // Camera rushes forward & widens FOV
          if (cameraRef.current) {
            cameraRef.current.position.z = 6.2 - progress * 14;
            cameraRef.current.fov = 50 + progress * 40;
            cameraRef.current.updateProjectionMatrix();
          }

          // Scale satellite forward during warp
          if (satGroupRef.current) {
            satGroupRef.current.position.z = -progress * 8;
            satGroupRef.current.rotation.z += delta * 8;
          }
        }

        // Update star positions towards camera (along +Z)
        for (let i = 0; i < count; i++) {
          const i3 = i * 3;
          const speed = starVelocitiesRef.current[i] * (0.8 + speedMultiplier * 0.6);
          positions[i3 + 2] += speed * delta * 18;

          // Parallax tilt from cursor
          positions[i3] -= mouseRef.current.targetX * delta * 2.5;
          positions[i3 + 1] += mouseRef.current.targetY * delta * 2.5;

          // Wrap stars around when passing camera
          if (positions[i3 + 2] > 20) {
            positions[i3 + 2] = -100;
            const radius = 2 + Math.random() * 45;
            const theta = Math.random() * Math.PI * 2;
            positions[i3] = Math.cos(theta) * radius;
            positions[i3 + 1] = Math.sin(theta) * radius;
          }
        }
        starsRef.current.geometry.attributes.position.needsUpdate = true;
      }

      // Thruster particle plume pulse
      if (thrustersRef.current) {
        const tPositions = thrustersRef.current.geometry.attributes.position.array as Float32Array;
        for (let i = 0; i < thrusterCount; i++) {
          const i3 = i * 3;
          tPositions[i3 + 1] -= delta * 2.5;
          if (tPositions[i3 + 1] < -2.4) {
            tPositions[i3 + 1] = -1.25;
            tPositions[i3] = (Math.random() - 0.5) * 0.15;
            tPositions[i3 + 2] = (Math.random() - 0.5) * 0.15;
          }
        }
        thrustersRef.current.geometry.attributes.position.needsUpdate = true;
      }

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
    };
  }, [satelliteRotationSpeed]);

  // Pointer event listeners for interactive dragging and parallax
  const handlePointerDown = (e: React.PointerEvent) => {
    isDraggingRef.current = true;
    prevMousePosRef.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    mouseRef.current.targetX = (e.clientX / w - 0.5) * 2;
    mouseRef.current.targetY = -(e.clientY / h - 0.5) * 2;

    if (isDraggingRef.current) {
      const deltaX = e.clientX - prevMousePosRef.current.x;
      const deltaY = e.clientY - prevMousePosRef.current.y;
      prevMousePosRef.current = { x: e.clientX, y: e.clientY };

      satManualEulerRef.current.y += deltaX * 0.008;
      satManualEulerRef.current.x += deltaY * 0.008;
    }
  };

  const handlePointerUp = () => {
    isDraggingRef.current = false;
  };

  return (
    <div
      className="relative w-full h-screen overflow-hidden select-none bg-[#040711] text-slate-100 flex flex-col justify-between"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {/* Three.js 3D Viewport Background */}
      <div ref={containerRef} className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Subtle vignette & scanline grid overlay */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,rgba(4,7,17,0)_30%,rgba(4,7,17,0.85)_100%)]" />
      <div
        className="absolute inset-0 pointer-events-none opacity-20 bg-[linear-gradient(rgba(0,229,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(0,229,255,0.08)_1px,transparent_1px)]"
        style={{ backgroundSize: '60px 60px' }}
      />

      {/* Top Header Bar */}
      <header className="relative z-20 flex items-center justify-between px-6 py-5 backdrop-blur-md bg-black/30 border-b border-cyan-500/20">
        {/* Left: Team & Mission Identification */}
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-cyan-950/90 border border-cyan-400/50 flex items-center justify-center text-cyan-300 shadow-[0_0_20px_rgba(34,211,238,0.4)]">
            <Satellite className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-black text-xl tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-sky-200 to-indigo-300">
                COSMIC ERA
              </span>
              <span className="px-2 py-0.5 text-[10px] font-mono font-semibold tracking-wider bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 rounded">
                MMMUT GORAKHPUR
              </span>
              <span className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-mono font-semibold tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/40 rounded">
                DRONE & IOT CLUB
              </span>
            </div>
            <p className="text-xs font-mono tracking-widest text-slate-400 mt-0.5">
              ORBITRA 2026 // CUBESAT TELEMETRY MISSION CONTROL
            </p>
          </div>
        </div>

        {/* Right: Sound toggle, hardware status & skip to HUD */}
        <div className="flex items-center gap-3">
          {/* Mute/Sound button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleSound();
            }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-900/80 hover:bg-slate-800 text-xs font-mono text-slate-300 transition-colors shadow-sm"
            title={isMuted ? 'Unmute Deep Space Audio' : 'Mute Audio'}
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-slate-400" /> : <Volume2 className="w-4 h-4 text-cyan-400 animate-pulse" />}
            <span className="hidden sm:inline">{isMuted ? 'AUDIO OFF' : 'AUDIO ON'}</span>
          </button>

          {/* Direct hardware status indicator */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-cyan-500/30 bg-cyan-950/40 text-xs font-mono">
            <span
              className={`w-2 h-2 rounded-full ${
                connectionState === 'CONNECTED' ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-amber-400 animate-ping'
              }`}
            />
            <span className="text-cyan-200 uppercase font-semibold">
              {connectionState === 'CONNECTED' ? 'ESP32 ONLINE' : 'READY TO SYNC'}
            </span>
          </div>

          {/* Quick Skip Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleLaunchTransition();
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-mono font-bold text-xs tracking-wider transition-all shadow-[0_0_15px_rgba(6,182,212,0.5)] active:scale-95"
          >
            <span>ENTER HUD</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Middle Interactive Zone & Telemetry Teaser Overlays */}
      <div className="relative z-20 flex-1 flex flex-col items-center justify-between px-6 py-6 pointer-events-none">
        {/* Top Floating Orbit Ephemeris Badges */}
        <div className="w-full max-w-5xl flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/70 border border-cyan-500/20 backdrop-blur-md pointer-events-auto shadow-lg">
            <Globe className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-slate-400">ORBIT INCLINATION:</span>
            <span className="text-cyan-300 font-bold">51.6° LEO</span>
            <span className="text-slate-500">•</span>
            <span className="text-slate-400">ALTITUDE:</span>
            <span className="text-emerald-400 font-bold">520 KM</span>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/70 border border-purple-500/20 backdrop-blur-md pointer-events-auto shadow-lg">
            <Activity className="w-3.5 h-3.5 text-purple-400" />
            <span className="text-slate-400">TRANSMISSION:</span>
            <span className="text-purple-300 font-bold">ESP-NOW 2.4 GHz</span>
            <span className="text-slate-500">•</span>
            <span className="text-slate-400">SENSORS:</span>
            <span className="text-slate-200">DHT11 / BMP280 / MPU6050 / NEO-6M</span>
          </div>
        </div>

        {/* Center Prompt & Interactive Warp Engage Button */}
        <div className="text-center max-w-2xl flex flex-col items-center pointer-events-auto">
          {/* Pulsing Target Reticle / Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-cyan-950/80 border border-cyan-400/40 text-cyan-300 text-xs font-mono tracking-widest uppercase mb-4 shadow-[0_0_20px_rgba(6,182,212,0.3)] animate-pulse">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>Interactive 3D Spacecraft Digital Twin</span>
          </div>

          {/* Cosmic Era Title Hero with Rich Cosmic Graphics & Colors */}
          <div className="relative my-2 mb-6 flex flex-col items-center">
            {/* Ambient Cosmic Nebula Glow Backdrop */}
            <div className="absolute -inset-x-20 -inset-y-8 bg-gradient-to-r from-cyan-500/20 via-fuchsia-500/25 to-amber-400/20 blur-3xl pointer-events-none rounded-full animate-pulse" />

            {/* Orbit vector & starburst graphic header */}
            <div className="relative flex items-center justify-center gap-3 mb-2">
              <div className="h-[1px] w-12 sm:w-20 bg-gradient-to-r from-transparent via-cyan-400 to-fuchsia-400" />
              <div className="flex items-center gap-1.5 text-xs font-mono text-cyan-300 tracking-widest uppercase">
                <span className="text-fuchsia-400 animate-spin" style={{ animationDuration: '8s' }}>✦</span>
                <span className="bg-cyan-950/90 px-2 py-0.5 rounded border border-cyan-400/30 text-[10px] text-cyan-300">
                  ORBITRA'26 MISSION
                </span>
                <span className="text-cyan-400 animate-spin" style={{ animationDuration: '8s' }}>✦</span>
              </div>
              <div className="h-[1px] w-12 sm:w-20 bg-gradient-to-l from-transparent via-cyan-400 to-fuchsia-400" />
            </div>

            {/* Vibrant Cosmic Title */}
            <div className="relative flex items-center justify-center gap-3">
              {/* Left Orbit Arc Graphic */}
              <svg className="w-6 h-12 text-cyan-400 hidden sm:block opacity-75" viewBox="0 0 24 48" fill="none">
                <path d="M22 2C10 12 4 24 4 24C4 24 10 36 22 46" stroke="currentColor" strokeWidth="2" strokeDasharray="3 3" />
                <circle cx="4" cy="24" r="3" fill="#22d3ee" className="animate-ping" />
              </svg>

              <h1 className="text-4xl sm:text-6xl font-black font-mono tracking-tight bg-gradient-to-r from-cyan-300 via-teal-200 via-fuchsia-400 to-amber-300 bg-clip-text text-transparent drop-shadow-[0_0_35px_rgba(217,70,239,0.7)] select-none">
                Cosmic Era
              </h1>

              {/* Right Orbit Arc Graphic */}
              <svg className="w-6 h-12 text-fuchsia-400 hidden sm:block opacity-75" viewBox="0 0 24 48" fill="none">
                <path d="M2 2C14 12 20 24 20 24C20 24 14 36 2 46" stroke="currentColor" strokeWidth="2" strokeDasharray="3 3" />
                <circle cx="20" cy="24" r="3" fill="#e879f9" className="animate-ping" />
              </svg>
            </div>

            {/* Sub-badge Graphic with MMMUT Gorakhpur & Spacecraft ID */}
            <div className="mt-2.5 flex items-center gap-2 text-[11px] font-mono">
              <span className="text-cyan-400 font-semibold">[</span>
              <span className="text-slate-300 font-medium">MMMUT GORAKHPUR</span>
              <span className="text-slate-600">•</span>
              <span className="text-fuchsia-400 font-bold">DRONE & IOT CLUB</span>
              <span className="text-slate-600">•</span>
              <span className="text-amber-300 font-semibold">1U CUBESAT</span>
              <span className="text-cyan-400 font-semibold">]</span>
            </div>
          </div>

          {/* Primary Call-to-Action: High-Tech Glowing Launch Portal */}
          <button
            onClick={handleLaunchTransition}
            disabled={isWarping}
            className="group relative flex items-center gap-4 px-8 py-4 rounded-xl bg-gradient-to-r from-cyan-500 via-sky-400 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 text-slate-950 font-mono font-black text-sm tracking-wider uppercase shadow-[0_0_35px_rgba(6,182,212,0.6)] hover:shadow-[0_0_50px_rgba(6,182,212,0.9)] transition-all transform hover:-translate-y-0.5 active:translate-y-0 active:scale-95 border border-cyan-200/50"
          >
            <div className="w-7 h-7 rounded-lg bg-black/20 flex items-center justify-center text-black">
              <Play className="w-4 h-4 fill-black group-hover:scale-110 transition-transform" />
            </div>
            <div className="flex flex-col text-left">
              <span className="text-[11px] font-bold text-slate-900 tracking-widest uppercase leading-none">
                {isWarping ? 'WARP DRIVE ENGAGED...' : 'INITIALIZE TELEMETRY'}
              </span>
              <span className="text-base font-black tracking-wider leading-tight text-black">
                {isWarping ? 'TRANSITIONING TO HUD' : 'ENTER MISSION CONTROL'}
              </span>
            </div>
            <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1.5 transition-transform" />

            {/* Glowing animated ping ring */}
            <span className="absolute -inset-1 rounded-xl bg-cyan-400/30 blur-sm opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>

          {/* Quick Hardware / Sim Toggle Shortcuts */}
          <div className="flex flex-wrap items-center justify-center gap-4 mt-6 text-xs font-mono">
            {onConnectSerial && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onConnectSerial();
                }}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/80 hover:bg-cyan-950/80 border border-slate-700 hover:border-cyan-500/50 text-slate-300 hover:text-cyan-300 transition-all shadow"
              >
                <Radio className="w-3.5 h-3.5 text-cyan-400" />
                <span>CONNECT USB SERIAL (ESP32)</span>
              </button>
            )}

            {onToggleDemo && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleDemo();
                }}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/80 hover:bg-purple-950/80 border border-slate-700 hover:border-purple-500/50 text-slate-300 hover:text-purple-300 transition-all shadow"
              >
                <Zap className="w-3.5 h-3.5 text-purple-400" />
                <span>TOGGLE SIMULATOR [{connectionMode === 'SIM' ? 'ON' : 'OFF'}]</span>
              </button>
            )}
          </div>
        </div>

        {/* Bottom Interactive Hints & 3D Controls */}
        <div className="w-full max-w-5xl flex flex-wrap items-center justify-between gap-4 text-xs font-mono">
          <div className="flex items-center gap-3 px-3 py-1.5 rounded-lg bg-slate-900/70 border border-slate-700/60 backdrop-blur-md pointer-events-auto">
            <RotateCw className="w-3.5 h-3.5 text-cyan-400 animate-spin" style={{ animationDuration: '6s' }} />
            <span className="text-slate-400">3D MOTION:</span>
            <span className="text-slate-200">DRAG MOUSE TO ROTATE CUBESAT</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setSatelliteRotationSpeed((prev) => (prev === 1 ? 2.5 : prev === 2.5 ? 0.3 : 1));
              }}
              className="px-2.5 py-1 rounded bg-slate-900/80 border border-slate-700 hover:border-cyan-500/50 text-slate-300 hover:text-cyan-300 transition-colors pointer-events-auto text-[11px]"
            >
              SPIN SPEED: {satelliteRotationSpeed}X
            </button>
            <span className="text-slate-500">|</span>
            <span className="text-slate-400">ORBITRA'26 GROUND STATION</span>
          </div>
        </div>
      </div>

      {/* Cinematic Warp Speed Transition Overlay */}
      {isWarping && (
        <div
          className="absolute inset-0 z-50 pointer-events-none flex flex-col items-center justify-center transition-all duration-300 bg-cyan-950/30 backdrop-blur-[2px]"
          style={{ opacity: warpProgress }}
        >
          {/* Radial light burst */}
          <div
            className="w-96 h-96 rounded-full bg-cyan-400 blur-3xl opacity-40 animate-ping"
            style={{ animationDuration: '0.8s' }}
          />
          <div className="relative z-10 flex flex-col items-center">
            <div className="text-cyan-300 font-mono text-2xl font-black tracking-widest animate-pulse">
              HYPERSPACE WARP ENGAGED
            </div>
            <div className="text-xs font-mono text-slate-300 tracking-wider mt-2">
              SYNCHRONIZING GROUND STATION TELEMETRY HUD...
            </div>
            <div className="w-64 h-1.5 bg-slate-800 rounded-full overflow-hidden mt-4 border border-cyan-400/40">
              <div
                className="h-full bg-gradient-to-r from-cyan-400 to-indigo-500 transition-all duration-75"
                style={{ width: `${warpProgress * 100}%` }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
