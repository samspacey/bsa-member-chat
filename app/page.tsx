"use client";

import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface Persona {
  id: string;
  name: string;
  avatar: string;
  society: string;
  shortDescription: string;
}

const personas: Persona[] = [
  {
    id: "margaret",
    name: "Margaret Davies",
    avatar: "👵",
    society: "Monmouthshire Building Society",
    shortDescription: "74, retired teacher, traditional saver, uses branch weekly",
  },
  {
    id: "rhys",
    name: "Rhys Morgan",
    avatar: "👨‍💻",
    society: "Monmouthshire Building Society",
    shortDescription: "29, software developer, first-time buyer, digital-first",
  },
];

export default function Home() {
  const [selectedPersona, setSelectedPersona] = useState<Persona | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const startChat = (persona: Persona) => {
    setSelectedPersona(persona);
    setMessages([
      {
        role: "assistant",
        content: getGreeting(persona),
      },
    ]);
  };

  const getGreeting = (persona: Persona): string => {
    if (persona.id === "margaret") {
      return "Oh, hello there. Are you from the building society? I hope you're not here to tell me you're closing my branch... I've been meaning to have a word with someone. Do sit down.";
    } else if (persona.id === "rhys") {
      return "Hey. So, you're from MBS? Cool. I've actually got a few things I wanted to ask about - mainly about mortgages and why your app is so basic. Got a minute?";
    }
    return "Hello, how can I help you today?";
  };

  const sendMessage = async () => {
    if (!input.trim() || !selectedPersona || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, { role: "user", content: userMessage }],
          personaId: selectedPersona.id,
        }),
      });

      if (!response.ok) throw new Error("Failed to get response");

      const data = await response.json();
      setMessages((prev) => [...prev, { role: "assistant", content: data.message }]);
    } catch (error) {
      console.error("Error:", error);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, I got a bit confused there. What were you saying?" },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const resetChat = () => {
    setSelectedPersona(null);
    setMessages([]);
  };

  if (!selectedPersona) {
    return (
      <main className="min-h-screen p-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              BSA Member Chat
            </h1>
            <p className="text-xl text-gray-600">
              Experience your building society through your members' eyes
            </p>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-800 mb-6 text-center">
              Select a member to chat with
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              {personas.map((persona) => (
                <button
                  key={persona.id}
                  onClick={() => startChat(persona)}
                  className="bg-white p-6 rounded-xl shadow-md hover:shadow-lg transition-shadow border border-gray-200 text-left"
                >
                  <div className="flex items-start gap-4">
                    <span className="text-5xl">{persona.avatar}</span>
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900">
                        {persona.name}
                      </h3>
                      <p className="text-sm text-gray-500 mb-2">{persona.society}</p>
                      <p className="text-gray-600">{persona.shortDescription}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="text-center text-gray-500 text-sm">
            <p>These are simulated members based on typical customer profiles.</p>
            <p>Use this tool to understand member perspectives on your decisions.</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{selectedPersona.avatar}</span>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">
                {selectedPersona.name}
              </h1>
              <p className="text-sm text-gray-500">{selectedPersona.society}</p>
            </div>
          </div>
          <button
            onClick={resetChat}
            className="text-gray-600 hover:text-gray-900 text-sm font-medium"
          >
            ← Choose different member
          </button>
        </div>
      </header>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto chat-messages p-6">
        <div className="max-w-4xl mx-auto space-y-4">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                  message.role === "user"
                    ? "bg-blue-600 text-white"
                    : "bg-white border border-gray-200 text-gray-800"
                }`}
              >
                {message.role === "assistant" && (
                  <span className="text-xl mr-2">{selectedPersona.avatar}</span>
                )}
                <ReactMarkdown className="inline">{message.content}</ReactMarkdown>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3">
                <span className="text-xl mr-2">{selectedPersona.avatar}</span>
                <span className="text-gray-400">typing...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-gray-200 bg-white p-4">
        <div className="max-w-4xl mx-auto flex gap-4">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder="Type your message..."
            className="flex-1 border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isLoading}
          />
          <button
            onClick={sendMessage}
            disabled={isLoading || !input.trim()}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            Send
          </button>
        </div>
      </div>
    </main>
  );
}
