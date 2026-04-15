import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(cookieParser());

// Request logger
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

app.use(cors({
  origin: true,
  credentials: true
}));

// Trust proxy for rate limiting
app.set('trust proxy', 1);

// --- Supabase Client Validation ---
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ivdkaccijoeitkrkmrkk.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml2ZGthY2Npam9laXRrcmttcmtrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5ODMxMDIsImV4cCI6MjA5MTU1OTEwMn0.1vRwBZb3JInDYL5ee7fDiNCu5gXtKrmdLLFTTHwhRMU';

const isSupabaseConfigured = supabaseUrl && !supabaseUrl.includes('placeholder') && 
                             ((supabaseServiceKey && supabaseServiceKey !== 'placeholder') || 
                              (supabaseAnonKey && supabaseAnonKey !== 'placeholder'));

if (!isSupabaseConfigured) {
  console.error('CRITICAL: Supabase environment variables are missing or invalid!');
}

// Supabase Admin Client (for server-side operations)
// Note: We prefer service role key for admin tasks, but fallback to anon if necessary
const supabaseAdmin = createClient(
  supabaseUrl,
  supabaseServiceKey || supabaseAnonKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// Rate Limiters
const signinLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // Increased for development/testing
  message: { error: 'Too many failed sign-in attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  validate: { default: false }
});

const otpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // Increased for development/testing
  message: { error: 'Maximum verification codes requested. Please try again in an hour.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.body.email || req.ip || 'unknown';
  },
  validate: { default: false }
});

// --- Auth Middleware ---
async function getAuthenticatedUser(req: express.Request, res: express.Response) {
  if (!isSupabaseConfigured) {
    console.warn('Auth check skipped: Supabase not configured.');
    return null;
  }

  const token = req.cookies['sb-access-token'];
  const refreshToken = req.cookies['sb-refresh-token'];

  if (!token) return null;

  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    let user = data?.user;

    if ((error || !user) && refreshToken) {
      console.log('Token expired, attempting refresh...');
      const { data: refreshData, error: refreshError } = await supabaseAdmin.auth.refreshSession({ refresh_token: refreshToken });
      
      if (!refreshError && refreshData.session) {
        user = refreshData.user;
        // Update cookies with new session
        res.cookie('sb-access-token', refreshData.session.access_token, {
          httpOnly: true,
          secure: true,
          sameSite: 'none',
          maxAge: refreshData.session.expires_in * 1000
        });
        if (refreshData.session.refresh_token) {
          res.cookie('sb-refresh-token', refreshData.session.refresh_token, {
            httpOnly: true,
            secure: true,
            sameSite: 'none',
            maxAge: 60 * 60 * 24 * 7 * 1000
          });
        }
        return user;
      }
    }

    if (error || !user) return null;
    return user;
  } catch (err) {
    console.error('Auth middleware error:', err);
    return null;
  }
}

// --- Routes ---

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// --- Auth Routes ---

// 1. Sign Up / Request OTP
app.post('/api/auth/signup', otpLimiter, async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  if (!process.env.VITE_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Supabase configuration is missing on the server.' });
  }

  try {
    const { error } = await supabaseAdmin.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
      }
    });

    if (error) return res.status(error.status || 500).json({ error: error.message });
    res.json({ message: 'Verification code sent to your email' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// 2. Verify OTP
app.post('/api/auth/verify', async (req, res) => {
  const { email, token } = req.body;
  if (!email || !token) return res.status(400).json({ error: 'Email and code are required' });

  const { data, error } = await supabaseAdmin.auth.verifyOtp({
    email,
    token,
    type: 'email' // or 'signup' depending on Supabase config
  });

  if (error) return res.status(error.status || 400).json({ error: error.message });

  // Set session cookie
  if (data.session) {
    console.log('Setting session cookies after verify for user:', data.user?.id);
    res.cookie('sb-access-token', data.session.access_token, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: data.session.expires_in * 1000
    });
    res.cookie('sb-refresh-token', data.session.refresh_token, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 60 * 60 * 24 * 7 * 1000 // 7 days
    });
  }

  res.json({ user: data.user, session: data.session });
});

// 3. Complete Profile
app.post('/api/auth/complete-profile', async (req, res) => {
  const user = await getAuthenticatedUser(req, res);
  if (!user) return res.status(401).json({ error: 'Invalid session' });

  const { username: rawUsername, fullName, dob, phone, location, password } = req.body;
  const username = rawUsername.toLowerCase().replace(/\s+/g, '');

  console.log('Completing profile for user:', user.id, 'Username:', username);

  // 0. Check if username is taken
  const { data: existingUser } = await supabaseAdmin
    .from('profiles')
    .select('username')
    .eq('username', username)
    .maybeSingle();

  if (existingUser) return res.status(400).json({ error: 'Username is already taken' });

  // 1. Update Password
  const { error: pwdError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
    password: password
  });
  if (pwdError) return res.status(400).json({ error: pwdError.message });

  // 2. Create Profile
  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .upsert({
      id: user.id,
      username,
      full_name: fullName,
      dob,
      phone,
      location,
      email: user.email,
      onboarding_completed: true
    });

  if (profileError) {
    console.error('Profile creation error:', profileError);
    if (profileError.code === '23505') return res.status(400).json({ error: 'Username already taken' });
    return res.status(400).json({ error: profileError.message });
  }

  // 3. Update user metadata as fallback
  await supabaseAdmin.auth.admin.updateUserById(user.id, {
    user_metadata: { onboarding_completed: true, username }
  });

  res.json({ message: 'Profile completed successfully' });
});

// 4. Sign In (Email + Password)
app.post('/api/auth/signin', signinLimiter, async (req, res) => {
  const { email, password } = req.body;
  console.log('Signin attempt for email:', email);
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

  try {
    // Sign in with email directly
    const { data, error } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      console.error('Signin error:', error.message);
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Set session cookie
    if (data.session) {
      console.log('Setting session cookies after signin for user:', data.user?.id);
      res.cookie('sb-access-token', data.session.access_token, {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        maxAge: data.session.expires_in * 1000
      });
      res.cookie('sb-refresh-token', data.session.refresh_token, {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        maxAge: 60 * 60 * 24 * 7 * 1000 // 7 days
      });
    }

    res.json({ user: data.user, session: data.session });
  } catch (err) {
    console.error('Signin error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 5. Sign Out
app.post('/api/auth/signout', async (req, res) => {
  res.clearCookie('sb-access-token', { 
    path: '/',
    secure: true,
    sameSite: 'none'
  });
  res.clearCookie('sb-refresh-token', { 
    path: '/',
    secure: true,
    sameSite: 'none'
  });
  res.json({ message: 'Signed out' });
});

// 6. Get Current User
app.get('/api/auth/me', async (req, res) => {
  if (!isSupabaseConfigured) {
    return res.status(503).json({ error: 'Supabase is not configured on the server.' });
  }

  const user = await getAuthenticatedUser(req, res);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  try {
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    // Map onboarding status from metadata if missing in DB
    const profileWithOnboarding = profile ? {
      ...profile,
      onboarding_completed: profile.onboarding_completed ?? user.user_metadata?.onboarding_completed ?? false
    } : null;

    res.json({ 
      user, 
      profile: profileWithOnboarding, 
      session: { 
        access_token: req.cookies['sb-access-token'],
        refresh_token: req.cookies['sb-refresh-token']
      } 
    });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- Error Handlers ---

// 404 for API routes
app.all('/api/*', (req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.url} not found` });
});

// Global error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled Error:', err);
  res.status(500).json({ 
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// --- Vite Middleware ---
async function startServer() {
  console.log('Starting server initialization...');
  
  if (process.env.NODE_ENV !== 'production') {
    console.log('Initializing Vite in middleware mode...');
    try {
      const vite = await createViteServer({
        server: { 
          middlewareMode: true,
          hmr: process.env.DISABLE_HMR !== 'true'
        },
        appType: 'spa',
      });
      app.use(vite.middlewares);
      console.log('Vite middleware initialized.');
    } catch (viteErr) {
      console.error('Failed to initialize Vite middleware:', viteErr);
    }
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Supabase Configured: ${isSupabaseConfigured}`);
  });
}

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

startServer().catch(err => {
  console.error('CRITICAL: Failed to start server:', err);
  process.exit(1);
});
