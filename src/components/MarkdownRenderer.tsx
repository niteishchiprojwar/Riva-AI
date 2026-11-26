import { useState, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Check, Copy } from 'lucide-react';

interface CodeBlockProps {
  language: string;
  code: string;
}

function CodeBlock({ language, code }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard fallback ignored
    }
  };

  return (
    <div className="my-3.5 overflow-hidden rounded-xl border border-violet-200/60 dark:border-violet-800/50 bg-[#141122] text-slate-100">
      <div className="flex items-center justify-between px-3.5 py-2 bg-[#1e1a33] border-b border-violet-900/50 text-xs text-slate-300">
        <span className="font-mono lowercase">{language || 'code'}</span>
        <button
          type="button"
          onClick={handleCopy}
          aria-label={copied ? 'Code copied' : 'Copy code'}
          className="inline-flex items-center gap-1.5 text-xs text-slate-200 hover:text-white transition-colors px-2 py-1 rounded-md hover:bg-white/10 whitespace-nowrap shrink-0"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-pink-400" />
              <span>Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="p-3.5 overflow-x-auto text-[13px] leading-relaxed font-mono">
        <code>{code}</code>
      </pre>
    </div>
  );
}

interface MarkdownRendererProps {
  content: string;
  isStreaming?: boolean;
}

export function MarkdownRenderer({ content, isStreaming }: MarkdownRendererProps) {
  return (
    <div className="text-[15px] leading-[1.65] text-slate-800 dark:text-slate-100 break-words">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="text-lg font-semibold text-slate-950 dark:text-white mt-4 mb-2 first:mt-0">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-base font-semibold text-slate-950 dark:text-white mt-4 mb-1.5 first:mt-0">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-[15px] font-semibold text-violet-950 dark:text-violet-200 mt-3.5 mb-1 first:mt-0">
              {children}
            </h3>
          ),
          p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
          ul: ({ children }) => (
            <ul className="list-disc pl-5 mb-3 space-y-1">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal pl-5 mb-3 space-y-1">{children}</ol>
          ),
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-violet-700 dark:text-pink-400 underline underline-offset-2 hover:text-blue-600 dark:hover:text-pink-300"
            >
              {children}
            </a>
          ),
          blockquote: ({ children }) => (
            <blockquote className="my-3 px-3.5 py-2 rounded-lg bg-violet-50 dark:bg-violet-950/40 border border-violet-200/80 dark:border-violet-800/50 text-slate-700 dark:text-slate-300 italic">
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <div className="my-3 overflow-x-auto rounded-lg border border-violet-200/80 dark:border-violet-800/50">
              <table className="w-full text-left text-sm border-collapse">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-violet-50 dark:bg-violet-950/60 text-slate-900 dark:text-slate-100">
              {children}
            </thead>
          ),
          th: ({ children }) => (
            <th className="px-3 py-2 font-semibold border-b border-violet-200/80 dark:border-violet-800/50">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-3 py-2 border-b border-violet-100 dark:border-violet-900/40 tabular-nums">
              {children}
            </td>
          ),
          hr: () => (
            <hr className="my-4 border-violet-200/80 dark:border-violet-800/50" />
          ),
          pre: ({ children }) => <>{children}</>,
          code: ({
            className,
            children,
          }: {
            className?: string;
            children?: ReactNode;
          }) => {
            const match = /language-([\w-]+)/.exec(className || '');
            const text = String(children ?? '').replace(/\n$/, '');
            const isBlock = Boolean(match) || text.includes('\n');
            if (isBlock) {
              return <CodeBlock language={match?.[1] ?? ''} code={text} />;
            }
            return (
              <code className="px-1.5 py-0.5 rounded-md bg-violet-100/80 dark:bg-violet-900/50 text-violet-900 dark:text-pink-200 text-[13px] font-mono">
                {children}
              </code>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
      {isStreaming && <span className="streaming-cursor" aria-hidden="true" />}
    </div>
  );
}
