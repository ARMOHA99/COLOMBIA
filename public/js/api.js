import { emit } from './bus.js';

export class ApiError extends Error {
  constructor(message, code, status) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export async function api(path, { method = 'GET', body, formData, signal } = {}) {
  const opts = {
    method,
    credentials: 'same-origin',
    headers: {},
    signal
  };
  if (formData) {
    opts.body = formData;
  } else if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(`/api${path}`, opts);
  } catch (err) {
    throw new ApiError('تعذر الاتصال بالخادم', 'NETWORK', 0);
  }

  let data = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (res.status === 401) {
    const err = new ApiError((data && data.error) || 'انتهت الجلسة', (data && data.code) || 'UNAUTHENTICATED', 401);
    emit('auth:expired', err);
    throw err;
  }

  if (!res.ok) {
    throw new ApiError((data && data.error) || 'حدث خطأ ما', (data && data.code) || 'ERROR', res.status);
  }

  return data;
}

export const get = (p, o) => api(p, { ...o, method: 'GET' });
export const post = (p, body, o) => api(p, { ...o, method: 'POST', body });
export const put = (p, body, o) => api(p, { ...o, method: 'PUT', body });
export const del = (p, body, o) => api(p, { ...o, method: 'DELETE', body });
