import CertificateCard from './CertificateCard';

export default function LessonFinishPanel({
  finishNotice,
  finishPanelRef,
  lessonCert,
  courseCert,
  lessonCertTitle,
  studentName,
  academyName,
  nextLessonTitle,
  onNextLesson,
  onBack
}) {
  if (!finishNotice && !lessonCert) return null;

  return (
    <div ref={finishPanelRef} style={{ display: 'grid', gap: '14px', marginTop: '10px', justifyItems: 'center' }}>
      {finishNotice && <p className='finish-notice'>{finishNotice}</p>}
      {lessonCert && (
        <>
          <CertificateCard
            kind='lesson'
            title={lessonCertTitle}
            courseTitle={lessonCert.courseTitle}
            studentName={studentName}
            academyName={academyName}
            earnedOn={lessonCert.earnedOn}
          />
          {courseCert && (
            <CertificateCard
              kind='course'
              title={courseCert.title}
              studentName={studentName}
              academyName={academyName}
              earnedOn={courseCert.earnedOn}
            />
          )}
          <p style={{ margin: 0, width: '100%', color: '#9ca3af', fontSize: '14px' }}>
            {courseCert
              ? 'You finished this course. Both certificates are saved on your Progress tab.'
              : nextLessonTitle
                ? `Next up: ${nextLessonTitle}. This certificate is saved on your Progress tab.`
                : 'This certificate is saved on your Progress tab.' }
          </p>
          <div className='certificate-actions'>
            {nextLessonTitle && (
              <button
                type='button'
                onClick={onNextLesson}
                style={{ background: '#f97316', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                Next Lesson →
              </button>
            )}
            <button
              type='button'
              onClick={onBack}
              style={{ background: '#10b981', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
            >
              Back to Course Menu
            </button>
          </div>
        </>
      )}
    </div>
  );
}
