/**
 * Neo-Luxury Minimalist Apple-inspired Styling Palette
 * Optimized for high-contrast presentation, clean proportions, 
 * and deep luxury light/dark interface fidelity.
 */
import { COLORS } from '../../constants';

export const NeoLuxuryStyles = {
  // Deep premium matte background mimicking a high-end metal chassis
  background: "min-h-screen bg-white dark:bg-[#0a0a0f] text-zinc-900 dark:text-white font-sans antialiased overflow-x-hidden relative flex flex-col justify-between selection:bg-[#FF6B6B]/20 selection:text-white",

  // Pure glassmorphism holding card with microscopic border and heavy ambient shadows
  glassCard: "w-full max-w-xl mx-auto bg-white dark:bg-[#111118]/85 backdrop-blur-2xl border border-black/[0.06] dark:border-white/[0.06] rounded-[2.5rem] p-8 md:p-10 shadow-xl dark:shadow-[0_32px_80px_rgba(0,0,0,0.95)] flex flex-col justify-between relative",

  // Sleek subtle interactive frame overlays
  inputContainer: "relative flex items-center bg-black/[0.01] dark:bg-white/[0.02] border border-black/[0.08] dark:border-white/[0.08] hover:border-[#FF8A8A]/40 dark:hover:border-[#FF8A8A]/30 focus-within:border-[#FF6B6B]/60 dark:focus-within:border-[#FF6B6B]/60 rounded-2xl px-5 py-4 transition-all duration-300 shadow-sm dark:shadow-inner",

  // Elite minimalist labels with wide tracking and tiny bold weights
  label: "text-[10px] font-semibold text-zinc-500 dark:text-[#94A3B8] uppercase tracking-[0.2em] ml-2 block text-left mb-1.5",

  // Custom text input styled for premium legibility
  input: "bg-transparent border-none outline-none flex-1 text-sm font-normal text-zinc-800 dark:text-white placeholder-zinc-400 dark:placeholder-[#4E4E52] focus:ring-0 w-full",

  // Coral/Pink gradient primary action button with deep contrast
  primaryButton: "flex-1 h-14 rounded-2xl font-bold text-xs uppercase tracking-[0.25em] flex items-center justify-center gap-3 transition-all duration-300 disabled:opacity-20 disabled:pointer-events-none bg-gradient-to-r from-[#FF7C7C] to-[#FF6B6B] text-white shadow-[0_8px_20px_rgba(255,107,107,0.35)] hover:shadow-[0_12px_30px_rgba(255,107,107,0.5)] hover:-translate-y-0.5 active:translate-y-0 active:scale-95 cursor-pointer",

  // Subtle luxury secondary trigger, outlined with precise dimensions
  secondaryButton: "w-14 h-14 bg-black/[0.02] dark:bg-white/[0.02] hover:bg-black/[0.04] dark:hover:bg-white/[0.06] border border-black/[0.08] dark:border-white/[0.05] hover:border-[#FF8A8A]/40 dark:hover:border-white/[0.1] text-zinc-700 dark:text-white rounded-2xl flex items-center justify-center transition-all duration-300 active:scale-95 disabled:opacity-20",

  // Metallic sub-badge or interest pills
  pillActive: "px-5 py-4 rounded-2xl text-[11px] font-semibold tracking-wider uppercase transition-all duration-300 scale-[1.02] border border-[#FF8A8A]/40 dark:border-[#FF8A8A]/40 bg-[#FFE8E8]/30 dark:bg-gradient-to-r dark:from-[#FF6B6B]/15 dark:to-[#FF7C7C]/5 text-zinc-900 dark:text-white shadow-sm dark:shadow-[0_4px_20px_rgba(255,107,107,0.15)]",
  pillInactive: "px-5 py-4 rounded-2xl text-[11px] font-medium tracking-wider uppercase transition-all duration-300 border border-black/[0.08] dark:border-white/[0.04] bg-white dark:bg-white/[0.01] text-zinc-500 dark:text-[#94A3B8] hover:text-zinc-800 hover:dark:text-white hover:bg-black/[0.02] hover:dark:bg-white/[0.03] hover:border-black/[0.12] hover:dark:border-white/[0.08]",

  // Minimalist coral-pink tracker indicator for steps
  stepDotActive: "h-1 flex-1 rounded-full transition-all duration-700 ease-in-out bg-gradient-to-r from-[#FF7C7C] to-[#FF6B6B] shadow-[0_0_8px_rgba(255,107,107,0.8)]",
  stepDotInactive: "h-1 flex-1 rounded-full transition-all duration-700 ease-in-out bg-black/[0.08] dark:bg-white/[0.08]"
};
