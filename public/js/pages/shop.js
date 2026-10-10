import { h, icon, toast, modal, skeleton, emptyState, badge, segTabs, field, input, textarea } from '../ui.js';
import { t, money } from '../state.js';
import { get, post } from '../api.js';
import { previewButton } from '../preview3d.js';

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
  id: 'shop',
  minRank: 1,

  async render(root, ctx) {
    root.appendChild(h('div', { class: 'card' }, skeleton(5)));

    let data;
    try {
      data = await get('/shop/products');
    } catch (err) {
      root.innerHTML = '';
      root.appendChild(h('div', { class: 'card' }, h('p', { class: 'danger-text', text: err.message })));
      return;
    }
    root.innerHTML = '';

    const strings = ctx.site.strings.shop;
    const products = data.products || [];
    const categories = (ctx.site.defaults && ctx.site.defaults.categories) || [];
    let activeCat = 'all';

    root.appendChild(
      h(
        'div',
        { class: 'page-head' },
        h('div', {}, h('h1', { text: strings.title }), h('p', { text: strings.subtitle })),
        h(
          'div',
          { class: 'page-actions' },
          h('button', {
            class: 'btn btn-ghost',
            html: `${icon('receipt', 16)}<span>${t('orders.title', 'الطلبات')}</span>`,
            onClick: () => ctx.navigate('#/orders')
          })
        )
      )
    );

    const productGrid = h('div', { class: 'shop-grid' });

    function productCard(p) {
      const addBtn = h('button', {
        class: 'btn btn-gold btn-sm',
        disabled: p.out,
        html: `${icon('cart', 15)}<span>${t('shop.addToCart', 'أضف للسلة')}</span>`,
        onClick: () => addToCart(p)
      });
      return h(
        'div',
        { class: 'card', style: { padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' } },
        thumb(p.imageUrl, p.name, 230),
        h(
          'div',
          { class: 'between' },
          h('strong', { text: p.name }),
          p.out
            ? badge(t('shop.outOfStock', 'نفذ'), 'var(--danger)')
            : badge(`${t('shop.stock', 'المخزون')}: ${p.stock}`, 'var(--emerald)')
        ),
        p.description ? h('p', { class: 'small muted', style: { margin: 0 }, text: p.description }) : null,
        h('div', { class: 'between' }, h('span', { class: 'gold', style: { fontSize: '18px', fontWeight: '800' }, text: money(p.price) })),
        h('div', { class: 'row-wrap' }, previewButton(t('shop.preview3d', 'معاينة ثلاثية الأبعاد'), { imageUrl: p.imageUrl, name: p.name }), addBtn)
      );
    }

    function paintProducts() {
      productGrid.innerHTML = '';
      const list = activeCat === 'all' ? products : products.filter((p) => p.category === activeCat);
      if (!list.length) {
        productGrid.appendChild(emptyState(t('shop.emptyCategory', 'لا توجد منتجات في هذا القسم'), 'bag'));
        return;
      }
      for (const p of list) productGrid.appendChild(productCard(p));
    }

        const productsCard = h(
      'div',
      { class: 'card' },
      h('div', { class: 'card-title' }, h('span', { text: strings.title })),
      productGrid
    );

    const cartBody = h('div', { class: 'col' });
    const cartCount = h('span', { class: 'small muted', text: '0' });
    const cartTotal = h('span', { class: 'gold', text: money(0) });
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

    function itemRow(item) {
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
        h(
          'div',
          { class: 'col', style: { gap: '2px', minWidth: 0 } },
          h('strong', { class: 'small', text: item.name }),
          h('span', { class: 'small muted', text: money(item.price) })
        ),
        h('div', { class: 'row', style: { gap: '6px' } }, minus, h('span', { class: 'small', text: String(item.qty) }), plus, remove)
      );
    }

    function paintCart() {
      cartBody.innerHTML = '';
      if (!cart.length) {
        cartBody.appendChild(emptyState(t('shop.cartEmpty', 'سلتك فارغة'), 'cart'));
      } else {
        for (const item of cart) cartBody.appendChild(itemRow(item));
      }
      const total = cart.reduce((a, i) => a + i.price * i.qty, 0);
      const count = cart.reduce((a, i) => a + i.qty, 0);
      cartTotal.textContent = money(total);
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
      else cart.push({ id: p.id, name: p.name, price: p.price, imageUrl: p.imageUrl, qty: 1, stock: p.stock });
      paintCart();
    }

    function checkout() {
      if (!cart.length) return;
      const ingame = input({ type: 'number', min: '1', placeholder: t('shop.inGameIdPlaceholder', 'مثال: 1024'), value: ctx.user.inGameId || '' });
      const note = textarea({ placeholder: t('shop.orderNotePlaceholder', 'أي تفاصيل إضافية...') });
      const body = h(
        'div',
        {},
        field(t('shop.inGameId', 'الرقم الداخلي داخل اللعبة'), ingame),
        field(t('shop.orderNote', 'ملاحظات للطلب (اختياري)'), note)
      );
      const submit = h('button', {
        class: 'btn btn-gold',
        html: `${icon('check', 16)}<span>${t('shop.orderNow', 'اطلب الآن')}</span>`
      });
      const m = modal({
        title: t('shop.checkout', 'إتمام الطلب'),
        content: body,
        footer: [
          h('button', { class: 'btn btn-ghost', text: t('common.cancel', 'إلغاء'), onClick: () => m.close() }),
          submit
        ]
      });
      submit.addEventListener('click', async () => {
        const ingameId = String(ingame.value || '').trim();
        if (!ingameId) {
          toast(t('common.required', 'هذا الحقل مطلوب'), 'error');
          return;
        }
        submit.disabled = true;
        try {
          const res = await post('/shop/orders', {
            items: cart.map((c) => ({ productId: c.id, qty: c.qty })),
            ingameId,
            note: String(note.value || '').trim()
          });
          toast(res.message || t('shop.orderSent', 'تم إرسال طلبك بنجاح'), 'success');
          cart = [];
          paintCart();
          m.close();
          ctx.navigate('#/orders');
        } catch (err) {
          toast(err.message, 'error');
        } finally {
          submit.disabled = false;
        }
      });
    }

    const cartCard = h(
      'div',
      { class: 'card' },
      h('div', { class: 'card-title' }, h('span', { html: `${icon('cart', 16)}<span>${strings.cart}</span>` }), cartCount),
      cartBody,
      h('div', { class: 'between mt-1' }, h('span', { class: 'small muted', text: t('shop.totalToPay', 'الإجمالي') }), cartTotal),
      h('div', { class: 'row-wrap mt-1' }, checkoutBtn, clearBtn)
    );

    paintProducts();
    paintCart();
    root.appendChild(h('div', { class: 'shop-layout' }, productsCard, cartCard));
  }
};
