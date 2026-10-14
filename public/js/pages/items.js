import { h, icon, toast, modal, confirm, badge, emptyState, skeleton, field, input, select, bindMagnetic } from '../ui.js';
import { t, money } from '../state.js';
import { get, post, put, del } from '../api.js';

export default {
  id: 'items',
  minRank: 1,

  async render(root, ctx) {
    root.appendChild(h('div', { class: 'card' }, skeleton(6)));

    let items = [];
    let canWrite = false;
    let query = '';

    async function load() {
      const res = await get('/items');
      items = res.items || [];
      canWrite = Boolean(res.canWrite);
    }

    try {
      await load();
    } catch (err) {
      root.innerHTML = '';
      root.appendChild(h('div', { class: 'card' }, h('p', { class: 'danger-text', text: err.message })));
      return;
    }
    root.innerHTML = '';

    const searchI = input({ placeholder: 'بحث عن صنف...' });
    searchI.addEventListener('input', () => {
      query = searchI.value.trim();
      paint();
    });

    root.appendChild(
      h(
        'div',
        { class: 'page-head' },
        h('div', {}, h('h1', { text: 'الأصناف والأسعار' }), h('p', { text: 'الأسعار التي تُحسب بها خسائر وأرباح العمليات تلقائياً' })),
        h(
          'div',
          { class: 'page-actions' },
          canWrite
            ? h('button', {
                class: 'btn btn-gold',
                html: `${icon('plus', 16)}<span>صنف جديد</span>`,
                onClick: () => openForm(null)
              })
            : null
        )
      )
    );
    root.appendChild(h('div', { class: 'card mb-2' }, searchI));

    const listHolder = h('div');
    root.appendChild(listHolder);

    function categories() {
      return Array.from(new Set(items.map((i) => i.category).filter(Boolean)));
    }

    function openForm(item) {
      const nameI = input({ value: item ? item.name : '', placeholder: 'مثال: سلاح', maxlength: 80 });
      const catI = input({ value: item ? item.category : '', placeholder: 'مثال: أسلحة', maxlength: 40 });
      const priceI = input({ type: 'number', min: '0', step: '1', value: item ? String(item.price) : '', placeholder: '0' });
      const activeS = select([
        { value: '1', label: 'فعّال (يظهر في العمليات)', selected: item ? item.active : true },
        { value: '0', label: 'مخفي', selected: item ? !item.active : false }
      ]);

      const chips = h(
        'div',
        { class: 'row-wrap', style: { marginTop: '6px' } },
        ...categories().map((c) => h('button', { class: 'btn btn-ghost btn-sm', type: 'button', text: c, onClick: () => { catI.value = c; } }))
      );

      const saveBtn = h('button', {
        class: 'btn btn-gold',
        text: t('common.save', 'حفظ'),
        onClick: async () => {
          const body = {
            name: nameI.value.trim(),
            category: catI.value.trim(),
            price: Number(priceI.value),
            active: activeS.value === '1'
          };
          if (!body.name || !Number.isFinite(body.price) || body.price < 0 || priceI.value === '') {
            toast(t('common.required', 'هذا الحقل مطلوب'), 'error');
            return;
          }
          saveBtn.disabled = true;
          try {
            if (item) await put(`/items/${item.id}`, body);
            else await post('/items', body);
            toast(t('common.success', 'تمت العملية بنجاح'), 'success');
            m.close();
            await load();
            paint();
          } catch (err) {
            toast(err.message, 'error');
            saveBtn.disabled = false;
          }
        }
      });

      const m = modal({
        title: item ? 'تعديل صنف' : 'صنف جديد',
        content: h(
          'div',
          {},
          field('اسم الصنف', nameI),
          field('القسم', h('div', {}, catI, chips)),
          field('سعر الوحدة', priceI, 'تتغير الأسعار للعمليات الجديدة فقط، والعمليات القديمة تحتفظ بسعرها'),
          field('الحالة', activeS)
        ),
        footer: [h('button', { class: 'btn btn-ghost', text: t('common.cancel', 'إلغاء'), onClick: () => m.close() }), saveBtn]
      });
    }

    async function remove(item) {
      if (!(await confirm(`حذف الصنف «${item.name}»؟ لن تتأثر العمليات القديمة.`, { danger: true, okText: t('common.delete', 'حذف') }))) return;
      try {
        await del(`/items/${item.id}`);
        toast(t('common.success', 'تمت العملية بنجاح'), 'success');
        await load();
        paint();
      } catch (err) {
        toast(err.message, 'error');
      }
    }

    function paint() {
      listHolder.innerHTML = '';
      const shown = items.filter((i) => !query || i.name.includes(query) || (i.category || '').includes(query));
      if (!shown.length) {
        listHolder.appendChild(h('div', { class: 'card' }, emptyState(items.length ? 'لا نتائج' : 'لا توجد أصناف بعد', 'box')));
        return;
      }
      const groups = new Map();
      for (const i of shown) {
        const key = i.category || 'أخرى';
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(i);
      }
      for (const [cat, list] of groups) {
        const tbody = h('tbody');
        for (const i of list) {
          tbody.appendChild(
            h(
              'tr',
              {},
              h('td', {}, h('strong', { text: i.name })),
              h('td', {}, h('span', { class: 'gold', text: money(i.price) })),
              h('td', {}, badge(i.active ? 'فعّال' : 'مخفي', i.active ? 'var(--emerald)' : 'var(--muted)')),
              canWrite
                ? h(
                    'td',
                    {},
                    h(
                      'div',
                      { class: 'row' },
                      h('button', { class: 'btn btn-ghost btn-sm', html: icon('edit', 14), title: t('common.edit', 'تعديل'), onClick: () => openForm(i) }),
                      h('button', { class: 'btn btn-danger btn-sm', html: icon('trash', 14), title: t('common.delete', 'حذف'), onClick: () => remove(i) })
                    )
                  )
                : null
            )
          );
        }
        listHolder.appendChild(
          h(
            'div',
            { class: 'card mb-2' },
            h('div', { class: 'card-title' }, h('span', { text: `${cat} (${list.length})` })),
            h(
              'div',
              { class: 'table-wrap' },
              h(
                'table',
                {},
                h('thead', {}, h('tr', {}, h('th', { text: 'الصنف' }), h('th', { text: 'السعر' }), h('th', { text: 'الحالة' }), canWrite ? h('th', { text: '' }) : null)),
                tbody
              )
            )
          )
        );
      }
    }

    paint();
    bindMagnetic(root);
  }
};
