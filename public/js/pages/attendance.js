import { h, icon, toast, skeleton, emptyState, badge } from '../ui.js';
import { t, duration, fmtDate, fmtTime, rankLabel } from '../state.js';
import { get, post } from '../api.js';

export default {
  id: 'attendance',
  minRank: 2,

  async render(root, ctx) {
    root.appendChild(h('div', { class: 'card' }, skeleton(5)));

    let data;
    try {
      data = await get('/attendance');
    } catch (err) {
      root.innerHTML = '';
      root.appendChild(h('div', { class: 'card' }, h('p', { class: 'danger-text', text: err.message })));
      return;
    }
    root.innerHTML = '';

    const strings = ctx.site.strings.attendance;
    const lockout = data.lockout || {};
    let onDuty = Boolean(data.onDuty);
    let since = data.since;

    const head = h(
      'div',
      { class: 'page-head' },
      h(
        'div',
        {},
        h('h1', { text: strings.title }),
        h('p', { text: `${ctx.user.displayName} • ${ctx.user.rankLabel}` })
      ),
      h(
        'div',
        { class: 'page-actions' },
        h('button', {
          class: 'btn btn-ghost',
          html: `${icon('refresh', 16)}<span>${t('common.refresh', 'تحديث')}</span>`,
          onClick: () => ctx.navigate('#/attendance')
        })
      )
    );
    root.appendChild(head);

    const statusBadge = h('span', {});
    const sinceLine = h('div', { class: 'small muted' });
    const noticeLine = h('div', { class: 'small muted' });

    const clockBtn = h('button', {
      class: onDuty ? 'btn btn-danger' : 'btn btn-emerald',
      onClick: async () => {
        clockBtn.disabled = true;
        try {
          const res = await post('/attendance/clock');
          toast(res.message || t('common.success', 'تمت العملية بنجاح'), res.onDuty ? 'success' : 'info');
          ctx.navigate('#/attendance');
        } catch (err) {
          toast(err.message, 'error');
          clockBtn.disabled = false;
        }
      }
    });

    function paintDuty() {
      clockBtn.className = onDuty ? 'btn btn-danger' : 'btn btn-emerald';
      clockBtn.innerHTML = onDuty
        ? `${icon('clock', 16)}<span>${strings.clockOut}</span>`
        : `${icon('clock', 16)}<span>${strings.clockIn}</span>`;
      clockBtn.disabled = !onDuty && Boolean(lockout.active);
      statusBadge.innerHTML = '';
      statusBadge.appendChild(
        onDuty ? badge(t('dashboard.onDuty', 'على رأس العمل'), 'var(--emerald)') : badge(t('dashboard.offDuty', 'خارج الخدمة'), 'var(--muted)')
      );
      sinceLine.textContent = onDuty && since ? `${strings.dutySince} ${fmtTime(since)}` : '';
      noticeLine.textContent = !onDuty && lockout.active ? strings.blocked : '';
    }
    paintDuty();

    const dutyCard = h(
      'div',
      { class: 'card' },
      h('div', { class: 'card-title' }, h('span', { text: strings.title }), statusBadge),
      h('p', { class: onDuty ? 'emerald' : 'muted', text: onDuty ? strings.onDuty : t('dashboard.offDuty', 'خارج الخدمة') }),
      sinceLine,
      noticeLine,
      h('div', { class: 'mt-1' }, clockBtn)
    );

    const lockCard = h(
      'div',
      { class: 'card', style: lockout.active ? { borderColor: 'var(--danger)' } : {} },
      h(
        'div',
        { class: 'card-title' },
        h('span', { text: strings.lockout }),
        h('span', { class: lockout.active ? 'danger-text' : 'muted', html: icon('alert', 16) })
      ),
      h(
        'div',
        { class: 'row-wrap' },
        h('span', { class: 'pill', text: `${strings.lockoutFrom} ${lockout.start || '—'}` }),
        h('span', { class: 'pill', text: `${strings.lockoutTo} ${lockout.end || '—'}` }),
        lockout.enabled ? badge(lockout.active ? strings.lockoutActive : t('common.no', 'غير مفعّل حالياً'), lockout.active ? 'var(--danger)' : 'var(--emerald)') : null
      )
    );

    root.appendChild(h('div', { class: 'grid grid-2 mb-2' }, dutyCard, lockCard));

    const statDefs = [
      { label: strings.todayMinutes, value: data.todayMin, icon: 'clock' },
      { label: strings.weekMinutes, value: data.weekMin, icon: 'chart' },
      { label: strings.duration, value: data.liveMin, icon: 'play' }
    ];
    root.appendChild(
      h(
        'div',
        { class: 'grid grid-3 mb-2' },
        ...statDefs.map((s) =>
          h(
            'div',
            { class: 'card stat-card' },
            h('div', { class: 'stat-label' }, h('span', { html: icon(s.icon, 15) }), h('span', { text: s.label })),
            h('div', { class: 'stat-value', text: duration(s.value) })
          )
        )
      )
    );

    const rosterList = h('div', { class: 'col' });
    const roster = data.roster || [];
    if (!roster.length) {
      rosterList.appendChild(emptyState(t('common.noData', 'لا توجد بيانات لعرضها'), 'user'));
    } else {
      for (const r of roster) {
        if (!r.user) continue;
        rosterList.appendChild(
          h(
            'div',
            { class: 'between' },
            h(
              'div',
              { class: 'cell-user' },
              h('img', { src: r.user.avatar, alt: '' }),
              h('div', {}, h('div', { text: r.user.name }), h('div', { class: 'small muted', text: rankLabel(r.user.rank) }))
            ),
            h(
              'div',
              { class: 'row' },
              h('span', { class: 'small muted', text: `${strings.dutySince} ${fmtTime(r.since)}` }),
              badge(duration(r.liveMin), 'var(--emerald)')
            )
          )
        );
      }
    }
    const rosterCard = h(
      'div',
      { class: 'card' },
      h('div', { class: 'card-title' }, h('span', { text: strings.roster }), badge(String(roster.length), 'var(--emerald)')),
      rosterList
    );

    const tbody = h('tbody');
    const sessions = data.sessions || [];
    if (!sessions.length) {
      tbody.appendChild(h('tr', {}, h('td', { colspan: '4', class: 'muted', text: strings.noSessions })));
    } else {
      for (const s of sessions) {
        tbody.appendChild(
          h(
            'tr',
            {},
            h('td', { text: fmtDate(s.start, false) }),
            h('td', { text: fmtTime(s.start) }),
            h('td', { text: s.end ? fmtTime(s.end) : '—' }),
            h('td', {}, s.open ? badge(t('common.at', 'مستمرة'), 'var(--emerald)') : h('span', { text: duration(s.durationMin) }))
          )
        );
      }
    }
    const table = h(
      'div',
      { class: 'table-wrap' },
      h(
        'table',
        { class: 'table' },
        h(
          'thead',
          {},
          h(
            'tr',
            {},
            h('th', { text: t('common.date', 'التاريخ') }),
            h('th', { text: t('attendance.in', 'الدخول') }),
            h('th', { text: t('attendance.out', 'الخروج') }),
            h('th', { text: strings.duration })
          )
        ),
        tbody
      )
    );
    const sessionsCard = h(
      'div',
      { class: 'card' },
      h('div', { class: 'card-title' }, h('span', { text: strings.sessions }), h('span', { class: 'small muted', text: `${sessions.length}` })),
      table
    );

    root.appendChild(h('div', { class: 'grid grid-2' }, rosterCard, sessionsCard));

    return () => {};
  }
};
