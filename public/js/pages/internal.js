import { h, icon, toast, confirm, skeleton, emptyState, badge } from '../ui.js';
import { t, fmtDate, statusLabel } from '../state.js';
import { get, post } from '../api.js';
import * as bus from '../bus.js';

const STATUS_COLOR = { new: 'var(--info)', preparing: 'var(--warning)', delivered: 'var(--emerald)', cancelled: 'var(--danger)' };

let cart = [];

function thumb(src, name, height = 150) {
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
    let ordersData;
    try {
      const res = await Promise.all([get('/internal/items'), get('/internal/orders/mine')]);
      itemsData = res[0];
      ordersData = res[1];
    } catch (err) {
      root.innerHTML = '';
      root.appendChild(h('div', { class: 'card' }, h('p', { class: 'danger-text', text: err.message })));
      return;
    }
    root.innerHTML = '';

    const strings = ctx.site.strings.internalShop;
    const items = itemsData.items || [];
    let myOrders = ordersData.orders || [];

    root.appendChild(h('div', { class: 'page-head' }, h('div', {}, h('h1', { text: strings.title }), h('p', { text: strings.subtitle }))));

    const grid = h('div', { class: 'shop-grid' });

    function itemCard(p) {
      const addBtn = h('button', {
        class: 'btn btn-gold btn-sm',
        disabled: p.out,
        html: `${icon('cart', 15)}<span>${t('shop.addToCart', 'أضف للسلة')}</span>`,
        onClick: () => addToCart(p)
      });
      return h(
        'div',
        { class: 'card', style: { padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' } },
        thumb(p.imageUrl, p.name, 200),
        h(
          'div',
          { class: 'between' },
          h('strong', { text: p.name }),
          p.out ? badge(t('shop.outOfStock', 'نفذ'), 'var(--danger)') : badge(`${t('shop.stock', 'المخزون')}: ${p.stock}`, 'var(--emerald)')
        ),
        p.description ? h('p', { class: 'small muted', style: { margin: 0 }, text: p.description }) : null,
        h('div', { class: 'row-wrap' }, addBtn)
      );
    }

    function paintItems() {
      grid.innerHTML = '';
      if (!items.length) {
        grid.appendChild(emptyState(strings.noItems, 'box'));
        return;
      }
      for (const p of items) grid.appendChild(itemCard(p));
    }

    const itemsCard = h('div', { class: 'card' }, h('div', { class: 'card-title' }, h('span', { text: strings.title })), grid);

    const cartBody = h('div', { class: 'col' });
    const cartCount = h('span', { class: 'small muted', text: '0' });
    const checkoutBtn = h('button', {
      class: 'btn btn-gold btn-block',
      disabled: true,
      html: `${icon('check', 16)}<span>${t('shop.checkout', 'إتمام الطلب')}</span>`,
      onClick: () => checkout()
    });
    const clearBtn = h('button', {
      class: 'btn btn-ghost btn-sm',
      html: `${icon('trash', 15)}<span>${t('shop.clearCart', 'تفريغ السلة')}</span>`,
      onClick: () => {
        cart = [];
        paintCart();
      }
    });

    function cartRow(item) {
      const minus = h('button', {
        class: 'btn btn-ghost btn-sm',
        text: '−',
        disabled: item.qty <= 1,
        onClick: () => {
          item.qty -= 1;
          paintCart();
        }
      });
      const plus = h('button', {
        class: 'btn btn-ghost btn-sm',
        text: '+',
        disabled: item.qty >= item.stock,
        onClick: () => {
          item.qty += 1;
          paintCart();
        }
      });
      const remove = h('button', {
        class: 'icon-btn',
        style: { width: '34px', height: '34px' },
        html: icon('trash', 15),
        onClick: () => {
          cart = cart.filter((c) => c.id !== item.id);
          paintCart();
        }
      });
      return h(
        'div',
        { class: 'between', style: { gap: '8px', padding: '8px 0', borderBottom: '1px solid var(--border-soft)' } },
        h('strong', { class: 'small', text: item.name }),
        h('div', { class: 'row', style: { gap: '6px' } }, minus, h('span', { class: 'small', text: String(item.qty) }), plus, remove)
      );
    }

    function paintCart() {
      cartBody.innerHTML = '';
      if (!cart.length) cartBody.appendChild(emptyState(t('shop.cartEmpty', 'سلتك فارغة'), 'cart'));
      else for (const item of cart) cartBody.appendChild(cartRow(item));
      const count = cart.reduce((a, i) => a + i.qty, 0);
      cartCount.textContent = `${count} ${t('shop.itemsInCart', 'عناصر في السلة')}`;
      checkoutBtn.disabled = !cart.length;
    }

    function addToCart(p) {
      if (p.out || p.stock <= 0) {
        toast(t('shop.outOfStock', 'نفذ'), 'error');
        return;
      }
      const existing = cart.find((c) => c.id === p.id);
      const nextQty = existing ? existing.qty + 1 : 1;
      if (nextQty > p.stock) {
        toast(t('shop.outOfStock', 'نفذ'), 'warn');
        return;
      }
      if (existing) existing.qty = nextQty;
      else cart.push({ id: p.id, name: p.name, qty: 1, stock: p.stock });
      paintCart();
    }

    async function checkout() {
      if (!cart.length) return;
      const summary = cart.map((c) => `${c.qty}× ${c.name}`).join('، ');
      const ok = await confirm(`تأكيد الطلب: ${summary}`, { okText: t('shop.orderNow', 'اطلب الآن') });
      if (!ok) return;
      checkoutBtn.disabled = true;
      try {
        const res = await post('/internal/orders', { items: cart.map((c) => ({ itemId: c.id, qty: c.qty })) });
        toast(res.message || strings.orderSent, 'success');
        cart.forEach((c) => {
          const it = items.find((i) => i.id === c.id);
          if (it) {
            it.stock = Math.max(0, it.stock - c.qty);
            it.out = it.stock <= 0;
          }
        });
        cart = [];
        paintCart();
        paintItems();
        await reloadOrders();
      } catch (err) {
        toast(err.message, 'error');
        checkoutBtn.disabled = !cart.length;
      }
    }

    const cartCard = h(
      'div',
      { class: 'card' },
      h('div', { class: 'card-title' }, h('span', { html: `${icon('cart', 16)}<span>${t('shop.cart', 'سلة الطلب')}</span>` }), cartCount),
      cartBody,
      h('div', { class: 'row-wrap mt-1' }, checkoutBtn, clearBtn)
    );

    const ordersBody = h('div', { class: 'col' });
    function paintOrders() {
      ordersBody.innerHTML = '';
      if (!myOrders.length) {
        ordersBody.appendChild(emptyState(strings.noOrders, 'receipt'));
        return;
      }
      for (const o of myOrders) {
        ordersBody.appendChild(
          h(
            'div',
            { class: 'mv-row' },
            h(
              'div',
              { class: 'between' },
              h('strong', { text: `#${String(o.id).slice(-6)}` }),
              badge(statusLabel('order', o.status), STATUS_COLOR[o.status] || 'var(--gold)')
            ),
            h('div', { class: 'small', text: (o.items || []).map((i) => `${i.qty}× ${i.name}`).join('، ') }),
            h('div', { class: 'small muted', text: fmtDate(o.createdAt) })
          )
        );
      }
    }

    async function reloadOrders() {
      try {
        const res = await get('/internal/orders/mine');
        myOrders = res.orders || [];
        paintOrders();
      } catch (err) {
        toast(err.message, 'error');
      }
    }

    paintItems();
    paintCart();
    paintOrders();

    root.appendChild(h('div', { class: 'shop-layout' }, itemsCard, cartCard));
    root.appendChild(h('div', { class: 'card mt-2' }, h('div', { class: 'card-title' }, h('span', { text: strings.myOrders })), ordersBody));

    const offStatus = bus.on('order:status', () => reloadOrders());
    return () => offStatus();
  }
};
