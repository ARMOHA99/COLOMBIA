import * as THREE from '/vendor/three.module.js';
let pendingLogoUrl = '';
let setActiveLogo = null;

export function setBackgroundLogo(url) {
  pendingLogoUrl = url || '';
  if (setActiveLogo) setActiveLogo(pendingLogoUrl);
}
export function initBackground(canvas) {
  if (!canvas) return () => {};
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: 'low-power' });
  } catch {
    canvas.style.display = 'none';
    return () => {};
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
  renderer.setSize(window.innerWidth, window.innerHeight, false);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 200);
  camera.position.set(0, 0, 30);

  const COUNT = reduced ? 350 : Math.min(1500, Math.floor((window.innerWidth * window.innerHeight) / 900));
  const positions = new Float32Array(COUNT * 3);
  const speeds = new Float32Array(COUNT);
  for (let i = 0; i < COUNT; i += 1) {
    const r = 14 + Math.random() * 26;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.55;
    positions[i * 3 + 2] = r * Math.cos(phi) * 0.7;
    speeds[i] = 0.15 + Math.random() * 0.5;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const material = new THREE.PointsMaterial({
    color: 0xd4af37,
    size: 0.16,
    transparent: true,
    opacity: 0.75,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true
  });

  const particles = new THREE.Points(geometry, material);
  scene.add(particles);

  const emblemGroup = new THREE.Group();
  const emblem = new THREE.Mesh(
    new THREE.IcosahedronGeometry(6.4, 1),
    new THREE.MeshBasicMaterial({ color: 0xd4af37, wireframe: true, transparent: true, opacity: 0.11 })
  );
  const emblemCore = new THREE.Mesh(
    new THREE.IcosahedronGeometry(3.1, 0),
    new THREE.MeshBasicMaterial({ color: 0x10b981, wireframe: true, transparent: true, opacity: 0.07 })
  );
  emblemGroup.add(emblem, emblemCore);
  emblemGroup.position.set(6, -2, -6);
  scene.add(emblemGroup);

    let logoMesh = null;
  let logoToken = 0;
  const textureLoader = new THREE.TextureLoader();

  function clearLogo() {
    if (!logoMesh) return;
    scene.remove(logoMesh);
    logoMesh.geometry.dispose();
    logoMesh.material.map.dispose();
    logoMesh.material.dispose();
    logoMesh = null;
  }

  function setLogo(url) {
    logoToken += 1;
    const token = logoToken;
    if (!url) {
      clearLogo();
      emblemGroup.visible = true;
      ring.visible = true;
      if (reduced) renderer.render(scene, camera);
      return;
    }
    textureLoader.load(
      url,
      (tex) => {
        if (token !== logoToken) {
          tex.dispose();
          return;
        }
        clearLogo();
        tex.colorSpace = THREE.SRGBColorSpace;
        const img = tex.image;
        const k = 22 / Math.max(img.width, img.height);
        logoMesh = new THREE.Mesh(
          new THREE.PlaneGeometry(img.width * k, img.height * k),
          new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.5, depthWrite: false })
        );
        logoMesh.position.set(0, 0, -12);
        scene.add(logoMesh);
        emblemGroup.visible = false;
        ring.visible = false;
        if (reduced) renderer.render(scene, camera);
      },
      undefined,
      () => {}
    );
  }

  setActiveLogo = setLogo;
  if (pendingLogoUrl) setLogo(pendingLogoUrl);

  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  const onPointer = (e) => {
    mouse.tx = (e.clientX / window.innerWidth - 0.5) * 2;
    mouse.ty = (e.clientY / window.innerHeight - 0.5) * 2;
  };
  if (!reduced) window.addEventListener('pointermove', onPointer, { passive: true });

  const onResize = () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight, false);
  };
  window.addEventListener('resize', onResize);

  let raf = 0;
  let running = true;
  const clock = new THREE.Clock();

  function frame() {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    if (document.hidden) return;
    const t = clock.getElapsedTime();

    if (!reduced) {
      mouse.x += (mouse.tx - mouse.x) * 0.045;
      mouse.y += (mouse.ty - mouse.y) * 0.045;
      camera.position.x = mouse.x * 3.4;
      camera.position.y = -mouse.y * 2.2;
      camera.lookAt(0, 0, 0);

      particles.rotation.y = t * 0.026;
      particles.rotation.x = Math.sin(t * 0.12) * 0.06;
      emblemGroup.rotation.y = t * 0.14;
      emblemGroup.rotation.x = t * 0.08;
      ring.rotation.z = t * 0.1;
      material.opacity = 0.62 + Math.sin(t * 0.9) * 0.14;
            if (logoMesh) {
        logoMesh.rotation.y = Math.sin(t * 0.35) * 0.4;
        logoMesh.position.y = Math.sin(t * 0.6) * 0.8;
        logoMesh.material.opacity = 0.5 + Math.sin(t * 0.9) * 0.06;
      }
    }

    renderer.render(scene, camera);
  }

  if (reduced) {
    renderer.render(scene, camera);
  } else {
    frame();
  }

  const onVisibility = () => {
    if (!document.hidden && running && !reduced) {
      cancelAnimationFrame(raf);
      frame();
    }
  };
  document.addEventListener('visibilitychange', onVisibility);

  return function dispose() {
    running = false;
    cancelAnimationFrame(raf);
    window.removeEventListener('pointermove', onPointer);
    window.removeEventListener('resize', onResize);
    document.removeEventListener('visibilitychange', onVisibility);
    setActiveLogo = null;
    clearLogo();
    geometry.dispose();
    material.dispose();
    emblem.geometry.dispose();
    emblem.material.dispose();
    emblemCore.geometry.dispose();
    emblemCore.material.dispose();
    ring.geometry.dispose();
    ring.material.dispose();
    renderer.dispose();
  };
}
