import { useEffect, useState } from 'react';

export function useAppNavigation() {
  const [view, setView] = useState('dashboard');
  const [authView, setAuthView] = useState('signin');
  const [theme, setTheme] = useState('dark');
  const [selectedCourseId, setSelectedCourseId] = useState(null);
  const [activeLessonId, setActiveLessonId] = useState(null);
  const [resumeStepIndex, setResumeStepIndex] = useState(0);
  const [skipAutoResume, setSkipAutoResume] = useState(false);
  const [editingCourse, setEditingCourse] = useState(null);
  const [progressRevision, setProgressRevision] = useState(0);

  useEffect(() => {
    document.body.className = theme === 'dark' ? 'dark-theme' : 'light-theme';
  }, [theme]);

  return {
    view,
    setView,
    authView,
    setAuthView,
    theme,
    setTheme,
    selectedCourseId,
    setSelectedCourseId,
    activeLessonId,
    setActiveLessonId,
    resumeStepIndex,
    setResumeStepIndex,
    skipAutoResume,
    setSkipAutoResume,
    editingCourse,
    setEditingCourse,
    progressRevision,
    setProgressRevision
  };
}