import { h, icon, toast, modal, confirm, badge, emptyState, skeleton, field, select, bindMagnetic } from '../ui.js';
import { t, fmtDate, statusLabel } from '../state.js';
import { get, post } from '../api.js';
import * as bus from '../bus.js';

const STATUS_COLOR = { empty: 'var(--muted)', planted: 'var(--gold)', ready: 'var(--emerald)' };

export default {
  id: 'farm',
  minRank: 2,

  async render(root, ctx) {
    root.appendChild(h('div', { class: 'card' }, skeleton(4)));

    let data;
    try {
      data = await get('/farm');
    } catch (err) {
      root.innerHTML = '';
      root.appendChild(h('div', { class: 'card' }, h('p', { class: 'danger-text', text: err.message })));
      return;
    }
    root.innerHTML = '';

    const site = ctx.site;
    const strings = site.strings.farm;
    const crops = data.crops && data.crops.length ? data.crops : site.defaults.crops || [];
    const canManage = ctx.rankOrder(ctx.user.rank) >= 3 || Boolean(data.canManage);
    const unsubs = [];
    let timers = [];
    let plots = data.plots.slice();

    const head = h(
      'div',
      { class: 'page-head' },
      h('div', {}, h('h1', { text: strings.title }), h('p', { text: strings.autoSync })),
      h(
        'div',
        { class: 'page-actions' },
        h('button', {
          class: 'btn btn-ghost',
          html: `${icon('refresh', 16)}<span>${t('common.refresh', 'تحديث')}</span>`,
          onClick: () => ctx.navigate('#/farm')
        })
      )
    );
    root.appendChild(head);

    function progressOf(plot) {
      if (plot.status === 'ready') return 100;
      const total = plot.crop && plot.crop.growMs ? plot.crop.growMs : 0;
      if (!total || !plot.readyAt) return 0;
      const rem = Math.max(0, new Date(plot.readyAt).getTime() - Date.now());
      return Math.max(0, Math.min(100, Math.round(((total - rem) / total) * 100)));
    }

    function remainingOf(plot) {
      if (!plot.readyAt) return 0;
      return Math.max(0, new Date(plot.readyAt).getTime() - Date.now());
    }

    function fmtRemain(ms) {
      const s = Math.max(0, Math.floor(ms / 1000));
      const hh = String(Math.floor(s / 3600)).padStart(2, '0');
      const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
      const ss = String(s % 60).padStart(2, '0');
      return `${hh}:${mm}:${ss}`;
    }

    function isReady(plot) {
      return plot.status === 'ready' || (plot.status === 'planted' && Boolean(plot.readyAt) && remainingOf(plot) <= 0);
    }

    function makePlotCard(plot) {
      const card = h('div', { class: 'card' });
      card.appendChild(
        h(
          'div',
          { class: 'card-title' },
          h('span', { text: `${strings.plot} #${plot.plotNumber}` }),
          badge(statusLabel('plot', plot.status), STATUS_COLOR[plot.status] || 'var(--gold)')
        )
      );
      if (plot.status === 'empty') {
        card.appendChild(h('p', { class: 'muted', text: statusLabel('plot', 'empty') }));
        card.appendChild(
          h(
            'div',
            { class: 'mt-1' },
            h('button', {
              class: 'btn btn-gold btn-sm',
              html: `${icon('leaf', 15)}<span>${strings.plant}</span>`,
              onClick: () => openPlant(plot)
            })
          )
        );
        return card;
      }
      const crop = plot.crop || {};
      card.appendChild(
        h(
          'div',
          { class: 'row between' },
          h('span', { class: 'gold', text: crop.label || '' }),
          h('span', { class: 'small muted', text: `${strings.plantedAt}: ${fmtDate(plot.plantedAt)}` })
        )
      );
      const fill = h('div', { class: 'progress-fill', style: { width: '0%' } });
      const bar = h('div', { class: 'progress mt-1' }, fill);
      card.appendChild(bar);
      const timeEl = h('span', { class: 'small muted' });
      const actionWrap = h('div', { class: 'row' });
      card.appendChild(h('div', { class: 'between mt-1' }, timeEl, actionWrap));
      plot._ui = { card, fill, bar, timeEl, actionWrap };
      return card;
    }

    function tick() {
      for (const plot of plots) {
        if (!plot._ui) continue;
        const { card, fill, bar, timeEl, actionWrap } = plot._ui;
        const ready = isReady(plot);
        if (ready) plot.status = 'ready';
        fill.style.width = `${progressOf(plot)}%`;
        bar.classList.toggle('glow', ready);
        card.style.borderColor = ready ? 'rgba(16,185,129,0.55)' : '';
        if (ready) {
          timeEl.textContent = strings.readyNow;
          if (timeEl.className !== 'small emerald') timeEl.className = 'small emerald';
        } else {
          timeEl.textContent = `${strings.readyIn} ${fmtRemain(remainingOf(plot))}`;
          if (timeEl.className !== 'small muted') timeEl.className = 'small muted';
        }
        const stateKey = `${ready ? 'r' : 'p'}:${canManage ? 'a' : 'm'}`;
        if (actionWrap.dataset.state === stateKey) continue;
        actionWrap.dataset.state = stateKey;
        actionWrap.innerHTML = '';
        if (ready) {
          actionWrap.appendChild(
            h('button', {
              class: 'btn btn-emerald btn-sm',
              html: `${icon('check', 15)}<span>${strings.harvest}</span>`,
              onClick: () => harvest(plot)
            })
          );
        } else {
          actionWrap.appendChild(h('button', { class: 'btn btn-ghost btn-sm', disabled: true, text: strings.harvest }));
        }
        if (canManage && plot.status !== 'empty') {
          actionWrap.appendChild(
            h('button', { class: 'btn btn-danger btn-sm', html: icon('trash', 14), title: strings.reset, onClick: () => clearPlot(plot) })
          );
        }
      }
    }

    const gridEl = h('div', { class: 'grid grid-3 mb-2' });

    function paintPlots() {
      gridEl.innerHTML = '';
      if (!plots.length) {
        gridEl.appendChild(emptyState(t('common.noData', 'لا توجد بيانات لعرضها'), 'leaf'));
        return;
      }
      for (const plot of plots) gridEl.appendChild(makePlotCard(plot));
      tick();
    }
    root.appendChild(gridEl);

    function openPlant(plot) {
      const sel = select(
        crops.map((c) => ({ value: c.key, label: `${c.label} • ${Math.round((c.growMs || 0) / 60000)} ${t('common.points', 'د')}` }))
      );
      const content = h('div', {}, field(strings.chooseCrop, sel));
      const saveBtn = h('button', {
        class: 'btn btn-gold',
        text: strings.plant,
        onClick: async () => {
          saveBtn.disabled = true;
          try {
            await post(`/farm/${plot.id}/plant`, { cropKey: sel.value });
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
        title: `${strings.plant} — ${strings.plot} #${plot.plotNumber}`,
        content,
        footer: [h('button', { class: 'btn btn-ghost', text: t('common.cancel', 'إلغاء'), onClick: () => m.close() }), saveBtn]
      });
    }

    async function harvest(plot) {
      try {
        const res = await post(`/farm/${plot.id}/harvest`);
        const y = res.yield || {};
        toast(`${strings.yield}: ${y.qty || 0}${y.product ? ' • ' + y.product : ''}`, 'success');
        if (ctx.refreshUser) ctx.refreshUser();
        await reload();
      } catch (err) {
        toast(err.message, 'error');
      }
    }

    async function clearPlot(plot) {
      if (!(await confirm(`${strings.reset} ${strings.plot} #${plot.plotNumber}؟`, { danger: true, okText: strings.reset }))) return;
      try {
        await post(`/farm/${plot.id}/clear`);
        toast(t('common.success', 'تمت العملية بنجاح'), 'success');
        await reload();
      } catch (err) {
        toast(err.message, 'error');
      }
    }

    const logsEl = h('div', { class: 'timeline' });

    function paintLogs() {
      logsEl.innerHTML = '';
      const logs = data.logs || [];
      if (!logs.length) {
        logsEl.appendChild(emptyState(strings.noLogs, 'box'));
        return;
      }
      for (const l of logs) {
        logsEl.appendChild(
          h(
            'div',
            { class: 'timeline-item' },
            h('span', { class: 'timeline-dot', style: { background: 'var(--emerald)' } }),
            h(
              'div',
              { class: 'timeline-body' },
              h(
                'div',
                { class: 'between' },
                h('strong', { class: 'tl-title', text: `${l.cropLabel} • ${strings.plot} #${l.plotNumber}` }),
                badge(`${strings.yield}: ${l.qty}`, 'var(--emerald)')
              ),
              h(
                'div',
                { class: 'tl-sub' },
                h('span', { text: `${l.productName || ''} • ${fmtDate(l.at)}` }),
                l.user ? h('span', { text: ` • ${l.user.name}` }) : null
              )
            )
          )
        );
      }
    }

    const logsCard = h(
      'div',
      { class: 'card' },
      h('div', { class: 'card-title' }, h('span', { text: strings.harvestLogs }), h('span', { class: 'small muted', text: `${(data.logs || []).length}` })),
      logsEl
    );

    const infoItems = [
      { icon: 'leaf', label: strings.crop, value: String(crops.length) },
      { icon: 'box', label: strings.plots, value: String(plots.length) },
      { icon: 'check', label: strings.readyNow, value: String(plots.filter((p) => isReady(p)).length) }
    ];
    const infoCard = h(
      'div',
      { class: 'card' },
      h('div', { class: 'card-title' }, h('span', { text: t('farm.growProgress', 'حالة المزرعة') })),
      h(
        'div',
        { class: 'col' },
        ...infoItems.map((it) =>
          h(
            'div',
            { class: 'between' },
            h('div', { class: 'row' }, h('span', { class: 'gold', html: icon(it.icon, 17) }), h('span', { text: it.label })),
            h('span', { class: 'gold', text: it.value })
          )
        ),
        h('p', { class: 'small muted', text: strings.autoSync })
      )
    );

    root.appendChild(h('div', { class: 'grid grid-2' }, logsCard, infoCard));

    async function reload() {
      try {
        data = await get('/farm');
        plots = data.plots.slice();
        paintLogs();
        paintPlots();
      } catch (err) {
        toast(err.message, 'error');
      }
    }

    unsubs.push(
      bus.on('farm:ready', (payload) => {
        const num = payload && payload.plot;
        const plot = plots.find((p) => p.plotNumber === num);
        if (plot) plot.status = 'ready';
        paintPlots();
      }),
      bus.on('farm:updated', () => reload()),
      bus.on('farm:harvested', () => reload())
    );

    paintLogs();
    paintPlots();
    timers.push(setInterval(tick, 1000));
    bindMagnetic(root);

    return () => {
      unsubs.forEach((off) => off());
      timers.forEach((id) => clearInterval(id));
      timers = [];
    };
  }
};
