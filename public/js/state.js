export const state = {
  site: null,
  user: null,
  buildId: null,
  route: null
};

export function t(path, fallback = '') {
  if (!state.site) return fallback;
  const parts = String(path).split('.');
  let node = state.site.strings;
  for (const p of parts) {
    if (node == null) return fallback;
    node = node[p];
  }
  return typeof node === 'string' ? node : fallback;
}

export function statusLabel(group, key) {
  const s = state.site && state.site.statuses && state.site.statuses[group];
  return (s && s[key]) || key;
}

export function rankLabel(rank) {
  const r = state.site && state.site.ranks && state.site.ranks[rank];
  return r ? r.label : rank;
}

export function rankOrder(rank) {
  const r = state.site && state.site.ranks && state.site.ranks[rank];
  return r ? r.order : 0;
}

export function money(value) {
  const cur = (state.site && state.site.locale && state.site.locale.currency) || '$';
  const n = Number(value) || 0;
  return `${n.toLocaleString('en-US', { maximumFractionDigits: 2 })} ${cur}`;
}

export function fmtDate(value, withTime = true) {
  if (!value) return '—';
  try {
    const opts = { timeZone: 'Africa/Algiers', year: 'numeric', month: '2-digit', day: '2-digit' };
    if (withTime) {
      opts.hour = '2-digit';
      opts.minute = '2-digit';
      opts.hour12 = false;
    }
    return new Intl.DateTimeFormat('ar-DZ', opts).format(new Date(value));
  } catch {
    return new Date(value).toISOString().slice(0, 16).replace('T', ' ');
  }
}

export function fmtTime(value) {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('ar-DZ', {
      timeZone: 'Africa/Algiers',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(new Date(value));
  } catch {
    return '';
  }
}

export function relative(value) {
  if (!value) return '';
  const diff = Date.now() - new Date(value).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'الآن';
  if (min < 60) return `منذ ${min} د`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `منذ ${hr} س`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `منذ ${day} ي`;
  const month = Math.floor(day / 30);
  return month < 12 ? `منذ ${month} شهر` : `منذ ${Math.floor(month / 12)} سنة`;
}

export function duration(min) {
  const m = Math.max(0, Math.round(min || 0));
  const h = Math.floor(m / 60);
  const r = m % 60;
  return h ? `${h} س ${r} د` : `${r} د`;
}
