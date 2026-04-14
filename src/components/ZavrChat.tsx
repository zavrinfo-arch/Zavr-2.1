import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageCircle, Send, X, Bot, Loader2 } from 'lucide-react';
import { useStore } from '../store/useStore';

export default function ZavrChat() {
  const { isChatOpen, setIsChatOpen, chatMessages, sendChatMessage } = useStore();
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages, isTyping]);

  const handleSend = () => {
    if (!input.trim()) return;
    sendChatMessage(input);
    setInput('');
    setIsTyping(true);
    setTimeout(() => setIsTyping(false), 1500);
  };

  return (
    <div className="fixed bottom-20 md:bottom-24 right-4 md:right-6 z-[100] flex flex-col items-end gap-4 max-w-[calc(100vw-2rem)]">
      <AnimatePresence>
        {isChatOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="w-[calc(100vw-2rem)] sm:w-[380px] h-[70vh] sm:h-[550px] clay bg-surface shadow-2xl flex flex-col overflow-hidden border border-border"
          >
            {/* Header */}
            <div className="p-5 sm:p-6 bg-gradient-to-br from-[#FF6B6B] via-[#EE5253] to-[#d63031] text-white flex items-center justify-between relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-3xl" />
              <div className="flex items-center gap-3 sm:gap-4 relative z-10">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-xl">
                  <Bot size={22} className="text-white animate-pulse sm:size-[26px]" />
                </div>
                <div>
                  <h3 className="font-black text-xs sm:text-sm leading-none uppercase tracking-[0.2em]">Zavr</h3>
                  <div className="flex items-center gap-2 mt-1.5 sm:mt-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <p className="text-[8px] sm:text-[9px] text-white/60 uppercase font-bold tracking-widest">Always Online</p>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setIsChatOpen(false)}
                className="p-2 hover:bg-white/10 rounded-xl transition-all relative z-10 active:scale-90"
              >
                <X size={18} className="sm:size-5" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 sm:space-y-6 bg-background hide-scrollbar">
              {chatMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] p-3.5 sm:p-4 rounded-2xl sm:rounded-3xl text-[10px] sm:text-[11px] font-bold leading-relaxed shadow-lg ${
                      msg.sender === 'user'
                        ? 'clay-coral text-white rounded-tr-none'
                        : 'clay-card text-foreground/80 rounded-tl-none border border-border'
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className="flex justify-start">
                  <div className="clay-card p-3.5 sm:p-4 rounded-2xl sm:rounded-3xl rounded-tl-none border border-border">
                    <div className="flex gap-1">
                      <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1 }} className="w-1.5 h-1.5 rounded-full bg-[#FF6B6B]" />
                      <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="w-1.5 h-1.5 rounded-full bg-[#FF6B6B]" />
                      <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="w-1.5 h-1.5 rounded-full bg-[#FF6B6B]" />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-5 sm:p-6 bg-surface border-t border-border">
              <div className="flex gap-2 sm:gap-3">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                    placeholder="Ask about your goals..."
                    className="w-full clay-inset px-4 sm:px-5 py-3.5 sm:py-4 text-[10px] sm:text-[11px] font-bold text-foreground/90 placeholder:text-foreground/20 outline-none focus:border-[#FF6B6B]/30 border border-transparent transition-all"
                  />
                </div>
                <button
                  onClick={handleSend}
                  disabled={!input.trim()}
                  className="w-12 h-12 sm:w-14 sm:h-14 clay-coral text-white flex items-center justify-center hover:brightness-110 transition-all active:scale-90 disabled:opacity-50 disabled:grayscale"
                >
                  <Send size={18} className="sm:size-5" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsChatOpen(!isChatOpen)}
        className="w-14 h-14 clay-coral text-white shadow-2xl flex items-center justify-center transition-all"
      >
        {isChatOpen ? <X size={24} /> : <MessageCircle size={24} />}
      </motion.button>
    </div>
  );
}
