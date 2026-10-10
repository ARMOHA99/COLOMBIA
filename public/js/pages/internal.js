import { h, icon, toast, confirm, skeleton, emptyState, badge } from '../ui.js';
import { t, money, fmtDate } from '../state.js';
import { get, post } from '../api.js';

function thumb(src, name, height = 140) {
  if (src) {
    return h('img', {
      src,
      alt: name || '',
      loading: 'lazy',
      style: { width: '100%', height: `${height}px`, objectFit: 'cover', borderRadius: '12px', border: '1px solid var(--border-soft)' }
    });
  }
  return h('div', {
    style: {
      width: '100%',
      height: `${height}px`,
      borderRadius: '12px',
      display: 'grid',
      placeContent: 'center',
      color: 'var(--gold)',
      background: 'rgba(212,175,55,0.08)',
      border: '1px solid var(--border)'
    },
    html: icon('box', 34)
  });
}

export default {
  id: 'internal',
  minRank: 2,

  async render(root, ctx) {
    root.appendChild(h('div', { class: 'card' }, skeleton(5)));

    let itemsData;
    let purchasesData;
    try {
      const res = await Promise.all([get('/internal/items'), get('/internal/purchases/mine')]);
      itemsData = res[0];
      purchasesData = res[1];
    } catch (err) {
      root.innerHTML = '';
      root.appendChild(h('div', { class: 'card' }, h('p', { class: 'danger-text', text: err.message })));
      return;
    }
    root.innerHTML = '';

    const strings = ctx.site.strings.internalShop;
    const itemsGrid = h('div', { class: 'grid grid-auto' });
    const purchasesList = h('div', { class: 'col' });
    const balancePill = h('span', { class: 'pill gold', text: money(itemsData.balance != null ? itemsData.balance : ctx.user.balance) });

    function itemCard(item) {
      const buyBtn = h('button', {
        class: 'btn btn-gold btn-sm',
        disabled: item.out,
        html: `${icon('cart', 15)}<span>${t('internalShop.buy', 'شراء')}</span>`,
        onClick: () => buy(item, buyBtn)
      });
      return h(
        'div',
        { class: 'card', style: { padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' } },
        thumb(item.imageUrl, item.name, 140),
        h(
          'div',
          { class: 'between' },
          h('strong', { text: item.name }),
          item.out
            ? badge(t('shop.outOfStock', 'نفذ'), 'var(--danger)')
            : badge(`${t('shop.stock', 'المخزون')}: ${item.stock}`, 'var(--emerald)')
        ),
        item.description ? h('p', { class: 'small muted', style: { margin: 0 }, text: item.description }) : null,
        h('div', { class: 'between' }, h('span', { class: 'gold', text: money(item.price) }), buyBtn)
      );
    }

    function paintItems(list) {
      itemsGrid.innerHTML = '';
      if (!list.length) {
        itemsGrid.appendChild(emptyState(t('internalShop.noItems', 'لا توجد عناصر متاحة حالياً'), 'cart'));
        return;
      }
      for (const item of list) itemsGrid.appendChild(itemCard(item));
    }

    function paintPurchases(list) {
      purchasesList.innerHTML = '';
      if (!list.length) {
        purchasesList.appendChild(emptyState(t('internalShop.noPurchases', 'لا توجد مشتريات'), 'receipt'));
        return;
      }
      for (const p of list) {
        purchasesList.appendChild(
          h(
            'div',
            { class: 'between', style: { padding: '8px 0', borderBottom: '1px solid var(--border-soft)' } },
            h(
              'div',
              { class: 'col', style: { gap: '2px' } },
              h('strong', { class: 'small', text: `${p.itemName} × ${p.qty}` }),
              h('span', { class: 'small muted', text: fmtDate(p.createdAt) })
            ),
            h('span', { class: 'gold', text: money(p.total) })
          )
        );
      }
    }

    async function buy(item, btn) {
      if (!(await confirm(t('internalShop.buyConfirm', 'هل تريد شراء هذا العنصر؟')))) return;
      btn.disabled = true;
      try {
        const res = await post('/internal/purchase', { itemId: item.id, qty: 1 });
        toast(res.message || t('internalShop.purchased', 'تم الشراء بنجاح'), 'success');
        await ctx.refreshUser();
        await reload();
      } catch (err) {
        if (err.code === 'INSUFFICIENT') toast(t('internalShop.insufficient', 'رصيدك غير كافٍ لإتمام الشراء'), 'error');
        else toast(err.message || t('internalShop.insufficient', 'رصيدك غير كافٍ لإتمام الشراء'), 'error');
      }
    }

    async function reload() {
      try {
        const res = await Promise.all([get('/internal/items'), get('/internal/purchases/mine')]);
        itemsData = res[0];
        purchasesData = res[1];
        paintItems(itemsData.items || []);
        paintPurchases(purchasesData.purchases || []);
        const bal = itemsData.balance != null ? itemsData.balance : purchasesData.balance;
        if (bal != null) balancePill.textContent = money(bal);
      } catch (err) {
        toast(err.message, 'error');
      }
    }

    root.appendChild(
      h(
        'div',
        { class: 'page-head' },
        h('div', {}, h('h1', { text: strings.title }), h('p', { text: strings.subtitle })),
        h('div', { class: 'page-actions' }, h('span', { class: 'small muted', text: t('common.balance', 'الرصيد') }), balancePill)
      )
    );

    root.appendChild(
      h(
        'div',
        { class: 'grid grid-2' },
        h('div', { class: 'card' }, h('div', { class: 'card-title' }, h('span', { text: strings.title })), itemsGrid),
        h('div', { class: 'card' }, h('div', { class: 'card-title' }, h('span', { text: strings.myPurchases })), purchasesList)
      )
    );

    paintItems(itemsData.items || []);
    paintPurchases(purchasesData.purchases || []);
  }
};
