import StudentQuizQuestion from './StudentQuizQuestion';

const QUIZ_PASSING_PERCENT = 90;

function getQuizAnswerKey(moduleId, question, index) {
  return `${moduleId}_${question.id || index}`;
}

export default function QuizStep({ moduleId, questions, answers, result, onAnswer, onCheck }) {
  return (
    <div style={{ background: '#1e293b', padding: '18px', borderRadius: '18px' }}>
      <h5 style={{ color: '#f97316', margin: '0 0 12px 0' }}>Quiz Questions</h5>
      {questions.map((q, qIdx) => {
        const questionKey = getQuizAnswerKey(moduleId, q, qIdx);
        return (
          <StudentQuizQuestion
            key={questionKey}
            question={q}
            answer={answers[questionKey] || ''}
            groupName={questionKey}
            onChange={(value) => onAnswer(questionKey, value)}
          />
        );
      })}
      <div style={{ marginTop: '12px' }}>
        <button
          type='button'
          onClick={onCheck}
          style={{
            background: '#f97316',
            color: '#fff',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 'bold'
          }}
        >
          {result ? 'Retake / Check Again' : 'Check Quiz'}
        </button>
        {result && (
          <p style={{ marginTop: '10px', color: result.passed ? '#34d399' : '#f87171' }}>
            Score: {result.correct}/{result.total} ({result.percent}%).
            {result.passed ? 'Passed!' : `Need ${QUIZ_PASSING_PERCENT}% to pass.`}
          </p>
        )}
      </div>
    </div>
  );
}
