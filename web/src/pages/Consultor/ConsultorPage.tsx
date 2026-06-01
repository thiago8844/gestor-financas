import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import PageLayout from "../../layouts/PageLayout";
import {
  getPrompt,
  enviarMensagemChatbot,
  verificarPermissaoChatbot,
} from "../../api/consultor";
import { CopyPromptButton } from "./CopyPromptButton";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import "../../styles/consultor.scss"; // ✅ Arquivo de estilos (vou criar depois)
import type {
  DadosFinanceirosResponse,
  HistoryMessage,
} from "../../types/chatbot";
import axios from "axios";
import { useNavigate } from "react-router-dom";

// ✅ TIPO DA MENSAGEM
type Message = {
  id: string;
  role: "user" | "ai";
  text: string;
  timestamp: Date;
};

export function ConsultorPage() {
  const navigate = useNavigate();

  useEffect(() => {
    verificarPermissaoChatbot()
      .then((res) => {
        console.log("Permissão concedida:", res);
      })
      .catch((error) => {
        console.error("Erro ao verificar permissão:", error);
        if (axios.isAxiosError(error) && error.response?.status === 403) {
          //alert("Acesso negado ao consultor financeiro. Redirecionando...");
          navigate("/acesso-negado");
        } else {
          alert(
            "Ocorreu um erro ao verificar acesso ao consultor financeiro. Tente novamente mais tarde.",
          );
          navigate("/");
        }
      });
  }, [navigate]);

  // ✅ BUSCA O PROMPT INICIAL (contexto financeiro do usuário)
  const {
    data: promptContext,
    isLoading,
    isError,
    error,
  } = useQuery<DadosFinanceirosResponse>({
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
      const history: HistoryMessage[] = messages.slice(-3).map((message) => {
        const role: HistoryMessage["role"] =
          message.role === "ai" ? "assistant" : "user";

        return {
          role,
          content: message.text,
        };
      });

      const reply = await enviarMensagemChatbot(
        userMessage.text,
        promptContext!,
        history,
      );

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "ai",
        text: reply || "Desculpe, não consegui processar sua pergunta.",
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, aiMessage]);
      setIsTyping(false);
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

  if (isError) {
    return (
      <PageLayout title="" backTo="/">
        <div className="d-flex flex-column align-items-center justify-content-center py-5 text-center">
          <i className="bi bi-exclamation-triangle-fill text-warning fs-1 mb-3"></i>
          <h5 className="fw-bold">Não foi possível carregar o consultor</h5>
          <p className="text-muted small mb-3">
            {axios.isAxiosError(error) && error.response?.data?.message
              ? error.response.data.message
              : "Ocorreu um erro ao buscar seus dados financeiros. Tente novamente."}
          </p>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => window.location.reload()}
          >
            <i className="bi bi-arrow-clockwise me-1"></i>
            Tentar novamente
          </button>
        </div>
      </PageLayout>
    );
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
          <div className="chat-input-wrapper">
            <input
              type="text"
              className="form-control"
              placeholder="Digite sua pergunta sobre finanças..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isTyping}
              autoFocus
            />
            <CopyPromptButton
              text={promptContext ? promptContext.prompt : undefined}
            />
          </div>

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
