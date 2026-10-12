'use strict';

const env = require('../../config/env');
const logger = require('./logger');

const API = 'https://discord.com/api/v10';

async function discordFetch(path, { method = 'GET', token, authType = 'Bot', body, form } = {}) {
  const headers = {};
  if (token) headers.Authorization = `${authType} ${token}`;
  let payload = body;
  if (form) {
    payload = new URLSearchParams(form);
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const res = await fetch(`${API}${path}`, { method, headers, body: payload });
  if (res.status === 204) return { ok: true, status: 204, data: null };
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

async function exchangeCode(code) {
  const res = await discordFetch('/oauth2/token', {
    method: 'POST',
    authType: 'Bearer',
    form: {
      client_id: env.discord.clientId,
      client_secret: env.discord.clientSecret,
      grant_type: 'authorization_code',
      code,
      redirect_uri: env.discord.redirectUri
    }
  });
  if (!res.ok) {
    logger.error('OAuth token exchange failed:', res.status, JSON.stringify(res.data));
    return null;
  }
  return res.data;
}

async function fetchOAuthUser(accessToken) {
  const res = await discordFetch('/users/@me', { token: accessToken, authType: 'Bearer' });
  return res.ok ? res.data : null;
}

async function fetchOAuthGuildMember(accessToken) {
  const res = await discordFetch(`/users/@me/guilds/${env.discord.guildId}/member`, {
    token: accessToken,
    authType: 'Bearer'
  });
  if (res.status === 404) return null;
  return res.ok ? res.data : null;
}

async function fetchBotGuildMember(discordId) {
  if (!env.discord.configured) return null;
  const res = await discordFetch(`/guilds/${env.discord.guildId}/members/${discordId}`, { token: env.discord.token });
  if (res.status === 404) return null;
  return res.ok ? res.data : null;
}

async function fetchAllGuildMembers() {
  if (!env.discord.configured) return null;
  const members = [];
  let after = '0';
  for (let page = 0; page < 20; page += 1) {
    const res = await discordFetch(`/guilds/${env.discord.guildId}/members?limit=1000&after=${after}`, {
      token: env.discord.token
    });
    if (!res.ok || !Array.isArray(res.data)) return members.length ? members : null;
    if (!res.data.length) break;
    for (const m of res.data) members.push(m);
    after = res.data[res.data.length - 1].user.id;
    if (res.data.length < 1000) break;
  }
  return members;
}

function memberName(member) {
  if (!member) return '';
  return member.nick || (member.user && (member.user.global_name || member.user.username)) || '';
}

async function getMemberRoles(discordId) {
  const member = await fetchBotGuildMember(discordId);
  if (member) return { roles: member.roles || [], left: false, name: memberName(member) };
  if (!env.discord.configured) return null;
  return { roles: [], left: true };
}

let rolesCache = { at: 0, list: [] };

async function fetchGuildRoles() {
  if (!env.discord.configured) return [];
  if (Date.now() - rolesCache.at < 10 * 60 * 1000 && rolesCache.list.length) return rolesCache.list;
  try {
    const res = await discordFetch(`/guilds/${env.discord.guildId}/roles`, { token: env.discord.token });
    if (res.ok && Array.isArray(res.data)) {
      rolesCache = {
        at: Date.now(),
        list: res.data.map((r) => ({
          id: String(r.id),
          name: r.name,
          position: r.position,
          hoist: Boolean(r.hoist),
          managed: Boolean(r.managed)
        }))
      };
    }
  } catch (err) {
    logger.warn(`fetchGuildRoles failed: ${err.message}`);
  }
  return rolesCache.list;
}

function cachedRole(roleId) {
  return rolesCache.list.find((r) => r.id === String(roleId)) || null;
}

async function sendChannelMessage(channelId, body) {
  if (!env.discord.configured || !channelId) return false;
  const res = await discordFetch(`/channels/${channelId}/messages`, { method: 'POST', token: env.discord.token, body });
  if (!res.ok) logger.warn(`sendChannelMessage failed: ${res.status} ${(res.data && res.data.message) || ''}`);
  return res.ok;
}

async function addRole(discordId, roleId) {
  if (!env.discord.configured || !roleId) return false;
  const res = await discordFetch(`/guilds/${env.discord.guildId}/members/${discordId}/roles/${roleId}`, {
    method: 'PUT',
    token: env.discord.token
  });
  return res.ok;
}

async function removeRole(discordId, roleId) {
  if (!env.discord.configured || !roleId) return false;
  const res = await discordFetch(`/guilds/${env.discord.guildId}/members/${discordId}/roles/${roleId}`, {
    method: 'DELETE',
    token: env.discord.token
  });
  return res.ok || res.status === 404;
}

module.exports = {
  discordFetch,
  exchangeCode,
  fetchOAuthUser,
  fetchOAuthGuildMember,
  fetchBotGuildMember,
  fetchAllGuildMembers,
  getMemberRoles,
  memberName,
  fetchGuildRoles,
  cachedRole,
  sendChannelMessage,
  addRole,
  removeRole
};
