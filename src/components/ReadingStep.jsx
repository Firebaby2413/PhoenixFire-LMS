import MarkdownPreview from './MarkdownPreview';

export default function ReadingStep({ markdown, isRead, onToggleRead }) {
  return (
    <>
      <div
        className='module-markdown'
        style={{ background: '#030712', border: '1px solid #1f2937', padding: '20px', borderRadius: '8px', marginBottom: '16px', color: '#e5e7eb' }}
      >
        <MarkdownPreview markdown={markdown} showHeader={false} />
      </div>
      <button
        onClick={onToggleRead}
        style={{
          background: isRead ? '#10b981' : '#374151',
          color: '#fff',
          border: 'none',
          padding: '10px 20px',
          borderRadius: '6px',
          cursor: 'pointer',
          fontWeight: 'bold'
        }}
      >
        {isRead ? '✓ Material Read (Completed)' : 'Mark Material as Read'}
      </button>
    </>
  );
}
