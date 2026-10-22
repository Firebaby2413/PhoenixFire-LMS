import {
  getDisplayName,
  messageNoteMatchesPerson,
  readUserNotifications
} from './academySettings';

export const SEEN_KEY_PREFIX = 'lms_message_seen_';

export function seenKey(userId) {
  return `${SEEN_KEY_PREFIX}${userId}`;
}

export function readSeenMap(userId) {
  if (!userId) return {};
  try {
    const parsed = JSON.parse(localStorage.getItem(seenKey(userId)) || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function writeSeenMap(userId, seenMap) {
  if (!userId) return;
  localStorage.setItem(seenKey(userId), JSON.stringify(seenMap));
}

export function hasPendingMessageNotes(user) {
  return readUserNotifications(user).some((note) => note.type === 'message' && !note.read);
}

function unreadBoundary(rows, userId, senderId, note) {
  const incoming = (rows || []).filter(
    (row) => row.receiver_id === userId && row.sender_id === senderId && row.created_at
  );
  if (!incoming.length) return null;
  const newest = incoming.reduce((best, row) => (row.created_at > best.created_at ? row : best));
  const noteAt = new Date(note?.at || 0).getTime();
  const newestAt = new Date(newest.created_at).getTime();
  if (!Number.isFinite(noteAt) || noteAt <= 0) return Number.isFinite(newestAt) ? newestAt : null;
  const covered = incoming.filter((row) => new Date(row.created_at).getTime() <= noteAt + 15000);
  const target = covered.length
    ? covered.reduce((best, row) => (row.created_at > best.created_at ? row : best))
    : newest;
  const at = new Date(target.created_at).getTime();
  return Number.isFinite(at) ? at : null;
}

// The first visit used to stamp every thread as already read, which hid a
// message the dashboard still lists as new. Pull that thread back to unread
// until the person opens it.
export function seenMapForUnread(stored, rows, user, people) {
  const seen = { ...(stored || {}) };
  if (!user?.id) return seen;
  const rewindTo = new Map();
  readUserNotifications(user)
    .filter((note) => note.type === 'message' && !note.read)
    .forEach((note) => {
      const sender = (people || []).find((person) => messageNoteMatchesPerson(note, person));
      if (!sender?.id) return;
      const boundary = unreadBoundary(rows, user.id, sender.id, note);
      if (!Number.isFinite(boundary)) return;
      const previous = rewindTo.get(sender.id);
      if (!previous || boundary < previous) rewindTo.set(sender.id, boundary);
    });

  rewindTo.forEach((boundary, senderId) => {
    const seenAt = seen[senderId] ? new Date(seen[senderId]).getTime() : 0;
    if (!Number.isFinite(seenAt) || seenAt >= boundary) {
      seen[senderId] = new Date(boundary - 1).toISOString();
    }
  });
  return seen;
}

export function seedSeenMap(rows, user, people) {
  const seen = {};
  (rows || []).forEach((row) => {
    if (row.receiver_id !== user?.id || !row.sender_id || !row.created_at) return;
    if (!seen[row.sender_id] || row.created_at > seen[row.sender_id]) {
      seen[row.sender_id] = row.created_at;
    }
  });
  return seenMapForUnread(seen, rows, user, people);
}

export function seenMapsDiffer(left, right) {
  const keys = new Set([...Object.keys(left || {}), ...Object.keys(right || {})]);
  for (const key of keys) {
    if ((left || {})[key] !== (right || {})[key]) return true;
  }
  return false;
}

export function incomingNotices(rows, user, people, seenMap) {
  if (!user?.id) return [];
  const bySender = new Map();
  (rows || []).forEach((row) => {
    if (row.receiver_id !== user.id || row.sender_id === user.id || !row.id) return;
    const list = bySender.get(row.sender_id) || [];
    list.push(row);
    bySender.set(row.sender_id, list);
  });

  const notes = [];
  bySender.forEach((list, senderId) => {
    const seenAt = seenMap?.[senderId] ? new Date(seenMap[senderId]).getTime() : 0;
    const unread = list.filter((row) => new Date(row.created_at).getTime() > (Number.isFinite(seenAt) ? seenAt : 0));
    if (!unread.length) return;
    const newest = unread.slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
    const sender = (people || []).find((person) => person.id === senderId);
    notes.push({
      id: newest.id,
      senderId,
      senderName: sender ? getDisplayName(sender) : 'Someone',
      preview: (newest.body || newest.text || '').slice(0, 80),
      count: unread.length
    });
  });
  return notes;
}

export function unreadTotal(notices) {
  return (notices || []).reduce((sum, note) => sum + (note.count || 0), 0);
}

function threadActivity(rows, user, contact) {
  if (!user?.id || !contact?.id) return 0;
  let latest = 0;
  (rows || []).forEach((row) => {
    const involves =
      (row.sender_id === user.id && row.receiver_id === contact.id) ||
      (row.sender_id === contact.id && row.receiver_id === user.id);
    if (!involves) return;
    const at = new Date(row.created_at || row.timestamp || 0).getTime();
    if (Number.isFinite(at) && at > latest) latest = at;
  });
  return latest;
}

export function sortContactsByThread(contacts, rows, user) {
  return (contacts || [])
    .map((contact, index) => ({
      contact,
      index,
      at: threadActivity(rows, user, contact)
    }))
    .sort((a, b) => (b.at - a.at) || (a.index - b.index))
    .map((item) => item.contact);
}

export function latestThreadPreview(rows, user, contact) {
  if (!user?.id || !contact?.id) return '';
  let latest = null;
  (rows || []).forEach((row) => {
    const involves =
      (row.sender_id === user.id && row.receiver_id === contact.id) ||
      (row.sender_id === contact.id && row.receiver_id === user.id);
    if (!involves) return;
    if (!latest || new Date(row.created_at || 0) > new Date(latest.created_at || 0)) latest = row;
  });
  if (!latest) return '';
  const body = String(latest.body || latest.text || '').replace(/\s+/g, ' ').trim();
  if (!body) return '';
  const prefix = latest.sender_id === user.id ? 'You: ' : '';
  return `${prefix}${body}`.slice(0, 80);
}
