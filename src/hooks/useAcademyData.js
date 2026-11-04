import { useEffect, useState } from 'react';
import { readLiveClasses, LIVE_CLASSES_KEY } from '../utils/liveClasses';
import { fetchLiveClasses, migrateLocalLiveClasses, subscribeLiveClasses } from '../utils/liveClassService';
import { supabase } from '../utils/supabaseClient';
import { withModuleClassification } from '../utils/moduleTypes';
import { getAcademySettings } from '../utils/academySettings';
import { profileFromRow } from '../utils/profileShape';
import { loadCourses, uploadCourses } from '../utils/courseService';

export const sanitizeCourses = (rawCourses) => {
  if (!Array.isArray(rawCourses)) return [];

  return rawCourses.map((course) => {
    if (!course || !course.lessons) return course;

    return {
      ...course,
      lessons: course.lessons.map((lesson) => {
        if (!lesson || !lesson.modules) return lesson;

        return {
          ...lesson,
          modules: lesson.modules
            .filter((mod) => {
              const modTitle = mod.title || mod.name || '';
              if (!mod.id || modTitle === 'New Module') {
                return false;
              }
              return true;
            })
            .map((mod) => {
              const rest = { ...mod };
              delete rest.completed;
              delete rest.isCompleted;
              return withModuleClassification(rest);
            }),
        };
      }),
    };
  });
};

export function useAcademyData(authUser) {
  const [users, setUsers] = useState(() => {
    try {
      const saved = localStorage.getItem('app_users');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error('Failed to parse users from localStorage', e);
      return [];
    }
  });

  const [courses, setCourses] = useState(() => {
    try {
      const saved = localStorage.getItem('app_courses');
      const parsed = saved ? JSON.parse(saved) : [];
      return sanitizeCourses(parsed);
    } catch (e) {
      console.error('Failed to parse courses from localStorage', e);
      return [];
    }
  });

  const [localUser, setLocalUser] = useState(null);
  const [liveClasses, setLiveClasses] = useState(() => readLiveClasses());
  const [liveClassNotice, setLiveClassNotice] = useState('');
  const [academySettings, setAcademySettings] = useState(() => getAcademySettings());

  useEffect(() => {
    localStorage.setItem('app_users', JSON.stringify(users));
  }, [users]);

  useEffect(() => {
    localStorage.setItem('app_courses', JSON.stringify(courses));
  }, [courses]);

  useEffect(() => {
    localStorage.setItem(LIVE_CLASSES_KEY, JSON.stringify(liveClasses));
  }, [liveClasses]);

  useEffect(() => {
    const handleStorage = (event) => {
      if (event.key === LIVE_CLASSES_KEY && event.newValue) {
        try {
          const parsed = JSON.parse(event.newValue);
          if (Array.isArray(parsed)) setLiveClasses(parsed);
        } catch (err) {
          console.error('Failed to sync live classes', err);
        }
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const user = authUser || localUser;

    (async () => {
      const remote = await fetchLiveClasses();
      if (cancelled) return;
      if (!remote.ok) {
        if (remote.missingTable) setLiveClassNotice(remote.message);
        return;
      }

      if (remote.rows.length === 0) {
        const migrated = await migrateLocalLiveClasses(user);
        if (cancelled || !migrated.ok) return;
        setLiveClassNotice('');
        setLiveClasses(migrated.rows);
        return;
      }

      setLiveClassNotice('');
      setLiveClasses(remote.rows);
    })();

    const channel = subscribeLiveClasses((rows) => {
      if (cancelled) return;
      setLiveClassNotice('');
      setLiveClasses(rows);
    });

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [authUser, localUser]);

  useEffect(() => {
    if (!authUser?.id) return undefined;
    let cancelled = false;

    supabase.from('profiles').select('*').then(({ data, error }) => {
      if (cancelled || error) {
        if (error) console.error('Could not load profiles:', error.message);
        return;
      }
      const rows = (data || []).map(profileFromRow).filter(Boolean);
      if (!rows.some((user) => user.id === authUser.id)) {
        rows.push(profileFromRow({
          id: authUser.id,
          email: authUser.email,
          role: authUser.role,
          first_name: authUser.firstName,
          last_name: authUser.lastName,
          student_id: authUser.studentId
        }));
      }

      setUsers(rows);
    });

    loadCourses().then(async (result) => {
      if (cancelled || !result.ok) return;
      if (result.rows.length > 0) {
        setCourses(sanitizeCourses(result.rows));
        return;
      }

      const role = String(authUser.role || '').toLowerCase();
      const canUpload = ['admin', 'mentor', 'instructor'].includes(role);
      if (!canUpload) return;

      let localCourses = [];
      try {
        const saved = JSON.parse(localStorage.getItem('app_courses') || '[]');
        if (Array.isArray(saved)) localCourses = sanitizeCourses(saved);
      } catch (err) {
        console.error('Could not read saved courses:', err);
      }
      if (localCourses.length === 0) return;

      try {
        const uploaded = await uploadCourses(localCourses);
        if (!cancelled && uploaded.length > 0) setCourses(sanitizeCourses(uploaded));
      } catch (err) {
        console.error('Could not store courses in Supabase:', err);
      }
    });

    if (String(authUser.role || '').toLowerCase() === 'admin') {
      supabase.from('academy_settings').select('*').eq('id', 1).maybeSingle().then(({ data }) => {
        if (cancelled || !data) return;
        setAcademySettings({
          academyName: data.academy_name,
          ownerKey: data.owner_key,
          enrollmentKey: data.enrollment_key
        });
      });
    }

    return () => {
      cancelled = true;
    };
  }, [authUser]);

  return {
    users,
    setUsers,
    courses,
    setCourses,
    localUser,
    setLocalUser,
    liveClasses,
    setLiveClasses,
    liveClassNotice,
    academySettings,
    setAcademySettings
  };
}