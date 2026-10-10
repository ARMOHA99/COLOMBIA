import { h, icon, countUp, progressRing, badge, emptyState, skeleton } from '../ui.js';
import { money, fmtDate } from '../state.js';
import { get } from '../api.js';

export default {
  id: 'card',
  minRank: 2,

  async render(root, ctx) {
    root.appendChild(h('div', { class: 'card' }, skeleton(6)));

    let card;
    try {
      const data = await get('/leaderboard/card');
      card = data.card;
    } catch (err) {
      root.innerHTML = '';
      root.appendChild(h('div', { class: 'card' }, h('p', { class: 'danger-text', text: err.message })));
      return;
    }
    root.innerHTML = '';

    const rankInfo = (ctx.site.ranks && ctx.site.ranks[card.rank]) || {};
    const rankColor = rankInfo.color || 'var(--gold)';

    root.appendChild(
      h(
        'div',
        { class: 'page-head' },
        h('div', {}, h('h1', { text: 'بطاقتي' }), h('p', { text: 'ملفك الشخصي وإحصائياتك داخل المنظمة' }))
      )
    );

    const identity = h(
      'div',
      { class: 'card member-card', style: { borderColor: rankColor } },
      h('img', { class: 'member-avatar', src: card.avatar, alt: '', style: { borderColor: rankColor } }),
      h('h2', { class: 'member-name', text: card.name }),
      h('div', { class: 'row-wrap', style: { justifyContent: 'center' } }, badge(card.rankLabel, rankColor)),
      h(
        'div',
        { class: 'member-info' },
        h('div', { class: 'between' }, h('span', { class: 'muted', text: 'الرقم داخل اللعبة' }), h('strong', { text: String(card.inGameId) })),
        h('div', { class: 'between' }, h('span', { class: 'muted', text: 'الرصيد' }), h('strong', { class: 'gold', text: money(card.balance) })),
        h('div', { class: 'between' }, h('span', { class: 'muted', text: 'تاريخ الانضمام' }), h('strong', { text: fmtDate(card.joinedAt, false) }))
      )
    );

    const stats = [
      { label: 'عمليات شارك فيها', value: card.opsCount, icon: 'target' },
      { label: 'انتصارات', value: card.wins, icon: 'medal', tone: 'emerald-tone' },
      { label: 'خسائر', value: card.losses, icon: 'alert' },
      { label: 'عمليات لم يشارك فيها', value: card.missedOps, icon: 'close' },
      { label: 'ساعات الدوام', value: card.dutyHours, icon: 'clock', decimals: 1 },
      { label: 'إنذارات ومخالفات', value: card.warnings, icon: 'shield' }
    ];
    const statCards = stats.map((s) =>
      h(
        'div',
        { class: `card stat-card ${s.tone || ''}` },
        h('div', { class: 'stat-label' }, h('span', { html: icon(s.icon, 15) }), h('span', { text: s.label })),
        h('div', { class: 'stat-value', text: '0' })
      )
    );
    statCards.forEach((el, i) => countUp(el.querySelector('.stat-value'), stats[i].value, { decimals: stats[i].decimals || 0 }));

    const ring = progressRing(card.participationRate, { size: 150, stroke: 12, label: `${card.participationRate}%` });
    const participation = h(
      'div',
      { class: 'card', style: { textAlign: 'center' } },
      h('div', { class: 'card-title' }, h('span', { text: 'نسبة المشاركة في العمليات' })),
      ring,
      h('p', { class: 'small muted', text: `شارك في ${card.opsCount} من ${card.opsCount + card.missedOps} عملية منذ انضمامه` })
    );

    const gear = h(
      'div',
      { class: 'card' },
      h('div', { class: 'card-title' }, h('span', { text: 'تجهيزاتي' })),
      card.gear && card.gear.length
        ? h(
            'div',
            { class: 'col' },
            ...card.gear.map((g) =>
              h(
                'div',
                { class: 'between', style: { padding: '8px 0', borderBottom: '1px solid var(--border-soft)' } },
                h('strong', { text: g.name }),
                badge(`× ${g.qty}`, 'var(--gold)')
              )
            )
          )
        : emptyState('لا توجد تجهيزات بعد', 'box')
    );

    root.appendChild(
      h(
        'div',
        { class: 'member-layout' },
        identity,
        h('div', { class: 'col' }, h('div', { class: 'grid grid-3' }, ...statCards), h('div', { class: 'grid grid-2' }, participation, gear))
      )
    );
  }
};
