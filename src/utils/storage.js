import { supabase } from './supabaseClient';

export { supabase };

const LOCAL_GRADES_KEY = 'lms_submission_grades';

const readLocalGrades = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(LOCAL_GRADES_KEY) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const writeLocalGrade = (submissionId, patch) => {
  if (!submissionId) return;
  const all = readLocalGrades();
  const key = String(submissionId);
  all[key] = { ...(all[key] || {}), ...patch, id: submissionId };
  localStorage.setItem(LOCAL_GRADES_KEY, JSON.stringify(all));
};

export const applyLocalGrade = (sub) => {
  if (!sub) return sub;
  const patch = readLocalGrades()[String(sub.id)];
  if (!patch) return sub;
  return { ...sub, ...patch };
};

// Normalize Supabase DB rows into consistent formats for the entire UI
const normalizeSubmission = (sub) => {
  if (!sub) return null;
  
  const rawUrl = sub.submission_url || sub.url || sub.link || '';
  const rawStudent = String(sub.student_id || sub.studentEmail || sub.student_email || sub.student || '').trim();
  const rawModule = String(sub.module_id || sub.moduleId || sub.lesson_id || sub.lessonId || '').trim();
  const rawCourse = String(sub.course_id || sub.courseId || '').trim();

  return {
    ...sub,
    id: sub.id,

    // Standardized IDs (Always Strings)
    courseId: rawCourse,
    course_id: rawCourse,
    moduleId: rawModule,
    module_id: rawModule,
    lessonId: sub.lesson_id ? String(sub.lesson_id).trim() : rawModule,
    lesson_id: sub.lesson_id ? String(sub.lesson_id).trim() : rawModule,

    // Standardized User Keys
    student: rawStudent,
    studentId: rawStudent,
    student_id: rawStudent,
    studentEmail: rawStudent,
    student_email: rawStudent,

    // Standardized Links
    submissionUrl: rawUrl,
    submission_url: rawUrl,
    url: rawUrl,
    link: rawUrl,

    // Standardized Status & Feedback
    status: sub.status || 'pending',
    feedback: sub.feedback_text || sub.feedbackText || sub.feedback || '',
    feedbackText: sub.feedback_text || sub.feedbackText || sub.feedback || '',
    feedback_text: sub.feedback_text || sub.feedbackText || sub.feedback || '',
    feedbackVideoUrl: sub.feedback_video_url || sub.feedbackVideoUrl || '',
    feedback_video_url: sub.feedback_video_url || sub.feedbackVideoUrl || '',
    submittedAt: sub.created_at || sub.submittedAt || new Date().toISOString(),
    created_at: sub.created_at || sub.submittedAt || new Date().toISOString()
  };
};

export const exportData = (data) => {
  try {
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `lms_backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Failed to export data:', error);
    alert('An error occurred while exporting backup data.');
  }
};

export const importData = (file, setUsers, setCourses, setLiveClasses) => {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const parsed = JSON.parse(e.target.result);
      if (parsed.users && Array.isArray(parsed.users)) setUsers(parsed.users);
      if (parsed.courses && Array.isArray(parsed.courses)) setCourses(parsed.courses);
      if (parsed.liveClasses && Array.isArray(parsed.liveClasses) && setLiveClasses) {
        setLiveClasses(parsed.liveClasses);
      }
      alert('Backup restored successfully!');
    } catch (error) {
      console.error('Failed to parse import file:', error);
      alert('Invalid JSON file. Please provide a valid backup file.');
    }
  };
  reader.readAsText(file);
};

export const submitAssignment = async (paramsOrStudentId, courseId, moduleId, submissionUrl) => {
  let payload;

  if (typeof paramsOrStudentId === 'object' && paramsOrStudentId !== null) {
    const p = paramsOrStudentId;
    payload = {
      student_id: String(p.studentId || p.studentEmail).trim(),
      course_id: String(p.courseId).trim(),
      module_id: String(p.moduleId || p.lessonId).trim(),
      lesson_id: p.lessonId ? String(p.lessonId).trim() : null,
      submission_url: p.submissionUrl,
      status: 'pending'
    };
  } else {
    payload = {
      student_id: String(paramsOrStudentId).trim(),
      course_id: String(courseId).trim(),
      module_id: String(moduleId).trim(),
      submission_url: submissionUrl,
      status: 'pending'
    };
  }

  const { data: existingRows } = await supabase
    .from('submissions')
    .select('id')
    .eq('student_id', payload.student_id)
    .eq('module_id', payload.module_id)
    .order('created_at', { ascending: false })
    .limit(1);

  const existingId = existingRows?.[0]?.id;
  let result;
  let error;
  
  if (existingId) {
    const updated = await supabase
      .from('submissions')
      .update({
        submission_url: payload.submission_url,
        status: 'pending',
        course_id: payload.course_id,
        lesson_id: payload.lesson_id
      })
      .eq('id', existingId)
      .select();
    result = updated.data;
    error = updated.error;
  } else {
    const inserted = await supabase
      .from('submissions')
      .insert([payload])
      .select();
    result = inserted.data;
    error = inserted.error;
  }

  if (error) {
    console.error('Supabase submission save error:', error);
    throw error;
  }
  return normalizeSubmission(result[0]);
};

export const fetchStudentProgress = async (studentId, courseId, totalModules) => {
  if (!totalModules || totalModules === 0) return 0;

  const { data, error } = await supabase
    .from('submissions')
    .select('module_id, status')
    .eq('student_id', String(studentId).trim())
    .eq('course_id', String(courseId).trim())
    .in('status', ['pass', 'passed', 'approved']);

  if (error) {
    console.error('Error fetching progress:', error);
    return 0;
  }

  const completedModuleIds = new Set((data || []).map((sub) => String(sub.module_id).trim()));
  const progressPercent = Math.round((completedModuleIds.size / totalModules) * 100);
  return Math.min(progressPercent, 100);
};

export const fetchAllSubmissions = async () => {
  try {
    const { data, error } = await supabase
      .from('submissions')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Supabase table "submissions" not found (404). Falling back to local storage.');
      return [];
    }

    return (data || []).map((row) => normalizeSubmission(applyLocalGrade(row)));
  } catch (err) {
    console.warn('Network or database connection error. Returning to empty remote array.', err);
    return [];
  }
};

export const gradeSubmission = async (submissionId, status, feedbackText = '', feedbackVideoUrl = '') => {
  const patch = {
    status,
    feedback_text: feedbackText,
    feedback_video_url: feedbackVideoUrl
  };

  writeLocalGrade(submissionId, patch);

  const { data, error } = await supabase
    .from('submissions')
    .update(patch)
    .eq('id', submissionId)
    .select();

  if (error) {
    console.error('Error grading submission:', error);
    return normalizeSubmission({ id: submissionId, ...patch });
  }

  if (!data || data.length === 0) {
    console.warn(
      'Supabase update matched 0 rows (often RLS). Grade saved locally so this browser can still show Passed.'
    );
    return normalizeSubmission({ id: submissionId, ...patch });
  }

  const saved = normalizeSubmission(applyLocalGrade(data[0]));
  writeLocalGrade(submissionId, {
    status: saved.status,
    feedback_text: saved.feedback_text,
    feedback_video_url: saved.feedback_video_url
  });
  return saved;
};

export const deleteCourse = async (courseId) => {
  if (!courseId) throw new Error('Course ID is required for deletion.');

  const cleanCourseId = String(courseId).trim();

  // 1. Delete all student submissions associated with this course first
  const { error: submissionError } = await supabase
    .from('submissions')
    .delete()
    .eq('course_id', cleanCourseId);

  if (submissionError) {
    console.error('Failed to delete course submissions:', submissionError);
    throw submissionError;
  }

  // 2. Delete the course itself from Supabase
  const { error: courseError } = await supabase
    .from('courses')
    .delete()
    .eq('id', cleanCourseId);

  if (courseError) {
    console.error('Failed to delete course:', courseError);
    throw courseError;
  }

  return true;
};