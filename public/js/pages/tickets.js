import { h, icon, badge, emptyState, skeleton, segTabs, modal, field, textarea, select, bindMagnetic } from '../ui.js';
import { t, fmtDate, statusLabel } from '../state.js';
import { get, post, put } from '../api.js';

const STATUS_COLOR = { pending: 'var(--warning)', approved: 'var(--emerald)', rejected: 'var(--danger)' };

export default {
  id: 'tickets',
  minRank: 2,

  async render(root, ctx) {
    const site = ctx.site;
    const strings = site.strings.tickets;
    const user = ctx.user;
    const isStaff = ctx.rankOrder(user.rank) >= 3;
    const unsubs = [];
    let scope = isStaff ? 'all' : 'mine';
    let tickets = [];

    root.innerHTML = '';

    root.appendChild(
      h('div', { class: 'page-head' },
        h('div', {}, h('h1', { text: strings.title }), h('p', { text: `${user.displayName} • ${user.rankLabel}` })),
        h('div', { class: 'page-actions' },
          h('button', { class: 'btn btn-gold', html: `${icon('mail', 16)}<span>${strings.create}</span>`, onClick: () => openCreate() }),
          h('button', { class: 'btn btn-ghost', html: `${icon('refresh', 16)}<span>${t('common.refresh', 'تحديث')}</span>`, onClick: () => load() })
        )
      )
    );

    const tabsHolder = h('div', { class: 'mb-2' });
    const listHolder = h('div');
    root.appendChild(tabsHolder);
    root.appendChild(listHolder);

    const tabDefs = [{ id: 'mine', label: strings.myTickets }];
    if (isStaff) tabDefs.push({ id: 'all', label: strings.allTickets });
    if (tabDefs.length > 1) {
      tabsHolder.appendChild(segTabs(tabDefs, scope, (id) => { scope = id; load(); }));
    }

    function ticketCard(tk) {
      const tone = STATUS_COLOR[tk.status] || 'var(--gold)';
      const canHandle = isStaff && tk.status === 'pending';
      return h('div', { class: 'card' },
        h('div', { class: 'between' },
          h('div', { class: 'row' },
            scope === 'all' && tk.user && tk.user.avatar ? h('img', { src: tk.user.avatar, alt: '', style: { width: '32px', height: '32px', borderRadius: '50%' } }) : null,
            h('div', {},
              h('strong', { text: scope === 'all' && tk.user ? tk.user.name : tk.typeLabel }),
              scope === 'all' && tk.user ? h('div', { class: 'small muted', text: tk.typeLabel }) : null
            )
          ),
          badge(tk.statusLabel || statusLabel('ticket', tk.status), tone)
        ),
        h('p', { class: 'small', style: { margin: '10px 0' }, text: tk.message }),
        tk.resolution
          ? h('div', { class: 'card', style: { padding: '10px 12px', background: 'rgba(255,255,255,0.03)' } },
              h('div', { class: 'small gold', text: strings.resolution }),
              h('p', { class: 'small', style: { margin: '4px 0 0' }, text: tk.resolution })
            )
          : null,
        h('div', { class: 'between mt-1' },
          h('span', { class: 'small muted', text: fmtDate(tk.createdAt) }),
          h('span', { class: 'small muted', text: tk.handledBy ? `${t('tickets.handledBy', 'بواسطة')}: ${tk.handledBy}` : '' })
        ),
        canHandle
          ? h('div', { class: 'row-wrap mt-1' },
              h('button', { class: 'btn btn-emerald btn-sm', html: `${icon('check', 15)}<span>${strings.approve}</span>`, onClick: () => openResolve(tk, 'approved') }),
              h('button', { class: 'btn btn-danger btn-sm', html: `${icon('close', 15)}<span>${strings.reject}</span>`, onClick: () => openResolve(tk, 'rejected') })
            )
          : null
      );
    }

    function paint() {
      listHolder.innerHTML = '';
      if (!tickets.length) {
        listHolder.appendChild(h('div', { class: 'card' }, emptyState(strings.noTickets, 'mail')));
        return;
      }
      listHolder.appendChild(h('div', { class: 'grid grid-2' }, ...tickets.map(ticketCard)));
    }

    async function load() {
      listHolder.innerHTML = '';
      listHolder.appendChild(h('div', { class: 'card' }, skeleton(6)));
      try {
        const data = scope === 'all' ? await get('/tickets') : await get('/tickets/mine');
        tickets = data.tickets || [];
      } catch (err) {
        listHolder.innerHTML = '';
        listHolder.appendChild(h('div', { class: 'card' }, h('p', { class: 'danger-text', text: err.message })));
        ctx.toast(err.message, 'error');
        return;
      }
      paint();
    }

    function openCreate() {
      const typeOptions = Object.entries(site.statuses.ticketTypes).map(([value, label]) => ({ value, label }));
      const typeSel = select(typeOptions);
      const messageArea = textarea({ placeholder: strings.messagePlaceholder });
      let self;
      async function submit() {
        const message = messageArea.value.trim();
        if (!message) {
          ctx.toast(site.strings.errors.validation, 'error');
          return;
        }
        try {
          const res = await post('/tickets', { type: typeSel.value, message });
          ctx.toast((res && res.message) || strings.submitted, 'success');
          self.close();
          load();
        } catch (err) {
          ctx.toast(err.message, 'error');
        }
      }
      self = modal({
        title: strings.create,
        content: h('div', {}, field(strings.type, typeSel), field(strings.message, messageArea)),
        footer: [
          h('button', { class: 'btn btn-ghost', text: t('common.cancel', 'إلغاء'), onClick: () => self.close() }),
          h('button', { class: 'btn btn-gold', text: t('common.create', 'إرسال'), onClick: submit })
        ]
      });
    }

    function openResolve(tk, status) {
      const resolutionArea = textarea({ placeholder: strings.resolution });
      let self;
      async function submit() {
        try {
          await put(`/tickets/${tk.id}`, { status, resolution: resolutionArea.value.trim() });
          ctx.toast(t('common.success', 'تمت العملية بنجاح'), 'success');
          self.close();
          load();
        } catch (err) {
          ctx.toast(err.message, 'error');
        }
      }
      self = modal({
        title: status === 'approved' ? strings.approve : strings.reject,
        content: h('div', {},
          h('p', { class: 'small muted', text: tk.typeLabel }),
          h('p', { class: 'small', text: tk.message }),
          field(strings.resolution, resolutionArea)
        ),
        footer: [
          h('button', { class: 'btn btn-ghost', text: t('common.cancel', 'إلغاء'), onClick: () => self.close() }),
          h('button', { class: status === 'approved' ? 'btn btn-emerald' : 'btn btn-danger', text: t('common.confirm', 'تأكيد'), onClick: submit })
        ]
      });
    }

    await load();
    unsubs.push(
      ctx.bus.on('ticket:resolved', () => load()),
      ctx.bus.on('ticket:updated', () => load())
    );
    bindMagnetic(root);

    return () => unsubs.forEach((off) => off());
  }
};
