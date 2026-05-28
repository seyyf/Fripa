import { useEffect, useRef } from 'react';
import * as THREE from 'three';

// Decorative warm "dust motes" drifting behind the field. Capped pixel ratio,
// modest particle count, paused when the tab is hidden. Render nothing — and
// run nothing — when disabled (reduced motion or calm mode).
export function AmbientLayer({ enabled }: { enabled: boolean }) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!enabled) return;
    const mount = mountRef.current;
    if (!mount) return;

    const width = mount.clientWidth || window.innerWidth;
    const height = mount.clientHeight || window.innerHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(70, width / height, 0.1, 100);
    camera.position.z = 6;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(width, height);
    mount.appendChild(renderer.domElement);

    const COUNT = 110;
    const positions = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 14;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 10;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 6;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      color: new THREE.Color('#d4a017'),
      size: 0.09,
      transparent: true,
      opacity: 0.5,
    });
    const points = new THREE.Points(geometry, material);
    scene.add(points);

    let raf = 0;
    let running = true;
    const animate = () => {
      if (!running) return;
      points.rotation.y += 0.0008;
      points.rotation.x += 0.0004;
      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    };
    animate();

    const onVisibility = () => {
      running = document.visibilityState === 'visible';
      if (running) animate();
      else cancelAnimationFrame(raf);
    };
    document.addEventListener('visibilitychange', onVisibility);

    const onResize = () => {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('resize', onResize);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
  }, [enabled]);

  if (!enabled) return null;
  return <div className="ambient-layer" ref={mountRef} aria-hidden="true" />;
}
