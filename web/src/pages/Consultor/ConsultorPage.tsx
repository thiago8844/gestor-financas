import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import PageLayout from "../../layouts/PageLayout";
import { getPrompt } from "../../api/consultor";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import "../../styles/consultor.scss"; // ✅ Arquivo de estilos (vou criar depois)

// ✅ TIPO DA MENSAGEM
type Message = {
  id: string;
  role: "user" | "ai";
  text: string;
  timestamp: Date;
};

export function ConsultorPage() {
  // ✅ BUSCA O PROMPT INICIAL (contexto financeiro do usuário)
  const { data: promptContext, isLoading } = useQuery({
    queryKey: ["prompt"],
    queryFn: getPrompt,
  });

  // ✅ ESTADOS DO CHAT
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false); // IA "pensando"
  const messagesEndRef = useRef<HTMLDivElement>(null); // Scroll automático

  // ✅ SCROLL AUTOMÁTICO PARA ÚLTIMA MENSAGEM
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  // ✅ FUNÇÃO PARA ENVIAR MENSAGEM
  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || isTyping) return;

    // ✅ ADICIONA MENSAGEM DO USUÁRIO
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      text: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput(""); // Limpa input
    setIsTyping(true); // Mostra "IA pensando..."

    try {
      const question =
        promptContext + "\n\n Pergunta Usuario: " + userMessage.text;
      // ✅ ENVIA PARA O WEBHOOK DO N8N
      const response = await fetch(
        "https://sistemasoito-n8n.3apavv.easypanel.host/webhook-test/webhook/consultor-financeiro",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: question, // Pergunta do usuário
            //history: messages.map((m) => ({ role: m.role, text: m.text })), // Histórico
          }),
        }
      );

      const data = await response.json();

      // ✅ ADICIONA RESPOSTA DA IA (com delay para efeito)
      setTimeout(() => {
        const aiMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: "ai",
          text: data.reply || "Desculpe, não consegui processar sua pergunta.",
          timestamp: new Date(),
        };

        setMessages((prev) => [...prev, aiMessage]);
        setIsTyping(false);
      }, 100); // Delay de 100ms para simular "pensando"
    } catch (error) {
      console.error("Erro ao enviar mensagem:", error);

      // ✅ MENSAGEM DE ERRO
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "ai",
        text: "Desculpe, ocorreu um erro ao processar sua pergunta. Tente novamente.",
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, errorMessage]);
      setIsTyping(false);
    }
  }

  // ✅ LIMPAR TODAS AS MENSAGENS
  function handleClearChat() {
    if (window.confirm("Tem certeza que deseja limpar todo o histórico?")) {
      setMessages([]);
    }
  }

  return (
    <PageLayout title="" backTo="/" loading={isLoading}>
      <div className="consultor-container">
        {/* ✅ HEADER DO CHAT */}
        <div className="chat-header">
          <div>
            <h5 className="mb-0">
              <i className="bi bi-chat-dots-fill me-2"></i>
              Consultor Financeiro IA
            </h5>
          </div>
          <button
            className={`btn btn-sm btn-secondary ${
              messages.length === 0 ? "d-none" : ""
            }`}
            onClick={handleClearChat}
            disabled={messages.length === 0}
          >
            <i className="bi bi-trash me-1"></i>
            Limpar Chat
          </button>
        </div>

        {/* ✅ ÁREA DE MENSAGENS */}
        <div className="chat-messages">
          {messages.length === 0 && (
            <div className="empty-state">
              <i className="bi bi-chat-square-text fs-1 text-muted mb-3"></i>
              <p className="text-muted">
                Nenhuma mensagem ainda. Faça sua primeira pergunta!
              </p>
            </div>
          )}

          {/* ✅ RENDERIZA MENSAGENS */}
          {messages.map((message) => (
            <div
              key={message.id}
              className={`message message-${message.role} animate-in`}
            >
              <div className="message-avatar">
                {message.role === "user" ? (
                  <i className="bi bi-person-circle"></i>
                ) : (
                  <i className="bi bi-robot"></i>
                )}
              </div>
              <div className="message-content">
                <div className="message-text">
                  <Markdown remarkPlugins={[remarkGfm]}>
                    {message.text}
                  </Markdown>
                </div>
                <div className="message-time">
                  {message.timestamp.toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </div>
            </div>
          ))}

          {/* ✅ INDICADOR "IA PENSANDO..." */}
          {isTyping && (
            <div className="message message-ai animate-in">
              <div className="message-avatar">
                <i className="bi bi-robot"></i>
              </div>
              <div className="message-content">
                <div className="typing-indicator">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            </div>
          )}

          {/* ✅ REF PARA SCROLL AUTOMÁTICO */}
          <div ref={messagesEndRef} />
        </div>

        {/* ✅ INPUT DE MENSAGEM */}
        <form className="chat-input" onSubmit={handleSendMessage}>
          <input
            type="text"
            className="form-control"
            placeholder="Digite sua pergunta sobre finanças..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isTyping}
            autoFocus
          />
          <button
            type="submit"
            className="btn btn-primary"
            disabled={!input.trim() || isTyping}
          >
            <i className="bi bi-send-fill"></i>
          </button>
        </form>
      </div>

      {/* {promptContext && (
        <pre
          style={{
            background: "#f8f9fa",
            padding: 12,
            borderRadius: 8,
            fontSize: 14,
          }}
        >
          {JSON.stringify(promptContext, null, 2)}
        </pre>
      )} */}
    </PageLayout>
  );
}
