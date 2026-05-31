import { useState } from "react";

interface Props {
  text: string | undefined;
}

export function CopyPromptButton({ text }: Props) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      type="button"
      className="copy-prompt-btn"
      onClick={handleCopy}
      disabled={!text}
      title="Copiar prompt de contexto"
    >
      <i className={`bi ${copied ? "bi-check2" : "bi-clipboard"}`}></i>
      {copied && <span className="copy-prompt-tooltip">Copiado!</span>}
    </button>
  );
}
