import type { ReactNode } from "react";
import fs from "fs";
import path from "path";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import { headingAnchorId, headingText } from "@/utils/headingAnchor";

function headingWithAnchor(
  Tag: "h1" | "h2" | "h3",
  className: string,
  { children }: { children?: ReactNode },
) {
  const text = headingText(children);
  const id = headingAnchorId(text);

  return (
    <Tag id={id} className={`${className} whitepaper-heading-anchor`}>
      <a href={`#${id}`} className="whitepaper-heading-link" aria-label={`链接到：${text}`}>
        {children}
      </a>
    </Tag>
  );
}

const markdownComponents: Components = {
  h1: (props) => headingWithAnchor("h1", "whitepaper-title", props),
  h2: (props) => headingWithAnchor("h2", "", props),
  h3: (props) => headingWithAnchor("h3", "", props),
  a: ({ href, children }) => {
    if (href?.startsWith("#")) {
      return (
        <a
          href={href}
          className="text-green-400 underline decoration-green-500/50 underline-offset-2 hover:text-green-300"
        >
          {children}
        </a>
      );
    }
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-green-400 underline decoration-green-500/50 underline-offset-2 hover:text-green-300"
      >
        {children}
      </a>
    );
  },
  img: ({ src, alt }) => {
    if (!src || typeof src !== "string") return null;
    const resolvedSrc = src.startsWith("./") ? `/${src.slice(2)}` : src;
    const isQr = alt === "my_qr" || resolvedSrc.includes("my_qr");
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={resolvedSrc}
        alt={alt ?? ""}
        className={
          isQr
            ? "my-4 w-full max-w-[170px] rounded-xl border border-white/10"
            : "my-4 w-full max-w-lg rounded-xl border border-white/10"
        }
      />
    );
  },
};

export default function WhitepaperPage() {
  const filePath = path.join(process.cwd(), "public", "whitepaper.md");
  const content = fs.readFileSync(filePath, "utf-8");

  return (
    <div className="pb-12">
      <div className="mx-5 py-4">
        <Link
          href="/"
          className="text-green-200 hover:text-green-100"
        >
          {"<返回"}
        </Link>
      </div>
      <article className="whitepaper-content mx-6 max-w-3xl md:mx-auto md:px-4">
        <ReactMarkdown components={markdownComponents}>{content}</ReactMarkdown>
      </article>
    </div>
  );
}
