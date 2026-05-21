# Local Development & Testing Guide

This guide describes how to work around the current Google AI Studio preview iframe glitches, set up your development environment locally, and use premium alternative testing methodologies to verify your **Zettl**, **Goals**, and **Dashboard** features without any friction.

---

## Trick 1: Clear the Preview Glitch Instantly with Sandbox Tab Testing

Since the AI Studio live preview container executes in an `<iframe>`, certain cookies, local web storages, and browser extensions trigger excessive internal event handlers that flood the console with numbers.

### The Fix: Open in a New Tab
Instead of relying on the embedded frame preview, copy your personal dev/preview URL from the workspace container and open it in a **separate, full browser tab**:
* **Development Site URL**: `https://ais-dev-6lveo54j5rj5slfvxlgdpq-837287986696.asia-southeast1.run.app`
* **Shared Site URL**: `https://ais-pre-6lveo54j5rj5slfvxlgdpq-837287986696.asia-southeast1.run.app`

By opening either of these URLs directly in your browser:
1. All iframe-related CPU logging bottlenecks disappear instantly.
2. The browser treats it as a top-level document, enabling proper Popups, Cookies, OAuth callback triggers, and correct responsive scaling.
3. You can use your standard browser DevTools (`F12`) safely.

---

## Trick 2: Console Logging Toggle Override

We have installed a safe interceptor utility inside your folder at `src/utils/debug.ts`, which is automatically integrated into `src/main.tsx`. It silences all numeric spams, React DevTools installation nagging, and HMR warnings when running inside preview.

If you ever wish to **manually re-enable** or **force-disable** logs directly in the runtime console, press `F12` and run this helper in the console:

```javascript
// Force enable logs in the browser tab
__toggleLogs(true);

// Re-silence all logs
__toggleLogs(false);
```

---

## Trick 3: Setting Up the App Externally (Local Machine)

To build and test the full-stack system completely offline on your own machine, follow these simple steps:

### 1. Export Code from AI Studio
1. Look at the top right of the Google AI Studio builder interface and click on **Settings** or the **Export** action.
2. Select **Export to ZIP** or link your repository to **Export to GitHub**.
3. Extract the downloaded folder on your local machine.

### 2. Prepare Environment Configuration
Create a `.env` file in the root of your project directory. Customize your keys to either point to our sandbox Supabase/Gemini channels, or supply your own private endpoints:

```env
# Create .env based on .env.example
VITE_SUPABASE_URL=url_obtained_from_supabase_dashboard
VITE_SUPABASE_ANON_KEY=anon_key_obtained_from_supabase_dashboard
GEMINI_API_KEY=your_gemini_api_key_from_google_ai_studio
```

### 3. Install Dependencies & Build
Open your terminal inside the project directory and run the following commands:

```bash
# 1. Install all required React and Vite packages
npm install

# 2. Run the development server locally (usually launches on localhost:3000)
npm run dev

# 3. For custom full-stack server builds
npm run build
npm run start
```

---

## Trick 4: Testing Your Supabase Database Logic Locally

The database tables (like `personal_zettls`, `activities`, and `notifications`) can be loaded into any Supabase instance.
1. Sign up for a free tier at [supabase.com](https://supabase.com).
2. Create a new project.
3. Head over to the **SQL Editor** on the left dashboard navigation column in Supabase.
4. Open the SQL migration files provided in this project root:
   * `./supabase_data_isolation_hardened.sql`
   * `./supabase_zettl_new_migration.sql`
5. Paste their contents into the SQL Editor and click **Run** to generate the identical isolation tables and Row Level Security (RLS) rules!
