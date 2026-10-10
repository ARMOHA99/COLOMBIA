import { h, icon, toast, modal, confirm, progressRing, badge, emptyState, skeleton, field, input, textarea, select, bindMagnetic } from '../ui.js';
import { t, fmtDate, statusLabel } from '../state.js';
import { get, post, put, del } from '../api.js';
import * as bus from '../bus.js';

const RESULT_COLOR = { win: 'var(--emerald)', loss: 'var(--danger)', pending: 'var(--warning)' };

export default {
  id: 'operations',
  minRank: 2,

  async render(root, ctx) {
    root.appendChild(h('div', { class: 'card' }, skeleton(6)));

    let data;
    try {
      data = await get('/operations');
    } catch (err) {
      root.innerHTML = '';
      root.appendChild(h('div', { class: 'card' }, h('p', { class: 'danger-text', text: err.message })));
      return;
    }
    root.innerHTML = '';

    const site = ctx.site;
    const strings = site.strings.operations;
    const isStaff = ctx.rankOrder(ctx.user.rank) >= 3;
    const unsubs = [];
    let members = null;
    let ops = data.operations.slice();

    const head = h(
      'div',
      { class: 'page-head' },
      h(
        'div',
        {},
        h('h1', { text: strings.title }),
        h('p', { text: isStaff ? strings.feed : strings.readOnly })
      ),
      h(
        'div',
        { class: 'page-actions' },
        h('button', {
          class: 'btn btn-ghost',
          html: `${icon('refresh', 16)}<span>${t('common.refresh', 'تحديث')}</span>`,
          onClick: () => ctx.navigate('#/operations')
        }),
        isStaff
          ? h('button', {
              class: 'btn btn-gold',
              html: `${icon('plus', 16)}<span>${strings.create}</span>`,
              onClick: () => openForm(null)
            })
          : null
      )
    );
    root.appendChild(head);

    if (!isStaff) {
      root.appendChild(
        h(
          'div',
          { class: 'card mb-2', style: { borderColor: 'var(--border)' } },
          h('div', { class: 'row-wrap' }, h('span', { class: 'gold', html: icon('alert', 18) }), h('span', { text: strings.readOnly }))
        )
      );
    }

    const ringHolder = h('div', { class: 'row', style: { justifyContent: 'center', padding: '10px 0' } });
    const bar = h('div', { class: 'progress mt-1' }, h('div', { class: 'progress-fill', style: { width: '0%' } }));
    const targetMeta = h('div', { class: 'row-wrap mt-1', style: { justifyContent: 'center' } });

    function paintTarget(target) {
      ringHolder.innerHTML = '';
      targetMeta.innerHTML = '';
      if (!target) {
        ringHolder.appendChild(emptyState(t('target.noHistory', 'لا يوجد أرشيف بعد'), 'target'));
        bar.querySelector('.progress-fill').style.width = '0%';
        return;
      }
      ringHolder.appendChild(progressRing(target.percent, { label: t('target.progress', 'نسبة الإنجاز') }));
      bar.classList.toggle('glow', target.glowing || target.completed);
      bar.querySelector('.progress-fill').style.width = `${target.percent}%`;
      targetMeta.append(
        h('span', { class: 'pill', text: `${t('target.goal', 'الهدف')}: ${target.goal}` }),
        h('span', { class: 'pill', text: `${t('target.remaining', 'المتبقي')}: ${target.remaining}` }),
        h('span', { class: 'pill', text: `W ${target.wins} / L ${target.losses}` }),
        target.completed ? badge(t('target.completed', 'اكتمل الهدف الأسبوعي! 🎉'), 'var(--emerald)') : null
      );
    }

    const targetCard = h(
      'div',
      { class: 'card mb-2' },
      h(
        'div',
        { class: 'card-title' },
        h('span', { text: t('target.title', 'الهدف الأسبوعي') }),
        h('span', { class: 'small muted', text: t('target.resetInfo', 'يُعاد الضبط تلقائياً كل يوم اثنين') })
      ),
      ringHolder,
      bar,
      targetMeta
    );
    root.appendChild(targetCard);

    const feedEl = h('div', { class: 'timeline' });

    function openForm(op) {
      openFormAsync(op);
    }

    async function openFormAsync(op) {
      const list = await getMembers();
      const titleI = input({ value: op ? op.title : '', placeholder: strings.title, maxlength: 120 });
      const typeS = select(
        (site.defaults.operationTypes || []).map((tp) => ({ value: tp.key, label: tp.label, selected: op ? op.typeKey === tp.key : false }))
      );
      const resultS = select(
        Object.entries(site.statuses.opResult).map(([k, v]) => ({ value: k, label: v, selected: op ? op.result === k : k === 'pending' }))
      );
      const dateI = input({
        type: 'datetime-local',
        value: op && op.date ? new Date(new Date(op.date).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)
      });
      const partS = select(
        list.map((m) => ({ value: m.id, label: m.name, selected: op ? (op.participants || []).some((p) => p.id === m.id) : false })),
        { multiple: true, size: 6 }
      );
      const notesI = textarea({ maxlength: 1000, placeholder: t('common.notes', 'ملاحظات') });
      if (op) notesI.value = op.notes || '';

      const content = h(
        'div',
        {},
        field(t('common.name', 'العنوان'), titleI),
        field(strings.type, typeS),
        field(strings.result, resultS),
        field(t('common.date', 'التاريخ'), dateI),
        field(strings.participants, partS, strings.selectParticipants),
        field(t('common.notes', 'ملاحظات'), notesI)
      );

      const saveBtn = h('button', {
        class: 'btn btn-gold',
        text: t('common.save', 'حفظ'),
        onClick: async () => {
          const body = {
            title: titleI.value.trim(),
            typeKey: typeS.value,
            date: dateI.value ? new Date(dateI.value) : new Date(),
            result: resultS.value,
            participants: Array.from(partS.selectedOptions).map((o) => o.value),
            notes: notesI.value.trim()
          };
          if (!body.title) {
            toast(t('common.required', 'هذا الحقل مطلوب'), 'error');
            return;
          }
          saveBtn.disabled = true;
          try {
            if (op) await put(`/operations/${op.id}`, body);
            else await post('/operations', body);
            toast(t('common.success', 'تمت العملية بنجاح'), 'success');
            m.close();
            await refresh();
          } catch (err) {
            toast(err.message, 'error');
            saveBtn.disabled = false;
          }
        }
      });
      const m = modal({
        title: op ? strings.edit : strings.create,
        wide: true,
        content,
        footer: [h('button', { class: 'btn btn-ghost', text: t('common.cancel', 'إلغاء'), onClick: () => m.close() }), saveBtn]
      });
    }

    async function getMembers() {
      if (members) return members;
      try {
        const res = await get('/leaderboard');
        members = (res.leaderboard || []).map((r) => ({ id: r.id, name: r.name, avatar: r.avatar }));
      } catch {
        members = [];
      }
      return members;
    }

    async function removeOp(op) {
      if (!(await confirm(strings.deleteConfirm, { danger: true, okText: t('common.delete', 'حذف') }))) return;
      try {
        await del(`/operations/${op.id}`);
        toast(t('common.success', 'تمت العملية بنجاح'), 'success');
        await refresh();
      } catch (err) {
        toast(err.message, 'error');
      }
    }

    function paintFeed() {
      feedEl.innerHTML = '';
      if (!ops.length) {
        feedEl.appendChild(emptyState(strings.noOps, 'target'));
        return;
      }
      for (const op of ops) {
        const people = op.participants || [];
        const avatars = h(
          'div',
          { class: 'row', style: { gap: '4px' } },
          ...people.slice(0, 6).map((p) =>
            h('img', {
              src: p.avatar,
              title: p.name,
              alt: '',
              style: { width: '26px', height: '26px', borderRadius: '50%', border: '1px solid var(--border)' }
            })
          )
        );
        const actions = isStaff
          ? h(
              'div',
              { class: 'row' },
              h('button', { class: 'btn btn-ghost btn-sm', html: icon('edit', 14), title: t('common.edit', 'تعديل'), onClick: () => openForm(op) }),
              h('button', { class: 'btn btn-danger btn-sm', html: icon('trash', 14), title: t('common.delete', 'حذف'), onClick: () => removeOp(op) })
            )
          : null;
        feedEl.appendChild(
          h(
            'div',
            { class: 'timeline-item' },
            h('span', { class: 'timeline-dot', style: { background: RESULT_COLOR[op.result] || 'var(--gold)' } }),
            h(
              'div',
              { class: 'timeline-body' },
              h(
                'div',
                { class: 'between' },
                h('strong', { class: 'tl-title', text: op.title }),
                badge(statusLabel('opResult', op.result), RESULT_COLOR[op.result] || 'var(--gold)')
              ),
              h('div', { class: 'tl-sub', text: `${op.typeLabel || ''} • ${fmtDate(op.date)}` }),
              op.notes ? h('p', { class: 'small muted', style: { margin: '6px 0 0' }, text: op.notes }) : null,
              h(
                'div',
                { class: 'between mt-1' },
                h(
                  'div',
                  { class: 'row-wrap' },
                  avatars,
                  h('span', { class: 'small muted', text: people.length ? people.map((p) => p.name).join('، ') : strings.selectParticipants })
                ),
                actions
              )
            )
          )
        );
      }
    }

    async function refresh() {
      try {
        data = await get('/operations');
        ops = data.operations.slice();
        paintTarget(data.target);
        paintFeed();
      } catch (err) {
        toast(err.message, 'error');
      }
    }

    const feedCard = h(
      'div',
      { class: 'card' },
      h(
        'div',
        { class: 'card-title' },
        h('span', { text: strings.feed }),
        h('span', { class: 'small muted', text: `${ops.length}` })
      ),
      feedEl
    );
    root.appendChild(feedCard);

    unsubs.push(
      bus.on('ops:new', (op) => {
        if (!op) return;
        ops = [op, ...ops.filter((o) => o.id !== op.id)];
        paintFeed();
      }),
      bus.on('ops:updated', (op) => {
        if (!op) return refresh();
        ops = ops.map((o) => (o.id === op.id ? op : o));
        paintFeed();
      }),
      bus.on('ops:deleted', (payload) => {
        const id = payload && payload.id;
        if (!id) return refresh();
        ops = ops.filter((o) => o.id !== id);
        paintFeed();
      }),
      bus.on('target:updated', (target) => paintTarget(target))
    );

    paintTarget(data.target);
    paintFeed();
    bindMagnetic(root);

    return () => unsubs.forEach((off) => off());
  }
};
