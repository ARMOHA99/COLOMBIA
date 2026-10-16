import { h, icon, toast, emptyState, skeleton, segTabs, bindMagnetic } from '../ui.js';
import { get } from '../api.js';
import { openMemberView } from '../member-view.js';

const VIEWS = [
  { id: '0', label: 'هذا الأسبوع' },
  { id: '-1', label: 'الأسبوع الماضي' },
  { id: '-2', label: 'قبل أسبوعين' },
  { id: 'month', label: 'آخر 30 يوماً' }
];

const CELL = {
  yes: { text: '✓', cls: 'pc-yes' },
  no: { text: '✗', cls: 'pc-no' },
  pending: { text: '—', cls: 'pc-pending' },
  none: { text: '', cls: 'pc-none' },
  future: { text: '', cls: 'pc-none' }
};

export default {
  id: 'presence',
  minRank: 1,

  async render(root, ctx) {
    let view = '0';
    const canOpen = ctx.can('members.view');

    root.appendChild(
      h(
        'div',
        { class: 'page-head' },
        h('div', {}, h('h1', { text: 'جدول الحضور' }), h('p', { text: 'من سجّل دخوله في كل يوم دوام' })),
        h('div', { class: 'page-actions' }, h('button', { class: 'btn btn-ghost', html: `${icon('refresh', 16)}<span>تحديث</span>`, onClick: () => load() }))
      )
    );

    const info = h('p', { class: 'small muted mb-2' });
    const legend = h(
      'div',
      { class: 'row-wrap small mb-2' },
      h('span', { class: 'pc-yes', text: '✓ سجّل دخول' }),
      h('span', { class: 'pc-no', text: '✗ لم يسجّل' }),
      h('span', { class: 'pc-pending', text: '— لم تنتهِ فترة اليوم بعد' })
    );
    const holder = h('div', {});

    root.appendChild(h('div', { class: 'mb-2' }, segTabs(VIEWS, view, (id) => { view = id; load(); })));
    root.appendChild(info);
    root.appendChild(legend);
    root.appendChild(h('div', { class: 'card' }, holder));

    function paint(data) {
      holder.innerHTML = '';
      info.textContent = data.window.enabled
        ? `اليوم هو فترة الدوام ${data.window.label}، وليس من 12 إلى 12.`
        : 'اليوم هو اليوم الكامل من 00:00 إلى 24:00 (القفل الليلي معطّل).';
      if (!data.users.length) {
        holder.appendChild(emptyState('لا يوجد أعضاء لعرضهم', 'user'));
        return;
      }
      const head = h(
        'tr',
        {},
        h('th', { class: 'pc-name', text: 'العضو' }),
        ...data.days.map((d) => h('th', { class: d.state === 'current' ? 'pc-today' : '' }, h('div', { text: d.weekday }), h('div', { class: 'small muted', text: d.date }))),
        h('th', { text: '✓' })
      );
      const body = h('tbody');
      for (const u of data.users) {
        const nameNode = h(
          'div',
          { class: 'pc-user' },
          h('img', { src: u.avatar, alt: '' }),
          h('div', {}, h('div', canOpen ? { class: 'link-name', text: u.name, onClick: () => openMemberView(ctx, u, { tab: 'attendance' }) } : { text: u.name }), h('div', { class: 'small muted', text: u.rankLabel }))
        );
        body.appendChild(
          h(
            'tr',
            {},
            h('td', { class: 'pc-name' }, nameNode),
            ...u.cells.map((c) => h('td', { class: `pc-cell ${CELL[c].cls}`, text: CELL[c].text })),
            h('td', { class: 'pc-total', text: String(u.total) })
          )
        );
      }
      holder.appendChild(h('div', { class: 'table-wrap' }, h('table', { class: 'table presence-table' }, h('thead', {}, head), body)));
    }

    async function load() {
      holder.innerHTML = '';
      holder.appendChild(skeleton(6));
      try {
        const query = view === 'month' ? 'range=month' : `range=week&offset=${view}`;
        paint(await get(`/presence?${query}`));
      } catch (err) {
        holder.innerHTML = '';
        holder.appendChild(h('p', { class: 'danger-text', text: err.message }));
        toast(err.message, 'error');
      }
    }

    await load();
    bindMagnetic(root);
  }
};
