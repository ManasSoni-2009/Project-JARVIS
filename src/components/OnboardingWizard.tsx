import React, { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowRight,
  Check,
  Cpu,
  FolderKanban,
  KeyRound,
  Mic,
  Moon,
  PictureInPicture2,
  Sparkles,
  Sun,
  Volume2,
  X,
} from "lucide-react";
import { StudioDropdown, StudioDropdownOption } from "./StudioDropdown.tsx";

export interface OnboardingSettingsState {
  provider: "google" | "openai" | "anthropic" | "openrouter";
  flash_model?: string;
  thinking_mode: "auto" | "high" | "medium" | "low";
  tts_enabled: boolean;
  tts_engine?: "kokoro" | "gemini" | "browser_british";
  stt_engine?: "faster_whisper" | "gemini" | "web_speech";
  tts_voice: string;
  kokoro_url?: string;
  whisper_url?: string;
  os_backend: "gemini_vision" | "openclaw";
  obsidian_vault_path?: string;
  onboarding_completed?: boolean;
  has_gemini_key: boolean;
  has_openai_key: boolean;
  has_anthropic_key: boolean;
  has_openrouter_key: boolean;
  has_github_token: boolean;
  masked_keys?: {
    gemini?: string;
    openai?: string;
    anthropic?: string;
    openrouter?: string;
    github?: string;
  };
}

export interface CredentialInputs {
  gemini_api_key: string;
  openai_api_key: string;
  anthropic_api_key: string;
  openrouter_api_key: string;
  github_token: string;
}

interface OnboardingWizardProps {
  open: boolean;
  theme: "light" | "dark";
  onToggleTheme: (next: "light" | "dark") => void;
  settings: OnboardingSettingsState;
  onChangeSettings: React.Dispatch<
    React.SetStateAction<OnboardingSettingsState>
  >;
  credentials: CredentialInputs;
  onChangeCredentials: React.Dispatch<React.SetStateAction<CredentialInputs>>;
  providerOptions: StudioDropdownOption[];
  modelOptions: StudioDropdownOption[];
  thinkingOptions: StudioDropdownOption[];
  voiceOptions: StudioDropdownOption[];
  ttsEngineOptions: StudioDropdownOption[];
  sttEngineOptions: StudioDropdownOption[];
  onTestVoiceSample: (voiceId: string) => void;
  testingVoice: boolean;
  onLaunchAlwaysOnTopPip: () => void;
  onRunDiagnostics: () => Promise<void>;
  runningDiagnostics: boolean;
  diagnosticsChecks: Array<{
    id: string;
    label: string;
    ok: boolean;
    detail: string;
  }>;
  onCompleteOnboarding: () => Promise<void>;
  onClose: () => void;
}

const STEPS = [
  { id: 0, title: "Identity & Companion", icon: Sparkles },
  { id: 1, title: "AI Engine & API Keys", icon: KeyRound },
  { id: 2, title: "Kokoro TTS & Whisper STT", icon: Volume2 },
  { id: 3, title: "Obsidian Space & Launch", icon: FolderKanban },
];

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({
  open,
  theme,
  onToggleTheme,
  settings,
  onChangeSettings,
  credentials,
  onChangeCredentials,
  providerOptions,
  modelOptions,
  thinkingOptions,
  voiceOptions,
  ttsEngineOptions,
  sttEngineOptions,
  onTestVoiceSample,
  testingVoice,
  onLaunchAlwaysOnTopPip,
  onRunDiagnostics,
  runningDiagnostics,
  diagnosticsChecks,
  onCompleteOnboarding,
  onClose,
}) => {
  const [step, setStep] = useState<number>(0);
  const [previewEyePop, setPreviewEyePop] = useState(false);

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="onboarding-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.22 }}
        className="fixed inset-0 z-50 bg-black/45 backdrop-blur-md flex items-center justify-center p-3 sm:p-5"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 14 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 10 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-[26px] bg-white dark:bg-[#14141A] border border-black/[0.08] dark:border-white/[0.1] shadow-[0_32px_80px_-16px_rgba(0,0,0,0.35)] overflow-hidden"
        >
          {/* Top Wizard Header & Stepper */}
          <div className="px-6 pt-5 pb-4 border-b border-black/[0.06] dark:border-white/[0.08] flex flex-col gap-3.5 shrink-0">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-[9px] bg-[#1D1D1F] dark:bg-white text-white dark:text-[#1D1D1F] flex items-center justify-center font-mono text-xs font-bold">
                  J
                </div>
                <div>
                  <h2 className="text-sm font-bold text-[#1D1D1F] dark:text-white tracking-tight">
                    J.A.R.V.I.S v3.0 Studio — Interactive Onboarding & Setup
                  </h2>
                  <p className="text-[11px] text-[#6E6E73] dark:text-zinc-400">
                    OpenJarvis 5-Primitive Core · Kokoro-82M Neural Voice ·
                    Faster-Whisper STT · Obsidian Space
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                title="Skip to Studio"
                className="studio-btn w-7 h-7 rounded-full flex items-center justify-center text-[#6E6E73] hover:text-[#1D1D1F] dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Step Indicator Pills */}
            <div className="grid grid-cols-4 gap-1.5">
              {STEPS.map((s) => {
                const Icon = s.icon;
                const isActive = step === s.id;
                const isDone = step > s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setStep(s.id)}
                    className={`h-8 px-2.5 rounded-[10px] text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      isActive
                        ? "bg-[#1D1D1F] dark:bg-white text-white dark:text-[#1D1D1F] shadow-xs"
                        : isDone
                        ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20"
                        : "bg-black/[0.04] dark:bg-white/[0.05] text-[#6E6E73] dark:text-zinc-400"
                    }`}
                  >
                    {isDone ? (
                      <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    ) : (
                      <Icon className="w-3.5 h-3.5 shrink-0" />
                    )}
                    <span className="truncate">{s.title}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Animated Step Body */}
          <div className="flex-1 overflow-y-auto studio-scroll p-6">
            <AnimatePresence mode="wait">
              {/* STEP 0: WELCOME, THEME & ALWAYS-ON-TOP COMPANION PILL */}
              {step === 0 && (
                <motion.div
                  key="onboard-step-0"
                  initial={{ opacity: 0, x: 14 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -14 }}
                  transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                  className="space-y-4"
                >
                  <div className="p-5 rounded-[18px] bg-[#F5F5F7] dark:bg-[#0D0D12] border border-black/[0.06] dark:border-white/[0.08] flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="space-y-1.5 text-center sm:text-left">
                      <div className="text-[10.5px] font-mono text-sky-600 dark:text-sky-400">
                        Always-On-Screen Companion Visor
                      </div>
                      <h3 className="text-base font-bold text-[#1D1D1F] dark:text-white">
                        Pure-Avatar Hardware Visor Pill
                      </h3>
                      <p className="text-xs text-[#515154] dark:text-zinc-400 leading-relaxed max-w-md">
                        Your companion pill is 100% an expressive visor avatar.
                        Click the **"Pin Always-On-Top OS Pill"** button below
                        to float the J.A.R.V.I.S pill on top of all other
                        desktop windows (VS Code, games, browser tabs) while you
                        work.
                      </p>
                    </div>

                    {/* Interactive Mini Pill Preview */}
                    <button
                      type="button"
                      onClick={() => {
                        setPreviewEyePop(true);
                        window.setTimeout(() => setPreviewEyePop(false), 900);
                      }}
                      className={`shrink-0 w-28 h-13 rounded-full bg-[#0C0D12] border border-white/15 shadow-xl flex items-center justify-center gap-4 transition-transform duration-300 cursor-pointer ${
                        previewEyePop ? "scale-110" : "hover:scale-105"
                      }`}
                    >
                      <span
                        className={`w-2.5 rounded-full bg-white transition-all duration-200 ${
                          previewEyePop ? "h-3 bg-emerald-400" : "h-4"
                        }`}
                      />
                      <span
                        className={`w-2.5 rounded-full bg-white transition-all duration-200 ${
                          previewEyePop ? "h-3 bg-sky-400" : "h-4"
                        }`}
                      />
                    </button>
                  </div>

                  {/* Theme & Always-On-Top OS Overlay Selector */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-4 rounded-[16px] border border-black/[0.07] dark:border-white/[0.08] bg-white dark:bg-[#181820] space-y-2.5">
                      <div className="text-xs font-semibold text-[#1D1D1F] dark:text-white">
                        1. Choose Surface Palette
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => onToggleTheme("light")}
                          className={`h-9 rounded-[10px] text-xs font-semibold flex items-center justify-center gap-1.5 border cursor-pointer ${
                            theme === "light"
                              ? "bg-[#1D1D1F] text-white border-[#1D1D1F]"
                              : "bg-[#F5F5F7] dark:bg-[#101015] text-[#6E6E73] dark:text-zinc-300 border-black/[0.08] dark:border-white/[0.08]"
                          }`}
                        >
                          <Sun className="w-3.5 h-3.5" />
                          <span>Daylight</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onToggleTheme("dark")}
                          className={`h-9 rounded-[10px] text-xs font-semibold flex items-center justify-center gap-1.5 border cursor-pointer ${
                            theme === "dark"
                              ? "bg-white text-[#1D1D1F] border-white"
                              : "bg-[#F5F5F7] dark:bg-[#101015] text-[#6E6E73] dark:text-zinc-300 border-black/[0.08] dark:border-white/[0.08]"
                          }`}
                        >
                          <Moon className="w-3.5 h-3.5" />
                          <span>Graphite</span>
                        </button>
                      </div>
                    </div>

                    <div className="p-4 rounded-[16px] border border-black/[0.07] dark:border-white/[0.08] bg-white dark:bg-[#181820] space-y-2.5">
                      <div className="text-xs font-semibold text-[#1D1D1F] dark:text-white">
                        2. Always-On-Top OS Floating Pill
                      </div>
                      <button
                        type="button"
                        onClick={onLaunchAlwaysOnTopPip}
                        className="studio-btn w-full h-9 px-3 rounded-[10px] bg-sky-500/15 hover:bg-sky-500/25 text-sky-700 dark:text-sky-300 border border-sky-500/25 text-xs font-semibold inline-flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <PictureInPicture2 className="w-3.5 h-3.5" />
                        <span>Pin Always-On-Top OS Pill</span>
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* STEP 1: INTELLIGENCE ENGINE & API CREDENTIALS */}
              {step === 1 && (
                <motion.div
                  key="onboard-step-1"
                  initial={{ opacity: 0, x: 14 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -14 }}
                  transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                  className="space-y-4 text-xs"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block font-semibold text-[#3A3A3C] dark:text-zinc-300 mb-1.5">
                        Primary Provider
                      </label>
                      <StudioDropdown
                        value={settings.provider}
                        options={providerOptions}
                        onChange={(val) =>
                          onChangeSettings((s) => ({
                            ...s,
                            provider: val as OnboardingSettingsState["provider"],
                          }))
                        }
                        size="md"
                        className="w-full"
                        menuWidthClass="w-full"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-[#3A3A3C] dark:text-zinc-300 mb-1.5">
                        Model Preset
                      </label>
                      <StudioDropdown
                        value={settings.flash_model || "gemini-4-hydrogen"}
                        options={modelOptions}
                        onChange={(val) =>
                          onChangeSettings((s) => ({
                            ...s,
                            flash_model: val,
                          }))
                        }
                        size="md"
                        className="w-full"
                        menuWidthClass="w-full"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-[#3A3A3C] dark:text-zinc-300 mb-1.5">
                        Reasoning Depth
                      </label>
                      <StudioDropdown
                        value={settings.thinking_mode}
                        options={thinkingOptions}
                        onChange={(val) =>
                          onChangeSettings((s) => ({
                            ...s,
                            thinking_mode:
                              val as OnboardingSettingsState["thinking_mode"],
                          }))
                        }
                        size="md"
                        className="w-full"
                        menuWidthClass="w-full"
                      />
                    </div>
                  </div>

                  {/* Provider API Credentials Vault (Saved to .env & ./data/settings.json) */}
                  <div className="p-4 rounded-[16px] bg-[#F5F5F7] dark:bg-[#0D0D12] border border-black/[0.06] dark:border-white/[0.08] space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-[#1D1D1F] dark:text-white">
                        API Keys & Tokens (Saved locally to `.env`)
                      </span>
                      <span className="font-mono text-[10.5px] text-emerald-600 dark:text-emerald-400">
                        Leave blank to keep existing key
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-medium text-[#6E6E73] dark:text-zinc-400 mb-1">
                          Google Gemini API Key{" "}
                          {settings.has_gemini_key && (
                            <span className="text-emerald-600 dark:text-emerald-400 font-mono">
                              (Configured{" "}
                              {settings.masked_keys?.gemini
                                ? `· ${settings.masked_keys.gemini}`
                                : ""}
                              )
                            </span>
                          )}
                        </label>
                        <input
                          type="password"
                          value={credentials.gemini_api_key}
                          onChange={(e) =>
                            onChangeCredentials((c) => ({
                              ...c,
                              gemini_api_key: e.target.value,
                            }))
                          }
                          placeholder={
                            settings.masked_keys?.gemini ||
                            "AIzaSy... (GEMINI_API_KEY)"
                          }
                          className="w-full h-8.5 px-2.5 rounded-[9px] bg-white dark:bg-[#16161E] border border-black/[0.08] dark:border-white/[0.1] font-mono text-xs text-[#1D1D1F] dark:text-zinc-200 outline-none focus:border-sky-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-[#6E6E73] dark:text-zinc-400 mb-1">
                          OpenAI API Key{" "}
                          {settings.has_openai_key && (
                            <span className="text-emerald-600 dark:text-emerald-400 font-mono">
                              (Configured)
                            </span>
                          )}
                        </label>
                        <input
                          type="password"
                          value={credentials.openai_api_key}
                          onChange={(e) =>
                            onChangeCredentials((c) => ({
                              ...c,
                              openai_api_key: e.target.value,
                            }))
                          }
                          placeholder={
                            settings.masked_keys?.openai ||
                            "sk-... (OPENAI_API_KEY)"
                          }
                          className="w-full h-8.5 px-2.5 rounded-[9px] bg-white dark:bg-[#16161E] border border-black/[0.08] dark:border-white/[0.1] font-mono text-xs text-[#1D1D1F] dark:text-zinc-200 outline-none focus:border-sky-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-[#6E6E73] dark:text-zinc-400 mb-1">
                          Anthropic API Key{" "}
                          {settings.has_anthropic_key && (
                            <span className="text-emerald-600 dark:text-emerald-400 font-mono">
                              (Configured)
                            </span>
                          )}
                        </label>
                        <input
                          type="password"
                          value={credentials.anthropic_api_key}
                          onChange={(e) =>
                            onChangeCredentials((c) => ({
                              ...c,
                              anthropic_api_key: e.target.value,
                            }))
                          }
                          placeholder={
                            settings.masked_keys?.anthropic ||
                            "sk-ant-... (ANTHROPIC_API_KEY)"
                          }
                          className="w-full h-8.5 px-2.5 rounded-[9px] bg-white dark:bg-[#16161E] border border-black/[0.08] dark:border-white/[0.1] font-mono text-xs text-[#1D1D1F] dark:text-zinc-200 outline-none focus:border-sky-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-[#6E6E73] dark:text-zinc-400 mb-1">
                          OpenRouter API Key{" "}
                          {settings.has_openrouter_key && (
                            <span className="text-emerald-600 dark:text-emerald-400 font-mono">
                              (Configured)
                            </span>
                          )}
                        </label>
                        <input
                          type="password"
                          value={credentials.openrouter_api_key}
                          onChange={(e) =>
                            onChangeCredentials((c) => ({
                              ...c,
                              openrouter_api_key: e.target.value,
                            }))
                          }
                          placeholder={
                            settings.masked_keys?.openrouter ||
                            "sk-or-... (OPENROUTER_API_KEY)"
                          }
                          className="w-full h-8.5 px-2.5 rounded-[9px] bg-white dark:bg-[#16161E] border border-black/[0.08] dark:border-white/[0.1] font-mono text-xs text-[#1D1D1F] dark:text-zinc-200 outline-none focus:border-sky-500"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-medium text-[#6E6E73] dark:text-zinc-400 mb-1">
                          GitHub Personal Access Token (MCP Tools & Auto-Release){" "}
                          {settings.has_github_token && (
                            <span className="text-emerald-600 dark:text-emerald-400 font-mono">
                              (Configured{" "}
                              {settings.masked_keys?.github
                                ? `· ${settings.masked_keys.github}`
                                : ""}
                              )
                            </span>
                          )}
                        </label>
                        <input
                          type="password"
                          value={credentials.github_token}
                          onChange={(e) =>
                            onChangeCredentials((c) => ({
                              ...c,
                              github_token: e.target.value,
                            }))
                          }
                          placeholder={
                            settings.masked_keys?.github ||
                            "ghp_... (GITHUB_TOKEN)"
                          }
                          className="w-full h-8.5 px-2.5 rounded-[9px] bg-white dark:bg-[#16161E] border border-black/[0.08] dark:border-white/[0.1] font-mono text-xs text-[#1D1D1F] dark:text-zinc-200 outline-none focus:border-sky-500"
                        />
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* STEP 2: KOKORO-82M NEURAL TTS (MOVIE J.A.R.V.I.S VOICE) & FASTER-WHISPER STT */}
              {step === 2 && (
                <motion.div
                  key="onboard-step-2"
                  initial={{ opacity: 0, x: 14 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -14 }}
                  transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                  className="space-y-4 text-xs"
                >
                  <div className="p-4 rounded-[16px] bg-[#F5F5F7] dark:bg-[#0D0D12] border border-black/[0.06] dark:border-white/[0.08] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div>
                      <div className="text-[10.5px] font-mono text-emerald-600 dark:text-emerald-400">
                        Kokoro-82M Neural TTS · Faster-Whisper STT
                      </div>
                      <h3 className="text-sm font-bold text-[#1D1D1F] dark:text-white mt-0.5">
                        Movie J.A.R.V.I.S British RP Voice (`bm_george`)
                      </h3>
                      <p className="text-[11.5px] text-[#6E6E73] dark:text-zinc-400 mt-0.5">
                        Refined British Received Pronunciation cadence tuned to
                        match the iconic cinema J.A.R.V.I.S assistant.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        onTestVoiceSample(settings.tts_voice || "bm_george")
                      }
                      disabled={testingVoice}
                      className="studio-btn shrink-0 h-9 px-3.5 rounded-[11px] bg-[#1D1D1F] dark:bg-white text-white dark:text-[#1D1D1F] font-semibold text-xs inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                      <span>
                        {testingVoice
                          ? "Speaking Sample..."
                          : "Test J.A.R.V.I.S Voice"}
                      </span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-[#3A3A3C] dark:text-zinc-300 mb-1.5">
                        TTS Synthesis Engine
                      </label>
                      <StudioDropdown
                        value={settings.tts_engine || "kokoro"}
                        options={ttsEngineOptions}
                        onChange={(val) =>
                          onChangeSettings((s) => ({
                            ...s,
                            tts_engine:
                              val as OnboardingSettingsState["tts_engine"],
                          }))
                        }
                        size="md"
                        className="w-full"
                        menuWidthClass="w-full"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-[#3A3A3C] dark:text-zinc-300 mb-1.5">
                        Speech-to-Text (STT) Engine
                      </label>
                      <StudioDropdown
                        value={settings.stt_engine || "faster_whisper"}
                        options={sttEngineOptions}
                        onChange={(val) =>
                          onChangeSettings((s) => ({
                            ...s,
                            stt_engine:
                              val as OnboardingSettingsState["stt_engine"],
                          }))
                        }
                        size="md"
                        className="w-full"
                        menuWidthClass="w-full"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-[#3A3A3C] dark:text-zinc-300 mb-1.5">
                      Select Voice Persona (Kokoro-82M & Natural Studio Voices)
                    </label>
                    <StudioDropdown
                      value={settings.tts_voice || "bm_george"}
                      options={voiceOptions}
                      onChange={(val) =>
                        onChangeSettings((s) => ({
                          ...s,
                          tts_voice: val,
                        }))
                      }
                      size="md"
                      className="w-full"
                      menuWidthClass="w-full"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-[#6E6E73] dark:text-zinc-400 mb-1">
                        Local Kokoro-82M Bridge URL (`scripts/voice_bridge.py`)
                      </label>
                      <input
                        type="text"
                        value={settings.kokoro_url || "http://127.0.0.1:8880"}
                        onChange={(e) =>
                          onChangeSettings((s) => ({
                            ...s,
                            kokoro_url: e.target.value,
                          }))
                        }
                        className="w-full h-8.5 px-2.5 rounded-[9px] bg-[#F5F5F7] dark:bg-[#101015] border border-black/[0.08] dark:border-white/[0.1] font-mono text-xs text-[#1D1D1F] dark:text-zinc-200 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-[#6E6E73] dark:text-zinc-400 mb-1">
                        Local Faster-Whisper Bridge URL (`base.en` INT8)
                      </label>
                      <input
                        type="text"
                        value={settings.whisper_url || "http://127.0.0.1:8880"}
                        onChange={(e) =>
                          onChangeSettings((s) => ({
                            ...s,
                            whisper_url: e.target.value,
                          }))
                        }
                        className="w-full h-8.5 px-2.5 rounded-[9px] bg-[#F5F5F7] dark:bg-[#101015] border border-black/[0.08] dark:border-white/[0.1] font-mono text-xs text-[#1D1D1F] dark:text-zinc-200 outline-none"
                      />
                    </div>
                  </div>
                </motion.div>
              )}

              {/* STEP 3: OBSIDIAN SECOND BRAIN SPACE & READINESS CHECK */}
              {step === 3 && (
                <motion.div
                  key="onboard-step-3"
                  initial={{ opacity: 0, x: 14 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -14 }}
                  transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                  className="space-y-4 text-xs"
                >
                  <div className="p-4 rounded-[16px] bg-[#F5F5F7] dark:bg-[#0D0D12] border border-black/[0.06] dark:border-white/[0.08] space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-[#1D1D1F] dark:text-white">
                        Obsidian Second Brain Vault Space
                      </span>
                      <span className="font-mono text-[10.5px] text-amber-600 dark:text-amber-400">
                        Auto-Indexed with [[WikiLinks]] & #Tags
                      </span>
                    </div>
                    <input
                      type="text"
                      value={settings.obsidian_vault_path || "./data/vault"}
                      onChange={(e) =>
                        onChangeSettings((s) => ({
                          ...s,
                          obsidian_vault_path: e.target.value,
                        }))
                      }
                      placeholder="./data/vault or C:/Users/you/Documents/ObsidianVault"
                      className="w-full h-9 px-3 rounded-[10px] bg-white dark:bg-[#16161E] border border-black/[0.08] dark:border-white/[0.1] font-mono text-xs text-[#1D1D1F] dark:text-zinc-200 outline-none focus:border-amber-500"
                    />
                    <p className="text-[11px] text-[#6E6E73] dark:text-zinc-400">
                      Pre-seeded with{" "}
                      <code className="font-mono">Welcome to JARVIS.md</code>,{" "}
                      <code className="font-mono">Project Architecture.md</code>
                      ,{" "}
                      <code className="font-mono">
                        Kokoro & Faster-Whisper Voice Engine.md
                      </code>
                      ,{" "}
                      <code className="font-mono">
                        Agent-Desktop Semantic Refs.md
                      </code>
                      , and today’s <code className="font-mono">Daily/</code>{" "}
                      note.
                    </p>
                  </div>

                  {/* 6-Subsystem Studio Readiness Check */}
                  <div className="p-4 rounded-[16px] border border-black/[0.07] dark:border-white/[0.08] bg-white dark:bg-[#181820] space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-semibold text-[#1D1D1F] dark:text-white">
                        <Cpu className="w-3.5 h-3.5 text-sky-500" />
                        <span>6-Subsystem Final Verification</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => void onRunDiagnostics()}
                        disabled={runningDiagnostics}
                        className="studio-btn px-3 py-1 rounded-[8px] bg-sky-500/15 text-sky-700 dark:text-sky-300 font-semibold text-[11px] cursor-pointer"
                      >
                        {runningDiagnostics
                          ? "Verifying..."
                          : "Verify All Subsystems"}
                      </button>
                    </div>

                    {diagnosticsChecks.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {diagnosticsChecks.map((chk) => (
                          <div
                            key={chk.id}
                            className="p-2 rounded-[10px] bg-[#F5F5F7] dark:bg-[#101015] border border-black/[0.05] dark:border-white/[0.06] flex items-center justify-between gap-2 text-[11px]"
                          >
                            <div className="flex items-center gap-1.5 font-semibold text-[#1D1D1F] dark:text-zinc-200 truncate">
                              <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                              <span className="truncate">{chk.label}</span>
                            </div>
                            <span className="font-mono text-[10px] text-[#6E6E73] dark:text-zinc-400 shrink-0">
                              Ready
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-[11px] text-[#6E6E73] dark:text-zinc-400">
                        Click "Verify All Subsystems" or "Complete Setup & Enter
                        Studio" to save your configuration and start working.
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Bottom Navigation Bar */}
          <div className="px-6 py-4 border-t border-black/[0.06] dark:border-white/[0.08] bg-[#FAFAFC] dark:bg-[#101015] flex items-center justify-between gap-3 shrink-0">
            <button
              type="button"
              onClick={() => (step > 0 ? setStep(step - 1) : onClose())}
              className="studio-btn px-3.5 py-2 rounded-[11px] text-xs font-medium text-[#6E6E73] dark:text-zinc-400 hover:text-[#1D1D1F] dark:hover:text-white cursor-pointer"
            >
              {step > 0 ? "Back" : "Skip Setup"}
            </button>

            <div className="flex items-center gap-2">
              {step < 3 ? (
                <button
                  type="button"
                  onClick={() => setStep(step + 1)}
                  className="studio-btn px-4 py-2 rounded-[11px] bg-[#1D1D1F] dark:bg-white text-white dark:text-[#1D1D1F] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Continue</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void onCompleteOnboarding()}
                  className="studio-btn px-5 py-2 rounded-[11px] bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Complete Setup & Enter Studio</span>
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
