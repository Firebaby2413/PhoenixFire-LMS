import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../utils/supabaseClient';
import {
  getDisplayName,
  markMessageNotificationsRead,
  pushUserNotification
} from '../utils/academySettings';
import {
  hasPendingMessageNotes,
  incomingNotices,
  readSeenMap,
  seedSeenMap,
  seenKey,
  seenMapForUnread,
  seenMapsDiffer,
  unreadTotal,
  writeSeenMap
} from '../utils/messageInbox';

function newestWith(rows, userId, personId) {
  let latest = 0;
  (rows || []).forEach((row) => {
    const involves =
      (row.sender_id === userId && row.receiver_id === personId) ||
      (row.sender_id === personId && row.receiver_id === userId);
    if (!involves) return;
    const at = new Date(row.created_at || 0).getTime();
    if (Number.isFinite(at) && at > latest) latest = at;
  });
  return latest;
}

export function useMessageInbox(currentUser, users = []) {
  const userId = currentUser?.id;
  const userRef = useRef(currentUser);
  const usersRef = useRef(users);
  const rowsRef = useRef([]);

  const [rows, setRows] = useState([]);
  const [seenMap, setSeenMap] = useState(() => readSeenMap(userId));

  useEffect(() => {
    userRef.current = currentUser;
    usersRef.current = users;
    rowsRef.current = rows;
  }, [currentUser, users, rows]);

  useEffect(() => {
    setSeenMap(readSeenMap(userId));
  }, [userId]);

  useEffect(() => {
    if (!userId) return undefined;
    let cancelled = false;

    const loadMessages = () => {
      supabase
        .from('messages')
        .select('*')
        .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
        .order('created_at')
        .then(({ data, error }) => {
          if (cancelled) return;
          if (error) {
            console.error('Could not load messages:', error.message);
            return;
          }
          const nextRows = data || [];
          setRows(nextRows);
          if (!nextRows.length || localStorage.getItem(seenKey(userId))) return;
          const people = usersRef.current || [];
          if (hasPendingMessageNotes(userRef.current) && people.length === 0) return;
          const seeded = seedSeenMap(nextRows, userRef.current, people);
          writeSeenMap(userId, seeded);
          setSeenMap(seeded);
        });
    };

    loadMessages();
    const channel = supabase
      .channel(`messages-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, loadMessages)
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [userId]);

  useEffect(() => {
    if (!userId || !rows.length) return;
    const stored = readSeenMap(userId);
    if (!localStorage.getItem(seenKey(userId))) {
      if (hasPendingMessageNotes(currentUser) && (!users || users.length === 0)) return;
      const seeded = seedSeenMap(rows, currentUser, users || []);
      writeSeenMap(userId, seeded);
      setSeenMap(seeded);
      return;
    }
    const repaired = seenMapForUnread(stored, rows, currentUser, users || []);
    if (seenMapsDiffer(stored, repaired)) {
      writeSeenMap(userId, repaired);
      setSeenMap(repaired);
    }
  }, [userId, currentUser, rows, users]);

  const effectiveSeen = useMemo(
    () => seenMapForUnread(seenMap, rows, currentUser, users || []),
    [seenMap, rows, currentUser, users]
  );

  const seenReady = !userId || rows.length === 0 || Boolean(userId && localStorage.getItem(seenKey(userId)));

  const notices = useMemo(() => {
    if (!seenReady) return [];
    return incomingNotices(rows, currentUser, users || [], effectiveSeen);
  }, [seenReady, rows, currentUser, users, effectiveSeen]);

  const unreadCount = useMemo(() => unreadTotal(notices), [notices]);

  const markThreadRead = useCallback((person) => {
    const user = userRef.current;
    if (!user?.id || !person?.id) return;
    markMessageNotificationsRead(user, person);
    setSeenMap((prev) => {
      const seenAt = prev[person.id] ? new Date(prev[person.id]).getTime() : 0;
      const newest = newestWith(rowsRef.current, user.id, person.id);
      if (Number.isFinite(seenAt) && seenAt >= newest && seenAt >= Date.now() - 1000) return prev;
      const next = { ...prev, [person.id]: new Date().toISOString() };
      writeSeenMap(user.id, next);
      return next;
    });
  }, []);

  const sendMessage = useCallback(async (contact, text) => {
    const user = userRef.current;
    const body = String(text || '').trim();
    if (!body || !contact?.id || !user?.id) return null;
    const { data, error } = await supabase
      .from('messages')
      .insert({
        sender_id: user.id,
        receiver_id: contact.id,
        body
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    setRows((prev) => (prev.some((row) => row.id === data.id) ? prev : [...prev, data]));
    pushUserNotification(
      contact,
      'message',
      `New message from ${getDisplayName(user)}`,
      { senderId: user.id }
    );
    return data;
  }, []);

  return { rows, notices, unreadCount, markThreadRead, sendMessage };
}
