const ICONS = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  bag: '<path d="M6 7h12l1.5 13a1 1 0 0 1-1 1H5.5a1 1 0 0 1-1-1L6 7Z"/><path d="M9 10V6a3 3 0 0 1 6 0v4"/>',
  receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z"/><path d="M9 8h6M9 12h6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
  leaf: '<path d="M5 19c0-8 6-13 14-13 0 8-5 14-13 14"/><path d="M5 19c3-3 6-5 10-7"/>',
  coins: '<ellipse cx="12" cy="7" rx="7" ry="3"/><path d="M5 7v5c0 1.7 3.1 3 7 3s7-1.3 7-3V7"/><path d="M5 12v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5"/>',
  cart: '<circle cx="9" cy="20" r="1.5"/><circle cx="17" cy="20" r="1.5"/><path d="M3 4h2l2.5 11h10L20 7H6.5"/>',
  shield: '<path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3Z"/><path d="M9 12l2 2 4-4"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  medal: '<circle cx="12" cy="14" r="5"/><path d="M8 3l2.5 6M16 3l-2.5 6"/><path d="m12 11 .9 1.9 2 .3-1.5 1.4.4 2-1.8-1-1.8 1 .4-2L9 13.2l2-.3L12 11Z"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.2a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.2a1.7 1.7 0 0 0 1 1.5h.1a1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1a1.7 1.7 0 0 0 1.5 1h.2a2 2 0 1 1 0 4h-.2a1.7 1.7 0 0 0-1.5 1Z"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  logout: '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/><path d="M10 17l-5-5 5-5"/><path d="M5 12h11"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6"/><path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13"/><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>',
  edit: '<path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17v3Z"/><path d="M14.5 6.5 17.5 9.5"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  check: '<path d="m5 13 4 4L19 7"/>',
  alert: '<path d="M12 3 2.5 20h19L12 3Z"/><path d="M12 9v5M12 17.5v.5"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/>',
  sync: '<path d="M20 12a8 8 0 1 1-2.3-5.7"/><path d="M20 4v5h-5"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="m4 18 5-5 4 4 3-3 4 4"/>',
  chevron: '<path d="m9 6 6 6-6 6"/>',
  play: '<path d="M7 5v14l12-7L7 5Z"/>',
  box: '<path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z"/><path d="M4 7.5 12 12l8-4.5M12 12v9"/>',
  star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3Z"/>',
  refresh: '<path d="M3 12a9 9 0 0 1 15.5-6.2M21 12a9 9 0 0 1-15.5 6.2"/><path d="M18 3v4h-4M6 21v-4h4"/>'
};

export function icon(name, size = 18) {
  const body = ICONS[name] || ICONS.box;
  return `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs || {})) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') el.className = value;
    else if (key === 'html') el.innerHTML = value;
    else if (key === 'text') el.textContent = value;
    else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key === 'dataset') Object.assign(el.dataset, value);
    else if (key === 'style' && typeof value === 'object') Object.assign(el.style, value);
    else el.setAttribute(key, value === true ? '' : String(value));
  }
  for (const child of children.flat(4)) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return el;
}

export function toast(message, type = 'info', ms = 4200) {
  const root = document.getElementById('toasts');
  if (!root) return;
  const colors = { info: 'var(--info)', success: 'var(--emerald)', error: 'var(--danger)', warn: 'var(--warning)' };
  const node = h(
    'div',
    { class: `toast toast-${type}` },
    h('span', { class: 'toast-bar', style: { background: colors[type] || colors.info } }),
    h('span', { class: 'toast-text', text: String(message || '') })
  );
  root.appendChild(node);
  requestAnimationFrame(() => node.classList.add('show'));
  setTimeout(() => {
    node.classList.remove('show');
    setTimeout(() => node.remove(), 400);
  }, ms);
}

export function modal({ title, content, footer, wide = false, onClose } = {}) {
  const root = document.getElementById('modal-root');
  const box = h('div', { class: `modal-box glass${wide ? ' modal-wide' : ''}` });
  const overlay = h(
    'div',
    { class: 'modal-overlay' },
    box
  );

  const close = () => {
    overlay.classList.remove('show');
    setTimeout(() => overlay.remove(), 260);
    document.body.classList.remove('modal-open');
    if (onClose) onClose();
  };

  box.append(
    h(
      'div',
      { class: 'modal-head' },
      h('h3', { text: title || '' }),
      h('button', { class: 'icon-btn', html: icon('close'), onClick: close, 'aria-label': 'إغلاق' })
    ),
    h('div', { class: 'modal-body' }, content instanceof Node ? content : h('div', { html: String(content || '') }))
  );
  if (footer) box.append(h('div', { class: 'modal-foot' }, footer));

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  root.appendChild(overlay);
  document.body.classList.add('modal-open');
  requestAnimationFrame(() => overlay.classList.add('show'));
  return { el: overlay, box, close };
}

export function confirm(message, { danger = false, okText = 'تأكيد', cancelText = 'إلغاء' } = {}) {
  return new Promise((resolve) => {
    let settled = false;
    const done = (val) => {
      if (settled) return;
      settled = true;
      resolve(val);
      close();
    };
    const m = modal({
      title: 'تأكيد',
      content: h('p', { class: 'confirm-text', text: message }),
      footer: [
        h('button', { class: 'btn btn-ghost', text: cancelText, onClick: () => done(false) }),
        h('button', { class: danger ? 'btn btn-danger' : 'btn btn-gold', text: okText, onClick: () => done(true) })
      ],
      onClose: () => done(false)
    });
    const close = m.close;
  });
}

export function countUp(elm, target, { duration = 1100, decimals = 0, suffix = '', prefix = '' } = {}) {
  const to = Number(target) || 0;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    elm.textContent = `${prefix}${to.toFixed(decimals)}${suffix}`;
    return;
  }
  const start = performance.now();
  const from = Number(String(elm.textContent).replace(/[^\d.-]/g, '')) || 0;
  const step = (now) => {
    const p = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - p, 3);
    const value = from + (to - from) * eased;
    elm.textContent = `${prefix}${value.toFixed(decimals)}${suffix}`;
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

export function bindMagnetic(root = document) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  root.querySelectorAll('.magnetic, .btn, .nav-item, .stat-card').forEach((el) => {
    if (el.dataset.mag) return;
    el.dataset.mag = '1';
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width - 0.5) * 8;
      const y = ((e.clientY - r.top) / r.height - 0.5) * 8;
      el.style.transform = `translate(${x}px, ${y}px)`;
    });
    el.addEventListener('pointerleave', () => {
      el.style.transform = '';
    });
  });
}

export function skeleton(lines = 3) {
  return h(
    'div',
    { class: 'skeleton-wrap' },
    ...Array.from({ length: lines }, (_, i) => h('div', { class: 'skeleton-line', style: { width: `${90 - i * 12}%` } }))
  );
}

export function emptyState(text, iconName = 'box') {
  return h('div', { class: 'empty-state' }, h('div', { class: 'empty-icon', html: icon(iconName, 34) }), h('p', { text }));
}

export function badge(text, color = 'var(--gold)') {
  return h('span', { class: 'badge', style: { '--badge-color': color }, text: String(text) });
}

export function progressRing(percent, { size = 130, stroke = 10, label = '' } = {}) {
  const p = Math.max(0, Math.min(100, Number(percent) || 0));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (p / 100) * c;
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
  svg.classList.add('ring');
  if (p > 90) svg.classList.add('ring-glow');
  svg.innerHTML = `
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="rgba(255,255,255,0.07)" stroke-width="${stroke}"/>
    <circle class="ring-fill" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="url(#goldGrad)" stroke-width="${stroke}"
      stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c}" transform="rotate(-90 ${size / 2} ${size / 2})"/>
    <defs><linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#8a6d1f"/><stop offset="50%" stop-color="#d4af37"/><stop offset="100%" stop-color="#10b981"/>
    </linearGradient></defs>
    <text x="50%" y="50%" text-anchor="middle" dy="0.1em" class="ring-text" font-size="${size / 5}">${p}%</text>
    ${label ? `<text x="50%" y="62%" text-anchor="middle" class="ring-sub" font-size="${size / 11}">${label}</text>` : ''}
  `;
  requestAnimationFrame(() => {
    const fill = svg.querySelector('.ring-fill');
    if (fill) {
      fill.style.transition = 'stroke-dashoffset 1.4s cubic-bezier(.2,.8,.2,1)';
      fill.style.strokeDashoffset = offset;
    }
  });
  return svg;
}

export function field(label, input, hint) {
  return h(
    'label',
    { class: 'field' },
    h('span', { class: 'field-label', text: label }),
    input,
    hint ? h('span', { class: 'field-hint', text: hint }) : null
  );
}

export function input(attrs = {}) {
  return h('input', { class: 'input', ...attrs });
}

export function textarea(attrs = {}) {
  return h('textarea', { class: 'input textarea', ...attrs });
}

export function select(options = [], attrs = {}) {
  const sel = h('select', { class: 'input select', ...attrs });
  for (const opt of options) {
    const o = h('option', { value: opt.value, text: opt.label });
    if (opt.selected) o.selected = true;
    sel.appendChild(o);
  }
  return sel;
}

export function segTabs(tabs, activeId, onPick) {
  const wrap = h('div', { class: 'seg' });
  for (const tab of tabs) {
    const btn = h('button', {
      class: `seg-btn${tab.id === activeId ? ' active' : ''}`,
      text: tab.label,
      onClick: () => {
        wrap.querySelectorAll('.seg-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        onPick(tab.id);
      }
    });
    wrap.appendChild(btn);
  }
  return wrap;
}
export function applyBrandLogo(url) {
  document.querySelectorAll('.brand-mark, .login-logo, .boot-mark').forEach((el) => {
    if (!el.dataset.initials) el.dataset.initials = el.textContent;
    el.textContent = '';
    if (url) {
      el.classList.add('has-logo');
      const img = document.createElement('img');
      img.src = url;
      img.alt = '';
      el.appendChild(img);
    } else {
      el.classList.remove('has-logo');
      el.textContent = el.dataset.initials;
    }
  });
}
