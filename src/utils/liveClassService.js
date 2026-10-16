import { supabase } from './supabaseClient';
import { readLiveClasses } from './liveClasses';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

let migrationPromise = null;

export function isUuid(value) {
  return UUID_PATTERN.test(String(value || ''));
}

export function isMissingLiveClassesTable(error) {
  return error?.code === 'PGRST205';
}

function explain(error) {
  if (isMissingLiveClassesTable(error)) {
    return 'The live_classes table is not in Supabase yet. This class stays in this browser until that table exists.';
  }
  if (error?.code === '42501') {
    return 'Supabase refused this change. Check the live_classes row security policies.';
  }
  return error?.message || 'Could not save this class to Supabase.';
}

export function sessionFromRow(row) {
  return {
    id: row.id,
    title: row.title || '',
    description: row.description || '',
    courseId: row.course_id || '',
    startsAt: row.starts_at,
    durationMinutes: row.duration_minutes || 60,
    meetingUrl: row.meeting_url || '',
    recordingUrl: row.recording_url || '',
    hostId: row.host_id || null,
    hostEmail: row.host_email || '',
    hostName: row.host_name || '',
    status: row.status || 'scheduled',
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function rowFromSession(session, user) {
  const row = {
    title: session.title,
    description: session.description || '',
    course_id: String(session.courseId || ''),
    starts_at: session.startsAt,
    duration_minutes: Number(session.durationMinutes) || 60,
    meeting_url: session.meetingUrl,
    recording_url: session.recordingUrl || '',
    host_email: session.hostEmail || user?.email || '',
    host_name: session.hostName || '',
    status: session.status || 'scheduled'
  };

  if (isUuid(session.id)) row.id = session.id;

  const profileId = user?.rawUser?.id;
  if (isUuid(session.hostId)) row.host_id = session.hostId;
  else if (isUuid(profileId)) row.host_id = profileId;

  return row;
}

export async function fetchLiveClasses() {
  const { data, error } = await supabase
    .from('live_classes')
    .select('*')
    .order('starts_at', { ascending: true });

  if (error) {
    return { ok: false, missingTable: isMissingLiveClassesTable(error), message: explain(error), rows: [] };
  }

  return { ok: true, missingTable: false, message: '', rows: (data || []).map(sessionFromRow) };
}

async function writeRow(row) {
  let result = await supabase.from('live_classes').upsert(row).select().single();
  if (result.error && row.host_id) {
    const withoutHost = { ...row };
    delete withoutHost.host_id;
    result = await supabase.from('live_classes').upsert(withoutHost).select().single();
  }
  return result;
}

export async function upsertLiveClass(session, user) {
  const { data, error } = await writeRow(rowFromSession(session, user));

  if (error?.code === 'PGRST116') {
    return { ok: true, missingTable: false, message: '', session };
  }

  if (error) {
    return {
      ok: false,
      missingTable: isMissingLiveClassesTable(error),
      message: explain(error),
      session
    };
  }

  return { ok: true, missingTable: false, message: '', session: sessionFromRow(data) };
}

export async function deleteLiveClass(id) {
  const { error } = await supabase.from('live_classes').delete().eq('id', id);

  if (error) {
    return {
      ok: false,
      missingTable: isMissingLiveClassesTable(error),
      message: explain(error)
    };
  }

  return { ok: true, missingTable: false, message: '' };
}

export function migrateLocalLiveClasses(user) {
  if (!migrationPromise) {
    migrationPromise = (async () => {
      const remote = await fetchLiveClasses();
      if (!remote.ok) return remote;
      if (remote.rows.length > 0) return remote;

      const local = readLiveClasses();
      if (local.length === 0) return remote;

      const pushed = [];
      for (const session of local) {
        const saved = await upsertLiveClass(session, user);
        if (!saved.ok) {
          migrationPromise = null;
          return saved.missingTable
            ? { ...remote, rows: local }
            : { ok: false, missingTable: false, message: saved.message, rows: remote.rows };
        }
        pushed.push(saved.session);
      }

      return { ok: true, missingTable: false, message: '', rows: pushed };
    })().catch((error) => {
      migrationPromise = null;
      return { ok: false, missingTable: false, message: explain(error), rows: [] };
    });
  }

  return migrationPromise;
}

export function subscribeLiveClasses(onRows) {
  const channel = supabase
    .channel('live-classes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'live_classes' },
      () => {
        fetchLiveClasses().then((result) => {
          if (result.ok) onRows(result.rows);
        });
      }
    )
    .subscribe();

  return channel;
}
