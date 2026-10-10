import { h, icon, toast, modal, confirm, countUp, badge, emptyState, skeleton, field, input, select, bindMagnetic } from '../ui.js';
import { t, money, fmtDate } from '../state.js';
import { get, post, del } from '../api.js';
import * as bus from '../bus.js';

function loadChart() {
  return new Promise((resolve) => {
    if (window.Chart) return resolve(window.Chart);
    let script = document.getElementById('vendor-chartjs');
    if (script) {
      script.addEventListener('load', () => resolve(window.Chart || null));
      script.addEventListener('error', () => resolve(null));
      return;
    }
    script = document.createElement('script');
    script.id = 'vendor-chartjs';
    script.src = '/vendor/chart.umd.js';
    script.onload = () => resolve(window.Chart || null);
    script.onerror = () => resolve(null);
    document.head.appendChild(script);
  });
}

export default {
  id: 'treasury',
  minRank: 2,

  async render(root, ctx) {
    root.appendChild(h('div', { class: 'card' }, skeleton(5)));

    let data;
    try {
      data = await get('/treasury');
    } catch (err) {
      root.innerHTML = '';
      root.appendChild(h('div', { class: 'card' }, h('p', { class: 'danger-text', text: err.message })));
      return;
    }
    root.innerHTML = '';

    const site = ctx.site;
    const strings = site.strings.treasury;
    const currency = (site.locale && site.locale.currency) || '$';
    const isStaff = ctx.rankOrder(ctx.user.rank) >= 3 || Boolean(data.canWrite);
    const categories = data.categories && data.categories.length ? data.categories : site.defaults.treasuryCategories || [];
    const unsubs = [];
    let entries = data.entries.slice();
    let chart = null;

    const head = h(
      'div',
      { class: 'page-head' },
      h('div', {}, h('h1', { text: strings.title }), h('p', { text: strings.summary })),
      h(
        'div',
        { class: 'page-actions' },
        h('button', {
          class: 'btn btn-ghost',
          html: `${icon('refresh', 16)}<span>${t('common.refresh', 'تحديث')}</span>`,
          onClick: () => ctx.navigate('#/treasury')
        }),
        isStaff
          ? h('button', {
              class: 'btn btn-gold',
              html: `${icon('plus', 16)}<span>${strings.addEntry}</span>`,
              onClick: () => openAdd()
            })
          : null
      )
    );
    root.appendChild(head);

    const statDefs = [
      { label: strings.balance, value: data.balance, icon: 'coins', tone: data.balance >= 0 ? 'emerald-tone' : '' },
      { label: strings.income, value: data.summary.income, icon: 'chart', tone: 'emerald-tone' },
      { label: strings.expense, value: data.summary.expense, icon: 'chart', tone: '' }
    ];
    const statCards = statDefs.map((s) =>
      h(
        'div',
        { class: `card stat-card ${s.tone}` },
        h('div', { class: 'stat-label' }, h('span', { html: icon(s.icon, 15) }), h('span', { text: s.label })),
        h('div', { class: 'stat-value', text: '0' }),
        h('div', { class: 'stat-sub', text: strings.summary })
      )
    );
    root.appendChild(h('div', { class: 'grid grid-3 mb-2' }, ...statCards));

    function paintStats() {
      const values = [data.balance, data.summary.income, data.summary.expense];
      statCards.forEach((card, i) => {
        const elm = card.querySelector('.stat-value');
        countUp(elm, values[i], { duration: 1200, decimals: values[i] % 1 !== 0 ? 2 : 0, suffix: ` ${currency}` });
      });
    }
    paintStats();

    const chartBox = h('div', { class: 'chart-box' });
    const chartCard = h('div', { class: 'card mb-2' }, h('div', { class: 'card-title' }, h('span', { text: strings.chart })), chartBox);
    root.appendChild(chartCard);

    function buildSeries() {
      const map = new Map();
      for (const e of entries) {
        const d = new Date(e.entryDate || e.createdAt);
        const key = d.toISOString().slice(0, 10);
        if (!map.has(key)) map.set(key, { income: 0, expense: 0 });
        const row = map.get(key);
        if (e.type === 'income') row.income += e.amount;
        else row.expense += e.amount;
      }
      const keys = [...map.keys()].sort();
      return {
        labels: keys.map((k) => fmtDate(k, false)),
        income: keys.map((k) => map.get(k).income),
        expense: keys.map((k) => map.get(k).expense)
      };
    }

    function drawChart(ChartCtor) {
      const s = buildSeries();
      if (chart) {
        chart.destroy();
        chart = null;
      }
      chartBox.innerHTML = '';
      const canvas = h('canvas');
      chartBox.appendChild(canvas);
      chart = new ChartCtor(canvas, {
        type: 'line',
        data: {
          labels: s.labels,
          datasets: [
            {
              label: strings.income,
              data: s.income,
              borderColor: '#10b981',
              backgroundColor: 'rgba(16,185,129,0.15)',
              fill: true,
              tension: 0.35
            },
            {
              label: strings.expense,
              data: s.expense,
              borderColor: '#ef4444',
              backgroundColor: 'rgba(239,68,68,0.15)',
              fill: true,
              tension: 0.35
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { labels: { color: '#e8e6e1' } } },
          scales: {
            x: { ticks: { color: '#9a978f' }, grid: { color: 'rgba(255,255,255,0.06)' } },
            y: { beginAtZero: true, ticks: { color: '#9a978f' }, grid: { color: 'rgba(255,255,255,0.06)' } }
          }
        }
      });
    }

    loadChart().then((ChartCtor) => {
      if (!ChartCtor) {
        chartBox.innerHTML = '';
        chartBox.appendChild(emptyState(t('common.noData', 'لا توجد بيانات لعرضها'), 'chart'));
        return;
      }
      drawChart(ChartCtor);
    });

    const tbody = h('tbody');
    const thead = h(
      'thead',
      {},
      h(
        'tr',
        {},
        h('th', { text: t('common.date', 'التاريخ') }),
        h('th', { text: strings.entryType }),
        h('th', { text: strings.category }),
        h('th', { text: strings.amount }),
        h('th', { text: strings.reason }),
        h('th', { text: t('common.createdBy', 'أنشأه') }),
        isStaff ? h('th', { text: t('common.actions', 'إجراءات') }) : null
      )
    );

    function paintLedger() {
      tbody.innerHTML = '';
      if (!entries.length) {
        tbody.appendChild(h('tr', {}, h('td', { colspan: isStaff ? '7' : '6', class: 'muted', text: strings.noEntries })));
        return;
      }
      for (const e of entries) {
        const inc = e.type === 'income';
        tbody.appendChild(
          h(
            'tr',
            {},
            h('td', { text: fmtDate(e.entryDate || e.createdAt) }),
            h('td', {}, badge(inc ? strings.income : strings.expense, inc ? 'var(--emerald)' : 'var(--danger)')),
            h('td', { text: e.category || '—' }),
            h('td', { class: inc ? 'emerald' : 'danger-text', text: `${inc ? '+' : '-'}${money(e.amount)}` }),
            h('td', { class: 'small muted', text: e.note || '—' }),
            h('td', { class: 'small muted', text: e.by || '—' }),
            isStaff
              ? h(
                  'td',
                  {},
                  h('button', { class: 'icon-btn', html: icon('trash', 15), title: t('common.delete', 'حذف'), onClick: () => removeEntry(e) })
                )
              : null
          )
        );
      }
    }

    const ledgerCard = h(
      'div',
      { class: 'card' },
      h(
        'div',
        { class: 'card-title' },
        h('span', { text: strings.ledger }),
        h('span', { class: 'small muted', text: `${entries.length}` })
      ),
      h('div', { class: 'table-wrap' }, h('table', { class: 'table' }, thead, tbody))
    );
    root.appendChild(ledgerCard);

    function openAdd() {
      const typeS = select([
        { value: 'income', label: strings.income },
        { value: 'expense', label: strings.expense }
      ]);
      const catS = select(categories.map((c) => ({ value: c, label: c })));
      const amountI = input({ type: 'number', min: '0.01', step: '0.01', placeholder: '0.00' });
      const noteI = input({ maxlength: 500, placeholder: strings.reason });
      const content = h(
        'div',
        {},
        field(strings.entryType, typeS),
        field(strings.category, catS),
        field(strings.amount, amountI),
        field(strings.reason, noteI)
      );
      const saveBtn = h('button', {
        class: 'btn btn-gold',
        text: t('common.save', 'حفظ'),
        onClick: async () => {
          const amount = Number(amountI.value);
          if (!Number.isFinite(amount) || amount <= 0) {
            toast(t('common.required', 'هذا الحقل مطلوب'), 'error');
            return;
          }
          saveBtn.disabled = true;
          try {
            await post('/treasury', { type: typeS.value, category: catS.value, amount, note: noteI.value.trim() });
            toast(t('common.success', 'تمت العملية بنجاح'), 'success');
            m.close();
            await reload();
          } catch (err) {
            toast(err.message, 'error');
            saveBtn.disabled = false;
          }
        }
      });
      const m = modal({
        title: strings.addEntry,
        content,
        footer: [h('button', { class: 'btn btn-ghost', text: t('common.cancel', 'إلغاء'), onClick: () => m.close() }), saveBtn]
      });
    }

    async function removeEntry(entry) {
      if (!(await confirm(strings.deleteConfirm, { danger: true, okText: t('common.delete', 'حذف') }))) return;
      try {
        await del(`/treasury/${entry.id}`);
        toast(t('common.success', 'تمت العملية بنجاح'), 'success');
        await reload();
      } catch (err) {
        toast(err.message, 'error');
      }
    }

    async function reload() {
      try {
        data = await get('/treasury');
        entries = data.entries.slice();
        paintStats();
        paintLedger();
        if (window.Chart) drawChart(window.Chart);
      } catch (err) {
        toast(err.message, 'error');
      }
    }

    unsubs.push(bus.on('treasury:updated', () => reload()));

    paintLedger();
    bindMagnetic(root);

    return () => {
      unsubs.forEach((off) => off());
      if (chart) {
        chart.destroy();
        chart = null;
      }
    };
  }
};
