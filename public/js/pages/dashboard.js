import { h, icon, toast, countUp, progressRing, badge, emptyState, bindMagnetic, skeleton } from '../ui.js';
import { t, money, relative, fmtTime, statusLabel, rankLabel, weekResetText } from '../state.js';
import { get, post } from '../api.js';
import * as bus from '../bus.js';

const RESULT_COLOR = { win: 'var(--emerald)', loss: 'var(--danger)', pending: 'var(--warning)' };
const RESULT_LABEL = { win: 'انتصار', loss: 'خسارة', pending: 'قيد التنفيذ' };

export default {
  id: 'dashboard',
  minRank: 2,

  async render(root, ctx) {
    root.appendChild(h('div', { class: 'card' }, skeleton(5)));

    let data;
    try {
      data = await get('/dashboard');
    } catch (err) {
      root.innerHTML = '';
      root.appendChild(h('div', { class: 'card' }, h('p', { class: 'danger-text', text: err.message })));
      return;
    }
    root.innerHTML = '';

    const site = ctx.site;
    const strings = site.strings.dashboard;
    const unsubs = [];

    const head = h(
      'div',
      { class: 'page-head' },
      h(
        'div',
        {},
        h('h1', { text: strings.title }),
        h('p', { text: `${strings.welcome} ${ctx.user.displayName} • ${ctx.user.rankLabel}` })
      ),
      h(
        'div',
        { class: 'page-actions' },
        h(
          'button',
          {
            class: 'btn btn-ghost',
            html: `${icon('refresh', 16)}<span>${t('common.refresh', 'تحديث')}</span>`,
            onClick: () => ctx.navigate('#/dashboard')
          }
        ),
        h(
          'button',
          {
            class: 'btn btn-gold',
            html: `${icon('target', 16)}<span>${t('operations.title', 'العمليات')}</span>`,
            onClick: () => ctx.navigate('#/operations')
          }
        )
      )
    );
    root.appendChild(head);

    if (site.runtime && site.runtime.motd) {
      root.appendChild(
        h(
          'div',
          { class: 'card mb-2', style: { borderColor: 'var(--border)' } },
          h(
            'div',
            { class: 'row-wrap' },
            h('span', { class: 'gold', html: icon('star', 18) }),
            h('span', { text: site.runtime.motd })
          )
        )
      );
    }

    const stats = [
      { label: strings.statsMembers, value: data.stats.members, icon: 'user', sub: 'أعضاء نشطون' },
      { label: strings.statsOpsWeek, value: data.stats.opsWeek, icon: 'target', sub: 'هذا الأسبوع' },
      { label: strings.statsTarget, value: data.target ? data.target.percent : 0, icon: 'chart', suffix: '%', sub: data.target ? `${money(data.target.score)} / ${money(data.target.goal)}` : '', tone: 'emerald-tone' },
      { label: strings.statsBalance, value: data.stats.balance, icon: 'coins', money: true, sub: `📦 ${data.stats.pendingOrders} • 🎫 ${data.stats.openTickets}` }
      ].filter((s) => !s.money || ctx.can('view.treasury'));

    const statCards = stats.map((s) =>
      h(
        'div',
        { class: `card stat-card ${s.tone || ''}` },
        h('div', { class: 'stat-label' }, h('span', { html: icon(s.icon, 15) }), h('span', { text: s.label })),
        h('div', { class: 'stat-value', 'data-value': String(s.value), text: '0' }),
        h('div', { class: 'stat-sub', text: s.sub })
      )
    );
    const hasTreasury = ctx.can('view.treasury');
    const dutyState = { onDuty: Boolean(data.duty.onDuty), onBreak: Boolean(data.duty.onBreak), since: data.duty.since };

    function buildDutyCard() {
      const att = site.strings.attendance;
      const statusEl = h('div', { class: 'stat-value', style: { fontSize: '22px' } });
      const subEl = h('div', { class: 'stat-sub' });
      const clockBtn = h('button', { class: 'btn btn-sm' });
      const breakBtn = h('button', { class: 'btn btn-ghost btn-sm' });

      function paint() {
        statusEl.textContent = dutyState.onDuty ? (dutyState.onBreak ? att.breakBadge : t('dashboard.onDuty', 'على رأس العمل')) : t('dashboard.offDuty', 'خارج الخدمة');
        statusEl.style.color = dutyState.onDuty ? (dutyState.onBreak ? 'var(--warning)' : 'var(--emerald)') : 'var(--muted)';
        subEl.textContent = dutyState.onDuty && dutyState.since ? `منذ ${fmtTime(dutyState.since)}` : '—';
        clockBtn.className = dutyState.onDuty ? 'btn btn-danger btn-sm' : 'btn btn-emerald btn-sm';
        clockBtn.textContent = dutyState.onDuty ? att.clockOut : att.clockIn;
        breakBtn.style.display = dutyState.onDuty ? '' : 'none';
        breakBtn.className = dutyState.onBreak ? 'btn btn-emerald btn-sm' : 'btn btn-ghost btn-sm';
        breakBtn.textContent = dutyState.onBreak ? att.breakEnd : att.breakStart;
      }

      clockBtn.addEventListener('click', async () => {
        clockBtn.disabled = true;
        try {
          const res = await post('/attendance/clock');
          dutyState.onDuty = Boolean(res.onDuty);
          dutyState.onBreak = false;
          dutyState.since = res.since || null;
          toast(res.message || 'تم', 'success');
          paint();
        } catch (err) {
          toast(err.message, 'error');
        } finally {
          clockBtn.disabled = false;
        }
      });
      breakBtn.addEventListener('click', async () => {
        breakBtn.disabled = true;
        try {
          const res = await post('/attendance/break');
          dutyState.onBreak = Boolean(res.onBreak);
          toast(res.message || 'تم', 'info');
          paint();
        } catch (err) {
          toast(err.message, 'error');
        } finally {
          breakBtn.disabled = false;
        }
      });

      paint();
      return h(
        'div',
        { class: 'card stat-card' },
        h('div', { class: 'stat-label' }, h('span', { html: icon('clock', 15) }), h('span', { text: 'الدوام' })),
        statusEl,
        subEl,
        h('div', { class: 'row-wrap mt-1' }, clockBtn, breakBtn)
      );
    }

    const dutyCard = !hasTreasury && ctx.can('view.attendance') ? buildDutyCard() : null;
    root.appendChild(h('div', { class: 'grid grid-4 mb-2' }, ...statCards, ...(dutyCard ? [dutyCard] : [])));
    statCards.forEach((card, i) => {
      const elm = card.querySelector('.stat-value');
      const s = stats[i];
      if (s.money) countUp(elm, s.value, { duration: 1400, decimals: 0, suffix: ' $' });
      else countUp(elm, s.value, { duration: 1200, suffix: s.suffix || '' });
    });

    const ringHolder = h('div', { class: 'row', style: { justifyContent: 'center', padding: '10px 0' } });
    const targetBar = h('div', { class: 'progress mt-1' }, h('div', { class: 'progress-fill', style: { width: '0%' } }));

    function paintTarget(target) {
      if (!target) return;
      ringHolder.innerHTML = '';
      ringHolder.appendChild(progressRing(target.percent, { label: strings.targetRing }));
      targetBar.classList.toggle('glow', target.glowing || target.completed);
      targetBar.querySelector('.progress-fill').style.width = `${target.percent}%`;
      targetMeta.innerHTML = '';
      targetMeta.append(
        ...[
          h('span', { class: 'pill', text: `${t('target.goal', 'الهدف')}: ${money(target.goal)}` }),
          h('span', { class: 'pill', text: `${t('target.remaining', 'المتبقي')}: ${money(target.remaining)}` }),
          h('span', { class: 'pill', text: `${site.locale.timezone}` }),
          target.completed ? badge(t('target.completed', 'اكتمل الهدف الأسبوعي! 🎉'), 'var(--emerald)') : null
        ].filter(Boolean)
      );
    }

    const targetMeta = h('div', { class: 'row-wrap mt-1', style: { justifyContent: 'center' } });

    const dutyBtn = h('button', {
      class: data.duty.onDuty ? 'btn btn-danger btn-sm' : 'btn btn-emerald btn-sm',
      text: data.duty.onDuty ? strings.dutyStatus + ' • ' + t('dashboard.onDuty', 'على رأس العمل') : t('attendance.clockIn', 'تسجيل دخول'),
      onClick: async () => {
        dutyBtn.disabled = true;
        try {
          const res = await post('/attendance/clock');
          toast(res.message || 'تم', 'success');
          dutyOn = res.onDuty;
          paintDuty();
        } catch (err) {
          toast(err.message, 'error');
        } finally {
          dutyBtn.disabled = false;
        }
      }
    });
    let dutyOn = data.duty.onDuty;
    const dutyTime = h('span', { class: 'small muted', text: data.duty.since ? `${fmtTime(data.duty.since)}` : '—' });
    function paintDuty() {
      dutyBtn.className = dutyOn ? 'btn btn-danger btn-sm' : 'btn btn-emerald btn-sm';
      dutyBtn.textContent = dutyOn ? `${strings.dutyStatus} • ${t('dashboard.onDuty', 'على رأس العمل')}` : t('attendance.clockIn', 'تسجيل دخول');
      dutyTime.textContent = dutyOn ? `منذ ${fmtTime(data.duty.since)}` : '—';
    }

    const targetCard = h(
      'div',
      { class: 'card' },
      h('div', { class: 'card-title' }, h('span', { text: strings.targetRing }), hasTreasury ? dutyBtn : null),
      ringHolder,
      targetBar,
      targetMeta,
      h('div', { class: 'between mt-1' }, h('span', { class: 'small muted', text: weekResetText() }), hasTreasury ? dutyTime : null)
    );

    const annList = h('div', { class: 'col' });
    function paintAnnouncements(list) {
      annList.innerHTML = '';
      if (!list || !list.length) {
        annList.appendChild(emptyState(t('common.noData', 'لا توجد بيانات لعرضها'), 'mail'));
        return;
      }
      for (const a of list) {
        annList.appendChild(
          h(
            'div',
            { class: 'ann-item' },
            h(
              'div',
              { class: 'between' },
              h('strong', { text: a.title }),
              a.pinned ? badge('مثبّت', 'var(--gold)') : h('span', { class: 'small muted', text: relative(a.createdAt) })
            ),
            h('p', { class: 'small muted', text: a.body })
          )
        );
      }
    }
    paintAnnouncements(data.announcements);

    const annCard = h(
      'div',
      { class: 'card' },
      h('div', { class: 'card-title' }, h('span', { text: strings.announcements }), h('span', { class: 'small muted', text: `${data.announcements.length}` })),
      annList
    );

    const opsList = h('div', { class: 'timeline' });
    function paintOps(list) {
      opsList.innerHTML = '';
      if (!list || !list.length) {
        opsList.appendChild(emptyState(t('operations.noOps', 'لا توجد عمليات مسجلة'), 'target'));
        return;
      }
      for (const op of list) {
        const people = (op.participants || []).slice(0, 5).map((p) => p.name).join('، ');
        opsList.appendChild(
          h(
            'div',
            { class: 'timeline-item' },
            h('span', { class: 'timeline-dot', style: { background: RESULT_COLOR[op.result] || 'var(--gold)' } }),
            h(
              'div',
              { class: 'timeline-body' },
              h(
                'div',
                { class: 'between' },
                h('span', { class: 'tl-title', text: op.title }),
                badge(RESULT_LABEL[op.result] || op.result, RESULT_COLOR[op.result])
              ),
              h('div', { class: 'tl-sub', text: `${op.typeLabel || ''} • ${relative(op.date)}${people ? ' • ' + people : ''}` })
            )
          )
        );
      }
    }
    paintOps(data.latestOps);

    const opsCard = h(
      'div',
      { class: 'card' },
      h(
        'div',
        { class: 'card-title' },
        h('span', { text: strings.latestOps }),
        h(
          'button',
          {
            class: 'btn btn-ghost btn-sm',
            text: t('common.all', 'الكل'),
            onClick: () => ctx.navigate('#/operations')
          }
        )
      ),
      opsList
    );

    root.appendChild(h('div', { class: 'grid grid-2 mb-2' }, targetCard, annCard));
    root.appendChild(h('div', { class: 'grid grid-2' }, opsCard, quickCard()));

    function quickCard() {
      const ready = data.stats.readyPlots || 0;
      const items = [
        { icon: 'leaf', label: t('farm.title', 'المزرعة'), value: `${ready} ${ready === 1 ? 'جاهزة' : 'جاهزة'}`, route: '#/farm', tone: ready > 0 ? 'emerald' : '' },
                ...(!ctx.can('view.orders') ? [] : [{ icon: 'receipt', label: t('orders.title', 'الطلبات'), value: `${data.stats.pendingOrders} معلّق`, route: '#/orders' }]),
        { icon: 'mail', label: t('tickets.title', 'التذاكر'), value: `${data.stats.openTickets} مفتوحة`, route: '#/tickets' },
               ...(!ctx.can('view.treasury') ? [] : [{ icon: 'coins', label: t('treasury.title', 'الخزينة'), value: money(data.stats.balance), route: '#/treasury' }])
      ];
      return h(
        'div',
        { class: 'card' },
        h('div', { class: 'card-title' }, h('span', { text: strings.quickActions })),
        h(
          'div',
          { class: 'grid grid-2' },
          ...items.map((it) =>
            h(
              'button',
              { class: 'quick-action', onClick: () => ctx.navigate(it.route) },
              h('span', { class: `qa-icon ${it.tone}`, html: icon(it.icon, 20) }),
              h('span', { class: 'qa-label', text: it.label }),
              h('span', { class: `qa-value ${it.tone}`, text: it.value })
            )
          )
        )
      );
    }

    unsubs.push(
      bus.on('target:updated', (target) => paintTarget(target)),
      bus.on('announcement:new', (a) => {
        if (a) paintAnnouncements([a, ...data.announcements].slice(0, 5));
      }),
      bus.on('ops:new', (op) => {
        if (op) paintOps([op, ...(data.latestOps || [])].slice(0, 8));
      }),
      bus.on('ops:deleted', () => ctx.navigate('#/dashboard')),
      bus.on('shop:changed', () => {})
    );

    paintTarget(data.target);
    bindMagnetic(root);

    return () => unsubs.forEach((off) => off());
  }
};
