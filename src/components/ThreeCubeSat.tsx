/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Team: COSMIC ERA // ORBITRA 2026 // MMMUT Gorakhpur
 */

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

interface ThreeCubeSatProps {
  roll: number;   // degrees
  pitch: number;  // degrees
  yaw: number;    // degrees
  gx?: number;    // Gyro X in °/s
  gy?: number;    // Gyro Y in °/s
  gz?: number;    // Gyro Z in °/s
  isSynced?: boolean;
}

export const ThreeCubeSat: React.FC<ThreeCubeSatProps> = ({
  roll,
  pitch,
  yaw,
  gx = 0,
  gy = 0,
  gz = 0,
  isSynced = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeView, setActiveView] = useState<'ISO' | 'TOP' | 'NADIR' | 'SOLAR'>('SOLAR');
  const [syncEnabled, setSyncEnabled] = useState<boolean>(isSynced);

  // References to keep Three.js instances persistent across React re-renders
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const satGroupRef = useRef<THREE.Group | null>(null);
  const targetCamPosRef = useRef<THREE.Vector3>(new THREE.Vector3(3.2, 2.2, 4.0));
  const targetEulerRef = useRef<{ x: number; y: number; z: number }>({ x: 0, y: 0, z: 0 });

  // Initialize Three.js scene once
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const width = container.clientWidth || 400;
    const height = container.clientHeight || 260;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
    camera.position.set(3.2, 2.2, 4.0);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'low-power',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    rendererRef.current = renderer;
    container.appendChild(renderer.domElement);

    // Ambient & directional lighting
    const ambientLight = new THREE.AmbientLight(0x38bdf8, 0.6);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight1.position.set(5, 8, 6);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x22d3ee, 0.8);
    dirLight2.position.set(-5, -4, -4);
    scene.add(dirLight2);

    // Orbital reference ring (tilted purple/blue ring as in screenshot)
    const ringGeo = new THREE.RingGeometry(2.3, 2.34, 64);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x818cf8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.45,
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = Math.PI / 2.3;
    ringMesh.rotation.y = Math.PI / 6;
    scene.add(ringMesh);

    // Inner orbital dashed ring
    const innerRingGeo = new THREE.RingGeometry(1.8, 1.82, 64);
    const innerRingMat = new THREE.MeshBasicMaterial({
      color: 0x22d3ee,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.3,
    });
    const innerRing = new THREE.Mesh(innerRingGeo, innerRingMat);
    innerRing.rotation.x = Math.PI / 2.6;
    scene.add(innerRing);

    // Group for satellite attitude rotation
    const satGroup = new THREE.Group();
    satGroupRef.current = satGroup;
    scene.add(satGroup);

    // 1U CubeSat Chassis (1.2 x 1.2 x 1.2)
    const bodyGeo = new THREE.BoxGeometry(1.2, 1.2, 1.2);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x090f1d,
      roughness: 0.35,
      metalness: 0.85,
    });
    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    satGroup.add(bodyMesh);

    // Chassis wireframe edges (cyan glow)
    const edgesGeo = new THREE.EdgesGeometry(bodyGeo);
    const edgesMat = new THREE.LineBasicMaterial({
      color: 0x22d3ee,
      linewidth: 2,
    });
    const wireframeMesh = new THREE.LineSegments(edgesGeo, edgesMat);
    satGroup.add(wireframeMesh);

    // Solar Panel Arrays (left & right deployed wings)
    const panelGeo = new THREE.BoxGeometry(1.1, 0.04, 1.1);
    const solarMat = new THREE.MeshStandardMaterial({
      color: 0x1e3a8a,
      emissive: 0x1d4ed8,
      emissiveIntensity: 0.25,
      roughness: 0.2,
      metalness: 0.9,
    });

    // Left solar wing
    const leftWing = new THREE.Mesh(panelGeo, solarMat);
    leftWing.position.set(-1.25, 0, 0);
    satGroup.add(leftWing);

    const leftWingEdges = new THREE.LineSegments(
      new THREE.EdgesGeometry(panelGeo),
      new THREE.LineBasicMaterial({ color: 0x60a5fa })
    );
    leftWingEdges.position.copy(leftWing.position);
    satGroup.add(leftWingEdges);

    // Right solar wing (with wireframe grid)
    const rightWing = new THREE.Mesh(panelGeo, solarMat);
    rightWing.position.set(1.25, 0, 0);
    satGroup.add(rightWing);

    const rightWingEdges = new THREE.LineSegments(
      new THREE.EdgesGeometry(panelGeo),
      new THREE.LineBasicMaterial({ color: 0x60a5fa })
    );
    rightWingEdges.position.copy(rightWing.position);
    satGroup.add(rightWingEdges);

    // Solar panel cell grid overlay lines
    const gridHelper = new THREE.GridHelper(1.0, 4, 0x38bdf8, 0x1d4ed8);
    gridHelper.position.set(1.25, 0.03, 0);
    satGroup.add(gridHelper);

    const gridHelperLeft = new THREE.GridHelper(1.0, 4, 0x38bdf8, 0x1d4ed8);
    gridHelperLeft.position.set(-1.25, 0.03, 0);
    satGroup.add(gridHelperLeft);

    // Optical payload / Nadir lens port (blue cylinder on bottom)
    const lensGeo = new THREE.CylinderGeometry(0.3, 0.35, 0.2, 24);
    const lensMat = new THREE.MeshStandardMaterial({
      color: 0x2563eb,
      metalness: 0.9,
      roughness: 0.1,
    });
    const lens = new THREE.Mesh(lensGeo, lensMat);
    lens.position.set(0, -0.65, 0);
    satGroup.add(lens);

    // Coordinate Axes Needles
    const axesLength = 1.6;
    // X axis (Red)
    const xAxisGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(axesLength, 0, 0),
    ]);
    satGroup.add(new THREE.Line(xAxisGeo, new THREE.LineBasicMaterial({ color: 0xef4444 })));

    // Y axis (Green)
    const yAxisGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, axesLength, 0),
    ]);
    satGroup.add(new THREE.Line(yAxisGeo, new THREE.LineBasicMaterial({ color: 0x10b981 })));

    // Z axis (Cyan/Blue)
    const zAxisGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, axesLength),
    ]);
    satGroup.add(new THREE.Line(zAxisGeo, new THREE.LineBasicMaterial({ color: 0x22d3ee })));

    // Animation frame loop
    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);

      // Smooth camera position interpolation
      if (cameraRef.current) {
        cameraRef.current.position.lerp(targetCamPosRef.current, 0.08);
        cameraRef.current.lookAt(0, 0, 0);
      }

      // Smooth satellite attitude rotation interpolation
      if (satGroupRef.current) {
        satGroupRef.current.rotation.x = THREE.MathUtils.lerp(
          satGroupRef.current.rotation.x,
          targetEulerRef.current.x,
          0.25
        );
        satGroupRef.current.rotation.y = THREE.MathUtils.lerp(
          satGroupRef.current.rotation.y,
          targetEulerRef.current.y,
          0.25
        );
        satGroupRef.current.rotation.z = THREE.MathUtils.lerp(
          satGroupRef.current.rotation.z,
          targetEulerRef.current.z,
          0.25
        );
      }

      // Render
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };
    animate();

    // Resize handler
    const handleResize = () => {
      if (!containerRef.current || !rendererRef.current || !cameraRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    return () => {
      cancelAnimationFrame(animId);
      resizeObserver.disconnect();
      if (rendererRef.current && rendererRef.current.domElement) {
        rendererRef.current.domElement.remove();
        rendererRef.current.dispose();
      }
    };
  }, []);

  // Update attitude rotation from telemetry
  useEffect(() => {
    if (!syncEnabled) return;
    // Standard aerospace convention:
    // Roll around X, Pitch around Y, Yaw around Z
    const rollRad = (roll * Math.PI) / 180;
    const pitchRad = (pitch * Math.PI) / 180;
    const yawRad = (yaw * Math.PI) / 180;

    targetEulerRef.current = {
      x: pitchRad,
      y: yawRad,
      z: -rollRad,
    };
  }, [roll, pitch, yaw, syncEnabled]);

  // Handle camera view presets
  const handleViewChange = (view: 'ISO' | 'TOP' | 'NADIR' | 'SOLAR') => {
    setActiveView(view);
    if (!targetCamPosRef.current) return;

    switch (view) {
      case 'ISO':
        targetCamPosRef.current.set(3.4, 2.5, 3.4);
        break;
      case 'TOP':
        targetCamPosRef.current.set(0.01, 5.0, 0.01);
        break;
      case 'NADIR':
        targetCamPosRef.current.set(0.01, -4.8, 0.01);
        break;
      case 'SOLAR':
        targetCamPosRef.current.set(3.5, 0.8, 3.2);
        break;
    }
  };

  return (
    <div className="relative w-full h-[270px] bg-[#070e1c]/80 rounded-xl border border-cyan-500/20 overflow-hidden flex flex-col justify-between">
      {/* Top Overlay Header */}
      <div className="px-3 py-2 flex items-center justify-between z-10 bg-gradient-to-b from-[#070e1c]/90 to-transparent">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          <span className="text-[11px] font-mono tracking-wider font-semibold text-cyan-300">
            3D ATTITUDE DIGITAL TWIN
          </span>
          <span className="text-[9px] font-mono bg-cyan-950/80 text-cyan-400 border border-cyan-500/30 px-1.5 py-0.5 rounded">
            TELEMETRY SYNCED
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-emerald-950/70 border border-emerald-500/30 px-2 py-0.5 rounded-full">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-[10px] font-mono font-medium text-emerald-300">
              NOMINAL ORBITAL STABILITY
            </span>
          </div>

          <div className="text-[9px] font-mono text-slate-400 tracking-wider">
            <span className="text-red-400">X: ROLL</span>{' '}
            <span className="text-emerald-400">Y: PITCH</span>{' '}
            <span className="text-cyan-400">Z: YAW</span>
          </div>
        </div>
      </div>

      {/* Three.js Canvas Mount */}
      <div ref={containerRef} className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Bottom Camera View Controls */}
      <div className="relative z-10 px-3 py-1.5 flex items-center justify-center gap-1 bg-[#060b14]/70 border-t border-cyan-500/10 backdrop-blur-sm">
        {(['ISO', 'TOP', 'NADIR', 'SOLAR'] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => handleViewChange(v)}
            className={`px-3 py-1 text-[10px] font-mono tracking-wider font-medium rounded transition-colors ${
              activeView === v
                ? 'bg-cyan-500 text-slate-950 font-bold shadow-[0_0_10px_rgba(34,211,238,0.4)]'
                : 'text-slate-400 hover:text-cyan-300 hover:bg-cyan-950/50'
            }`}
          >
            {v}
          </button>
        ))}

        <div className="w-[1px] h-3 bg-slate-700 mx-1" />

        <button
          type="button"
          onClick={() => setSyncEnabled(!syncEnabled)}
          className={`px-2.5 py-1 text-[10px] font-mono font-medium rounded transition-colors ${
            syncEnabled
              ? 'bg-cyan-950 border border-cyan-400/60 text-cyan-300'
              : 'bg-slate-900 border border-slate-700 text-slate-500'
          }`}
        >
          {syncEnabled ? 'SYNC ON' : 'SYNC PAUSED'}
        </button>
      </div>
    </div>
  );
};
