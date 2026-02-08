"use client";

import { useCallback, useState } from "react";
import { useConversation } from "@elevenlabs/react";
import { Loader2, Phone, PhoneOff, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Orb, type AgentState as OrbAgentState } from "@/components/ui/orb";

type AgentState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "disconnecting"
  | null;

export type ElevenLabsAgent = {
  id: string;
  name: string;
  description?: string;
  colors?: string[];
};

const ENV_AGENTS: ElevenLabsAgent[] = [
  {
    id: process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID_1 ?? "",
    name: process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_NAME_1 ?? "Master Lin",
    description: "Feng Shui Master",
    colors: ["#D4AF37", "#C5A028"],
  },
  {
    id: process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID_2 ?? "",
    name: process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_NAME_2 ?? "Ava",
    description: "Interior Design Assistant",
    colors: ["#4ECDC4", "#556270"],
  },
].filter((a) => a.id);

const FALLBACK_SINGLE_AGENT = process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID
  ? [
      {
        id: process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID,
        name: "Voice Agent",
        description: "Tap to start voice chat",
      },
    ]
  : [];

type AgentProps = {
  agents?: ElevenLabsAgent[];
  className?: string;
};

export default function Agent({
  agents = ENV_AGENTS.length ? ENV_AGENTS : FALLBACK_SINGLE_AGENT,
  className,
}: AgentProps) {
  const [agentState, setAgentState] = useState<AgentState>("disconnected");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedAgentIndex, setSelectedAgentIndex] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  const selectedAgent = agents[selectedAgentIndex];
  const selectedAgentId = selectedAgent?.id;

  const conversation = useConversation({
    onConnect: () => setAgentState("connected"),
    onDisconnect: () => setAgentState("disconnected"),
    onError: (error) => {
      console.error("ElevenLabs error:", error);
      setAgentState("disconnected");
      setErrorMessage("Voice connection failed. Please try again.");
    },
  });

  const getInputVolume = useCallback(() => {
    const raw = conversation.getInputVolume?.() ?? 0;
    return Math.min(1, Math.pow(raw, 0.5) * 2.5);
  }, [conversation]);

  const getOutputVolume = useCallback(() => {
    const raw = conversation.getOutputVolume?.() ?? 0;
    return Math.min(1, Math.pow(raw, 0.5) * 2.5);
  }, [conversation]);

  const startConversation = useCallback(async () => {
    if (!selectedAgentId) {
      setErrorMessage("No agent configured. Add your ElevenLabs agent IDs.");
      return;
    }

    try {
      setErrorMessage(null);
      await navigator.mediaDevices.getUserMedia({ audio: true });
      await conversation.startSession({
        agentId: selectedAgentId,
        connectionType: "webrtc",
        onStatusChange: (status) => setAgentState(status.status),
      });
    } catch (error) {
      setAgentState("disconnected");
      if (error instanceof DOMException && error.name === "NotAllowedError") {
        setErrorMessage("Please allow microphone access in your browser.");
        return;
      }
      setErrorMessage("Could not start voice session.");
    }
  }, [conversation, selectedAgentId]);

  const handleCall = useCallback(() => {
    if (agentState === "disconnected" || agentState === null) {
      setAgentState("connecting");
      void startConversation();
      return;
    }
    if (agentState === "connected") {
      void conversation.endSession();
      setAgentState("disconnecting");
    }
  }, [agentState, conversation, startConversation]);

  const handleSelectAgent = useCallback(
    (index: number) => {
      if (index === selectedAgentIndex) return;
      if (agentState === "connected" || agentState === "connecting") {
        void conversation.endSession();
        setAgentState("disconnected");
      }
      setErrorMessage(null);
      setSelectedAgentIndex(index);
    },
    [agentState, conversation, selectedAgentIndex]
  );

  const isConnected = agentState === "connected";
  const isTransitioning =
    agentState === "connecting" || agentState === "disconnecting";

  // Determine Orb state based on volumes/connection
  // This is a simple approximation
  const orbState: OrbAgentState = isConnected 
    ? (getOutputVolume() > 0.1 ? "talking" : getInputVolume() > 0.1 ? "listening" : null)
    : null;

  return (
    <div className={cn("relative z-50", className)}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center justify-center rounded-full bg-white shadow-[0_4px_20px_rgba(0,0,0,0.08)] hover:shadow-xl transition-all duration-300 ease-in-out border border-neutral-100",
          isOpen ? "w-12 h-12 bg-neutral-100" : "w-12 h-12"
        )}
      >
        {isOpen ? (
          <X className="w-5 h-5 text-neutral-900" />
        ) : isConnected ? (
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
          </span>
        ) : (
          <Phone className="w-5 h-5 text-neutral-900" /> 
        )}
      </button>

      {/* Expanded Card */}
      {isOpen && (
        <div className="absolute top-16 right-0 w-[320px] bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/50 overflow-hidden animate-in fade-in slide-in-from-top-4 duration-200">
          
          {/* Agent Selection Header */}
          <div className="p-4 border-b border-neutral-100 bg-neutral-50/50">
            <div className="flex gap-2 p-1 bg-neutral-200/50 rounded-xl">
              {agents.map((agent, index) => (
                <button
                  key={agent.id}
                  onClick={() => handleSelectAgent(index)}
                  className={cn(
                    "flex-1 py-2 text-xs font-medium rounded-lg transition-all duration-200",
                    selectedAgentIndex === index
                      ? "bg-white text-neutral-900 shadow-sm"
                      : "text-neutral-500 hover:text-neutral-700"
                  )}
                >
                  {agent.name}
                </button>
              ))}
            </div>
          </div>

          <div className="p-6 flex flex-col items-center gap-6">
            {/* Orb Container */}
            <div className="relative w-48 h-48">
              <Orb 
                colors={selectedAgent.colors as [string, string]}
                getInputVolume={getInputVolume}
                getOutputVolume={getOutputVolume}
                volumeMode="manual"
              />
            </div>

            {/* Status / Info */}
            <div className="text-center space-y-1">
              <h3 className="font-serif text-xl text-neutral-900">
                {selectedAgent.name}
              </h3>
              <p className="text-xs text-neutral-500 font-medium tracking-wide uppercase">
                {isConnected 
                  ? "Connected" 
                  : isTransitioning 
                    ? "Connecting..." 
                    : selectedAgent.description}
              </p>
              {errorMessage && (
                <p className="text-xs text-red-500 mt-2">{errorMessage}</p>
              )}
            </div>

            {/* Action Button */}
            <button
              onClick={handleCall}
              disabled={isTransitioning}
              className={cn(
                "w-full py-4 rounded-xl flex items-center justify-center gap-2 font-medium transition-all duration-300",
                isConnected
                  ? "bg-red-50 text-red-600 hover:bg-red-100"
                  : "bg-neutral-900 text-white hover:bg-black hover:scale-[1.02]"
              )}
            >
              {isTransitioning ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : isConnected ? (
                <>
                  <PhoneOff className="w-4 h-4" />
                  <span>End Call</span>
                </>
              ) : (
                <>
                  <Phone className="w-4 h-4" />
                  <span>Start Call</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
