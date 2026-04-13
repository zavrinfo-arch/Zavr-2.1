# Zavr - Save Smarter, Together

Zavr is a fully functional savings and goal-tracking application built with React. It features solo and group goals, saving streaks, weekly challenges, and a distinctive **claymorphism** design.

## UI/UX Theme

- **Claymorphism**: A tactile, soft-shadowed aesthetic with multi-layered depth.
- **Color Palette**: Dark base with vibrant Coral (`#FF6B6B`), Teal (`#4ECDC4`), and Gold (`#FFD93D`) accents.
- **Typography**: Cormorant Garamond (Serif) for headings and Inter (Sans) for UI.
- **Logo**: 3D Glass "Z" (provided as `/logo.png`).

## Features

- **Splash Screen**: 2.5-second animated entry.
- **Authentication**: Secure Login and Signup with real-time validation and password strength meter.
- **Onboarding Wizard**: 4-step process to set up your profile, interests, and targets.
- **Goal Management**:
  - **Solo Goals**: Personal targets with deadlines and categories.
  - **Group Goals**: Shared goals with friends, auto-generated IDs, and equal share distribution.
- **Streak System**: Daily contribution tracking with badges (3, 7, 14, 30, 60, 100 days).
- **Weekly Challenges**: Dynamic challenges that reset every Monday to keep you motivated.
- **Transaction History**: Detailed logs with Recharts visualization and filters.
- **Notifications**: Real-time alerts for streaks, goal progress, and group activity.
- **Profile & Settings**: Badge gallery, currency selector (₹, $, €), and data export.
- **UI/UX**:
  - Dark mode by default with glassmorphism effects.
  - Framer Motion animations for smooth transitions.
  - Confetti celebrations for achievements.
  - Responsive design (mobile-first).

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite
- **Styling**: Tailwind CSS (v4)
- **State Management**: Zustand (with persistence)
- **Animations**: Framer Motion
- **Icons**: Lucide React
- **Charts**: Recharts
- **Dates**: date-fns
- **Celebrations**: canvas-confetti
- **Toasts**: react-hot-toast

## Folder Structure

```text
src/
├── components/     # Reusable UI components and Layout
├── lib/            # Utilities and helpers
├── pages/          # Main application screens
├── store/          # Zustand state management
├── types.ts        # TypeScript interfaces
├── App.tsx         # Main routing and global modals
└── main.tsx        # Entry point
```

## Setup Instructions

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

3. Build for production:
   ```bash
   npm run build
   ```

## Persistence

All data is stored in `localStorage` using Zustand's persist middleware. This ensures your goals, transactions, and streaks are saved even after refreshing the page.
