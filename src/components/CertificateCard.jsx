function formatEarnedOn(earnedOn) {
  if (!earnedOn) return '';
  const date = new Date(earnedOn);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

export default function CertificateCard({
  kind = 'lesson',
  title,
  courseTitle,
  studentName,
  academyName,
  earnedOn
}) {
  const isCourse = kind === 'course';
  const earnedLabel = formatEarnedOn(earnedOn);

  return (
    <article className={`certificate-card certificate-card--${isCourse ? 'course' : 'lesson'}`}>
      <p className='certificate-kicker'>{academyName || 'Phoenix Fire Technical Academy'}</p>
      <h3 className='certificate-heading'>
        {isCourse ? 'Course Certificate' : 'Lesson Certificate'}
      </h3>
      <p className='certificate-awarded'>Awarded to</p>
      <p className='certificate-name'>{studentName || 'Student'}</p>
      <p className='certificate-for'>
        {isCourse ? 'for completing the course' : 'for completing the lesson'}
      </p>
      <p className='certificate-title'>{title || (isCourse ? 'Course' : 'Lesson')}</p>
      {!isCourse && courseTitle && (
        <p className='certificate-course'>{courseTitle}</p>
      )}
      {earnedLabel && <p className='certificate-date'>{earnedLabel}</p>}
    </article>
  );
}