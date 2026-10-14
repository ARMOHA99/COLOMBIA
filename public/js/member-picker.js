import { h, input } from './ui.js';

export function memberPicker(members, selectedIds = []) {
  const selected = new Set((selectedIds || []).map(String));
  const search = input({ placeholder: 'ابحث عن عضو بالاسم...' });
  const count = h('span', { class: 'small muted' });
  const list = h('div', { class: 'picker-list' });

  function updateCount() {
    count.textContent = `${selected.size} محدد`;
  }

  function paint() {
    const q = search.value.trim();
    list.innerHTML = '';
    let shown = 0;
    for (const m of members) {
      if (q && !String(m.name).includes(q)) continue;
      shown += 1;
      const cb = h('input', { type: 'checkbox' });
      cb.checked = selected.has(String(m.id));
      const row = h('label', { class: `picker-item${cb.checked ? ' on' : ''}` }, cb, h('span', { text: m.name }));
      cb.addEventListener('change', () => {
        if (cb.checked) selected.add(String(m.id));
        else selected.delete(String(m.id));
        row.classList.toggle('on', cb.checked);
        updateCount();
      });
      list.appendChild(row);
    }
    if (!shown) list.appendChild(h('div', { class: 'small muted', style: { padding: '10px' }, text: 'لا يوجد أعضاء مطابقون' }));
  }

  search.addEventListener('input', paint);
  paint();
  updateCount();

  return {
    node: h('div', { class: 'picker' }, search, list, count),
    getValue: () => Array.from(selected)
  };
}
