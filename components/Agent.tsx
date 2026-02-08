"use client";

import { useCallback, useMemo, useState } from "react";
import { useConversation } from "@elevenlabs/react";
import { Loader2, Phone, PhoneOff } from "lucide-react";

import { cn } from "@/lib/utils";

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
};

const ENV_AGENTS: ElevenLabsAgent[] = [
  {
    id: process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID_1 ?? "",
    name: process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_NAME_1 ?? "Agent 1",
    description:
      process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_DESCRIPTION_1 ??
      "Tap to start voice chat",
  },
  {
    id: process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID_2 ?? "",
    name: process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_NAME_2 ?? "Agent 2",
    description:
      process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_DESCRIPTION_2 ??
      "Tap to start voice chat",
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

  const normalizedInputVolume = useMemo(() => {
    const raw = conversation.getInputVolume?.() ?? 0;
    return Math.min(1, Math.pow(raw, 0.5) * 2.5);
  }, [conversation]);

  const normalizedOutputVolume = useMemo(() => {
    const raw = conversation.getOutputVolume?.() ?? 0;
    return Math.min(1, Math.pow(raw, 0.5) * 2.5);
  }, [conversation]);

  const orbIntensity = Math.max(normalizedInputVolume, normalizedOutputVolume);
  const orbScale = 1 + orbIntensity * 0.35;

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

  return (
    <section
      className={cn(
        "w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm",
        className
      )}
    >
      <div className="flex flex-col items-center gap-5">
        <div className="flex w-full gap-2">
          {agents.length ? (
            agents.map((agent, index) => {
              const isActive = index === selectedAgentIndex;
              return (
                <button
                  key={agent.id}
                  type="button"
                  onClick={() => handleSelectAgent(index)}
                  className={cn(
                    "flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-colors",
                    isActive
                      ? "border-neutral-900 bg-neutral-900 text-white"
                      : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300"
                  )}
                >
                  {agent.name}
                </button>
              );
            })
          ) : (
            <p className="w-full rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              No ElevenLabs agents found. Configure env vars first.
            </p>
          )}
        </div>

        <div className="relative h-32 w-32">
          <div
            className={cn(
              "absolute inset-0 rounded-full bg-cyan-200/40 blur-xl transition-transform duration-100",
              isConnected && "animate-pulse"
            )}
            style={{ transform: `scale(${orbScale})` }}
          />
          <div
            className={cn(
              "relative h-full w-full rounded-full border border-cyan-200 bg-gradient-to-br from-cyan-100 via-sky-200 to-blue-300 shadow-inner transition-transform duration-100",
              isConnected && "shadow-cyan-300/70"
            )}
            style={{ transform: `scale(${orbScale})` }}
          />
        </div>

        <div className="text-center">
          <h2 className="text-lg font-semibold text-neutral-900">
            {selectedAgent?.name ?? "Voice Agent"}
          </h2>
          <p className="mt-1 min-h-5 text-sm text-neutral-500">
            {errorMessage ??
              (isConnected
                ? "Connected"
                : isTransitioning
                  ? agentState
                  : selectedAgent?.description ?? "Tap to start voice chat")}
          </p>
        </div>

        <button
          type="button"
          onClick={handleCall}
          disabled={isTransitioning || !selectedAgent?.id}
          className={cn(
            "inline-flex h-12 w-12 items-center justify-center rounded-full border transition-colors",
            isConnected
              ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
              : "border-neutral-900 bg-neutral-900 text-white hover:bg-black",
            "disabled:cursor-not-allowed disabled:opacity-50"
          )}
          aria-label={isConnected ? "End call" : "Start call"}
        >
          {isTransitioning ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : isConnected ? (
            <PhoneOff className="h-5 w-5" />
          ) : (
            <Phone className="h-5 w-5" />
          )}
        </button>
      </div>
    </section>
  );
}
