import { h, badge, emptyState, modal, segTabs, skeleton } from './ui.js';
import { money, fmtDate, fmtTime, duration } from './state.js';
import { get } from './api.js';

const PERIODS = [
  { id: 'week', label: 'هذا الأسبوع' },
  { id: 'lastweek', label: 'الأسبوع الماضي' },
  { id: 'month', label: 'آخر 30 يوماً' },
  { id: 'all', label: 'الكل' }
];

function statBox(label, value) {
  return h('div', { class: 'mv-stat' }, h('div', { class: 'mv-stat-value', text: String(value) }), h('div', { class: 'small muted', text: label }));
}

function cardView(card) {
  const identity = h(
    'div',
    { class: 'mv-identity' },
    h('img', { class: 'mv-avatar', src: card.avatar, alt: '' }),
    h(
      'div',
      {},
      h('h3', { style: { margin: '0 0 6px' }, text: card.name }),
      h('div', { class: 'row-wrap' }, badge(card.rankLabel, 'var(--gold)'), h('span', { class: 'small muted', text: `رقم اللعبة: ${card.inGameId}` })),
      h('div', { class: 'small muted', style: { marginTop: '6px' }, text: `الانضمام: ${fmtDate(card.joinedAt, false)}` })
    )
  );

  const stats = h(
    'div',
    { class: 'mv-stats' },
    statBox('عمليات شارك فيها', card.opsCount),
    statBox('انتصارات', card.wins),
    statBox('خسائر', card.losses),
    statBox('عمليات لم يشارك فيها', card.missedOps),
    statBox('نسبة المشاركة', `${card.participationRate}%`),
    statBox('ساعات الدوام', card.dutyHours),
    statBox('إنذارات ومخالفات', card.warnings)
  );

  const gear = h(
    'div',
    { class: 'mv-section' },
    h('h4', { text: 'التجهيزات' }),
    card.gear && card.gear.length
      ? h('div', { class: 'col' }, ...card.gear.map((g) => h('div', { class: 'between small' }, h('span', { text: g.name }), badge(`× ${g.qty}`, 'var(--gold)'))))
      : emptyState('لا توجد تجهيزات', 'box')
  );

  const discipline = h(
    'div',
    { class: 'mv-section' },
    h('h4', { text: 'السجل التأديبي' }),
    card.discipline && card.discipline.length
      ? h(
          'div',
          { class: 'col' },
          ...card.discipline.map((d) =>
            h(
              'div',
              { class: 'mv-row' },
              h(
                'div',
                { class: 'between' },
                badge(d.kindLabel, d.kind === 'note' ? 'var(--muted)' : d.kind === 'fine' ? 'var(--danger)' : '#f59e0b'),
                h('span', { class: 'small muted', text: fmtDate(d.createdAt) })
              ),
              h('div', { class: 'small', text: d.text }),
              d.amount ? h('div', { class: 'small gold', text: `المبلغ: ${money(d.amount)}` }) : null,
              d.by ? h('div', { class: 'small muted', text: `بواسطة: ${d.by}` }) : null
            )
          )
        )
      : emptyState('لا توجد سجلات', 'shield')
  );

  return h('div', { class: 'col' }, identity, stats, h('div', { class: 'grid grid-2' }, gear, discipline));
}

function attendanceView(log) {
  const t = log.totals;
  const totals = h(
    'div',
    { class: 'mv-stats' },
    statBox('عدد الجلسات', t.sessions),
    statBox('ساعات العمل', duration(t.workMin)),
    statBox('وقت الاستراحة', duration(t.breakMin)),
    statBox('ساعات مخصومة', duration(t.penaltyMin)),
    statBox('الصافي', duration(t.netMin))
  );

  const tbody = h('tbody');
  if (!log.sessions.length) {
    tbody.appendChild(h('tr', {}, h('td', { colspan: '5', class: 'muted', text: 'لا توجد جلسات في هذه الفترة' })));
  } else {
    for (const s of log.sessions) {
      const breaks = s.breaks.length
        ? h(
            'div',
            { class: 'col', style: { gap: '2px' } },
            ...s.breaks.map((b) => h('span', { class: 'small muted', text: `${fmtTime(b.start)} → ${b.end ? fmtTime(b.end) : 'مستمرة'} (${duration(b.min)})` }))
          )
        : h('span', { class: 'small muted', text: '—' });
      tbody.appendChild(
        h(
          'tr',
          {},
          h('td', { text: fmtDate(s.start, false) }),
          h('td', { text: fmtTime(s.start) }),
          h('td', {}, s.open ? badge('مستمرة', 'var(--emerald)') : h('span', { text: fmtTime(s.end) })),
          h('td', {}, breaks),
          h('td', { text: duration(s.workMin) })
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
      h('thead', {}, h('tr', {}, h('th', { text: 'التاريخ' }), h('th', { text: 'الدخول' }), h('th', { text: 'الخروج' }), h('th', { text: 'الاستراحات' }), h('th', { text: 'العمل' }))),
      tbody
    )
  );

  const adjustments =
    log.adjustments && log.adjustments.length
      ? h(
          'div',
          { class: 'mv-section' },
          h('h4', { text: 'خصومات الساعات' }),
          h(
            'div',
            { class: 'col' },
            ...log.adjustments.map((a) =>
              h('div', { class: 'between small' }, h('span', { text: `- ${duration(a.minutes)} ${a.reason ? `• ${a.reason}` : ''}` }), h('span', { class: 'muted', text: fmtDate(a.at) }))
            )
          )
        )
      : null;

  return h('div', { class: 'col' }, totals, table, adjustments);
}

export function openMemberView(ctx, member, { tab = 'card' } = {}) {
  const body = h('div', { class: 'col' });
  const holder = h('div', {}, skeleton(4));
  let activeTab = tab;
  let period = 'week';

  async function load() {
    holder.innerHTML = '';
    holder.appendChild(skeleton(4));
    try {
      if (activeTab === 'card') {
        const res = await get(`/leaderboard/card/${member.id}`);
        holder.innerHTML = '';
        holder.appendChild(cardView(res.card));
      } else {
        const res = await get(`/attendance/member/${member.id}?period=${period}`);
        holder.innerHTML = '';
        holder.appendChild(attendanceView(res));
      }
    } catch (err) {
      holder.innerHTML = '';
      holder.appendChild(h('p', { class: 'danger-text', text: err.message }));
    }
  }

  const periodTabs = h('div', { class: 'mb-2', style: { display: activeTab === 'attendance' ? 'block' : 'none' } }, segTabs(PERIODS, period, (id) => {
    period = id;
    load();
  }));

  const mainTabs = segTabs(
    [
      { id: 'card', label: 'بطاقة العضو' },
      { id: 'attendance', label: 'سجل الحضور' }
    ],
    activeTab,
    (id) => {
      activeTab = id;
      periodTabs.style.display = id === 'attendance' ? 'block' : 'none';
      load();
    }
  );

  body.append(h('div', { class: 'mb-2' }, mainTabs), periodTabs, holder);
  modal({ title: member.name, content: body, wide: true });
  load();
}
