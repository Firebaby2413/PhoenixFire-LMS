import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function MarkdownPreview({ markdown, showHeader = true }) {
  return (
    <div
      className='markdown-preview-container'
      style={{
        border: '1px solid var(--pf-border, #ddd)',
        borderRadius: 8,
        padding: 12,
        marginTop: 10
      }}
    >
      {showHeader && (
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Preview</div>
      )}

      <div style={{ lineHeight: 1.5 }}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            a: (allProps) => {
              const props = { ...allProps };
              delete props.node;
              return <a {...props} target='_blank' rel='noreferrer noopener' />;
            },
            code: (allProps) => {
              const { className, children, ...props } = allProps;
              delete props.node;

              const match = /language-(\w+)/.exec(className || '');
              const isBlock = Boolean(match) || String(children).includes('\n');

              if (!isBlock) {
                return (
                  <code
                    {...props}
                    style={{
                      background: 'rgba(0,0,0,0.06)',
                      padding: '2px 6px',
                      borderRadius: 6,
                      fontFamily: 'monospace'
                    }}
                  >
                    {children}
                  </code>
                );
              }

              return (
                <pre
                  style={{
                    background: 'rgba(0,0,0,0.06)',
                    padding: 12,
                    borderRadius: 8,
                    overflowX: 'auto'
                  }}
                >
                  <code {...props} className={className}>
                    {children}
                  </code>
                </pre>
              );
            }
          }}
        >
          {markdown || ''}
        </ReactMarkdown>
      </div>
    </div>
  );
}