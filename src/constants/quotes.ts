export const MOTIVATIONAL_QUOTES = [
  "Every ending is a new beginning. Keep going! 🌱",
  "Don't give up. Your next win is waiting. 🏆",
  "One step back, two steps forward. You got this! 💪",
  "Goals change, but your determination stays. ✨",
  "It's not failure. It's a redirect. 🚀",
  "Close one door. Open a better one. 🔑",
  "Restarting is brave. Keep pushing! 🔥",
  "Small progress is still progress. 📈",
  "You haven't come this far to stop. 🎯",
  "Tomorrow is a fresh start. Make it count. 🌅"
];

export const getRandomQuote = () => {
  return MOTIVATIONAL_QUOTES[Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length)];
};
