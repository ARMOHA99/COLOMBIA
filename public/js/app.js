import { state, t, rankOrder, rankLabel } from './state.js';
import { api } from './api.js';
import * as bus from './bus.js';
import { connectSocket, disconnectSocket } from './socket-client.js';
import { h, icon, toast, bindMagnetic, modal } from './ui.js';
import { initBackground } from './three-bg.js';

const PAGE_MODULES = {
  dashboard: () => import('./pages/dashboard.js'),
  shop: () => import('./pages/shop.js'),
  orders: () => import('./pages/orders.js'),
  attendance: () => import('./pages/attendance.js'),
  operations: () => import('./pages/operations.js'),
  farm: () => import('./pages/farm.js'),
  treasury: () => import('./pages/treasury.js'),
  discipline: () => import('./pages/discipline.js'),
  tickets: () => import('./pages/tickets.js'),
  internal: () => import('./pages/internal.js'),
  leaderboard: () => import('./pages/leaderboard.js'),
  admin: () => import('./pages/admin.js')
};

const els = {};
let pageCleanup = null;
let currentPage = null;
let unsubscribers = [];

function $(id) {
  return document.getElementById(id);
}

function applyBranding() {
  const site = state.site;
  document.title = `${site.org.name} — ${site.org.tagline}`;
  document.documentElement.lang = site.locale.lang || 'ar';
  document.documentElement.dir = site.locale.dir || 'rtl';
  if (site.runtime && site.runtime.siteName) {
    document.title = `${site.runtime.siteName} — ${site.org.tagline}`;
  }
}

function showBoot() {
  $('boot').classList.remove('hide');
}
function hideBoot() {
  $('boot').classList.add('hide');
  setTimeout(() => {
    const b = $('boot');
    if (b) b.hidden = true;
  }, 700);
}

/* ---------------- login ---------------- */
function showLogin(reason) {
  disconnectSocket();
  $('app').hidden = true;
  const root = $('login-root');
  root.hidden = false;
  root.innerHTML = '';

  const site = state.site;
  const params = new URLSearchParams((location.hash.split('?')[1] || ''));
  const err = params.get('err');
  let message = reason || '';
  let tone = 'error';
  if (!message && err === 'noaccess') message = site.strings.auth.noAccess;
  else if (!message && err === 'notmember') message = site.strings.auth.notMember;
  else if (!message && err === 'banned') message = site.strings.errors.forbidden;

  const initials = (site.org.initials || site.org.name || 'CO').slice(0, 3);
  const card = h(
    'div',
    { class: 'login-card' },
    h('div', { class: 'login-logo', text: initials }),
    h('h1', { text: site.runtime && site.runtime.siteName ? site.runtime.siteName : site.org.nameAr }),
    h('p', { class: 'login-sub', text: site.org.tagline }),
    site.runtime && site.runtime.motd ? h('p', { class: 'small muted', text: site.runtime.motd }) : null,
    message ? h('div', { class: `login-alert${tone === 'warn' ? ' warn' : ''}` }, h('span', { html: icon('alert', 18) }), h('span', { text: message })) : null,
    site.configured.discord
      ? h(
          'a',
          { class: 'discord-btn', href: '/api/auth/login' },
          h('span', { html: svgDiscord() }),
          h('span', { text: site.strings.auth.loginButton })
        )
      : h('div', { class: 'login-alert warn' }, h('span', { html: icon('alert', 18) }), h('span', { text: site.strings.errors.discordDown })),
    h('p', { class: 'login-foot', text: `${site.locale.timezone} • ${site.locale.dir === 'rtl' ? 'واجهة عربية' : 'Interface'}` })
  );
  root.appendChild(card);
}

function svgDiscord() {
  return `<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.3 4.9A19.9 19.9 0 0 0 15.9 3.6c-.2.4-.5.9-.7 1.3a18.4 18.4 0 0 0-5.4 0c-.2-.4-.5-.9-.7-1.3A19.9 19.9 0 0 0 4.6 4.9C1.7 9.2.9 13.4 1.3 17.5a20 20 0 0 0 6 3c.5-.6.9-1.3 1.3-2-.7-.3-1.4-.6-2-1l.5-.4a14.3 14.3 0 0 0 12.2 0l.5.4c-.6.4-1.3.7-2 1 .4.7.8 1.4 1.3 2a20 20 0 0 0 6-3c.5-4.8-.8-9-3.5-12.6ZM8.5 15c-1.2 0-2.1-1.1-2.1-2.4S7.3 10.2 8.5 10.2s2.2 1.1 2.2 2.4S9.7 15 8.5 15Z7 15Zm7 0c-1.2 0-2.1-1.1-2.1-2.4s.9-2.4 2.1-2.4 2.2 1.1 2.2 2.4S16.7 15 15.5 15Z"/></svg>`;
}

/* ---------------- shell ---------------- */
function buildNav() {
  const list = els.navList;
  list.innerHTML = '';
  const me = state.user;
  for (const item of state.site.nav) {
    if (rankOrder(me.rank) < item.minRank) continue;
    const btn = h(
      'button',
      {
        class: 'nav-item',
        dataset: { route: item.id },
        onClick: () => {
          navigate(item.hash);
          closeDrawer();
        }
      },
      h('span', { html: icon(item.icon, 19) }),
      h('span', { text: item.label })
    );
    list.appendChild(btn);
  }
}

function updateUserChip() {
  const u = state.user;
  if (!u) return;
  const rank = state.site.ranks[u.rank] || {};
  els.userChip.innerHTML = '';
  els.userChip.append(
    h('img', { src: u.avatar, alt: '' }),
    h('span', { class: 'chip-name', text: u.displayName }),
    h('span', { class: 'rank-dot', style: { background: rank.color || 'var(--gold)' }, title: rank.label || '' })
  );
  els.drawerUser.innerHTML = '';
  els.drawerUser.append(
    h('img', { src: u.avatar, alt: '' }),
    h(
      'div',
      {},
      h('div', { class: 'du-name', text: u.displayName }),
      h('div', { class: 'du-rank', text: `${rankLabel(u.rank)} • ${u.balance != null ? u.balance + ' $' : ''}` })
    )
  );
  els.logoutBtn.innerHTML = `${icon('logout', 17)}<span>${t('common.goodbye', 'تسجيل الخروج')}</span>`;
  els.menuBtn.innerHTML = icon('menu', 20);
}

function openDrawer() {
  els.drawer.classList.add('open');
  els.scrim.hidden = false;
  requestAnimationFrame(() => els.scrim.classList.add('show'));
}
function closeDrawer() {
  els.drawer.classList.remove('open');
  els.scrim.classList.remove('show');
  setTimeout(() => {
    els.scrim.hidden = true;
  }, 320);
}

function setActiveNav(pageId) {
  els.navList.querySelectorAll('.nav-item').forEach((el) => {
    el.classList.toggle('active', el.dataset.route === pageId);
  });
}

/* ---------------- router ---------------- */
function parseHash() {
  const raw = (location.hash || '#/dashboard').slice(1);
  const [pathPart, queryPart] = raw.split('?');
  const page = pathPart.replace(/^\/+/, '').split('/')[0] || 'dashboard';
  return { page, query: new URLSearchParams(queryPart || ''), raw };
}

function navigate(hash) {
  if (location.hash === hash) renderRoute();
  else location.hash = hash;
}

function defaultRoute() {
  return state.site.routesByRank[state.user.rank] || '#/dashboard';
}

async function renderRoute() {
  if (!state.user) return;
  let { page, query } = parseHash();

  if (page === 'login') {
    navigate(defaultRoute());
    return;
  }

  const navItem = state.site.nav.find((n) => n.id === page);
  const loader = PAGE_MODULES[page];
  if (!navItem || !loader) {
    navigate(defaultRoute());
    return;
  }
  if (rankOrder(state.user.rank) < navItem.minRank) {
    toast(t('errors.forbidden', 'ليس لديك صلاحية لهذا الإجراء'), 'error');
    navigate(defaultRoute());
    return;
  }

  const view = els.view;
  if (pageCleanup) {
    try {
      const res = pageCleanup();
      if (res && typeof res.then === 'function') await res;
    } catch {}
    pageCleanup = null;
  }
  const old = view.firstElementChild;
  if (old) {
    old.classList.add('leaving');
    await new Promise((r) => setTimeout(r, 180));
  }

  setActiveNav(pageIdSafe(page));
  els.pageTitle.textContent = navItem.label;

  let mod;
  try {
    mod = await loader();
  } catch (err) {
    console.error('page load failed', err);
    view.innerHTML = '';
    view.appendChild(h('div', { class: 'page' }, h('div', { class: 'card' }, h('p', { text: t('errors.server', 'خطأ في الخادم') }))));
    return;
  }

  const pageRank = mod.default.minRank !== undefined ? mod.default.minRank : navItem.minRank;
  if (rankOrder(state.user.rank) < pageRank) {
    toast(t('errors.forbidden', 'ليس لديك صلاحية'), 'error');
    navigate(defaultRoute());
    return;
  }

  view.innerHTML = '';
  const container = h('div', { class: 'page' });
  view.appendChild(container);
  currentPage = page;

  try {
    const cleanup = await mod.default.render(container, makeCtx(query));
    if (typeof cleanup === 'function') pageCleanup = cleanup;
  } catch (err) {
    console.error('page render failed', err);
    container.innerHTML = '';
    container.appendChild(
      h('div', { class: 'card' }, h('p', { class: 'danger-text', text: err.message || t('errors.server') }))
    );
  }
  bindMagnetic(container);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function pageIdSafe(page) {
  return page;
}

function makeCtx(query) {
  return {
    get user() {
      return state.user;
    },
    site: state.site,
    query,
    navigate,
    toast,
    api,
    bus,
    rankOrder,
    setUser(u) {
      state.user = { ...state.user, ...u };
      updateUserChip();
    },
    async refreshUser() {
      try {
        const me = await api('/auth/me');
        state.user = me.user;
        updateUserChip();
        return state.user;
      } catch {
        return null;
      }
    }
  };
}

/* ---------------- global socket ---------------- */
function wireGlobalSocketEvents() {
  unsubscribers.forEach((off) => off());
  unsubscribers = [];

  unsubscribers.push(
    bus.on('socket:state', ({ connected }) => {
      els.liveDot.classList.toggle('on', connected);
      if (connected) toast(t('socket.connected', 'الاتصال المباشر نشط'), 'success', 2200);
      else toast(t('socket.disconnected', 'انقطع الاتصال المباشر، جارٍ إعادة المحاولة...'), 'warn');
    })
  );

  unsubscribers.push(
    bus.on('session:revoked', (data) => {
      const reason = (data && data.reason) || t('auth.kicked');
      showLogin(reason);
      toast(reason, 'error', 6000);
      location.hash = '#/login';
    })
  );

  unsubscribers.push(
    bus.on('user:updated', (data) => {
      if (!data) return;
      const rankChanged = state.user && data.rank !== state.user.rank;
      state.user = { ...state.user, ...data };
      updateUserChip();
      if (rankChanged) {
        buildNav();
        navigate(defaultRoute());
        toast(`${t('common.rank', 'الرتبة')}: ${rankLabel(data.rank)}`, 'info');
      }
    })
  );

  unsubscribers.push(
    bus.on('order:new', (data) => {
      if (data && data.user && state.user && data.user.id === state.user.id) {
        toast(t('shop.orderSent', 'تم إرسال طلبك بنجاح'), 'success');
      } else {
        toast(`${t('socket.orderNew', 'طلب جديد وارد!')}`, 'info');
      }
    })
  );

  unsubscribers.push(
    bus.on('order:status', (data) => {
      if (data && data.statusLabel) toast(`${t('socket.orderStatus', 'تحديث حالة طلب')}: ${data.statusLabel}`, 'info');
    })
  );

  unsubscribers.push(
    bus.on('farm:ready', (data) => {
      toast(`${t('socket.farmReady', 'محصول جاهز للحصاد!')} ${data && data.crop ? '— ' + data.crop : ''}`, 'success', 5200);
    })
  );

  unsubscribers.push(
    bus.on('announcement:new', (a) => {
      if (a && a.title) toast(`📢 ${a.title}`, 'info', 6000);
    })
  );

  unsubscribers.push(
    bus.on('ticket:resolved', (ticket) => {
      if (ticket) toast(`${t('tickets.title', 'التذاكر')}: ${ticket.statusLabel}`, 'info');
    })
  );

  unsubscribers.push(
    bus.on('discipline:new', () => {
      toast(t('discipline.title', 'سجل الانضباط') + ': تحديث جديد', 'warn');
    })
  );
}

/* ---------------- build reload ---------------- */
function startBuildPoll() {
  setInterval(async () => {
    try {
      const data = await api('/build');
      if (state.buildId && data.buildId && data.buildId !== state.buildId) {
        toast('تم نشر إصدار جديد — سيتم إعادة تحميل الصفحة...', 'info', 5000);
        setTimeout(() => location.reload(), 1600);
      }
    } catch {}
  }, 20000);
}

/* ---------------- auth:expired ---------------- */
bus.on('auth:expired', (err) => {
  if (state.user) {
    showLogin(err && err.message ? err.message : t('auth.sessionExpired'));
    state.user = null;
    location.hash = '#/login';
  }
});

/* ---------------- boot ---------------- */
async function boot() {
  showBoot();
  initBackground(document.getElementById('bg-canvas'));
  try {
    const site = await api('/site');
    state.site = site;
    state.buildId = site.buildId;
    applyBranding();
  } catch (err) {
    hideBoot();
    document.body.innerHTML = `<div style="padding:40px;text-align:center;font-family:sans-serif;color:#ef4444">Cannot reach the server. ${err.message || ''}</div>`;
    return;
  }

  els.menuBtn = $('menu-btn');
  els.drawer = $('drawer');
  els.scrim = $('scrim');
  els.navList = $('nav-list');
  els.view = $('view');
  els.pageTitle = $('page-title');
  els.userChip = $('user-chip');
  els.drawerUser = $('drawer-user');
  els.logoutBtn = $('logout-btn');
  els.liveDot = $('live-dot');
  els.brandMark = $('brand-mark');
  els.brandName = $('brand-name');
  els.brandTag = $('brand-tag');

  els.brandMark.textContent = (state.site.org.initials || 'CO').slice(0, 3);
  els.brandName.textContent = state.site.runtime && state.site.runtime.siteName ? state.site.runtime.siteName : state.site.org.name;
  els.brandTag.textContent = state.site.org.tagline;

  els.menuBtn.addEventListener('click', () => {
    if (els.drawer.classList.contains('open')) closeDrawer();
    else openDrawer();
  });
  els.scrim.addEventListener('click', closeDrawer);
  els.logoutBtn.addEventListener('click', async () => {
    try {
      await api('/auth/logout', { method: 'POST' });
    } catch {}
    state.user = null;
    location.hash = '#/login';
    showLogin('');
    toast(t('auth.loggedOut', 'تم تسجيل خروجك بنجاح'), 'success');
  });

  let me = null;
  try {
    me = await api('/auth/me');
  } catch (err) {
    if (err.status && err.status !== 401) console.warn(err);
  }

  hideBoot();

  if (!me) {
    showLogin();
    return;
  }

  state.user = me.user;
  $('login-root').hidden = true;
  $('app').hidden = false;
  buildNav();
  updateUserChip();

  const hash = location.hash;
  if (!hash || hash === '#' || hash.startsWith('#/login')) {
    location.hash = defaultRoute();
  }

  await connectSocket();
  wireGlobalSocketEvents();
  startBuildPoll();

  window.addEventListener('hashchange', () => renderRoute());
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeDrawer();
  });

  await renderRoute();
}

boot();
