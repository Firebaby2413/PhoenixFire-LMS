import { supabase } from './supabaseClient';
import { isUuid} from './profileShape';
import { getDisplayName } from './academySettings';

export const LOUNGE_STORAGE_KEY = 'phoenix_lms_lounges';


function emptyStore() {
  return { lounges: [], messages: [], rooms: [] };
}

function readStore() {
  try {
    const saved = localStorage.getItem(LOUNGE_STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : emptyStore();
    return {
      lounges: Array.isArray(parsed.lounges) ? parsed.lounges : [],
      messages: Array.isArray(parsed.messages) ? parsed.messages : [],
      rooms: Array.isArray(parsed.rooms) ? parsed.rooms : []
    };
  } catch (error) {
    console.error('Could not read lounges from this browser', error);
    return emptyStore();
  }
}

function writeStore(store) {
  localStorage.setItem(LOUNGE_STORAGE_KEY, JSON.stringify(store));
}

function defaultLounge() {
  return {
    id: crypto.randomUUID(),
    name: 'Student Lounge',
    description: 'Drop in, see who is here, and open a meeting link when you want to connect live.',
    createdBy: null,
    createdAt: new Date().toISOString()
  };
}

function stamp(item) {
  return {
    ...item,
    id: item.id || crypto.randomUUID(),
    createdAt: item.createdAt || new Date().toISOString()
  };
}

export function readLocalLounge() {
  const store = readStore();
  if (store.lounges.length === 0) {
    store.lounges.push(defaultLounge());
    writeStore(store);
  }
  return store;
}

export function addLocalLounge(draft, user) {
  const store = readLocalLounge();
  const lounge = stamp({
    name: draft.name,
    description: draft.description || '',
    createdBy: user?.id || null
  });
  store.lounges.push(lounge);
  writeStore(store);
  return lounge;
}

export function removeLocalLounge(id) {
  const store = readLocalLounge();
  store.lounges = store.lounges.filter((item) => item.id !== id);
  store.messages = store.messages.filter((item) => item.loungeId !== id);
  store.rooms = store.rooms.filter((item) => item.loungeId !== id);
  if (store.lounges.length === 0) store.lounges.push(defaultLounge());
  writeStore(store);
  return store.lounges;
}

export function addLocalMessage(draft) {
  const store = readLocalLounge();
  const message = stamp({
    loungeId: draft.loungeId,
    senderId: draft.senderId || null,
    senderName: draft.senderName,
    senderRole: draft.senderRole || 'student',
    body: draft.body
  });
  store.messages.push(message);
  writeStore(store);
  return message;
}

export function addLocalRoom(draft) {
  const store = readLocalLounge();
  const room = stamp({
    loungeId: draft.loungeId,
    title: draft.title,
    note: draft.note || '',
    meetingUrl: draft.meetingUrl,
    hostId: draft.hostId || null,
    hostName: draft.hostName || '',
    status: 'open'
  });
  store.rooms.push(room);
  writeStore(store);
  return room;
}

export function closeLocalRoom(id) {
  const store = readLocalLounge();
  store.rooms = store.rooms.map((room) => (
    room.id === id ? { ...room, status: 'closed' } : room
  ));
  writeStore(store);
  return store.rooms.filter((room) => room.status !== 'closed');
}

function isMissingTable(error) {
  return error?.code === 'PGRST205';
}

function explain(error, label) {
  if (isMissingTable(error)) {
    return `The ${label} table is not in Supabase yet. This lounge stays in the browser until that table exists.`;
  }
  if (error?.code === '42501') {
    return 'Supabase refused this change. Admins are the only role that can add or remove a lounge.';
  }
  return error?.message || `Could not save this to ${label}.`;
}

export function loungeFromRow(row) {
  return {
    id: row.id,
    name: row.name || '',
    description: row.description || '',
    createdBy: row.created_by || null,
    createdAt: row.created_at
  };
}

export function messageFromRow(row) {
  return {
    id: row.id,
    loungeId: row.lounge_id,
    senderId: row.sender_id || null,
    senderName: row.sender_name || 'Student',
    senderRole: row.sender_role || 'student',
    body: row.body || '',
    createdAt: row.created_at
  };
}

export function roomFromRow(row) {
  return {
    id: row.id,
    loungeId: row.lounge_id,
    title: row.title || '',
    note: row.note || '',
    meetingUrl: row.meeting_url || '',
    hostId: row.host_id || null,
    hostName: row.host_name || '',
    status: row.status || 'open',
    createdAt: row.created_at
  };
}

async function insertRow(table, row, foreignKey) {
  let result = await supabase.from(table).insert(row).select().single();
  if (result.error && foreignKey && row[foreignKey]) {
    const copy = { ...row };
    delete copy[foreignKey];
    result = await supabase.from(table).insert(copy).select().single();
  }
  return result;
}

export async function fetchLounges() {
  const { data, error } = await supabase
    .from('lounges')
    .select('*')
    .order('created_at', { ascending: true });

    if (error) {
      return { ok: false, missingTable: isMissingTable(error), message: explain(error, 'lounges'), rows: [] };
    }

    return { ok: true, missingTable: false, message: '', rows: (data || []).map(loungeFromRow) };
}

export async function createLounge(draft, user) {
  const row = {
    name: draft.name,
    description: draft.description || ''
  };
  if (isUuid(user?.id)) row.created_by = user.id;

  const { data, error } = await insertRow('lounges', row, 'created_by');
  if (error) {
    return { ok: false, missingTable: isMissingTable(error), message: explain(error, 'lounges'), item: null };
  }
  return { ok: true, missingTable: false, message: '', item: loungeFromRow(data) };
}

export async function deleteLounge(id) {
  const { error } = await supabase.from('lounges').delete().eq('id', id);
  if (error) {
    return { ok: false, missingTable: isMissingTable(error), message: explain(error, 'lounges') };
  }
  return { ok: true, missingTable: false, message: '' };
}

export function subscribeLounges(onRows) {
  return supabase
    .channel('lounges')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'lounges' }, () => {
      fetchLounges().then((result) => {
        if (result.ok) onRows(result.rows);
      });
    })
    .subscribe();
}

export async function fetchLoungeMessages(loungeId) {
  const { data, error } = await supabase
    .from('lounge_messages')
    .select('*')
    .eq('lounge_id', loungeId)
    .order('created_at', { ascending: true });

    if (error) {
      return { ok: false, missingTable: isMissingTable(error), message: explain(error, 'lounge_messages'), rows: [] };
    }
    return { ok: true, missingTable: false, message: '', rows: (data || []).map(messageFromRow) };
}

export async function sendLoungeMessage(draft, user) {
  const row = {
    lounge_id: draft.loungeId,
    sender_name: draft.senderName || getDisplayName(user),
    sender_role: draft.senderRole || String(user?.role || 'student').toLowerCase(),
    body: draft.body
  };
  const senderId = draft.senderId || user?.id;
  if (isUuid(senderId)) row.sender_id = senderId;

  const { data, error } = await insertRow('lounge_messages', row, 'sender_id');
  if (error) {
    return { ok: false, missingTable: isMissingTable(error), message: explain(error, 'lounge_messages'), item: null };
  }
  return { ok: true, missingTable: false, message: '', item: messageFromRow(data) };
}

export function subscribeLoungeMessages(loungeId, onRows) {
  return supabase
    .channel(`lounge-messages-${loungeId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'lounge_messages' }, () => {
      fetchLoungeMessages(loungeId).then((result) => {
        if (result.ok) onRows(result.rows);
      });
    })
    .subscribe();
}

export async function fetchLoungeRooms(loungeId) {
  const { data, error } = await supabase
    .from('lounge_rooms')
    .select('*')
    .eq('lounge_id', loungeId)
    .eq('status', 'open')
    .order('created_at', { ascending: false });

    if (error) {
      return { ok: false, missingTable: isMissingTable(error), message: explain(error, 'lounge_rooms'), rows: [] };
    }
    return { ok: true, missingTable: false, message: '', rows: (data || []).map(roomFromRow) };
}

export async function openLoungeRoom(draft, user) {
  const row = {
    lounge_id: draft.loungeId,
    title: draft.title,
    note: draft.note || '',
    meeting_url: draft.meetingUrl,
    host_name: draft.hostName || getDisplayName(user),
    status: 'open'
  };
  const hostId = draft.hostId || user?.id;
  if (isUuid(hostId)) row.host_id = hostId;

  const { data, error } = await insertRow('lounge_rooms', row, 'host_id');
  if (error) {
    return { ok: false, missingTable: isMissingTable(error), message: explain(error, 'lounge_rooms'), item: null };
  }
  return { ok: true, missingTable: false, message: '', item: roomFromRow(data) };
}

export async function closeLoungeRoom(id) {
  const { error } = await supabase.from('lounge_rooms').update({ status: 'closed' }).eq('id', id);
  if (error) {
    return { ok: false, missingTable: isMissingTable(error), message: explain(error, 'lounge_rooms') };
  }
  return { ok: true, missingTable: false, message: ''};
}

export function subscribeLoungeRooms(loungeId, onRows) {
  return supabase
    .channel(`lounge_rooms-${loungeId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'lounge_rooms' }, () => {
      fetchLoungeRooms(loungeId).then((result) => {
        if (result.ok) onRows(result.rows);
      });
    })
    .subscribe();
}

export function joinLoungePresence(loungeId, user, onPeople) {
  const key = String(user?.id || user?.email || 'guest');
  const channel = supabase.channel(`lounge-presence-${loungeId}`, {
    config: { presence: { key } }
  });

  const publish = () => {
    const people = [];
    const seen = new Set();
    Object.values(channel.presenceState()).forEach((entries) => {
      entries.forEach((entry) => {
        const id = String(entry.id || entry.presence_ref);
        if (seen.has(id)) return;
        seen.add(id);
        people.push({
          id,
          name: entry.name || 'Student',
          role: entry.role || 'student'
        });
      });
    });
    onPeople(people);
  };

  channel.on('presence', { event: 'sync' }, publish);
  channel.subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      channel.track({
        id: key,
        name: getDisplayName(user),
        role: String(user?.role || 'student').toLowerCase()
      });
    }
  });

  return channel;
}

export function closeLoungeChannel(channel) {
  if (channel) supabase.removeChannel(channel);
}