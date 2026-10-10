import { h, icon, badge, emptyState, skeleton, segTabs, modal, confirm, field, input, textarea, select, countUp, bindMagnetic } from '../ui.js';
import { t, money, fmtDate } from '../state.js';
import { get, post, put, del } from '../api.js';

export default {
  id: 'admin',
  minRank: 4,

  async render(root, ctx) {
    const site = ctx.site;
    const S = site.strings.admin;
    const errors = site.strings.errors;
    const user = ctx.user;
    const unsubs = [];
    let tab = 'products';
    let userQuery = '';
    let auditPage = 1;

    root.innerHTML = '';

    root.appendChild(
      h('div', { class: 'page-head' },
        h('div', {}, h('h1', { text: S.title }), h('p', { text: `${user.displayName} • ${user.rankLabel}` })),
        h('div', { class: 'page-actions' },
          h('button', { class: 'btn btn-ghost', html: `${icon('refresh', 16)}<span>${t('common.refresh', 'تحديث')}</span>`, onClick: () => activate(tab) })
        )
      )
    );

    const statsRow = h('div', { class: 'grid grid-4 mb-2' });
    const tabsHolder = h('div', { class: 'mb-2' });
    const body = h('div');
    root.appendChild(statsRow);
    root.appendChild(tabsHolder);
    root.appendChild(body);

    const TAB_DEFS = [
      { id: 'products', label: S.tabProducts },
      { id: 'users', label: S.tabUsers },
      { id: 'fines', label: S.tabFines },
      { id: 'internal', label: S.tabInternal },
      { id: 'announcements', label: S.tabAnnouncements },
      { id: 'target', label: S.tabTarget },
      { id: 'audit', label: S.tabAudit },
      { id: 'settings', label: S.tabSettings }
    ];

    function jx(v) {
      if (v === undefined || v === null) return '—';
      if (typeof v === 'string') return v;
      try {
        return JSON.stringify(v);
      } catch {
        return String(v);
      }
    }

    function errCard(err) {
      return h('div', { class: 'card' }, h('p', { class: 'danger-text', text: err.message || errors.server }));
    }

    async function uploadImage(file) {
      const formData = new FormData();
      formData.append('image', file);
      const res = await post('/admin/upload', undefined, { formData });
      return res.url;
    }

    async function loadStats() {
      try {
        const data = await get('/admin/overview');
        const s = data.stats || {};
        statsRow.innerHTML = '';
        const cards = [
          { icon: 'user', label: S.totalUsers, value: s.users || 0 },
          { icon: 'bag', label: S.totalProducts, value: s.products || 0 },
          { icon: 'receipt', label: S.totalOrders, value: s.ordersTotal || 0 },
          { icon: 'mail', label: S.openTickets, value: s.pendingTickets || 0 }
        ];
        for (const c of cards) {
          const card = h('div', { class: 'card stat-card' },
            h('div', { class: 'stat-label' }, h('span', { html: icon(c.icon, 15) }), h('span', { text: c.label })),
            h('div', { class: 'stat-value', text: '0' })
          );
          statsRow.appendChild(card);
          countUp(card.querySelector('.stat-value'), c.value, { duration: 1100 });
        }
      } catch {}
    }

    async function renderCatalog(opts) {
      body.innerHTML = '';
      body.appendChild(h('div', { class: 'card' }, skeleton(6)));
      let data;
      try {
        data = await get(opts.endpoint);
      } catch (err) {
        body.innerHTML = '';
        body.appendChild(errCard(err));
        ctx.toast(err.message, 'error');
        return;
      }
      const items = opts.collect(data);
      const cats = opts.withCategory
        ? (data.categories && data.categories.length ? data.categories : (site.defaults.categories || []))
        : [];

      function table() {
        if (!items.length) return emptyState(t('common.noData', 'لا توجد بيانات لعرضها'), 'box');
        const cols = [S.image, t('common.name', 'الاسم')];
        if (opts.withCategory) cols.push(t('shop.categories', 'القسم'));
        cols.push(t('common.price', 'السعر'), S.stock, S.active, t('common.actions', 'إجراءات'));
        const thead = h('thead', {}, h('tr', {}, ...cols.map((txt) => h('th', { text: txt }))));
        const tbody = h('tbody');
        for (const item of items) {
          const cells = [
            h('td', {}, item.imageUrl
              ? h('img', { src: item.imageUrl, alt: '', style: { width: '42px', height: '42px', borderRadius: '10px', objectFit: 'cover' } })
              : h('span', { html: icon('image', 18) })),
            h('td', {}, h('strong', { text: item.name }))
          ];
          if (opts.withCategory) cells.push(h('td', { text: item.category || '—' }));
          cells.push(
            h('td', { class: 'gold', text: money(item.price) }),
            h('td', { text: String(item.stock) }),
            h('td', {}, badge(item.active ? S.active : S.inactive, item.active ? 'var(--emerald)' : 'var(--muted)')),
            h('td', {}, h('div', { class: 'row' },
              h('button', { class: 'icon-btn', title: t('common.edit', 'تعديل'), html: icon('edit', 15), onClick: () => form(item) }),
              h('button', { class: 'icon-btn', title: t('common.delete', 'حذف'), html: icon('trash', 15), onClick: () => remove(item) })
            ))
          );
          tbody.appendChild(h('tr', {}, ...cells));
        }
        return h('div', { class: 'table-wrap' }, h('table', {}, thead, tbody));
      }

      function form(item) {
        const isEdit = Boolean(item);
        const nameI = input({ value: item ? item.name : '', placeholder: t('common.name', 'الاسم') });
        const descI = textarea({ placeholder: t('common.notes', 'الوصف') });
        if (item && item.description) descI.value = item.description;
        const catSel = opts.withCategory
          ? select(cats.map((c) => ({ value: c, label: c, selected: item && item.category === c })))
          : null;
        const priceI = input({ type: 'number', min: '0', step: '0.01', value: item ? String(item.price) : '' });
        const stockI = input({ type: 'number', min: '0', step: '1', value: item ? String(item.stock) : '0' });
        const sortI = input({ type: 'number', value: item ? String(item.sortOrder || 0) : '0' });
        const activeCb = h('input', { type: 'checkbox', checked: item ? Boolean(item.active) : true });
        const fileI = h('input', { class: 'input', type: 'file', accept: 'image/*' });
        const preview = item && item.imageUrl
          ? h('img', { src: item.imageUrl, alt: '', style: { width: '60px', height: '60px', borderRadius: '12px', objectFit: 'cover', marginBottom: '8px' } })
          : null;

        const content = h('div', {},
          field(t('common.name', 'الاسم'), nameI),
          opts.withCategory ? field(t('shop.categories', 'القسم'), catSel) : null,
          h('div', { class: 'grid grid-2' }, field(t('common.price', 'السعر'), priceI), field(S.stock, stockI)),
          field(S.image, h('div', {}, preview, fileI), S.uploadHint),
          field(t('common.notes', 'الوصف'), descI),
          field(t('target.progress', 'الترتيب'), sortI),
          h('label', { class: 'check-row' }, activeCb, h('span', { text: S.active }))
        );

        let self;
        async function submit() {
          const payload = {
            name: nameI.value.trim(),
            description: descI.value.trim(),
            price: Number(priceI.value) || 0,
            stock: Number(stockI.value) || 0,
            sortOrder: Number(sortI.value) || 0,
            active: activeCb.checked
          };
          if (opts.withCategory) payload.category = catSel.value;
          if (!payload.name) {
            ctx.toast(errors.validation, 'error');
            return;
          }
          try {
            if (fileI.files && fileI.files[0]) payload.imageUrl = await uploadImage(fileI.files[0]);
            else if (item && item.imageUrl) payload.imageUrl = item.imageUrl;
            if (isEdit) await put(`${opts.endpoint}/${item.id}`, payload);
            else await post(opts.endpoint, payload);
            ctx.toast(t('common.success', 'تمت العملية بنجاح'), 'success');
            self.close();
            renderCatalog(opts);
          } catch (err) {
            ctx.toast(err.message, 'error');
          }
        }

        self = modal({
          title: isEdit ? opts.editLabel : opts.addLabel,
          content,
          wide: true,
          footer: [
            h('button', { class: 'btn btn-ghost', text: t('common.cancel', 'إلغاء'), onClick: () => self.close() }),
            h('button', { class: 'btn btn-gold', text: t('common.save', 'حفظ'), onClick: submit })
          ]
        });
      }

      async function remove(item) {
        if (!(await confirm(S.deleteConfirm, { danger: true }))) return;
        try {
          await del(`${opts.endpoint}/${item.id}`);
          ctx.toast(t('common.success', 'تمت العملية بنجاح'), 'success');
          renderCatalog(opts);
        } catch (err) {
          ctx.toast(err.message, 'error');
        }
      }

      const card = h('div', { class: 'card' },
        h('div', { class: 'card-title' },
          h('span', { text: opts.title }),
          h('button', { class: 'btn btn-gold btn-sm', html: `${icon('plus', 15)}<span>${opts.addLabel}</span>`, onClick: () => form(null) })
        ),
        table()
      );
      body.innerHTML = '';
      body.appendChild(card);
    }

    function tabProducts() {
      renderCatalog({
        endpoint: '/admin/products',
        withCategory: true,
        title: S.tabProducts,
        addLabel: S.addProduct,
        editLabel: S.editProduct,
        collect: (d) => d.products || []
      });
    }

    function tabInternal() {
      renderCatalog({
        endpoint: '/admin/internal-items',
        withCategory: false,
        title: S.tabInternal,
        addLabel: t('common.create', 'عنصر جديد'),
        editLabel: t('common.edit', 'تعديل عنصر'),
        collect: (d) => d.items || []
      });
    }

    function usersTable(users) {
      if (!users.length) return emptyState(t('common.noData', 'لا يوجد أعضاء'), 'user');
      const thead = h('thead', {}, h('tr', {},
        h('th', { text: t('common.member', 'العضو') }),
        h('th', { text: t('common.rank', 'الرتبة') }),
        h('th', { text: t('common.balance', 'الرصيد') }),
        h('th', { text: t('idCard.inGameId', 'الرقم الداخلي') }),
        h('th', { text: t('common.status', 'الحالة') }),
        h('th', { text: t('common.actions', 'إجراءات') })
      ));
      const tbody = h('tbody');
      for (const u of users) {
        const rankSel = select(Object.values(site.ranks).map((r) => ({ value: r.key, label: r.label, selected: r.key === u.rank })));
        rankSel.style.minWidth = '130px';
        rankSel.addEventListener('change', () => changeRank(u, rankSel.value));
        tbody.appendChild(h('tr', {},
          h('td', {}, h('div', { class: 'cell-user' },
            h('img', { src: u.avatar, alt: '' }),
            h('div', {}, h('strong', { text: u.name }), h('div', { class: 'small muted', text: u.discordId }))
          )),
          h('td', {}, rankSel),
          h('td', {}, h('div', { class: 'row' },
            h('span', { class: 'gold', text: money(u.balance) }),
            h('button', { class: 'icon-btn', title: S.balanceAdjust, html: icon('coins', 15), onClick: () => balanceForm(u) })
          )),
          h('td', { text: u.inGameId || '—' }),
          h('td', {}, badge(u.banned ? S.ban : S.active, u.banned ? 'var(--danger)' : 'var(--emerald)')),
          h('td', {}, h('button', {
            class: u.banned ? 'btn btn-emerald btn-sm' : 'btn btn-danger btn-sm',
            text: u.banned ? S.unban : S.ban,
            onClick: () => toggleBan(u)
          }))
        ));
      }
      return h('div', { class: 'table-wrap' }, h('table', {}, thead, tbody));
    }

    async function changeRank(u, rank) {
      try {
        const res = await put(`/admin/users/${u.id}/rank`, { rank });
        ctx.toast((res && res.message) || S.rankChanged, 'success');
      } catch (err) {
        ctx.toast(err.message, 'error');
      }
      tabUsers();
    }

    function balanceForm(u) {
      const amountI = input({ type: 'number', step: '0.01', placeholder: '0' });
      const reasonI = input({ placeholder: S.adjustReason });
      let self;
      async function submit() {
        const delta = Number(amountI.value) || 0;
        if (!delta) {
          ctx.toast(errors.validation, 'error');
          return;
        }
        try {
          await put(`/admin/users/${u.id}/balance`, { delta, reason: reasonI.value.trim() });
          ctx.toast(t('common.success', 'تمت العملية بنجاح'), 'success');
          self.close();
          tabUsers();
        } catch (err) {
          ctx.toast(err.message, 'error');
        }
      }
      self = modal({
        title: `${S.balanceAdjust} • ${u.name}`,
        content: h('div', {},
          field(t('common.balance', 'الرصيد'), h('div', { class: 'gold', text: money(u.balance) })),
          field(t('treasury.amount', 'المبلغ'), amountI, t('admin.balanceHint', 'قيمة موجبة للإضافة، سالبة للخصم')),
          field(S.adjustReason, reasonI)
        ),
        footer: [
          h('button', { class: 'btn btn-ghost', text: t('common.cancel', 'إلغاء'), onClick: () => self.close() }),
          h('button', { class: 'btn btn-gold', text: t('common.save', 'حفظ'), onClick: submit })
        ]
      });
    }

    async function toggleBan(u) {
      const next = !u.banned;
      if (next && !(await confirm(S.banConfirm, { danger: true }))) return;
      try {
        await put(`/admin/users/${u.id}/ban`, { banned: next, reason: '' });
        ctx.toast(t('common.success', 'تمت العملية بنجاح'), 'success');
      } catch (err) {
        ctx.toast(err.message, 'error');
      }
      tabUsers();
    }

    async function tabUsers() {
      body.innerHTML = '';
      body.appendChild(h('div', { class: 'card' }, skeleton(6)));
      let data;
      try {
        data = await get(`/admin/users${userQuery ? '?q=' + encodeURIComponent(userQuery) : ''}`);
      } catch (err) {
        body.innerHTML = '';
        body.appendChild(errCard(err));
        ctx.toast(err.message, 'error');
        return;
      }
      const users = data.users || [];
      const searchI = input({ placeholder: t('common.search', 'بحث...'), value: userQuery });
      searchI.style.maxWidth = '220px';
      searchI.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          userQuery = searchI.value.trim();
          tabUsers();
        }
      });
      const card = h('div', { class: 'card' },
        h('div', { class: 'card-title' },
          h('span', { text: `${S.tabUsers} (${data.total || users.length})` }),
          h('div', { class: 'row' }, searchI, h('button', { class: 'btn btn-ghost btn-sm', html: icon('search', 15), onClick: () => { userQuery = searchI.value.trim(); tabUsers(); } }))
        ),
        usersTable(users)
      );
      body.innerHTML = '';
      body.appendChild(card);
    }

    function finesCard(records) {
      if (!records.length) return h('div', { class: 'card mt-2' }, emptyState(t('discipline.noRecords', 'لا توجد مخالفات مسجلة'), 'coins'));
      const thead = h('thead', {}, h('tr', {},
        h('th', { text: t('common.member', 'العضو') }),
        h('th', { text: t('discipline.fineAmount', 'المبلغ') }),
        h('th', { text: t('common.notes', 'السبب') }),
        h('th', { text: t('common.createdBy', 'صدرت بواسطة') }),
        h('th', { text: t('common.date', 'التاريخ') })
      ));
      const tbody = h('tbody');
      for (const r of records.slice(0, 30)) {
        tbody.appendChild(h('tr', {},
          h('td', { text: r.user ? r.user.name : '—' }),
          h('td', { class: 'danger-text', text: money(r.amount) }),
          h('td', { text: r.text }),
          h('td', { text: r.by || '—' }),
          h('td', { text: fmtDate(r.createdAt) })
        ));
      }
      return h('div', { class: 'card mt-2' }, h('div', { class: 'table-wrap' }, h('table', {}, thead, tbody)));
    }

    async function tabFines() {
      body.innerHTML = '';
      body.appendChild(h('div', { class: 'card' }, skeleton(5)));
      let users = [];
      let records = [];
      try {
        const [uRes, dRes] = await Promise.all([get('/admin/users'), get('/discipline')]);
        users = uRes.users || [];
        records = (dRes.records || []).filter((r) => r.kind === 'fine');
      } catch (err) {
        body.innerHTML = '';
        body.appendChild(errCard(err));
        ctx.toast(err.message, 'error');
        return;
      }
      const memberSel = select([
        { value: '', label: `— ${t('common.member', 'العضو')} —` },
        ...users.map((u) => ({ value: u.id, label: u.name + (u.inGameId ? ' • ' + u.inGameId : '') }))
      ]);
      const amountI = input({ type: 'number', min: '0', step: '0.01', placeholder: '0' });
      const reasonI = textarea({ placeholder: t('treasury.reason', 'السبب / الوصف') });

      async function submit() {
        const userId = memberSel.value;
        const amount = Number(amountI.value) || 0;
        const text = reasonI.value.trim();
        if (!userId || amount <= 0 || !text) {
          ctx.toast(errors.validation, 'error');
          return;
        }
        try {
          await post('/discipline', { userId, kind: 'fine', amount, text });
          ctx.toast(t('common.success', 'تمت العملية بنجاح'), 'success');
          tabFines();
        } catch (err) {
          ctx.toast(err.message, 'error');
        }
      }

      const formCard = h('div', { class: 'card' },
        h('div', { class: 'card-title' }, h('span', { text: S.tabFines })),
        field(t('common.member', 'العضو'), memberSel),
        field(t('discipline.fineAmount', 'مبلغ الغرامة'), amountI, t('discipline.fineDeductHint', 'سيتم خصم المبلغ من رصيد العضو تلقائياً')),
        field(t('treasury.reason', 'السبب'), reasonI),
        h('button', { class: 'btn btn-danger', html: `${icon('alert', 15)}<span>${t('admin.tabFines', 'إصدار غرامة')}</span>`, onClick: submit })
      );

      body.innerHTML = '';
      body.appendChild(formCard);
      body.appendChild(finesCard(records));
    }

    function annRow(a) {
      return h('div', { class: 'card', style: { background: 'rgba(255,255,255,0.03)' } },
        h('div', { class: 'between' },
          h('strong', { text: a.title }),
          a.pinned ? badge(t('dashboard.announcements', 'مثبّت'), 'var(--gold)') : h('span', { class: 'small muted', text: fmtDate(a.createdAt) })
        ),
        h('p', { class: 'small muted', text: a.body }),
        h('div', { class: 'row-wrap mt-1' },
          h('button', { class: 'btn btn-ghost btn-sm', html: `${icon('edit', 14)}<span>${t('common.edit', 'تعديل')}</span>`, onClick: () => annForm(a) }),
          h('button', { class: 'btn btn-danger btn-sm', html: `${icon('trash', 14)}<span>${t('common.delete', 'حذف')}</span>`, onClick: () => removeAnn(a) })
        )
      );
    }

    function annForm(a) {
      const isEdit = Boolean(a);
      const titleI = input({ value: a ? a.title : '', placeholder: S.announcementTitle });
      const bodyI = textarea({ placeholder: S.announcementBody });
      if (a && a.body) bodyI.value = a.body;
      const pinCb = h('input', { type: 'checkbox', checked: a ? Boolean(a.pinned) : false });
      let self;
      async function submit() {
        const title = titleI.value.trim();
        const body = bodyI.value.trim();
        if (!title || !body) {
          ctx.toast(errors.validation, 'error');
          return;
        }
        try {
          const payload = { title, body, pinned: pinCb.checked };
          if (isEdit) await put(`/admin/announcements/${a.id || a._id}`, payload);
          else await post('/admin/announcements', payload);
          ctx.toast(t('common.success', 'تمت العملية بنجاح'), 'success');
          self.close();
          tabAnnouncements();
        } catch (err) {
          ctx.toast(err.message, 'error');
        }
      }
      self = modal({
        title: isEdit ? t('common.edit', 'تعديل') : S.addAnnouncement,
        content: h('div', {},
          field(S.announcementTitle, titleI),
          field(S.announcementBody, bodyI),
          h('label', { class: 'check-row' }, pinCb, h('span', { text: t('dashboard.announcements', 'مثبّت') }))
        ),
        footer: [
          h('button', { class: 'btn btn-ghost', text: t('common.cancel', 'إلغاء'), onClick: () => self.close() }),
          h('button', { class: 'btn btn-gold', text: t('common.save', 'حفظ'), onClick: submit })
        ]
      });
    }

    async function removeAnn(a) {
      if (!(await confirm(S.deleteConfirm, { danger: true }))) return;
      try {
        await del(`/admin/announcements/${a.id || a._id}`);
        ctx.toast(t('common.success', 'تمت العملية بنجاح'), 'success');
        tabAnnouncements();
      } catch (err) {
        ctx.toast(err.message, 'error');
      }
    }

    async function tabAnnouncements() {
      body.innerHTML = '';
      body.appendChild(h('div', { class: 'card' }, skeleton(5)));
      let data;
      try {
        data = await get('/admin/announcements');
      } catch (err) {
        body.innerHTML = '';
        body.appendChild(errCard(err));
        ctx.toast(err.message, 'error');
        return;
      }
      const list = data.announcements || [];
      const card = h('div', { class: 'card' },
        h('div', { class: 'card-title' },
          h('span', { text: S.tabAnnouncements }),
          h('button', { class: 'btn btn-gold btn-sm', html: `${icon('plus', 15)}<span>${S.addAnnouncement}</span>`, onClick: () => annForm(null) })
        ),
        list.length ? h('div', { class: 'col' }, ...list.map(annRow)) : emptyState(t('dashboard.announcements', 'الإعلانات'), 'mail')
      );
      body.innerHTML = '';
      body.appendChild(card);
    }

    async function tabTarget() {
      body.innerHTML = '';
      body.appendChild(h('div', { class: 'card' }, skeleton(5)));
      let data;
      try {
        data = await get('/admin/target');
      } catch (err) {
        body.innerHTML = '';
        body.appendChild(errCard(err));
        ctx.toast(err.message, 'error');
        return;
      }
      const target = data.target;
      const history = data.history || [];
      const goalI = input({ type: 'number', min: '0', value: target ? String(target.goal) : '0' });

      async function save() {
        const goal = Number(goalI.value) || 0;
        try {
          await put('/admin/target', { goal });
          ctx.toast(t('common.success', 'تمت العملية بنجاح'), 'success');
          tabTarget();
        } catch (err) {
          ctx.toast(err.message, 'error');
        }
      }

      const currentCard = h('div', { class: 'card' },
        h('div', { class: 'card-title' },
          h('span', { text: S.tabTarget }),
          target ? badge(`${target.percent}%`, target.percent >= 100 ? 'var(--emerald)' : 'var(--gold)') : null
        ),
        target ? h('div', {},
          h('div', { class: 'between' },
            h('span', { class: 'small muted', text: `${t('target.goal', 'الهدف')}: ${target.goal}` }),
            h('span', { class: 'small muted', text: `${t('target.progress', 'الإنجاز')}: ${target.score}` })
          ),
          h('div', { class: 'progress mt-1' }, h('div', { class: 'progress-fill', style: { width: target.percent + '%' } }))
        ) : null,
        h('div', { class: 'grid grid-2 mt-2' },
          field(S.weeklyGoal, goalI),
          h('div', { class: 'field' },
            h('span', { class: 'field-label', text: ' ' }),
            h('button', { class: 'btn btn-gold', html: `${icon('check', 15)}<span>${t('common.save', 'حفظ')}</span>`, onClick: save })
          )
        )
      );

      const historyCard = h('div', { class: 'card' },
        h('div', { class: 'card-title' }, h('span', { text: t('target.history', 'الأهداف السابقة') })),
        history.length
          ? h('div', { class: 'table-wrap' }, h('table', {},
              h('thead', {}, h('tr', {},
                h('th', { text: t('target.weekOf', 'أسبوع') }),
                h('th', { text: t('target.goal', 'الهدف') }),
                h('th', { text: site.strings.leaderboard.score }),
                h('th', { text: t('common.status', 'الحالة') })
              )),
              h('tbody', {}, ...history.map((row) => h('tr', {},
                h('td', { text: fmtDate(row.weekStart, false) }),
                h('td', { text: String(row.goal) }),
                h('td', { text: String(row.score) }),
                h('td', {}, row.completed ? badge(t('target.completed', 'اكتمل'), 'var(--emerald)') : badge(t('common.no', 'غير مكتمل'), 'var(--muted)'))
              )))
            ))
          : emptyState(t('target.noHistory', 'لا يوجد أرشيف بعد'), 'target')
      );

      body.innerHTML = '';
      body.appendChild(h('div', { class: 'grid grid-2' }, currentCard, historyCard));
    }

    async function tabAudit() {
      body.innerHTML = '';
      body.appendChild(h('div', { class: 'card' }, skeleton(6)));
      let data;
      try {
        data = await get(`/admin/audit?page=${auditPage}&limit=50`);
      } catch (err) {
        body.innerHTML = '';
        body.appendChild(errCard(err));
        ctx.toast(err.message, 'error');
        return;
      }
      const rows = data.rows || [];
      const thead = h('thead', {}, h('tr', {},
        h('th', { text: S.auditAction }),
        h('th', { text: S.auditActor }),
        h('th', { text: S.auditTarget }),
        h('th', { text: S.auditBefore }),
        h('th', { text: S.auditAfter }),
        h('th', { text: t('common.date', 'التاريخ') })
      ));
      const tbody = h('tbody');
      for (const r of rows) {
        tbody.appendChild(h('tr', {},
          h('td', { class: 'gold', text: r.action }),
          h('td', { text: r.actorName || '—' }),
          h('td', { text: `${r.targetType || ''}${r.targetId ? ' • ' + r.targetId : ''}` }),
          h('td', { class: 'small muted', text: jx(r.before) }),
          h('td', { class: 'small muted', text: jx(r.after) }),
          h('td', { text: fmtDate(r.at) })
        ));
      }
      const pages = data.pages || 1;
      const pager = h('div', { class: 'row-wrap mt-1' },
        h('button', { class: 'btn btn-ghost btn-sm', text: t('common.back', 'السابق'), disabled: auditPage <= 1, onClick: () => { auditPage = Math.max(1, auditPage - 1); tabAudit(); } }),
        h('span', { class: 'pill', text: `${data.page} / ${pages}` }),
        h('button', { class: 'btn btn-ghost btn-sm', text: t('common.next', 'التالي'), disabled: auditPage >= pages, onClick: () => { auditPage += 1; tabAudit(); } })
      );
      const card = h('div', { class: 'card' },
        h('div', { class: 'card-title' }, h('span', { text: `${S.tabAudit} (${data.total})` })),
        rows.length ? h('div', { class: 'table-wrap' }, h('table', {}, thead, tbody)) : emptyState(S.noAudit, 'receipt'),
        pager
      );
      body.innerHTML = '';
      body.appendChild(card);
    }

    async function tabSettings() {
      body.innerHTML = '';
      body.appendChild(h('div', { class: 'card' }, skeleton(8)));
      let data;
      try {
        data = await get('/admin/settings');
      } catch (err) {
        body.innerHTML = '';
        body.appendChild(errCard(err));
        ctx.toast(err.message, 'error');
        return;
      }
      const s = data.settings || {};
      const siteNameI = input({ value: s.siteName || '' });
      const taglineI = input({ value: s.siteTagline || '' });
      const motdI = input({ value: s.motd || '' });
      const noticeI = input({ value: s.shopNotice || '' });
      const goalI = input({ type: 'number', min: '0', value: String(s.weeklyGoal || 0) });
      const plotsI = input({ type: 'number', min: '1', value: String(s.plotsCount || 0) });
      const lockCb = h('input', { type: 'checkbox', checked: Boolean(s.lockoutEnabled) });
      const lockStartI = input({ type: 'time', value: s.lockoutStart || '22:00' });
      const lockEndI = input({ type: 'time', value: s.lockoutEnd || '04:00' });
      const maintCb = h('input', { type: 'checkbox', checked: Boolean(s.maintenance) });
      const catsI = input({ value: (s.categories || []).join('، ') });
      const tcatsI = input({ value: (s.treasuryCategories || []).join('، ') });

      async function save() {
        const split = (v) => v.split(/[،,]/).map((x) => x.trim()).filter(Boolean);
        const payload = {
          siteName: siteNameI.value.trim(),
          siteTagline: taglineI.value.trim(),
          motd: motdI.value.trim(),
          shopNotice: noticeI.value.trim(),
          weeklyGoal: Number(goalI.value) || 0,
          plotsCount: Number(plotsI.value) || 0,
          lockoutEnabled: lockCb.checked,
          lockoutStart: lockStartI.value,
          lockoutEnd: lockEndI.value,
          maintenance: maintCb.checked,
          categories: split(catsI.value),
          treasuryCategories: split(tcatsI.value)
        };
        try {
          const res = await put('/admin/settings', payload);
          ctx.toast((res && res.message) || S.settingsSaved, 'success');
          tabSettings();
        } catch (err) {
          ctx.toast(err.message, 'error');
        }
      }

      const content = h('div', {},
        h('div', { class: 'grid grid-2' },
          field(t('auth.loginTitle', 'اسم الموقع'), siteNameI),
          field(t('auth.loginSubtitle', 'الوصف المختصر'), taglineI)
        ),
        field('MOTD', motdI),
        field(t('shop.title', 'ملاحظة المتجر'), noticeI),
        h('div', { class: 'grid grid-2' },
          field(S.weeklyGoal, goalI),
          field(t('farm.plots', 'عدد البقع'), plotsI)
        ),
        h('div', { class: 'grid grid-2' },
          field(t('shop.categories', 'الأقسام'), catsI, t('common.notes', 'افصل بين الأقسام بفاصلة')),
          field(t('treasury.category', 'تصنيفات الخزينة'), tcatsI, t('common.notes', 'افصل بين التصنيفات بفاصلة'))
        ),
        h('div', { class: 'grid grid-2' },
          field(t('attendance.lockout', 'قفل الدوام الليلي'), h('label', { class: 'check-row' }, lockCb, h('span', { text: t('common.yes', 'مفعّل') }))),
          field(t('attendance.lockoutFrom', 'يبدأ'), lockStartI)
        ),
        h('div', { class: 'grid grid-2' },
          field(t('attendance.lockoutTo', 'ينتهي'), lockEndI),
          field(t('orders.title', 'وضع الصيانة'), h('label', { class: 'check-row' }, maintCb, h('span', { text: t('admin.active', 'مفعّل') })))
        ),
        h('button', { class: 'btn btn-gold', html: `${icon('check', 15)}<span>${S.saveSettings}</span>`, onClick: save })
      );

      body.innerHTML = '';
      body.appendChild(h('div', { class: 'card' }, h('div', { class: 'card-title' }, h('span', { text: S.tabSettings })), content));
    }

    const TABS = {
      products: tabProducts,
      users: tabUsers,
      fines: tabFines,
      internal: tabInternal,
      announcements: tabAnnouncements,
      target: tabTarget,
      audit: tabAudit,
      settings: tabSettings
    };

    function activate(id) {
      tab = id;
      const fn = TABS[id];
      if (fn) fn();
    }

    tabsHolder.appendChild(segTabs(TAB_DEFS, tab, (id) => activate(id)));

    loadStats();
    activate(tab);

    unsubs.push(ctx.bus.on('user:updated', () => { if (tab === 'users') tabUsers(); }));
    unsubs.push(ctx.bus.on('announcement:new', () => { if (tab === 'announcements') tabAnnouncements(); }));
    bindMagnetic(root);

    return () => unsubs.forEach((off) => off());
  }
};
