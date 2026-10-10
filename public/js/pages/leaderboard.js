import { h, badge, emptyState, skeleton, bindMagnetic } from '../ui.js';
import { t, duration } from '../state.js';
import { get } from '../api.js';

const MEDAL_COLOR = { 1: '#d4af37', 2: '#c0c0c0', 3: '#cd7f32' };

function ensureChart() {
  if (window.Chart) return Promise.resolve(true);
  const existing = document.getElementById('chartjs-vendor');
  if (existing) {
    return new Promise((resolve) => {
      if (existing.dataset.loaded === '1') {
        resolve(Boolean(window.Chart));
        return;
      }
      existing.addEventListener('load', () => resolve(Boolean(window.Chart)), { once: true });
      existing.addEventListener('error', () => resolve(false), { once: true });
    });
  }
  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.id = 'chartjs-vendor';
    script.src = '/vendor/chart.umd.js';
    script.addEventListener('load', () => { script.dataset.loaded = '1'; resolve(Boolean(window.Chart)); }, { once: true });
    script.addEventListener('error', () => resolve(false), { once: true });
    document.head.appendChild(script);
  });
}

export default {
  id: 'leaderboard',
  minRank: 2,

  async render(root, ctx) {
    const strings = ctx.site.strings.leaderboard;
    root.innerHTML = '';
    root.appendChild(h('div', { class: 'card' }, skeleton(8)));

    let data;
    try {
      data = await get('/leaderboard');
    } catch (err) {
      root.innerHTML = '';
      root.appendChild(h('div', { class: 'card' }, h('p', { class: 'danger-text', text: err.message })));
      ctx.toast(err.message, 'error');
      return () => {};
    }
    root.innerHTML = '';

    const rows = data.leaderboard || [];
    const me = data.me;
    let chart = null;

    root.appendChild(
      h('div', { class: 'page-head' },
        h('div', {}, h('h1', { text: strings.title }), h('p', { text: strings.subtitle })),
        h('div', { class: 'page-actions' },
          h('span', { class: 'pill', text: `${t('common.total', 'المجموع')}: ${data.total}` }),
          data.scoring ? h('span', { class: 'pill', text: `${t('operations.result', 'النتيجة')}: ${data.scoring.win} / ${data.scoring.loss} / ${data.scoring.hour}` }) : null
        )
      )
    );

    if (!rows.length) {
      root.appendChild(h('div', { class: 'card' }, emptyState(strings.noMembers, 'medal')));
      return () => {};
    }

    function medalLabel(pos) {
      if (pos === 1) return strings.gold;
      if (pos === 2) return strings.silver;
      return strings.bronze;
    }

    function podiumCard(r) {
      const color = MEDAL_COLOR[r.position] || 'var(--gold)';
      return h('div', { class: 'card', style: { borderColor: color, textAlign: 'center' } },
        h('div', { style: { display: 'grid', placeItems: 'center', gap: '8px' } },
          h('img', { src: r.avatar, alt: '', style: { width: '76px', height: '76px', borderRadius: '50%', border: `2px solid ${color}` } }),
          badge(medalLabel(r.position), color),
          h('strong', { text: r.name }),
          h('div', { class: 'stat-value', text: String(r.score) }),
          h('div', { class: 'small muted', text: `${r.opsPoints} ${strings.opsPts} • ${duration(r.dutyHours * 60)}` })
        )
      );
    }

    const podiumOrder = [rows[1], rows[0], rows[2]].filter(Boolean);
    root.appendChild(h('div', { class: 'grid grid-3 mb-2' }, ...podiumOrder.map(podiumCard)));

    const chartCard = h('div', { class: 'card mb-2' },
      h('div', { class: 'card-title' }, h('span', { text: `${strings.score} — ${t('leaderboard.subtitle', 'أفضل المساهمين')}` })),
      h('div', { class: 'chart-box' }, h('canvas'))
    );
    root.appendChild(chartCard);

    const thead = h('thead', {}, h('tr', {},
      h('th', { text: '#' }),
      h('th', { text: t('common.name', 'الاسم') }),
      h('th', { text: strings.score }),
      h('th', { text: strings.opsPts }),
      h('th', { text: strings.dutyPts })
    ));
    const tbody = h('tbody');
    for (const r of rows) {
      tbody.appendChild(h('tr', { style: r.isMe ? { background: 'rgba(212,175,55,0.09)' } : {} },
        h('td', {}, h('span', { class: r.position <= 3 ? 'gold' : 'muted', text: String(r.position) })),
        h('td', {}, h('div', { class: 'cell-user' },
          h('img', { src: r.avatar, alt: '' }),
          h('strong', { text: r.name }),
          r.isMe ? badge(strings.you, 'var(--emerald)') : null,
          h('span', { class: 'small muted', text: r.rankLabel })
        )),
        h('td', { class: 'gold', text: String(r.score) }),
        h('td', { text: String(r.opsPoints) }),
        h('td', { text: duration(r.dutyHours * 60) })
      ));
    }
    root.appendChild(h('div', { class: 'card' },
      h('div', { class: 'card-title' }, h('span', { text: strings.title })),
      h('div', { class: 'table-wrap' }, h('table', {}, thead, tbody))
    ));

    if (me && !rows.some((r) => r.isMe)) {
      root.appendChild(h('div', { class: 'card mt-2' },
        h('div', { class: 'card-title' }, h('span', { text: strings.you })),
        h('div', { class: 'row-wrap' },
          h('span', { class: 'pill', text: `#${me.position}` }),
          h('span', { class: 'pill', text: `${strings.score}: ${me.score}` }),
          h('span', { class: 'pill', text: `${strings.opsPts}: ${me.opsPoints}` }),
          h('span', { class: 'pill', text: `${strings.dutyPts}: ${duration(me.dutyHours * 60)}` })
        )
      ));
    }

    async function drawChart() {
      const ok = await ensureChart();
      if (!ok || !window.Chart) return;
      const canvas = chartCard.querySelector('canvas');
      if (!canvas) return;
      const top = rows.slice(0, 10);
      try {
        chart = new window.Chart(canvas.getContext('2d'), {
          type: 'bar',
          data: {
            labels: top.map((r) => r.name),
            datasets: [{
              label: strings.score,
              data: top.map((r) => r.score),
              backgroundColor: 'rgba(212,175,55,0.45)',
              borderColor: '#d4af37',
              borderWidth: 1,
              borderRadius: 8
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              x: { ticks: { color: '#9a978f' }, grid: { display: false } },
              y: { beginAtZero: true, ticks: { color: '#9a978f' }, grid: { color: 'rgba(255,255,255,0.06)' } }
            }
          }
        });
      } catch {
        chart = null;
      }
    }
    drawChart();

    bindMagnetic(root);

    return () => {
      if (chart) chart.destroy();
    };
  }
};
