/**
 * Single source of truth for module kind.
 *
 * Course Editor contract:
 * - Starter GitHub repo URL  → assignment (student submits a link)
 * - No repo URL              → reading / content-only (Mark as Read)
 *
 * Do not treat empty quiz arrays, leftover assignment objects,
 * instruction text, or videos as a submission requirement.
 */

export function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : '';
}

export function getModuleRepoUrl(mod) {
  if (!mod) return '';
  return nonEmptyString(
    mod.repo_url ||
      mod.repoUrl ||
      mod.repository ||
      mod.assignment?.repoUrl ||
      mod.assignment?.repo_url
  );
}

export function requiresAssignmentSubmission(mod) {
  return Boolean(getModuleRepoUrl(mod));
}

export function isReadingModule(mod) {
  return !requiresAssignmentSubmission(mod);
}

export function getModuleQuizItems(mod) {
  if (Array.isArray(mod?.questions) && mod.questions.length > 0) {
    return mod.questions;
  }
  if (Array.isArray(mod?.quiz) && mod.quiz.length > 0) {
    return mod.quiz;
  }
  return [];
}

export function getLessonFlashcards(lesson) {
  const list = lesson?.flashcards;
  if (!Array.isArray(list)) return [];
  return list.filter((card) => {
    const front = String(card?.front || '').trim();
    const back = String(card?.back || '').trim();
    return front.length > 0 || back.length > 0;
  });
}

export function moduleHasPortions(mod) {
  const content = String(
    mod?.content || mod?.body || mod?.markdown || mod?.details || mod?.text || ''
  ).trim();
  const video = mod?.video_url || mod?.videoUrl || mod?.video || '';
  const repo = getModuleRepoUrl(mod);
  const quiz = getModuleQuizItems(mod);
  return Boolean(content || video || repo || quiz.length > 0);
}

export function getModuleSteps(mod) {
  const steps = [];
  const content = String(
    mod?.content || mod?.body || mod?.markdown || mod?.details || mod?.text || ''
  ).trim();
  const video = mod?.video_url || mod?.videoUrl || mod?.video || '';
  const repo = getModuleRepoUrl(mod);
  const quiz = getModuleQuizItems(mod);

  if (content) steps.push('reading');
  if (video) steps.push('video');
  if (quiz.length > 0) steps.push('quiz');
  if (repo) steps.push('assignment');
  if (steps.length === 0 && moduleHasPortions(mod)) steps.push('reading');
  return steps;
}

export function withModuleClassification(mod) {
  if (!mod) return mod;

  const repoUrl = getModuleRepoUrl(mod);
  const requiresSubmission = Boolean(repoUrl);
  const instructionsText = nonEmptyString(
    mod.assignment_prompt || mod.instructions || mod.assignment?.instructionsText
  );
  const videoUrl = nonEmptyString(
    mod.video_url || mod.videoUrl || mod.assignment?.instructionsVideoUrl
  );

  return {
    ...mod,
    repo_url: repoUrl,
    assignment_prompt: instructionsText,
    video_url: videoUrl,
    type: requiresSubmission ? 'assignment' : 'reading',
    is_reading: !requiresSubmission,
    requires_submission: requiresSubmission,
    assignment: requiresSubmission
      ? {
          repoUrl,
          instructionsText,
          instructionsVideoUrl: videoUrl,
          submissions: Array.isArray(mod.assignment?.submissions)
            ? mod.assignment.submissions
            : []
        }
      : null
  };
}
