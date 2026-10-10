import * as THREE from '/vendor/three.module.js';
import { modal, icon } from './ui.js';

export function openPreview({ imageUrl = '', name = '' } = {}) {
  const holder = document.createElement('div');
  holder.className = 'preview3d';
  holder.innerHTML = '<canvas></canvas>';

  const hint = document.createElement('div');
  hint.className = 'preview3d-hint';
  hint.textContent = 'اسحب للتدوير • عجلة الفأرة للتقريب';
  holder.appendChild(hint);

  const m = modal({
    title: name || 'معاينة ثلاثية الأبعاد',
    content: holder,
    wide: true,
    onClose: () => dispose()
  });

  const canvas = holder.querySelector('canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 0, 5.2);

  scene.add(new THREE.AmbientLight(0xffffff, 1.1));
  const key = new THREE.DirectionalLight(0xfff2c9, 1.6);
  key.position.set(4, 6, 8);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x10b981, 0.7);
  rim.position.set(-6, -3, -4);
  scene.add(rim);

  const group = new THREE.Group();
  scene.add(group);

  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xd4af37,
    metalness: 0.85,
    roughness: 0.28
  });
  const edgeMat = new THREE.LineBasicMaterial({ color: 0xf0d67a, transparent: true, opacity: 0.5 });
  const box = new THREE.Mesh(new THREE.BoxGeometry(3, 2, 0.22, 1, 1, 1), goldMat);
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(box.geometry), edgeMat);
  group.add(box, edges);

  if (imageUrl) {
    new THREE.TextureLoader().load(
      imageUrl,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        const aspect = tex.image && tex.image.width ? tex.image.width / tex.image.height : 1.5;
        const w = 3;
        const hgt = w / aspect;
        const face = new THREE.Mesh(
          new THREE.PlaneGeometry(w * 0.96, hgt * 0.96),
          new THREE.MeshBasicMaterial({ map: tex, transparent: true })
        );
        face.position.z = 0.125;
        group.add(face);
        const back = face.clone();
        back.position.z = -0.125;
        back.rotation.y = Math.PI;
        group.add(back);
        box.material = new THREE.MeshStandardMaterial({
          color: 0x141518,
          metalness: 0.6,
          roughness: 0.5,
          transparent: true,
          opacity: 0.92
        });
      },
      undefined,
      () => {}
    );
  }

  const sparkle = new THREE.Mesh(
    new THREE.TorusGeometry(2.3, 0.02, 8, 90),
    new THREE.MeshBasicMaterial({ color: 0x10b981, transparent: true, opacity: 0.55 })
  );
  sparkle.rotation.x = Math.PI / 2.6;
  scene.add(sparkle);

  function resize() {
    const rect = holder.getBoundingClientRect();
    const w = Math.max(320, rect.width);
    const h = Math.max(240, rect.height);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(holder);

  const rot = { x: -0.18, y: 0.5, tx: 0.5, ty: -0.18, dist: 5.2, tdist: 5.2 };
  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  const down = (e) => {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
  };
  const move = (e) => {
    if (!dragging) return;
    rot.ty += (e.clientX - lastX) * 0.008;
    rot.tx += (e.clientY - lastY) * 0.006;
    rot.tx = Math.max(-1.2, Math.min(1.2, rot.tx));
    lastX = e.clientX;
    lastY = e.clientY;
  };
  const up = () => {
    dragging = false;
  };
  const wheel = (e) => {
    e.preventDefault();
    rot.tdist = Math.max(3, Math.min(9, rot.tdist + e.deltaY * 0.004));
  };

  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointerleave', up);
  canvas.addEventListener('wheel', wheel, { passive: false });

  let raf = 0;
  let alive = true;
  let auto = 0;
  function loop() {
    if (!alive) return;
    raf = requestAnimationFrame(loop);
    if (document.hidden) return;
    if (!dragging) auto += 0.0045;
    rot.y += (rot.ty + auto - rot.y) * 0.08;
    rot.x += (rot.tx - rot.x) * 0.08;
    rot.dist += (rot.tdist - rot.dist) * 0.09;
    group.rotation.y = rot.y;
    group.rotation.x = rot.x;
    camera.position.z = rot.dist;
    sparkle.rotation.z += 0.004;
    renderer.render(scene, camera);
  }
  loop();

  function dispose() {
    if (!alive) return;
    alive = false;
    cancelAnimationFrame(raf);
    ro.disconnect();
    canvas.removeEventListener('pointerdown', down);
    canvas.removeEventListener('pointermove', move);
    canvas.removeEventListener('pointerup', up);
    canvas.removeEventListener('pointerleave', up);
    canvas.removeEventListener('wheel', wheel);
    scene.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach((mat) => {
          if (mat.map) mat.map.dispose();
          mat.dispose();
        });
      }
    });
    renderer.dispose();
  }

  return m;
}

export function previewButton(label, data) {
  const btn = document.createElement('button');
  btn.className = 'btn btn-ghost btn-sm';
  btn.innerHTML = `${icon('box', 15)}<span>${label}</span>`;
  btn.addEventListener('click', () => openPreview(data));
  return btn;
}
