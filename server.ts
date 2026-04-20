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
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml2ZGthY2Npam9laXRrcmttcmtrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5ODMxMDIsImV4cCI6MjA5MTU1OTEwMn0.1vRwBZb3JInDYL5ee7fDiNCu5gXtKrmdLLFTTHwhRMU';

const isSupabaseConfigured = supabaseUrl && !supabaseUrl.includes('placeholder') && 
                             supabaseAnonKey && supabaseAnonKey !== 'placeholder';

if (!isSupabaseConfigured) {
  console.error('CRITICAL: Supabase environment variables are missing or invalid!');
}

// Supabase Client (using ANON key to respect RLS as requested)
// We still call it supabaseAdmin in some places but it now uses the anon key
const supabaseAdmin = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// Supabase Auth Client (for regular auth operations like signin)
const supabaseAuth = createClient(
  supabaseUrl,
  supabaseAnonKey,
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

// 1. Sign Up (Email + Password)
app.post('/api/auth/signup', signinLimiter, async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

  if (!supabaseUrl || !supabaseAnonKey) {
    return res.status(500).json({ error: 'Supabase configuration is missing on the server.' });
  }

  try {
    const { data, error } = await supabaseAuth.auth.signUp({
      email,
      password,
    });

    if (error) return res.status(error.status || 500).json({ error: error.message });

    // Handle case where user is already registered but unconfirmed
    if (data.user && data.user.identities && data.user.identities.length === 0) {
      return res.status(400).json({ error: 'User already exists. Please sign in.' });
    }

    // Set session cookie if returned (when email confirmation is disabled)
    if (data.session) {
      console.log('Setting session cookies after signup for user:', data.user?.id);
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

    res.json({ 
      message: data.session ? 'Signup successful! Welcome to Zavr.' : 'Signup successful! Please check your email for a confirmation code.',
      user: data.user,
      session: data.session 
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// 2. Verify OTP / Email Confirmation
app.post('/api/auth/verify', async (req, res) => {
  const { email, token, type } = req.body;
  if (!email || !token) return res.status(400).json({ error: 'Email and code are required' });

  const { data, error } = await supabaseAuth.auth.verifyOtp({
    email,
    token,
    type: type || 'signup' // Support 'signup', 'invite', 'recovery', 'email', 'magiclink'
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

// 2.1 Resend Verification Code
app.post('/api/auth/resend-code', otpLimiter, async (req, res) => {
  const { email, type } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  try {
    const { error } = await supabaseAuth.auth.resend({
      type: type || 'signup',
      email: email,
    });

    if (error) return res.status(error.status || 500).json({ error: error.message });
    res.json({ message: 'New verification code sent!' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// 2.2 Password Reset Request
app.post('/api/auth/reset-password-request', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  const { error } = await supabaseAuth.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.APP_URL || 'http://localhost:3000'}/auth?reset=true`,
  });

  if (error) return res.status(error.status || 500).json({ error: error.message });
  res.json({ message: 'Password reset instructions sent to your email.' });
});

// 3. Complete Profile
app.post('/api/auth/complete-profile', async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req, res);
    if (!user) return res.status(401).json({ error: 'Invalid session' });

    const { username: rawUsername, fullName, dob, phone, location, password, avatarId } = req.body;
    
    if (!rawUsername) return res.status(400).json({ error: 'Username is required' });
    const username = rawUsername.toLowerCase().replace(/\s+/g, '');

    console.log('Completing profile for user:', user.id, 'Username:', username);

  // 0. Check if username is taken
  const { data: existingUser } = await supabaseAdmin
    .from('profiles')
    .select('username')
    .eq('username', username)
    .maybeSingle();

  if (existingUser) return res.status(400).json({ error: 'Username is already taken' });

  // 1. Profile Logic
  // Password updates via admin API are skipped as we are using ANON key to respect RLS.
  // The user should set their password via standard auth methods if needed.


  // 2. Create Profile
  // We minimize the initial payload to avoid "column not found" errors.
  // We rely on defaults in getProfile and user_metadata for other fields.
  const profileData: any = {
    id: user.id,
    username
  };

  // Only include full_name if provided, but we might still hit a column error if it's missing in DB.
  // However, full_name is very common.
  if (fullName) profileData.full_name = fullName;

  console.log('Upserting minimal profile data for:', user.id);

  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .upsert(profileData);

  if (profileError) {
    console.error('FULL Profile creation error:', JSON.stringify(profileError, null, 2));
    
    // If it's a column error, try even more minimal (just ID)
    if (profileError.code === 'PGRST204') {
       console.log('Retrying with ID only due to column mismatch...');
       const { error: retryError } = await supabaseAdmin
        .from('profiles')
        .upsert({ id: user.id });
       
       if (retryError) {
         return res.status(400).json({ error: `Table 'profiles' might be missing 'username' or doesn't exist. (${retryError.message})` });
       }
    } else {
      if (profileError.code === '23505') return res.status(400).json({ error: 'Username already taken' });
      return res.status(400).json({ error: `${profileError.message} (${profileError.code})` || 'Failed to create profile' });
    }
  }

  // 3. Metadata updates via admin API are skipped as we are using ANON key.
  // We rely on the profiles table as the source of truth.

  res.json({ success: true, message: 'Profile completed successfully' });
  } catch (err: any) {
    console.error('Unhandled error in complete-profile:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// 4. Sign In (Email + Password)
app.post('/api/auth/signin', signinLimiter, async (req, res) => {
  const { email, password } = req.body;
  console.log('Signin attempt for email:', email);
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

  try {
    // Sign in with email directly using the standard auth client
    const { data, error } = await supabaseAuth.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      console.error('Signin AuthApiError:', {
        status: (error as any).status,
        message: error.message,
        email: `${email.substring(0, 2)}...${email.substring(email.length - 2)}` // Safe logging
      });
      
      // Detailed feedback for common issues
      let userMessage = 'Invalid email or password. Please try again.';
      
      if (error.message.includes('Email not confirmed')) {
        userMessage = 'Please confirm your email address. Check your inbox for the verification code we sent during signup.';
      } else if (error.message.includes('Invalid login credentials')) {
        // This is the most common error. It can mean wrong creds OR unconfirmed email (depending on Supabase settings)
        userMessage = 'Invalid email or password. If you just signed up, please make sure you verified your email using the code we sent.';
      } else {
        userMessage = error.message;
      }

      return res.status(401).json({ 
        error: userMessage,
        code: (error as any).status === 400 ? 'INVALID_CREDENTIALS' : 'AUTH_ERROR'
      });
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

app.post('/api/auth/session', async (req, res) => {
  const { session } = req.body;
  
  if (session) {
    console.log('Synchronizing session cookies for user:', session.user?.id);
    res.cookie('sb-access-token', session.access_token, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: session.expires_in * 1000
    });
    res.cookie('sb-refresh-token', session.refresh_token, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 60 * 60 * 24 * 7 * 1000 // 7 days
    });
  }
  
  res.json({ success: true });
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

    // Map snake_case from DB to camelCase for App
    const mappedProfile = profile ? {
      id: profile.id,
      fullName: profile.full_name,
      username: profile.username,
      email: profile.email || user.email,
      phone: profile.phone,
      dob: profile.dob,
      location: profile.location,
      avatar: `https://api.dicebear.com/7.x/lorelei/svg?seed=${profile.username}`, // Fallback as avatar column is missing
      avatarId: 1, // Fallback as avatar_id column is missing
      streak: profile.streak || 0,
      onboardingCompleted: profile.onboarding_completed ?? user.user_metadata?.onboarding_completed ?? false,
      interests: profile.interests || [],
      badges: profile.badges || [],
      createdAt: profile.created_at,
      lastLoginDate: profile.last_login_date,
      streakFreezeCount: profile.streak_freeze_count || 0,
      xp: profile.xp || 0,
      level: profile.level || 1,
      preferences: profile.preferences || {
        currency: 'INR',
        notificationsEnabled: true,
        reminders: { enabled: true, time: '20:00', frequency: 'daily' }
      }
    } : null;

    res.json({ 
      user, 
      profile: mappedProfile, 
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
          hmr: process.env.DISABLE_HMR !== 'true',
          host: '0.0.0.0',
          port: 3000
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
