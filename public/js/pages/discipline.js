import { h, icon, badge, emptyState, skeleton, segTabs, modal, confirm, field, input, textarea, select, bindMagnetic } from '../ui.js';
import { t, money, fmtDate } from '../state.js';
import { get, post, del } from '../api.js';

const KIND_COLOR = { note: 'var(--info)', warning: 'var(--warning)', fine: 'var(--danger)' };

export default {
  id: 'discipline',
  minRank: 2,

  async render(root, ctx) {
    const site = ctx.site;
    const strings = site.strings.discipline;
    const user = ctx.user;
    const isStaff = ctx.rankOrder(user.rank) >= 3;
    const unsubs = [];
    let scope = 'mine';
    let records = [];

    root.innerHTML = '';

    const actions = [];
    if (isStaff) {
      actions.push(h('button', { class: 'btn btn-gold', html: `${icon('plus', 16)}<span>${strings.addNote}</span>`, onClick: () => openAdd() }));
    }
    actions.push(h('button', { class: 'btn btn-ghost', html: `${icon('refresh', 16)}<span>${t('common.refresh', 'تحديث')}</span>`, onClick: () => load() }));

    root.appendChild(
      h('div', { class: 'page-head' },
        h('div', {}, h('h1', { text: strings.title }), h('p', { text: `${user.displayName} • ${user.rankLabel}` })),
        h('div', { class: 'page-actions' }, ...actions)
      )
    );

    const tabsHolder = h('div', { class: 'mb-2' });
    const listHolder = h('div');
    root.appendChild(tabsHolder);
    root.appendChild(listHolder);

    const tabDefs = [{ id: 'mine', label: strings.mine }];
    if (isStaff) tabDefs.push({ id: 'all', label: strings.all });
    if (tabDefs.length > 1) {
      tabsHolder.appendChild(segTabs(tabDefs, scope, (id) => { scope = id; load(); }));
    }

    async function loadMembers() {
      if (ctx.rankOrder(user.rank) >= 4) {
        const data = await get('/admin/users');
        return (data.users || []).map((u) => ({ value: u.id, label: u.name + (u.inGameId ? ' • ' + u.inGameId : '') }));
      }
      const data = await get('/leaderboard');
      const rows = [...(data.leaderboard || [])];
      if (data.me && !rows.some((r) => r.id === data.me.id)) rows.push(data.me);
      return rows.map((r) => ({ value: r.id, label: r.name }));
    }

    function recordRow(r) {
      const tone = KIND_COLOR[r.kind] || 'var(--gold)';
      const target = r.user && r.user.name ? r.user.name : scope === 'mine' ? user.displayName : '—';
      return h('div', { class: 'timeline-item' },
        h('span', { class: 'timeline-dot', style: { background: tone } }),
        h('div', { class: 'timeline-body' },
          h('div', { class: 'between' },
            h('div', { class: 'row' },
              r.user && r.user.avatar ? h('img', { src: r.user.avatar, alt: '', style: { width: '28px', height: '28px', borderRadius: '50%' } }) : null,
              h('strong', { text: target })
            ),
            badge(r.kindLabel || r.kind, tone)
          ),
          h('p', { class: 'small', style: { margin: '6px 0' }, text: r.text }),
          h('div', { class: 'row-wrap' },
            r.kind === 'fine' && r.amount ? badge(money(r.amount), 'var(--danger)') : null,
            h('span', { class: 'small muted', text: `${strings.issuedBy}: ${r.by || '—'}` }),
            h('span', { class: 'small muted', text: fmtDate(r.createdAt) }),
            isStaff ? h('button', { class: 'icon-btn', title: t('common.delete', 'حذف'), html: icon('trash', 15), onClick: () => remove(r) }) : null
          )
        )
      );
    }

    function paint() {
      listHolder.innerHTML = '';
      if (!records.length) {
        listHolder.appendChild(h('div', { class: 'card' }, emptyState(strings.noRecords, 'shield')));
        return;
      }
      const timeline = h('div', { class: 'timeline' }, ...records.map(recordRow));
      listHolder.appendChild(
        h('div', { class: 'card' },
          h('div', { class: 'card-title' },
            h('span', { text: scope === 'mine' ? strings.mine : strings.all }),
            h('span', { class: 'small muted', text: String(records.length) })
          ),
          timeline
        )
      );
    }

    async function load() {
      listHolder.innerHTML = '';
      listHolder.appendChild(h('div', { class: 'card' }, skeleton(6)));
      try {
        const query = isStaff && scope === 'mine' ? `?userId=${encodeURIComponent(user.id)}` : '';
        const data = await get(`/discipline${query}`);
        records = data.records || [];
      } catch (err) {
        listHolder.innerHTML = '';
        listHolder.appendChild(h('div', { class: 'card' }, h('p', { class: 'danger-text', text: err.message })));
        ctx.toast(err.message, 'error');
        return;
      }
      paint();
    }

    async function remove(r) {
      const ok = await confirm(site.strings.admin.deleteConfirm, { danger: true });
      if (!ok) return;
      try {
        await del(`/discipline/${r.id}`);
        ctx.toast(t('common.success', 'تمت العملية بنجاح'), 'success');
        load();
      } catch (err) {
        ctx.toast(err.message, 'error');
      }
    }

    async function openAdd() {
      let options;
      try {
        options = await loadMembers();
      } catch (err) {
        ctx.toast(err.message, 'error');
        return;
      }
      options.unshift({ value: '', label: `— ${t('common.member', 'العضو')} —` });

      const memberSel = select(options);
      const kindOptions = Object.entries(site.statuses.disciplineKinds).map(([value, label]) => ({ value, label }));
      const kindSel = select(kindOptions);
      const reasonArea = textarea({ placeholder: t('common.notes', 'السبب') });
      const amountI = input({ type: 'number', min: '0', step: '0.01', placeholder: '0' });
      const amountField = field(strings.fineAmount, amountI, strings.fineDeductHint);
      amountField.style.display = 'none';
      kindSel.addEventListener('change', () => { amountField.style.display = kindSel.value === 'fine' ? '' : 'none'; });

      const content = h('div', {},
        field(t('common.member', 'العضو'), memberSel),
        field(strings.kind, kindSel),
        field(t('common.notes', 'السبب'), reasonArea),
        amountField
      );

      let self;
      async function submit() {
        const userId = memberSel.value;
        const kind = kindSel.value;
        const text = reasonArea.value.trim();
        const amount = Number(amountI.value) || 0;
        if (!userId || !text || (kind === 'fine' && amount <= 0)) {
          ctx.toast(site.strings.errors.validation, 'error');
          return;
        }
        try {
          await post('/discipline', { userId, kind, text, amount });
          ctx.toast(t('common.success', 'تمت العملية بنجاح'), 'success');
          self.close();
          load();
        } catch (err) {
          ctx.toast(err.message, 'error');
        }
      }

      self = modal({
        title: strings.addNote,
        content,
        footer: [
          h('button', { class: 'btn btn-ghost', text: t('common.cancel', 'إلغاء'), onClick: () => self.close() }),
          h('button', { class: 'btn btn-gold', text: t('common.create', 'إضافة'), onClick: submit })
        ]
      });
    }

    await load();
    unsubs.push(ctx.bus.on('discipline:new', () => load()));
    bindMagnetic(root);

    return () => unsubs.forEach((off) => off());
  }
};
