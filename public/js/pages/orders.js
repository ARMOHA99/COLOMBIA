import { h, icon, toast, confirm, skeleton, emptyState, badge, segTabs, select } from '../ui.js';
import { t, money, fmtDate, statusLabel } from '../state.js';
import { get, put } from '../api.js';

const STATUS_COLOR = { new: 'var(--info)', preparing: 'var(--warning)', delivered: 'var(--emerald)', cancelled: 'var(--danger)' };
const STATUSES = ['new', 'preparing', 'delivered', 'cancelled'];

export default {
  id: 'orders',
  minRank: 1,

  async render(root, ctx) {
    root.appendChild(h('div', { class: 'card' }, skeleton(5)));

    const isStaff = ctx.rankOrder(ctx.user.rank) >= 2;
    let activeTab = 'mine';
    const unsubs = [];

    async function load() {
      return activeTab === 'all' ? get('/shop/orders') : get('/shop/orders/mine');
    }

    let first;
    try {
      first = await load();
    } catch (err) {
      root.innerHTML = '';
      root.appendChild(h('div', { class: 'card' }, h('p', { class: 'danger-text', text: err.message })));
      return;
    }
    root.innerHTML = '';

    const strings = ctx.site.strings.orders;
    const listWrap = h('div', { class: 'col' });

    async function reload() {
      try {
        const res = await load();
        paint(res);
      } catch (err) {
        toast(err.message, 'error');
      }
    }

    function orderCard(o) {
      const color = STATUS_COLOR[o.status] || 'var(--gold)';
      const rows = [];

      rows.push(
        h('div', { class: 'between' }, h('strong', { text: `#${String(o.id).slice(-6)}` }), badge(statusLabel('order', o.status), color))
      );
      rows.push(
        h(
          'div',
          { class: 'row-wrap small muted' },
          h('span', { html: `${icon('clock', 13)} ${fmtDate(o.createdAt)}` }),
          o.user
            ? h(
                'span',
                { class: 'row', style: { gap: '5px' } },
                o.user.avatar ? h('img', { src: o.user.avatar, alt: '', style: { width: '18px', height: '18px', borderRadius: '50%' } }) : null,
                h('span', { text: o.user.name })
              )
            : null
        )
      );

      if (o.items && o.items.length) {
        rows.push(
          h(
            'div',
            { class: 'col', style: { gap: '4px' } },
            ...o.items.map((it) =>
              h('div', { class: 'between small' }, h('span', { text: `${it.name} × ${it.qty}` }), h('span', { class: 'muted', text: money(it.total) }))
            )
          )
        );
      }

      rows.push(
        h('div', { class: 'between' }, h('span', { class: 'small muted', text: t('common.total', 'المجموع') }), h('span', { class: 'gold', text: money(o.total) }))
      );
      if (o.ingameId) rows.push(h('div', { class: 'small muted', text: `${t('shop.inGameId', 'الرقم الداخلي')}: ${o.ingameId}` }));
      if (o.note) rows.push(h('p', { class: 'small muted', style: { margin: 0 }, text: o.note }));

      const isMine = o.user && o.user.id === ctx.user.id;
      if (isMine && o.status === 'new') {
        rows.push(
          h('button', {
            class: 'btn btn-danger btn-sm',
            html: `${icon('close', 15)}<span>${t('orders.cancelOrder', 'إلغاء الطلب')}</span>`,
            onClick: async () => {
              if (!(await confirm(t('orders.cancelConfirm', 'هل تريد إلغاء هذا الطلب؟'), { danger: true }))) return;
              try {
                await put(`/shop/orders/${o.id}/status`, { status: 'cancelled' });
                toast(t('common.success', 'تمت العملية بنجاح'), 'success');
                reload();
              } catch (err) {
                toast(err.message, 'error');
              }
            }
          })
        );
      }

      if (isStaff) {
        const sel = select(STATUSES.map((s) => ({ value: s, label: statusLabel('order', s), selected: s === o.status })));
        const updateBtn = h('button', {
          class: 'btn btn-ghost btn-sm',
          html: `${icon('sync', 15)}<span>${t('orders.setStatus', 'تحديث الحالة')}</span>`,
          onClick: async () => {
            updateBtn.disabled = true;
            try {
              await put(`/shop/orders/${o.id}/status`, { status: sel.value });
              toast(t('common.success', 'تمت العملية بنجاح'), 'success');
              reload();
            } catch (err) {
              toast(err.message, 'error');
            } finally {
              updateBtn.disabled = false;
            }
          }
        });
        rows.push(h('div', { class: 'row-wrap', style: { gap: '8px' } }, sel, updateBtn));
      }

      return h('div', { class: 'card' }, h('div', { class: 'col' }, ...rows));
    }

    function paint(res) {
      listWrap.innerHTML = '';
      const orders = res.orders || [];
      if (!orders.length) {
        listWrap.appendChild(emptyState(t('orders.noOrders', 'لا توجد طلبات بعد'), 'receipt'));
        return;
      }
      for (const o of orders) listWrap.appendChild(orderCard(o));
    }

    const tabs = [{ id: 'mine', label: t('orders.myOrders', 'طلباتي') }];
    if (isStaff) tabs.push({ id: 'all', label: t('orders.allOrders', 'كل الطلبات') });

    root.appendChild(
      h(
        'div',
        { class: 'page-head' },
        h('div', {}, h('h1', { text: strings.title }), h('p', { text: strings.liveUpdates })),
        h(
          'div',
          { class: 'page-actions' },
          segTabs(tabs, activeTab, (id) => {
            activeTab = id;
            reload();
          })
        )
      )
    );

    root.appendChild(listWrap);
    paint(first);

    unsubs.push(
      ctx.bus.on('order:new', () => reload()),
      ctx.bus.on('order:status', () => reload()),
      ctx.bus.on('order:deleted', () => reload())
    );

    return () => unsubs.forEach((off) => off());
  }
};
