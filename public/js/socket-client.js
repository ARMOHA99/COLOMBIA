import { emit, on } from './bus.js';

let socket = null;
let loaded = false;

async function loadSocketIo() {
  if (loaded) return;
  loaded = true;
  await new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = '/vendor/socket.io.js';
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

export async function connectSocket() {
  await loadSocketIo();
  if (socket) return socket;

  socket = window.io({ withCredentials: true, transports: ['websocket', 'polling'], reconnection: true });

  socket.on('connect', () => emit('socket:state', { connected: true }));
  socket.on('disconnect', () => emit('socket:state', { connected: false }));
  socket.on('connect_error', () => emit('socket:state', { connected: false }));

  const forward = [
    'session:revoked',
    'user:updated',
    'order:new',
    'order:status',
    'order:deleted',
    'farm:ready',
    'farm:updated',
    'farm:harvested',
    'target:updated',
    'target:archived',
    'ops:new',
    'ops:updated',
    'ops:deleted',
    'announcement:new',
    'announcement:updated',
    'announcement:deleted',
    'ticket:new',
    'ticket:updated',
    'ticket:resolved',
    'treasury:updated',
    'discipline:new',
    'shop:changed',
    'shop:stock',
    'audit:new',
    'internal:sold'
  ];

  for (const event of forward) {
    socket.on(event, (data) => emit(event, data));
  }

  return socket;
}

export function getSocket() {
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
