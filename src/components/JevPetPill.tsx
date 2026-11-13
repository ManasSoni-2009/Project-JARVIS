import React, { useCallback, useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { AnimatePresence, motion } from "motion/react";
import { Maximize2, Mic, Sparkles, Terminal } from "lucide-react";
import {
  JevReflexDecision,
  PillMood,
  PipelineStateName,
} from "../types/jarvis.ts";

interface JevPetPillProps {
  mood: PillMood;
  pipelineState: PipelineStateName;
  isFocusAwayMode: boolean;
  isRecording: boolean;
  lastJevDecision: JevReflexDecision | null;
  statusSubtitle: string;
  activeRef?: string;
  onToggleRecording: () => void;
  onRestoreMainView: () => void;
  onSelectMood?: (mood: PillMood) => void;
  onQuickCommand?: (cmd: string) => void;
}

interface ExpressionProfile {
  width: number;
  height: number;
  leftEyeW: number;
  leftEyeH: number;
  rightEyeW: number;
  rightEyeH: number;
  leftEyeRotate: number;
  rightEyeRotate: number;
  eyeSpread: number;
  accentDotColor: string;
}

const EXPRESSION_PROFILES: Record<PillMood, ExpressionProfile> = {
  idle: {
    width: 88,
    height: 44,
    leftEyeW: 10,
    leftEyeH: 16,
    rightEyeW: 10,
    rightEyeH: 16,
    leftEyeRotate: 0,
    rightEyeRotate: 0,
    eyeSpread: 18,
    accentDotColor: "#38BDF8",
  },
  listening: {
    width: 132,
    height: 54,
    leftEyeW: 11,
    leftEyeH: 18,
    rightEyeW: 11,
    rightEyeH: 18,
    leftEyeRotate: 0,
    rightEyeRotate: 0,
    eyeSpread: 28,
    accentDotColor: "#38BDF8",
  },
  reflex_zap: {
    width: 128,
    height: 48,
    leftEyeW: 13,
    leftEyeH: 9,
    rightEyeW: 13,
    rightEyeH: 9,
    leftEyeRotate: 12,
    rightEyeRotate: -12,
    eyeSpread: 22,
    accentDotColor: "#FBBF24",
  },
  deep_thinking: {
    width: 112,
    height: 52,
    leftEyeW: 10,
    leftEyeH: 16,
    rightEyeW: 11,
    rightEyeH: 10,
    leftEyeRotate: -4,
    rightEyeRotate: 6,
    eyeSpread: 20,
    accentDotColor: "#A855F7",
  },
  acting_ref: {
    width: 126,
    height: 42,
    leftEyeW: 16,
    leftEyeH: 5.5,
    rightEyeW: 16,
    rightEyeH: 5.5,
    leftEyeRotate: 0,
    rightEyeRotate: 0,
    eyeSpread: 22,
    accentDotColor: "#10B981",
  },
  speaking: {
    width: 128,
    height: 52,
    leftEyeW: 10.5,
    leftEyeH: 15,
    rightEyeW: 10.5,
    rightEyeH: 15,
    leftEyeRotate: -3,
    rightEyeRotate: 3,
    eyeSpread: 27,
    accentDotColor: "#38BDF8",
  },
  celebrating: {
    width: 122,
    height: 52,
    leftEyeW: 12,
    leftEyeH: 12,
    rightEyeW: 12,
    rightEyeH: 12,
    leftEyeRotate: 0,
    rightEyeRotate: 0,
    eyeSpread: 21,
    accentDotColor: "#34D399",
  },
  alert: {
    width: 116,
    height: 54,
    leftEyeW: 12,
    leftEyeH: 19,
    rightEyeW: 12,
    rightEyeH: 19,
    leftEyeRotate: -8,
    rightEyeRotate: 8,
    eyeSpread: 20,
    accentDotColor: "#F43F5E",
  },
};

export const JevPetPill: React.FC<JevPetPillProps> = ({
  mood,
  pipelineState,
  isFocusAwayMode,
  isRecording,
  lastJevDecision,
  statusSubtitle,
  activeRef,
  onToggleRecording,
  onRestoreMainView,
  onSelectMood,
  onQuickCommand,
}) => {
  const [isPopped, setIsPopped] = useState(false);
  const [isWinking, setIsWinking] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [trayPinned, setTrayPinned] = useState(false);
  const [waveTick, setWaveTick] = useState(0);

  const effectiveMood: PillMood = isPopped
    ? "celebrating"
    : isRecording
    ? "listening"
    : mood;

  const profile = EXPRESSION_PROFILES[effectiveMood] || EXPRESSION_PROFILES.idle;
  const isBusy = pipelineState !== "IDLE" || isRecording;

  // Refs for imperative 60fps GSAP animations
  const pillRef = useRef<HTMLButtonElement | null>(null);
  const visorGroupRef = useRef<SVGGElement | null>(null);
  const leftEyeGroupRef = useRef<SVGGElement | null>(null);
  const rightEyeGroupRef = useRef<SVGGElement | null>(null);
  const leftRectRef = useRef<SVGRectElement | null>(null);
  const rightRectRef = useRef<SVGRectElement | null>(null);

  const dragOriginRef = useRef<{ x: number; y: number } | null>(null);
  const popTimerRef = useRef<number | null>(null);

  // GSAP quickTo interpolators for magnetic eye tracking
  const visorXTo = useRef<gsap.QuickToFunc | null>(null);
  const visorYTo = useRef<gsap.QuickToFunc | null>(null);

  useEffect(() => {
    if (visorGroupRef.current) {
      visorXTo.current = gsap.quickTo(visorGroupRef.current, "x", {
        duration: 0.24,
        ease: "power3.out",
      });
      visorYTo.current = gsap.quickTo(visorGroupRef.current, "y", {
        duration: 0.24,
        ease: "power3.out",
      });
    }
  }, []);

  // Magnetic cursor tracking across the viewport
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      const el = pillRef.current;
      if (!el) return;

      // Handle rubber-band pull if dragging
      if (dragOriginRef.current) {
        const pullX = (e.clientX - dragOriginRef.current.x) * 0.28;
        const pullY = (e.clientY - dragOriginRef.current.y) * 0.28;
        const clampedX = Math.max(-26, Math.min(26, pullX));
        const clampedY = Math.max(-26, Math.min(26, pullY));
        gsap.set(el, {
          x: clampedX,
          y: clampedY,
          scaleX: 1 + Math.abs(clampedX) * 0.004,
          scaleY: 1 + Math.abs(clampedY) * 0.004,
        });
      }

      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const dist = Math.hypot(dx, dy) || 1;
      const factor = Math.min(1, dist / 240);

      if (effectiveMood === "deep_thinking") {
        visorXTo.current?.(5.5);
        visorYTo.current?.(-4.2);
      } else {
        const maxX = 7.5;
        const maxY = 4.8;
        visorXTo.current?.((dx / dist) * maxX * factor);
        visorYTo.current?.((dy / dist) * maxY * factor);
      }
    };

    const onMouseUp = () => {
      if (dragOriginRef.current && pillRef.current) {
        dragOriginRef.current = null;
        gsap.to(pillRef.current, {
          x: 0,
          y: 0,
          scaleX: 1,
          scaleY: 1,
          duration: 0.65,
          ease: "elastic.out(1.25, 0.35)",
        });
      }
    };

    window.addEventListener("mousemove", onMouseMove, { passive: true });
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [effectiveMood]);

  // Poppy Enlarge-and-Return GSAP Transitions on Mood / Hover Change
  useEffect(() => {
    const el = pillRef.current;
    if (!el) return;

    const targetW =
      isHovered && effectiveMood === "idle" ? 104 : profile.width;
    const targetH =
      isHovered && effectiveMood === "idle" ? 48 : profile.height;

    // Enlarge with a snappy spring pop, then settle cleanly
    gsap.to(el, {
      width: targetW,
      height: targetH,
      duration: 0.48,
      ease: "back.out(2.1)",
    });

    // Action-specific kinetic pop impulse
    if (
      effectiveMood === "reflex_zap" ||
      effectiveMood === "listening" ||
      effectiveMood === "acting_ref"
    ) {
      gsap.fromTo(
        el,
        { scaleX: 1.18, scaleY: 0.84 },
        {
          scaleX: 1,
          scaleY: 1,
          duration: 0.58,
          ease: "elastic.out(1.2, 0.38)",
        }
      );
    } else if (effectiveMood === "celebrating") {
      gsap.fromTo(
        el,
        { scale: 1.22, y: -9 },
        {
          scale: 1,
          y: 0,
          duration: 0.68,
          ease: "elastic.out(1.25, 0.38)",
        }
      );
    } else if (effectiveMood === "alert") {
      gsap.fromTo(
        el,
        { x: -6, scale: 1.12 },
        {
          x: 0,
          scale: 1,
          duration: 0.5,
          ease: "elastic.out(1.5, 0.25)",
        }
      );
    }

    // Morph Left & Right Minimal Geometric Eyes
    if (leftEyeGroupRef.current && rightEyeGroupRef.current) {
      gsap.to(leftEyeGroupRef.current, {
        x: 60 - profile.eyeSpread,
        rotation: profile.leftEyeRotate,
        duration: 0.34,
        ease: "back.out(1.8)",
      });
      gsap.to(rightEyeGroupRef.current, {
        x: 60 + profile.eyeSpread,
        rotation: profile.rightEyeRotate,
        duration: 0.34,
        ease: "back.out(1.8)",
      });
    }

    if (leftRectRef.current && rightRectRef.current) {
      gsap.to(leftRectRef.current, {
        attr: {
          x: -profile.leftEyeW / 2,
          y: -profile.leftEyeH / 2,
          width: profile.leftEyeW,
          height: profile.leftEyeH,
          rx: Math.min(profile.leftEyeW, profile.leftEyeH) / 2,
        },
        duration: 0.3,
        ease: "power3.out",
      });
      gsap.to(rightRectRef.current, {
        attr: {
          x: -profile.rightEyeW / 2,
          y: -profile.rightEyeH / 2,
          width: profile.rightEyeW,
          height: profile.rightEyeH,
          rx: Math.min(profile.rightEyeW, profile.rightEyeH) / 2,
        },
        duration: 0.3,
        ease: "power3.out",
      });
    }
  }, [effectiveMood, isHovered, profile]);

  // Natural Randomized Blink & Curious Micro-Squint Loop
  useEffect(() => {
    let timerId: number;
    let disposed = false;

    const scheduleNextBlink = () => {
      if (disposed) return;
      const wait = 2400 + Math.random() * 3200;
      timerId = window.setTimeout(() => {
        if (disposed) return;
        const eyes = [leftEyeGroupRef.current, rightEyeGroupRef.current].filter(
          Boolean
        );
        if (eyes.length > 0 && effectiveMood !== "celebrating") {
          const tl = gsap.timeline({
            onComplete: () => {
              if (!disposed) scheduleNextBlink();
            },
          });
          tl.to(eyes, {
            scaleY: 0.08,
            duration: 0.07,
            ease: "power2.in",
          }).to(eyes, {
            scaleY: 1,
            duration: 0.11,
            ease: "power2.out",
          });

          if (Math.random() > 0.68) {
            tl.to(
              eyes,
              {
                scaleY: 0.08,
                duration: 0.06,
                ease: "power2.in",
              },
              "+=0.065"
            ).to(eyes, {
              scaleY: 1,
              duration: 0.1,
              ease: "power2.out",
            });
          }
        } else {
          scheduleNextBlink();
        }
      }, wait);
    };

    scheduleNextBlink();
    return () => {
      disposed = true;
      window.clearTimeout(timerId);
    };
  }, [effectiveMood]);

  // Harmonic equalizer wave ticker for Listening / Speaking
  useEffect(() => {
    if (effectiveMood !== "listening" && effectiveMood !== "speaking") return;
    const interval = window.setInterval(() => {
      setWaveTick((t) => (t + 1) % 360);
    }, 50);
    return () => window.clearInterval(interval);
  }, [effectiveMood]);

  // Interactive Click Pop-Enlarge-and-Return Burst
  const handlePillClick = useCallback(() => {
    setTrayPinned((prev) => !prev);
    setIsPopped(true);
    setIsWinking(Math.random() > 0.45);

    if (pillRef.current) {
      const tl = gsap.timeline();
      tl.to(pillRef.current, {
        width: 136,
        height: 58,
        scale: 1.08,
        y: -6,
        duration: 0.24,
        ease: "back.out(2.4)",
      }).to(pillRef.current, {
        scale: 1,
        y: 0,
        duration: 0.55,
        ease: "elastic.out(1.2, 0.36)",
      });
    }

    if (popTimerRef.current) window.clearTimeout(popTimerRef.current);
    popTimerRef.current = window.setTimeout(() => {
      setIsPopped(false);
      setIsWinking(false);
    }, 1250);
  }, []);

  const showFloatingHud =
    isHovered || trayPinned || isFocusAwayMode || isBusy;

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="fixed bottom-5 right-5 z-50 flex flex-col items-end select-none"
    >
      {/* Detached Minimal Floating Micro-Controls (Strictly outside the capsule) */}
      <AnimatePresence>
        {showFloatingHud && (
          <motion.div
            key="pet-pill-floating-hud"
            initial={{ opacity: 0, y: 8, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.94 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="mb-2.5 flex flex-col items-end gap-1.5"
          >
            {/* Compact Whisper Pill */}
            <div className="max-w-[248px] px-3 py-1.5 rounded-[14px] bg-white/94 dark:bg-[#16161B]/94 backdrop-blur-xl border border-black/[0.08] dark:border-white/[0.1] shadow-[0_10px_28px_-6px_rgba(0,0,0,0.12)] dark:shadow-[0_14px_34px_-6px_rgba(0,0,0,0.6)] text-right">
              <p className="text-[11px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7] leading-snug line-clamp-2">
                {isRecording
                  ? "Listening to voice stream..."
                  : statusSubtitle ||
                    lastJevDecision?.instantAck ||
                    "Tap to interact · Double-tap for voice"}
              </p>
              {(activeRef || lastJevDecision) && (
                <div className="mt-0.5 flex items-center justify-end gap-1.5 text-[10px] font-mono text-[#86868B] dark:text-[#A1A1AA] tabular-nums">
                  {activeRef && <span>{activeRef}</span>}
                  {activeRef && lastJevDecision && <span>·</span>}
                  {lastJevDecision && (
                    <span>{lastJevDecision.latencyMs}ms</span>
                  )}
                </div>
              )}
            </div>

            {/* Concentric Pill Action Strip */}
            <div className="flex items-center gap-1 p-1 rounded-full bg-white/92 dark:bg-[#16161B]/92 backdrop-blur-xl border border-black/[0.08] dark:border-white/[0.1] shadow-[0_8px_22px_-4px_rgba(0,0,0,0.1)]">
              <button
                type="button"
                onClick={onToggleRecording}
                title={isRecording ? "Stop Voice" : "Voice Input"}
                className={`studio-btn w-7 h-7 rounded-full flex items-center justify-center cursor-pointer ${
                  isRecording
                    ? "bg-rose-500 text-white scale-105"
                    : "text-[#1D1D1F] dark:text-[#F5F5F7] hover:bg-black/[0.06] dark:hover:bg-white/[0.09]"
                }`}
              >
                <Mic className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() =>
                  onQuickCommand?.("Click @e4 to run CI build and test suite")
                }
                title="Trigger @e4 Desktop Reflex"
                className="studio-btn w-7 h-7 rounded-full flex items-center justify-center text-[#1D1D1F] dark:text-[#F5F5F7] hover:bg-black/[0.06] dark:hover:bg-white/[0.09] cursor-pointer"
              >
                <Terminal className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => {
                  const moods: PillMood[] = [
                    "idle",
                    "listening",
                    "reflex_zap",
                    "deep_thinking",
                    "acting_ref",
                    "speaking",
                    "celebrating",
                    "alert",
                  ];
                  const next =
                    moods[(moods.indexOf(effectiveMood) + 1) % moods.length];
                  onSelectMood?.(next);
                }}
                title="Cycle Expression"
                className="studio-btn w-7 h-7 rounded-full flex items-center justify-center text-[#1D1D1F] dark:text-[#F5F5F7] hover:bg-black/[0.06] dark:hover:bg-white/[0.09] cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
              </button>

              {isFocusAwayMode && (
                <button
                  type="button"
                  onClick={onRestoreMainView}
                  title="Expand Studio"
                  className="studio-btn px-2.5 h-7 rounded-full bg-[#1D1D1F] dark:bg-[#F5F5F7] text-white dark:text-[#1D1D1F] text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
                >
                  <Maximize2 className="w-3 h-3" />
                  <span>Expand</span>
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* THE PURE-AVATAR HARDWARE-GRADE PET PILL (100% Minimal Face, Poppy Enlarge & Return) */}
      <button
        ref={pillRef}
        type="button"
        onMouseDown={(e) => {
          dragOriginRef.current = { x: e.clientX, y: e.clientY };
        }}
        onClick={handlePillClick}
        onDoubleClick={onToggleRecording}
        aria-label="Jev Minimal Avatar Companion Pill"
        style={{ width: 88, height: 44 }}
        className="relative rounded-full bg-[#0D0D11] dark:bg-[#111116] border border-black/20 dark:border-white/18 shadow-[0_12px_30px_-6px_rgba(0,0,0,0.32)] dark:shadow-[0_16px_38px_-6px_rgba(0,0,0,0.75)] flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing focus:outline-none"
      >
        {/* Subtle Precision Top Specular Edge */}
        <div className="pointer-events-none absolute inset-x-3.5 top-[1px] h-[1px] bg-gradient-to-r from-transparent via-white/28 to-transparent rounded-full" />

        {/* Minimalist High-Contrast Geometric Visor SVG */}
        <svg
          viewBox="0 0 120 52"
          className="w-full h-full overflow-visible pointer-events-none"
        >
          <g ref={visorGroupRef}>
            {/* Deep-Thinking Minimal Orbital Dots */}
            {effectiveMood === "deep_thinking" && (
              <g transform="translate(60, 11)">
                <circle
                  cx="-7"
                  cy="0"
                  r="1.5"
                  fill="#F5F5F7"
                  opacity="0.45"
                  className="animate-pulse"
                />
                <circle
                  cx="0"
                  cy="-1"
                  r="1.8"
                  fill="#F5F5F7"
                  opacity="0.85"
                  className="animate-pulse"
                />
                <circle
                  cx="7"
                  cy="0"
                  r="1.5"
                  fill="#38BDF8"
                  opacity="0.9"
                  className="animate-pulse"
                />
              </g>
            )}

            {/* Center Acoustic Harmonic Equalizer (Only visible during Listening / Speaking) */}
            {(effectiveMood === "listening" ||
              effectiveMood === "speaking") && (
              <g transform="translate(60, 26)">
                {[-8, -4, 0, 4, 8].map((bx, i) => {
                  const h =
                    effectiveMood === "speaking"
                      ? 4 + Math.abs(Math.sin((waveTick + i * 36) * 0.14)) * 12
                      : 3 + Math.abs(Math.cos((waveTick + i * 42) * 0.12)) * 10;
                  return (
                    <rect
                      key={bx}
                      x={bx - 1.1}
                      y={-h / 2}
                      width="2.2"
                      height={h}
                      rx="1.1"
                      fill={i === 2 ? profile.accentDotColor : "#F5F5F7"}
                      opacity={i === 2 ? 1 : 0.78}
                    />
                  );
                })}
              </g>
            )}

            {/* Subtle Precision Status Micro-Node in Reflex / @ref Scan Mode */}
            {(effectiveMood === "reflex_zap" ||
              effectiveMood === "acting_ref") && (
              <circle
                cx="60"
                cy="26"
                r="2.2"
                fill={profile.accentDotColor}
              />
            )}

            {/* LEFT GEOMETRIC EYE */}
            <g ref={leftEyeGroupRef} transform="translate(42, 26)">
              {effectiveMood === "celebrating" ? (
                <path
                  d="M -7 2.5 Q 0 -6.5 7 2.5"
                  stroke="#F5F5F7"
                  strokeWidth="3.2"
                  strokeLinecap="round"
                  fill="none"
                />
              ) : (
                <g>
                  <rect
                    ref={leftRectRef}
                    x="-5"
                    y="-8"
                    width="10"
                    height="16"
                    rx="5"
                    fill="#F5F5F7"
                  />
                  {/* Micro Corner Specular Cut */}
                  <circle
                    cx="-1.8"
                    cy="-3.6"
                    r="1.4"
                    fill={profile.accentDotColor}
                    opacity="0.9"
                  />
                </g>
              )}
            </g>

            {/* RIGHT GEOMETRIC EYE */}
            <g ref={rightEyeGroupRef} transform="translate(78, 26)">
              {effectiveMood === "celebrating" && !isWinking ? (
                <path
                  d="M -7 2.5 Q 0 -6.5 7 2.5"
                  stroke="#F5F5F7"
                  strokeWidth="3.2"
                  strokeLinecap="round"
                  fill="none"
                />
              ) : isWinking ? (
                <line
                  x1="-6"
                  y1="0"
                  x2="6"
                  y2="0"
                  stroke="#38BDF8"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              ) : (
                <g>
                  <rect
                    ref={rightRectRef}
                    x="-5"
                    y="-8"
                    width="10"
                    height="16"
                    rx="5"
                    fill="#F5F5F7"
                  />
                  <circle
                    cx="-1.8"
                    cy="-3.6"
                    r="1.4"
                    fill={profile.accentDotColor}
                    opacity="0.9"
                  />
                </g>
              )}
            </g>
          </g>
        </svg>
      </button>
    </div>
  );
};
