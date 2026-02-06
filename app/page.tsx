"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import societiesData from "../societies.json";

interface BenchmarkScore {
  factor: string;
  score: number;
  average: number;
  rank: number;
  reviewCount: number;
  positiveCount: number;
  negativeCount: number;
}

interface BenchmarkData {
  society: string;
  scores: BenchmarkScore[];
  totalSocieties: number;
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface Society {
  id: string;
  name: string;
  shortName: string;
  emoji: string;
  region: string;
  size: string;
  tagline: string;
  color: string;
}

interface Review {
  id: number;
  sentiment: "positive" | "negative";
  title: string;
  quote: string;
  rating: string;
  date: string;
  context: string;
  active?: boolean;
}

interface ArchetypeInfo {
  id: string;
  name: string;
  avatar: string;
  ageRange: string;
  shortDescription: string;
  getGreeting: (societyName: string) => string;
}

const societies: Society[] = societiesData as Society[];

function getSuggestedQuestions(archetypeId: string, shortName: string): string[] {
  const common = [
    `What do you think of ${shortName}?`,
    "What would you change?",
    "What would interest you in the next 5 years?",
  ];
  const specific: Record<string, string[]> = {
    loyalist: ["Tell me about your branch visits", "How do you feel about technology?"],
    "digital-native": ["How's the app?", "How do you compare to other banks?"],
    family: ["How do you manage the family finances?", "What about your children's savings?"],
    "business-owner": ["How's the relationship with your branch?", "What could we do better?"],
  };
  return [...common, ...(specific[archetypeId] || [])];
}

const archetypes: ArchetypeInfo[] = [
  {
    id: "loyalist",
    name: "The Loyalist",
    avatar: "👵",
    ageRange: "70-80",
    shortDescription:
      "Retired, member for 30+ years. Visits the branch every week, knows the staff by name. Values the personal touch and the community roots of their society.",
    getGreeting: (name: string) =>
      `Oh, hello there. Are you from ${name}? How lovely. I've been a member for... well, longer than I care to admit! Do sit down. I always enjoy having a chat about the society.`,
  },
  {
    id: "digital-native",
    name: "The Digital Native",
    avatar: "👨‍💻",
    ageRange: "25-35",
    shortDescription:
      "Tech professional, first-time buyer, saving hard. Chose a building society over a big bank for a reason — but expects a modern digital experience to match.",
    getGreeting: (name: string) =>
      `Hey! So you're from ${name}? Nice. I actually signed up not that long ago — trying to get on the property ladder, you know how it is. I've got a few thoughts about the experience so far if you're interested?`,
  },
  {
    id: "family",
    name: "The Family Juggler",
    avatar: "👩‍👧‍👦",
    ageRange: "38-48",
    shortDescription:
      "Working parent, mortgage holder, kids' savings accounts. Time-poor but engaged — wants to know their family's finances are in good hands.",
    getGreeting: (name: string) =>
      `Hi! Thanks for chatting. We've been with ${name} for a while now — got the mortgage, the kids' savings accounts, the lot. It's nice to actually talk to someone about how it's all going. Where shall we start?`,
  },
  {
    id: "business-owner",
    name: "The Business Owner",
    avatar: "💼",
    ageRange: "45-60",
    shortDescription:
      "Runs a local business, long-standing member. Values the relationship and local roots — expects service that reflects their loyalty and complexity.",
    getGreeting: (name: string) =>
      `Good morning. Thanks for making time. I've been with ${name} a long time — personal and business side — and I do value the relationship. I thought it'd be good to have a proper conversation about how things are going. Shall we?`,
  },
];

type Screen = "society" | "persona" | "chat";

export default function Home() {
  const [screen, setScreen] = useState<Screen>("society");
  const [selectedSociety, setSelectedSociety] = useState<Society | null>(null);
  const [selectedArchetype, setSelectedArchetype] =
    useState<ArchetypeInfo | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [showReviews, setShowReviews] = useState(false);
  const [hasUserSent, setHasUserSent] = useState(false);
  const [highlightedReview, setHighlightedReview] = useState<number | null>(
    null
  );
  const [showBenchmark, setShowBenchmark] = useState(false);
  const [benchmarkData, setBenchmarkData] = useState<BenchmarkData | null>(null);
  const [benchmarkLoading, setBenchmarkLoading] = useState(false);
  const [benchmarkEmail, setBenchmarkEmail] = useState("");
  const [benchmarkEmailSent, setBenchmarkEmailSent] = useState(false);
  const [benchmarkEmailSending, setBenchmarkEmailSending] = useState(false);
  const [benchmarkEmailError, setBenchmarkEmailError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const reviewRefs = useRef<Record<number, HTMLDivElement | null>>({});

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchReviews = useCallback(
    async (societyId: string, archetype?: string) => {
      try {
        const params = new URLSearchParams({ societyId });
        if (archetype) params.set("archetype", archetype);
        const res = await fetch(`/api/reviews?${params}`);
        const data = await res.json();
        setReviews(data.reviews || []);
      } catch {
        setReviews([]);
      }
    },
    []
  );

  const fetchBenchmark = useCallback(async (societyId: string) => {
    setBenchmarkLoading(true);
    try {
      const res = await fetch(`/api/benchmark?societyId=${societyId}`);
      const data = await res.json();
      setBenchmarkData(data);
    } catch {
      setBenchmarkData(null);
    } finally {
      setBenchmarkLoading(false);
    }
  }, []);

  const sendBenchmarkEmail = async () => {
    if (!selectedSociety) return;

    const hasEmail = benchmarkEmail && benchmarkEmail.includes("@") && benchmarkEmail.includes(".");
    if (benchmarkEmail && !hasEmail) {
      setBenchmarkEmailError("Please enter a valid email address");
      return;
    }

    setBenchmarkEmailSending(true);
    setBenchmarkEmailError("");

    try {
      const res = await fetch("/api/benchmark-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: hasEmail ? benchmarkEmail : undefined,
          societyId: selectedSociety.id,
        }),
      });

      if (!res.ok) throw new Error("Failed to generate report");

      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("application/pdf")) {
        // No email — download the PDF
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${selectedSociety.id}-benchmark-report.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
      // If JSON response, email was sent server-side

      setBenchmarkEmailSent(true);
    } catch {
      setBenchmarkEmailError("Something went wrong. Please try again.");
    } finally {
      setBenchmarkEmailSending(false);
    }
  };

  const scrollToReview = (reviewId: number) => {
    setShowReviews(true);
    setHighlightedReview(reviewId);
    setTimeout(() => {
      reviewRefs.current[reviewId]?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      // Clear highlight after animation
      setTimeout(() => setHighlightedReview(null), 2000);
    }, 100);
  };

  const selectSociety = (society: Society) => {
    setSelectedSociety(society);
    setScreen("persona");
    fetchReviews(society.id);
  };

  const selectArchetype = (archetype: ArchetypeInfo) => {
    if (!selectedSociety) return;
    setSelectedArchetype(archetype);
    setMessages([
      {
        role: "assistant",
        content: archetype.getGreeting(selectedSociety.shortName),
      },
    ]);
    // Re-fetch reviews with persona filtering
    fetchReviews(selectedSociety.id, archetype.id);
    setScreen("chat");
  };

  const goBackToSocieties = () => {
    setSelectedSociety(null);
    setSelectedArchetype(null);
    setMessages([]);
    setScreen("society");
  };

  const goBackToPersonas = () => {
    setSelectedArchetype(null);
    setMessages([]);
    setHasUserSent(false);
    setScreen("persona");
  };

  const startOver = () => {
    setSelectedSociety(null);
    setSelectedArchetype(null);
    setMessages([]);
    setReviews([]);
    setShowReviews(false);
    setHasUserSent(false);
    setShowBenchmark(false);
    setBenchmarkData(null);
    setBenchmarkEmail("");
    setBenchmarkEmailSent(false);
    setBenchmarkEmailSending(false);
    setBenchmarkEmailError("");
    setSearchQuery("");
    setInput("");
    setScreen("society");
  };

  const sendMessageText = async (text: string) => {
    if (!text.trim() || !selectedSociety || !selectedArchetype || isLoading)
      return;

    const userMessage = text.trim();
    setHasUserSent(true);
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, { role: "user", content: userMessage }],
          societyId: selectedSociety.id,
          personaArchetype: selectedArchetype.id,
        }),
      });

      if (!response.ok) throw new Error("Failed to get response");

      const data = await response.json();
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.message },
      ]);
    } catch (error) {
      console.error("Error:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Sorry, I got a bit confused there. What were you saying?",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!input.trim()) return;
    const text = input.trim();
    setInput("");
    await sendMessageText(text);
  };

  // Screen 1: Society Selection
  if (screen === "society") {
    return (
      <main className="min-h-screen p-6 md:p-8">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <h1 className="text-4xl font-bold text-gray-900 mb-3">
              BSA Member Chat
            </h1>
            <p className="text-lg text-gray-600">
              Experience your building society through your members&apos; eyes
            </p>
          </div>

          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-6 text-center">
              Choose a building society
            </h2>

            {/* Search input */}
            <div className="relative max-w-lg mx-auto mb-6">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <span className="text-gray-400 text-lg">🔍</span>
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search for a building society..."
                className="w-full bg-white border border-gray-300 rounded-lg pl-11 pr-10 py-3 text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:outline-none"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <span className="text-lg">✕</span>
                </button>
              )}
            </div>

            {(() => {
              const query = searchQuery.toLowerCase().trim();
              const filtered = query
                ? societies.filter(
                    (s) =>
                      s.name.toLowerCase().includes(query) ||
                      s.shortName.toLowerCase().includes(query) ||
                      s.region.toLowerCase().includes(query)
                  )
                : societies;

              if (filtered.length === 0) {
                return (
                  <div className="text-center py-12">
                    <p className="text-gray-400 text-lg mb-2">No societies found</p>
                    <p className="text-gray-400 text-sm">
                      Try a different search term
                    </p>
                  </div>
                );
              }

              return (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {filtered.map((society) => (
                    <button
                      key={society.id}
                      onClick={() => selectSociety(society)}
                      className="bg-white p-5 rounded-xl shadow-sm hover:shadow-md transition-all border border-gray-200 text-left group"
                      style={{ borderLeftWidth: "4px", borderLeftColor: society.color }}
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-3xl flex-shrink-0">{society.emoji}</span>
                        <div className="min-w-0">
                          <h3 className="text-base font-semibold text-gray-900 group-hover:text-gray-700 truncate">
                            {society.shortName}
                          </h3>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {society.region} · {society.size}
                          </p>
                          <p className="text-sm text-gray-600 mt-1.5 leading-snug">
                            {society.tagline}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              );
            })()}
          </div>

          <div className="text-center text-gray-400 text-sm">
            <p>
              Simulated members powered by AI. Use this tool to understand
              member perspectives.
            </p>
          </div>
        </div>
      </main>
    );
  }

  // Screen 2: Persona Selection
  if (screen === "persona" && selectedSociety) {
    return (
      <main className="min-h-screen p-6 md:p-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <button
              onClick={goBackToSocieties}
              className="text-gray-500 hover:text-gray-800 text-sm font-medium mb-4 inline-flex items-center gap-1"
            >
              ← Back to societies
            </button>
            <div className="text-center">
              <div className="inline-flex items-center gap-2 bg-white px-4 py-2 rounded-full shadow-sm border border-gray-200 mb-4">
                <span className="text-xl">{selectedSociety.emoji}</span>
                <span
                  className="font-semibold text-sm"
                  style={{ color: selectedSociety.color }}
                >
                  {selectedSociety.name}
                </span>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Who would you like to speak with?
              </h2>
              <p className="text-gray-600">
                Choose a member archetype to start a conversation
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-3xl mx-auto">
            {archetypes.map((archetype) => (
              <button
                key={archetype.id}
                onClick={() => selectArchetype(archetype)}
                className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-all border border-gray-200 text-left group"
              >
                <div className="flex items-start gap-4">
                  <span className="text-4xl flex-shrink-0">
                    {archetype.avatar}
                  </span>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 group-hover:text-gray-700">
                      {archetype.name}
                    </h3>
                    <p className="text-xs text-gray-500 mb-2">
                      Age {archetype.ageRange}
                    </p>
                    <p className="text-sm text-gray-600 leading-relaxed">
                      {archetype.shortDescription}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </main>
    );
  }

  // Helper: extract citation IDs and clean text from a message
  const extractCitations = (
    content: string
  ): { cleanText: string; citedReviews: Review[] } => {
    const citationIds: number[] = [];
    let m: RegExpExecArray | null;
    const re = /\[Review (\d+)\]/g;
    while ((m = re.exec(content)) !== null) {
      citationIds.push(parseInt(m[1]));
    }
    const cleanText = content.replace(/\s*\[Review \d+\]/g, "").trim();
    const citedReviews = citationIds
      .map((id) => reviews.find((r) => r.id === id))
      .filter((r): r is Review => r !== undefined);
    return { cleanText, citedReviews };
  };

  // Screen 3: Chat Interface
  return (
    <main className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 md:px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {selectedSociety && (
              <div className="flex items-center gap-1.5">
                <span className="text-xl">{selectedSociety.emoji}</span>
                <span
                  className="font-semibold text-sm hidden sm:inline"
                  style={{ color: selectedSociety.color }}
                >
                  {selectedSociety.shortName}
                </span>
              </div>
            )}
            {selectedSociety && selectedArchetype && (
              <span className="text-gray-300">|</span>
            )}
            {selectedArchetype && (
              <div className="flex items-center gap-1.5">
                <span className="text-xl">{selectedArchetype.avatar}</span>
                <div>
                  <span className="font-medium text-sm text-gray-900">
                    {selectedArchetype.name}
                  </span>
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            {reviews.length > 0 && (
              <button
                onClick={() => setShowReviews(!showReviews)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  showReviews
                    ? "bg-amber-100 text-amber-800 border border-amber-200"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200"
                }`}
              >
                <span className="text-base">📋</span>
                <span className="hidden sm:inline">Reviews</span>
                <span className="bg-white/60 text-xs px-1.5 py-0.5 rounded-full">
                  {reviews.length}
                </span>
              </button>
            )}
            <button
              onClick={startOver}
              className="text-gray-500 hover:text-gray-800 text-sm font-medium"
            >
              ← Start over
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Chat area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto chat-messages p-6">
            <div className="max-w-4xl mx-auto space-y-4">
              {messages.map((message, index) => {
                const isUser = message.role === "user";
                const { cleanText, citedReviews: cited } = isUser
                  ? { cleanText: message.content, citedReviews: [] }
                  : extractCitations(message.content);

                return (
                  <div
                    key={index}
                    className={`flex ${
                      isUser ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div className="max-w-[80%]">
                      <div
                        className={`rounded-2xl px-4 py-3 ${
                          isUser
                            ? "bg-blue-600 text-white"
                            : "bg-white border border-gray-200 text-gray-800"
                        }`}
                      >
                        {!isUser && selectedArchetype && (
                          <span className="text-xl mr-2">
                            {selectedArchetype.avatar}
                          </span>
                        )}
                        <ReactMarkdown className="inline">
                          {cleanText}
                        </ReactMarkdown>
                      </div>
                      {/* Attribution line below the bubble */}
                      {cited.length > 0 && (
                        <div className="mt-1.5 px-2 flex flex-wrap items-center gap-1.5">
                          <span className="text-[11px] text-gray-400 italic">
                            Based on:
                          </span>
                          {cited.map((review) => (
                            <button
                              key={review.id}
                              onClick={() => scrollToReview(review.id)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors cursor-pointer border border-amber-200"
                              title={review.quote.substring(0, 150) + "..."}
                            >
                              <span>
                                {review.sentiment === "positive"
                                  ? "👍"
                                  : "👎"}
                              </span>
                              {review.title.length > 40
                                ? review.title.substring(0, 40) + "…"
                                : review.title}
                              <span className="text-amber-400 ml-0.5">
                                · {review.date}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              {isLoading && selectedArchetype && (
                <div className="flex justify-start">
                  <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3">
                    <span className="text-xl mr-2">
                      {selectedArchetype.avatar}
                    </span>
                    <span className="text-gray-400">typing...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Input */}
          <div className="border-t border-gray-200 bg-white p-4">
            {/* Suggested question chips */}
            {!hasUserSent && selectedArchetype && selectedSociety && (
              <div className="max-w-4xl mx-auto mb-3 flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
                {getSuggestedQuestions(selectedArchetype.id, selectedSociety.shortName).map((q) => (
                  <button
                    key={q}
                    onClick={() => sendMessageText(q)}
                    disabled={isLoading}
                    className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm px-3 py-1.5 rounded-full border border-gray-200 cursor-pointer transition-colors whitespace-nowrap flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}
            <div className="max-w-4xl mx-auto">
              <div className="flex gap-4">
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
              {/* Benchmark button — show after 2+ user messages */}
              {selectedSociety && messages.filter(m => m.role === "user").length >= 2 && (
                <div className="mt-3 text-center">
                  <button
                    onClick={() => {
                      if (!benchmarkData && selectedSociety) {
                        fetchBenchmark(selectedSociety.id);
                      }
                      setShowBenchmark(true);
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-full transition-colors"
                  >
                    <span>📊</span>
                    See how {selectedSociety.shortName} benchmarks
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Reviews Sidebar */}
        {showReviews && (
          <div className="w-96 border-l border-gray-200 bg-gray-50 overflow-y-auto flex-shrink-0">
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900 text-sm">
                  Trustpilot Reviews
                </h3>
                <button
                  onClick={() => setShowReviews(false)}
                  className="text-gray-400 hover:text-gray-600 text-lg"
                >
                  ✕
                </button>
              </div>
              <p className="text-xs text-gray-500 mb-4">
                {reviews.filter((r) => r.active !== false).length} reviews
                active for this persona.{" "}
                {reviews.filter((r) => r.active === false).length > 0 && (
                  <span className="text-gray-400">
                    Others shown dimmed.
                  </span>
                )}
              </p>
              <div className="space-y-3">
                {/* Show active reviews first, then inactive */}
                {[...reviews]
                  .sort((a, b) => {
                    if (a.active !== false && b.active === false) return -1;
                    if (a.active === false && b.active !== false) return 1;
                    return a.id - b.id;
                  })
                  .map((review) => (
                  <div
                    key={review.id}
                    ref={(el) => {
                      reviewRefs.current[review.id] = el;
                    }}
                    className={`rounded-lg border p-3 transition-all duration-300 ${
                      highlightedReview === review.id
                        ? "bg-amber-50 border-amber-300 ring-2 ring-amber-200"
                        : review.active === false
                        ? "bg-gray-50 border-gray-100 opacity-50"
                        : "bg-white border-gray-200"
                    }`}
                  >
                    <div className="flex items-start gap-2 mb-1.5">
                      <span className="text-sm flex-shrink-0">
                        {review.sentiment === "positive" ? "👍" : "👎"}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                            #{review.id}
                          </span>
                          <span className="text-xs text-gray-400">
                            {review.rating} · {review.date}
                          </span>
                        </div>
                        <p className="text-xs font-medium text-gray-800 mt-1 leading-snug">
                          {review.title}
                        </p>
                      </div>
                    </div>
                    <blockquote className="text-xs text-gray-600 italic border-l-2 border-gray-200 pl-2 mt-2 leading-relaxed line-clamp-4">
                      &ldquo;{review.quote.length > 250
                        ? review.quote.substring(0, 250) + "..."
                        : review.quote}&rdquo;
                    </blockquote>
                    {review.context && (
                      <p className="text-[11px] text-gray-500 mt-2 leading-snug">
                        {review.context}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Benchmark Modal */}
      {showBenchmark && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                {selectedSociety && (
                  <span className="text-3xl">{selectedSociety.emoji}</span>
                )}
                <div>
                  <h2 className="text-lg font-bold text-gray-900">
                    Benchmarking Report
                  </h2>
                  <p className="text-sm text-gray-500">
                    {selectedSociety?.name} vs industry average
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowBenchmark(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none p-1"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              {benchmarkLoading && (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <div className="animate-spin h-8 w-8 border-4 border-blue-200 border-t-blue-600 rounded-full mx-auto mb-3"></div>
                    <p className="text-sm text-gray-500">Analysing reviews across all societies...</p>
                  </div>
                </div>
              )}

              {!benchmarkLoading && benchmarkData && (
                <div className="space-y-4">
                  {benchmarkData.scores.map((s) => {
                    const diff = s.score - s.average;
                    const absDiff = Math.abs(diff);
                    let colorClass: string;
                    let barColor: string;
                    let badge: string;

                    if (diff >= 1.0) {
                      colorClass = "text-emerald-700";
                      barColor = "bg-emerald-500";
                      badge = "Above avg";
                    } else if (diff > -1.0) {
                      colorClass = "text-amber-700";
                      barColor = "bg-amber-400";
                      badge = "Near avg";
                    } else {
                      colorClass = "text-red-600";
                      barColor = "bg-red-500";
                      badge = "Below avg";
                    }

                    const scorePercent = Math.min(100, (s.score / 10) * 100);
                    const avgPercent = Math.min(100, (s.average / 10) * 100);

                    // Ordinal suffix
                    const ordinal = (n: number) => {
                      const s = ["th", "st", "nd", "rd"];
                      const v = n % 100;
                      return n + (s[(v - 20) % 10] || s[v] || s[0]);
                    };

                    return (
                      <div key={s.factor} className="group">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-sm font-medium text-gray-800">
                            {s.factor}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-medium ${
                              diff >= 1.0 ? "text-emerald-600 bg-emerald-50 border-emerald-200" :
                              diff > -1.0 ? "text-amber-600 bg-amber-50 border-amber-200" :
                              "text-red-600 bg-red-50 border-red-200"
                            } px-2 py-0.5 rounded-full border`}>
                              {badge}
                            </span>
                            <span className="text-xs text-gray-400">
                              {ordinal(s.rank)} of {benchmarkData.totalSocieties}
                            </span>
                          </div>
                        </div>

                        {/* Bar chart */}
                        <div className="relative h-7 bg-gray-100 rounded-full overflow-hidden">
                          {/* Score bar */}
                          <div
                            className={`absolute inset-y-0 left-0 ${barColor} rounded-full transition-all duration-500`}
                            style={{ width: `${scorePercent}%` }}
                          />
                          {/* Average marker line */}
                          <div
                            className="absolute inset-y-0 w-0.5 bg-gray-500 z-10"
                            style={{ left: `${avgPercent}%` }}
                            title={`Average: ${s.average}`}
                          />
                          {/* Score label inside bar */}
                          <div className="absolute inset-0 flex items-center px-3">
                            <span className={`text-xs font-bold ${scorePercent > 15 ? "text-white" : "text-gray-700"}`}>
                              {s.score.toFixed(1)}
                            </span>
                          </div>
                        </div>

                        {/* Details row */}
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-[11px] text-gray-400">
                            Avg: {s.average.toFixed(1)} · {s.reviewCount} review{s.reviewCount !== 1 ? "s" : ""} matched
                          </span>
                          {absDiff > 0 && (
                            <span className={`text-[11px] font-medium ${colorClass}`}>
                              {diff > 0 ? "+" : ""}{diff.toFixed(1)} vs avg
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {!benchmarkLoading && !benchmarkData && (
                <div className="text-center py-12 text-gray-500">
                  <p>Unable to load benchmark data.</p>
                </div>
              )}

              {/* PDF download + optional email capture */}
              {!benchmarkLoading && benchmarkData && (
                <div className="mt-6 pt-5 border-t border-gray-100">
                  {!benchmarkEmailSent ? (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-800 mb-2">
                        📧 Get this report as a PDF
                      </h3>
                      <p className="text-xs text-gray-500 mb-3">
                        We&apos;ll send you a professionally formatted PDF of this benchmark report.
                      </p>
                      <div className="flex gap-2">
                        <input
                          type="email"
                          value={benchmarkEmail}
                          onChange={(e) => {
                            setBenchmarkEmail(e.target.value);
                            setBenchmarkEmailError("");
                          }}
                          placeholder="your@email.com"
                          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          onKeyDown={(e) => e.key === "Enter" && sendBenchmarkEmail()}
                          disabled={benchmarkEmailSending}
                        />
                        <button
                          onClick={sendBenchmarkEmail}
                          disabled={benchmarkEmailSending || !benchmarkEmail.trim()}
                          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed whitespace-nowrap"
                        >
                          {benchmarkEmailSending ? "Sending..." : "Send Report"}
                        </button>
                      </div>
                      {benchmarkEmailError && (
                        <p className="text-xs text-red-500 mt-2">{benchmarkEmailError}</p>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-3">
                      <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-200">
                        <span>✅</span>
                        <span className="text-sm font-medium">Report sent! Check your inbox.</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-100 flex-shrink-0 flex items-center justify-between">
              <p className="text-[11px] text-gray-400">
                Scores derived from customer review sentiment analysis
              </p>
              <button
                onClick={() => setShowBenchmark(false)}
                className="px-5 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
