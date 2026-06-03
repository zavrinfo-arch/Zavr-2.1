/**
 * Neo-Luxury Minimalist Apple-inspired Styling Palette
 * Optimized for high-contrast presentation, clean proportions, 
 * and deep luxury light/dark interface fidelity.
 */
export const NeoLuxuryStyles = {
  // Deep premium matte background mimicking a high-end metal chassis
  background: "min-h-screen bg-[#050505] text-[#F5F5F7] font-sans antialiased overflow-x-hidden relative flex flex-col justify-between selection:bg-white/20 selection:text-white",

  // Pure glassmorphism holding card with microscopic border and heavy ambient shadows
  glassCard: "w-full max-w-xl mx-auto bg-[#0a0a0a]/70 backdrop-blur-2xl border border-white/[0.06] rounded-[2.5rem] p-8 md:p-10 shadow-[0_32px_80px_rgba(0,0,0,0.95)] flex flex-col justify-between relative",

  // Sleek subtle interactive frame overlays
  inputContainer: "relative flex items-center bg-white/[0.02] border border-white/[0.08] hover:border-white/[0.12] focus-within:border-white/30 rounded-2xl px-5 py-4 transition-all duration-300 shadow-inner",

  // Elite minimalist labels with wide tracking and tiny bold weights
  label: "text-[10px] font-semibold text-[#8E8E93] uppercase tracking-[0.2em] ml-2 block text-left mb-1.5",

  // Custom text input styled for premium legibility
  input: "bg-transparent border-none outline-none flex-1 text-sm font-normal text-white placeholder-[#4E4E52] focus:ring-0 w-full",

  // Brushed steel/silver primary action button with deep contrast
  primaryButton: "flex-1 h-14 rounded-2xl font-semibold text-xs uppercase tracking-[0.25em] flex items-center justify-center gap-3 transition-all active:scale-[0.98] disabled:opacity-20 disabled:pointer-events-none bg-gradient-to-b from-white to-[#E5E5EA] text-[#050505] shadow-[0_4px_30px_rgba(255,255,255,0.15)] hover:brightness-110",

  // Subtle luxury secondary trigger, outlined with precise dimensions
  secondaryButton: "w-14 h-14 bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.05] hover:border-white/[0.1] text-[#E5E5EA] rounded-2xl flex items-center justify-center transition-all duration-300 active:scale-95 disabled:opacity-20",

  // Metallic sub-badge or interest pills
  pillActive: "px-5 py-4 rounded-2xl text-[11px] font-semibold tracking-wider uppercase transition-all duration-300 scale-[1.02] border border-white/20 bg-gradient-to-b from-white/10 to-white/[0.02] text-white shadow-[0_4px_20px_rgba(255,255,255,0.08)]",
  pillInactive: "px-5 py-4 rounded-2xl text-[11px] font-medium tracking-wider uppercase transition-all duration-300 border border-white/[0.04] bg-white/[0.01] text-[#8E8E93] hover:text-white hover:bg-white/[0.03] hover:border-white/[0.08]",

  // Minimalist silver tracker indicator for steps
  stepDotActive: "h-1 flex-1 rounded-full transition-all duration-700 ease-in-out bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]",
  stepDotInactive: "h-1 flex-1 rounded-full transition-all duration-700 ease-in-out bg-white/[0.08]"
};
