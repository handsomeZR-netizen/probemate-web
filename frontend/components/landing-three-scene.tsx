"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

export function LandingThreeScene() {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return undefined;
    }
    const hostElement: HTMLDivElement = host;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    hostElement.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(0, 0, 11);

    const root = new THREE.Group();
    scene.add(root);

    const nodeColors = [0x2d7a7f, 0xd79b3f, 0xb8555f, 0x5b6f91];
    const nodeGeometry = new THREE.SphereGeometry(0.075, 18, 18);
    const nodes: THREE.Mesh[] = [];
    const nodePositions: THREE.Vector3[] = [];

    for (let ring = 0; ring < 3; ring += 1) {
      const radius = 1.45 + ring * 1.15;
      const count = 18 + ring * 10;
      for (let i = 0; i < count; i += 1) {
        const angle = (i / count) * Math.PI * 2 + ring * 0.32;
        const z = Math.sin(angle * 2 + ring) * 0.65 + (ring - 1) * 0.08;
        const position = new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius * 0.72, z);
        nodePositions.push(position);
        const material = new THREE.MeshBasicMaterial({ color: nodeColors[(i + ring) % nodeColors.length] });
        const node = new THREE.Mesh(nodeGeometry, material);
        node.position.copy(position);
        node.userData.phase = angle + ring;
        root.add(node);
        nodes.push(node);
      }
    }

    const lineVertices: number[] = [];
    for (let i = 0; i < nodePositions.length; i += 1) {
      const current = nodePositions[i];
      const next = nodePositions[(i + 1) % nodePositions.length];
      lineVertices.push(current.x, current.y, current.z, next.x, next.y, next.z);
      if (i % 4 === 0) {
        const jump = nodePositions[(i + 11) % nodePositions.length];
        lineVertices.push(current.x, current.y, current.z, jump.x, jump.y, jump.z);
      }
    }
    const lineGeometry = new THREE.BufferGeometry();
    lineGeometry.setAttribute("position", new THREE.Float32BufferAttribute(lineVertices, 3));
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0x86a8ad, transparent: true, opacity: 0.26 });
    const lines = new THREE.LineSegments(lineGeometry, lineMaterial);
    root.add(lines);

    const particleCount = 140;
    const particlePositions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 2.2 + Math.random() * 3.6;
      particlePositions[i * 3] = Math.cos(angle) * radius;
      particlePositions[i * 3 + 1] = Math.sin(angle) * radius * 0.58;
      particlePositions[i * 3 + 2] = (Math.random() - 0.5) * 2.4;
    }
    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute("position", new THREE.BufferAttribute(particlePositions, 3));
    const particles = new THREE.Points(
      particleGeometry,
      new THREE.PointsMaterial({ color: 0xf2d28c, size: 0.025, transparent: true, opacity: 0.5 })
    );
    root.add(particles);

    const pointer = new THREE.Vector2(0, 0);
    function handlePointerMove(event: PointerEvent) {
      const rect = hostElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
      pointer.y = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
    }
    window.addEventListener("pointermove", handlePointerMove);

    function resize() {
      const width = Math.max(1, hostElement.clientWidth);
      const height = Math.max(1, hostElement.clientHeight);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      const scale = width < 760 ? 0.72 : 1;
      root.scale.setScalar(scale);
    }
    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(hostElement);

    let frame = 0;
    let animationId = 0;
    function animate() {
      frame += 0.01;
      root.rotation.y += (pointer.x * 0.18 - root.rotation.y) * 0.025;
      root.rotation.x += (-pointer.y * 0.09 - root.rotation.x) * 0.025;
      particles.rotation.z -= 0.0012;
      lines.rotation.z += 0.0007;
      nodes.forEach((node, index) => {
        const pulse = 1 + Math.sin(frame * 2.2 + node.userData.phase) * 0.16;
        node.scale.setScalar(pulse * (index % 9 === 0 ? 1.7 : 1));
      });
      renderer.render(scene, camera);
      animationId = window.requestAnimationFrame(animate);
    }
    animate();

    return () => {
      window.cancelAnimationFrame(animationId);
      resizeObserver.disconnect();
      window.removeEventListener("pointermove", handlePointerMove);
      hostElement.removeChild(renderer.domElement);
      nodeGeometry.dispose();
      nodes.forEach((node) => {
        const material = node.material;
        if (Array.isArray(material)) {
          material.forEach((item) => item.dispose());
        } else {
          material.dispose();
        }
      });
      lineGeometry.dispose();
      lineMaterial.dispose();
      particleGeometry.dispose();
      const particleMaterial = particles.material;
      if (Array.isArray(particleMaterial)) {
        particleMaterial.forEach((item) => item.dispose());
      } else {
        particleMaterial.dispose();
      }
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={hostRef}
      className="pointer-events-none absolute inset-0"
      aria-hidden="true"
    />
  );
}
