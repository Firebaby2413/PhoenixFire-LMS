import { supabase } from './supabaseClient';

function storageKey(studentId) {
  return `student_flashcards_${studentId}`;
}

function newCardId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `card_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function readLocalStudentFlashcards(studentId) {
  if (!studentId) return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey(studentId)) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalStudentFlashcards(studentId, cards) {
  localStorage.setItem(storageKey(studentId), JSON.stringify(cards));
}

function forLesson(cards, courseId, lessonId) {
  return cards.filter(
    (card) =>
      String(card.course_id) === String(courseId) && String(card.lesson_id) === String(lessonId)
  );
}

function upsertLocal(studentId, card) {
  const next = readLocalStudentFlashcards(studentId).filter((item) => item.id !== card.id);
  next.push(card);
  writeLocalStudentFlashcards(studentId, next);
}

function removeLocal(studentId, cardId) {
  writeLocalStudentFlashcards(
    studentId,
    readLocalStudentFlashcards(studentId).filter((item) => item.id !== cardId)
  );
}

export async function loadStudentFlashcards(studentId, courseId, lessonId) {
  const local = forLesson(readLocalStudentFlashcards(studentId), courseId, lessonId);
  const { data, error } = await supabase
    .from('student_flashcards')
    .select('id, student_id, course_id, lesson_id, front, back')
    .eq('student_id', String(studentId))
    .eq('course_id', String(courseId))
    .eq('lesson_id', String(lessonId));

  if (error) {
    return { cards: local, remote: false };
  }

  const remote = (data || []).map((card) => ({ ...card, synced: true }));
  const remoteIds = new Set(remote.map((card) => card.id));
  const pending = local.filter((card) => card.synced !== true && !remoteIds.has(card.id));
  return { cards: [...remote, ...pending], remote: true };
}

export async function addStudentFlashcard(studentId, courseId, lessonId, front, back) {
  const card = {
    id: newCardId(),
    student_id: String(studentId),
    course_id: String(courseId),
    lesson_id: String(lessonId),
    front: String(front || '').trim(),
    back: String(back || '').trim(),
    synced: false
  };
  const { data, error } = await supabase
    .from('student_flashcards')
    .insert({
      id: card.id,
      student_id: card.student_id,
      course_id: card.course_id,
      lesson_id: card.lesson_id,
      front: card.front,
      back: card.back
    })
    .select('id, student_id, course_id, lesson_id, front, back')
    .single();

  const saved = error ? card : { ...data, synced: true };
  upsertLocal(studentId, saved);
  return { card: saved, remote: !error };
}

export async function updateStudentFlashcard(studentId, card, front, back) {
  const next = {
    ...card,
    front: String(front || '').trim(),
    back: String(back || '').trim()
  };
  const { error } = await supabase
    .from('student_flashcards')
    .update({
      front: next.front,
      back: next.back,
      updated_at: new Date().toISOString()
    })
    .eq('id', card.id)
    .eq('student_id', String(studentId));
  next.synced = !error;
  upsertLocal(studentId, next);
  return { card: next, remote: !error };
}

export async function deleteStudentFlashcard(studentId, cardId) {
  const { error } = await supabase
    .from('student_flashcards')
    .delete()
    .eq('id', cardId)
    .eq('student_id', String(studentId));
  removeLocal(studentId, cardId);
  return { remote: !error };
}
