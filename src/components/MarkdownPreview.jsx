import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function MarkdownPreview({ markdown }) {
    return (
        <div
            style={{
                border: "1px solid #ddd",
                borderRadius: 8,
                padding: 12,
                marginTop: 10,
                
            }}
        >
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Preview</div>

            <div style={{ lineHeight: 1.5 }}>
                <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                        a: ({ ...props }) => (
                            <a {...props} target="_blank" rel="noreferrer noopener" />
                        ),
                        code: ({ inline, children, ...props }) =>
                            inline ? (
                                <code
                                    {...props}
                                    style={{
                                        background: "rgba(0,0,0,0.06)",
                                        padding: "2px 6px",
                                        borderRadius: 6,
                                    }}
                                >
                                    {children}
                                </code>
                            ) : (
                                <pre
                                    style={{
                                        background: "rgba(0,0,0,0.06)",
                                        padding: 12,
                                        borderRadius: 8,
                                        overflowX: "auto",
                                    }}
                                >
                                    <code {...props}>{children}</code>
                                </pre>
                            ),
                    }}
                >
                    {markdown || ""}
                </ReactMarkdown>
            </div>
        </div>
    );
}