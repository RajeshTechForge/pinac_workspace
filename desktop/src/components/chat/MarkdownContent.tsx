import { memo, Children, type ReactElement } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import CodeBlock from "./CodeBlock";

interface MarkdownContentProps {
  content: string;
}

function MarkdownContent({ content }: MarkdownContentProps) {
  return (
    <div className="[&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        components={{
          code({ className, children, node, ...props }) {
            const match = /language-(\w+)/.exec(className ?? "");
            if (match) {
              return (
                <CodeBlock
                  code={String(children).replace(/\n$/, "")}
                  language={match[1]}
                />
              );
            }
            return (
              <code
                className="px-1 py-0.5 bg-surface-3 rounded-sm text-[13px] font-mono text-accent"
                {...props}
              >
                {children}
              </code>
            );
          },
          pre({ children, node, ...props }) {
            const child = Children.only(children) as ReactElement;
            if (child?.type === CodeBlock) {
              return <>{children}</>;
            }
            return (
              <pre
                className="bg-surface-3 border border-border rounded-sm overflow-x-auto my-2 p-3 text-[13px] font-mono leading-relaxed text-text-primary whitespace-pre-wrap"
                {...props}
              >
                {children}
              </pre>
            );
          },
          p({ children, node, ...props }) {
            return (
              <p className="my-1.5 first:mt-0 last:mb-0" {...props}>
                {children}
              </p>
            );
          },
          h1({ children, node, ...props }) {
            return (
              <h1
                className="text-lg font-semibold mt-4 mb-2 text-text-primary"
                {...props}
              >
                {children}
              </h1>
            );
          },
          h2({ children, node, ...props }) {
            return (
              <h2
                className="text-base font-semibold mt-3 mb-1.5 text-text-primary"
                {...props}
              >
                {children}
              </h2>
            );
          },
          h3({ children, node, ...props }) {
            return (
              <h3
                className="text-[15px] font-medium mt-3 mb-1 text-text-primary"
                {...props}
              >
                {children}
              </h3>
            );
          },
          h4({ children, node, ...props }) {
            return (
              <h4
                className="text-[14px] font-medium mt-2 mb-1 text-text-primary"
                {...props}
              >
                {children}
              </h4>
            );
          },
          h5({ children, node, ...props }) {
            return (
              <h5
                className="text-[13px] font-medium mt-2 mb-1 text-text-muted"
                {...props}
              >
                {children}
              </h5>
            );
          },
          h6({ children, node, ...props }) {
            return (
              <h6
                className="text-[12px] font-medium mt-2 mb-1 text-text-muted"
                {...props}
              >
                {children}
              </h6>
            );
          },
          ul({ children, node, ...props }) {
            return (
              <ul className="list-disc pl-6 my-1.5 space-y-0.5" {...props}>
                {children}
              </ul>
            );
          },
          ol({ children, node, ...props }) {
            return (
              <ol className="list-decimal pl-6 my-1.5 space-y-0.5" {...props}>
                {children}
              </ol>
            );
          },
          li({ children, node, ...props }) {
            return (
              <li className="text-text-primary" {...props}>
                {children}
              </li>
            );
          },
          a({ children, target, rel, node, ...props }) {
            return (
              <a
                className="text-accent underline decoration-accent/30 hover:decoration-accent/60 transition-colors"
                target={target ?? "_blank"}
                rel={rel ?? "noopener noreferrer"}
                {...props}
              >
                {children}
              </a>
            );
          },
          blockquote({ children, node, ...props }) {
            return (
              <blockquote
                className="border-l-2 border-accent/40 pl-3 py-0.5 my-2 text-text-secondary italic"
                {...props}
              >
                {children}
              </blockquote>
            );
          },
          table({ children, node, ...props }) {
            return (
              <div className="overflow-x-auto my-2">
                <table className="w-full border-collapse" {...props}>
                  {children}
                </table>
              </div>
            );
          },
          th({ children, node, ...props }) {
            return (
              <th
                className="border border-border px-2 py-1 text-left text-[13px] font-medium text-text-primary bg-surface-2"
                {...props}
              >
                {children}
              </th>
            );
          },
          td({ children, node, ...props }) {
            return (
              <td
                className="border border-border px-2 py-1 text-[13px] text-text-primary"
                {...props}
              >
                {children}
              </td>
            );
          },
          hr({ node, ...props }) {
            return (
              <hr className="border-t border-border-soft my-3" {...props} />
            );
          },
          strong({ children, node, ...props }) {
            return (
              <strong className="font-semibold text-text-primary" {...props}>
                {children}
              </strong>
            );
          },
          em({ children, node, ...props }) {
            return (
              <em className="italic" {...props}>
                {children}
              </em>
            );
          },
          del({ children, node, ...props }) {
            return (
              <del className="line-through text-text-muted" {...props}>
                {children}
              </del>
            );
          },
          img({ src, alt, node, ...props }) {
            return (
              <img
                src={src}
                alt={alt ?? ""}
                className="max-w-full h-auto rounded-sm my-2"
                loading="lazy"
                {...props}
              />
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export default memo(MarkdownContent);
