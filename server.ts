import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(cookieParser());

// Request logger
app.use((req, res, next) => {
  if (req.url.startsWith('/api/')) {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  }
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

// Supabase Client (using SERVICE_ROLE key for administrative tasks if available)
const rawServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const hasServiceKey = rawServiceKey && rawServiceKey.length > 40; // Some keys might be slightly shorter but still valid
const supabaseServiceKey = hasServiceKey ? rawServiceKey.trim() : supabaseAnonKey;

console.log('[SUPABASE] Initialization Info:');
console.log(`- URL: ${supabaseUrl}`);
console.log(`- Using Service Role Key: ${hasServiceKey}`);
if (!hasServiceKey) {
  console.warn('[SUPABASE] WARNING: SUPABASE_SERVICE_ROLE_KEY is not set. Falling back to ANON key. Administrative queries will likely fail due to RLS or schema permissions.');
}

const supabaseAdmin = createClient(
  supabaseUrl,
  supabaseServiceKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// --- Schema Check ---
let hasFriendsStatusColumn = true;
let useZettlFallback = false;

// --- ZETTL LOCAL FALLBACK DATABASE ---
const FALLBACK_DB_PATH = path.resolve('./zettl_fallback_db.json');

function readLocalZettlDB(): {
  personal_zettls: any[];
  zettl_transactions: any[];
  zettl_groups: any[];
  zettl_group_members: any[];
  zettl_group_expenses: any[];
  zettl_expense_splits: any[];
  friends?: any[];
} {
  try {
    if (!fs.existsSync(FALLBACK_DB_PATH)) {
      const initial = {
        personal_zettls: [],
        zettl_transactions: [],
        zettl_groups: [],
        zettl_group_members: [],
        zettl_group_expenses: [],
        zettl_expense_splits: [],
        friends: []
      };
      fs.writeFileSync(FALLBACK_DB_PATH, JSON.stringify(initial, null, 2));
      return initial;
    }
    const content = fs.readFileSync(FALLBACK_DB_PATH, 'utf-8');
    const parsed = JSON.parse(content);
    if (!parsed.zettl_transactions) {
      parsed.zettl_transactions = [];
    }
    return parsed;
  } catch (err) {
    console.error('[LOCAL DB] Failed to read or initialize fallback DB:', err);
    return {
      personal_zettls: [],
      zettl_transactions: [],
      zettl_groups: [],
      zettl_group_members: [],
      zettl_group_expenses: [],
      zettl_expense_splits: [],
      friends: []
    };
  }
}

function writeLocalZettlDB(data: any) {
  try {
    fs.writeFileSync(FALLBACK_DB_PATH, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('[LOCAL DB] Failed to save fallback DB:', err);
  }
}

(async () => {
  console.log('[SUPABASE] Running schema check...');
  try {
    const { data, error } = await supabaseAdmin.from('profiles').select('id').limit(1);
    if (error) {
      console.error('[SUPABASE] Schema check failed:', error.message);
      if (error.message.includes('permission denied for schema public')) {
        console.error('[SUPABASE] CRITICAL: The role used does not have USAGE on schema public.');
        console.error('[SUPABASE] Possible Fixes:');
        console.error('1. Ensure SUPABASE_SERVICE_ROLE_KEY is correctly set in AI Studio Secrets.');
        console.error('2. Run this SQL in your Supabase Dashboard: GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;');
        console.error('3. Check if the "profiles" table was created in a different schema.');
      }
    } else {
      console.log('[SUPABASE] Schema check successful: profiles table is accessible.');
    }

    // Check if zettl_transactions is accessible, if not activate local JSON fallback
    const { error: zettlCheckError } = await supabaseAdmin.from('zettl_transactions').select('id').limit(1);
    if (zettlCheckError && (
      zettlCheckError.message.includes('relation') || 
      zettlCheckError.message.includes('cache') || 
      zettlCheckError.message.includes('not find the table')
    )) {
      useZettlFallback = true;
      console.warn('[SUPABASE] WARNING: zettl_transactions table is not accessible in Supabase. Enabling local filesystem JSON-based fallback for Zettl features!');
    } else {
      console.log('[SUPABASE] Zettl transactions table presence check passed.');
    }

    // Dynamic Friends Status Column Check
    const { error: friendsError } = await supabaseAdmin.from('friends').select('status').limit(1);
    if (friendsError && (friendsError.message.includes('column') || friendsError.message.includes('status') || friendsError.code === '42703')) {
      hasFriendsStatusColumn = false;
      console.log('[SUPABASE] Friends table status column fallback mode enabled.');
    } else {
      console.log('[SUPABASE] Friends table status column is present.');
    }
  } catch (err: any) {
    console.error('[SUPABASE] Schema check exception:', err.message);
  }
})();

// Alias for semantic clarity in auth routes
const supabaseAuth = supabaseAdmin;

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
// Keep track of ongoing refresh attempts to prevent concurrent rotation conflicts
const pendingRefreshes = new Map<string, Promise<any>>();

async function getAuthenticatedUser(req: express.Request, res: express.Response) {
  if (!isSupabaseConfigured) {
    console.warn('Auth check skipped: Supabase not configured.');
    return null;
  }

  const token = req.cookies['sb-access-token'];
  const refreshToken = req.cookies['sb-refresh-token'];

  if (!token) return null;

  try {
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    let user = userData?.user;

    // attempt refresh if user is missing or token is expired
    if ((userError || !user) && refreshToken && refreshToken !== 'undefined' && refreshToken !== 'null') {
      const refreshKey = refreshToken;
      
      // If there's already a refresh in progress for this token, wait for it
      if (pendingRefreshes.has(refreshKey)) {
        console.log('[AUTH] Waiting for already active refresh for token...');
        const result = await pendingRefreshes.get(refreshKey);
        if (result?.user) {
          return result.user;
        }
      }

      console.log('[AUTH] Token expired or invalid, attempting refresh using cookie...');
      const refreshPromise = supabaseAdmin.auth.refreshSession({ refresh_token: refreshToken })
        .then(async ({ data: refreshData, error: refreshError }) => {
          if (!refreshError && refreshData.session) {
            const session = refreshData.session;
            res.cookie('sb-access-token', session.access_token, {
              path: '/',
              httpOnly: true,
              secure: true,
              sameSite: 'none',
              maxAge: session.expires_in * 1000
            });
            if (session.refresh_token) {
              res.cookie('sb-refresh-token', session.refresh_token, {
                path: '/',
                httpOnly: true,
                secure: true,
                sameSite: 'none',
                maxAge: 60 * 60 * 24 * 7 * 1000
              });
            }
            (req as any).freshSession = session;
            return { user: refreshData.user, session };
          } else {
            console.warn('[AUTH] Refresh failed:', refreshError?.message);
            // "Refresh Token Not Found" usually means it was already used/rotated
            if (refreshError?.message?.includes('Refresh Token Not Found')) {
               // Try one last time to get user with current token, maybe it just refreshed in another request?
               const { data: retryData } = await supabaseAdmin.auth.getUser(token);
               if (retryData?.user) return { user: retryData.user };
            }
            res.clearCookie('sb-access-token', { path: '/', secure: true, sameSite: 'none' });
            res.clearCookie('sb-refresh-token', { path: '/', secure: true, sameSite: 'none' });
            return null;
          }
        })
        .finally(() => {
          pendingRefreshes.delete(refreshKey);
        });

      pendingRefreshes.set(refreshKey, refreshPromise);
      const refreshResult = await refreshPromise;
      return refreshResult?.user || null;
    }

    if (userError || !user) {
      if (userError) console.error('[AUTH] getUser Error:', userError.message);
      res.clearCookie('sb-access-token', { path: '/', secure: true, sameSite: 'none' });
      return null;
    }
    
    return user;
  } catch (err: any) {
    console.error('Auth middleware catch error:', err.message || err);
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
  const { email: rawEmail, password } = req.body;
  if (!rawEmail || !password) return res.status(400).json({ error: 'Email and password are required' });
  const email = rawEmail.trim().toLowerCase();

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

    // Auto-confirm the user if they were successfully signed up
    if (data.user && hasServiceKey) {
      try {
        console.log(`[API-AUTH] Automatically confirming email on signup for: ${data.user.id}`);
        const { error: confirmErr } = await supabaseAdmin.auth.admin.updateUserById(data.user.id, {
          email_confirm: true
        });
        if (confirmErr) {
          console.error('[API-AUTH] Auto-confirm error during signup:', confirmErr.message);
        } else {
          console.log(`[API-AUTH] Automatically confirmed email on signup for: ${data.user.id}`);
        }
      } catch (adminErr: any) {
        console.warn('[API-AUTH] Administrative auto-confirm exception during signup:', adminErr.message || adminErr);
      }
    }

    // Set session cookie if returned (when email confirmation is disabled)
    if (data.session) {
      console.log('Setting session cookies after signup for user:', data.user?.id);
      res.cookie('sb-access-token', data.session.access_token, {
        path: '/',
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        maxAge: data.session.expires_in * 1000
      });
      res.cookie('sb-refresh-token', data.session.refresh_token, {
        path: '/',
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
  const { email: rawEmail, token, type } = req.body;
  if (!rawEmail || !token) return res.status(400).json({ error: 'Email and code are required' });
  const email = rawEmail.trim().toLowerCase();

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
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: data.session.expires_in * 1000
    });
    res.cookie('sb-refresh-token', data.session.refresh_token, {
      path: '/',
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
  const { email: rawEmail, type } = req.body;
  if (!rawEmail) return res.status(400).json({ error: 'Email is required' });
  const email = rawEmail.trim().toLowerCase();

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

// 2.2 Password Reset Request (Supports Email or Username)
app.post('/api/auth/reset-password-request', async (req, res) => {
  const { email: rawEmail, loginInput } = req.body;
  const input = (loginInput || rawEmail || '').trim();
  if (!input) return res.status(400).json({ error: 'Email or Username is required' });

  try {
    let email = '';
    const isEmail = input.includes('@');
    if (isEmail) {
      email = input.toLowerCase();
    } else {
      console.log(`[API-AUTH] Reset request lookup by username: ${input}`);
      const { data: profileData, error: profileErr } = await supabaseAdmin
        .from('profiles')
        .select('email')
        .eq('username', input.toLowerCase())
        .maybeSingle();

      if (profileErr) {
        console.error('[API-AUTH] Error looking up email on profiles for reset:', profileErr);
      }

      if (!profileData || !profileData.email) {
        return res.status(404).json({
          error: `The username "${input}" does not exist. Please check your spelling or enter your email address.`,
          code: 'USER_NOT_FOUND'
        });
      }

      email = profileData.email.toLowerCase();
      console.log(`[API-AUTH] Username "${input}" resolved to email "${email}" for reset`);
    }

    const { error } = await supabaseAuth.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.APP_URL || 'http://localhost:3000'}/auth?reset=true`,
    });

    if (error) {
      console.error('[API-AUTH] Reset password for email failed:', error);
      return res.status(error.status || 500).json({ error: error.message });
    }

    // Obfuscate the email slightly if resolved from username, to prevent user scanning
    const displayEmail = isEmail 
      ? email 
      : email.replace(/^([^@]{2})[^@]+(@.*)$/, '$1***$2');

    res.json({ 
      message: `Password reset instructions sent to ${displayEmail}.`,
      email: email 
    });
  } catch (err: any) {
    console.error('[API-AUTH] Error in reset password request:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
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

  // 0. Check if username is taken (3-20 chars, lowercase, numbers, underscore only)
  const usernameRegex = /^[a-z0-9_]{3,20}$/;
  if (!usernameRegex.test(username)) {
    return res.status(400).json({ error: 'Username must be 3-20 characters and contain only lowercase letters, numbers, and underscores.' });
  }

  const { data: existingUser } = await supabaseAdmin
    .from('profiles')
    .select('username')
    .eq('username', username)
    .maybeSingle();

  if (existingUser) return res.status(400).json({ error: 'Username is already taken' });

  // 1. Profile Logic
  const profileData: any = {
    id: user.id,
    username,
    email: user.email,
    full_name: fullName,
    dob,
    phone,
    location,
    avatar_url: `https://api.dicebear.com/7.x/lorelei/svg?seed=${username}`,
    onboarding_completed: false,
    created_at: new Date().toISOString()
  };

  console.log('Creating profile record for:', user.id);

  let { error: profileError } = await supabaseAdmin
    .from('profiles')
    .upsert(profileData);

  if (profileError && (profileError.message?.includes('email') || profileError.code === '42703')) {
    console.warn('[SERVER_DB] Upsert failed due to missing email column in profiles table. Retrying fallback without email...', profileError.message);
    const fallbackProfileData = { ...profileData };
    delete fallbackProfileData.email;
    const retryResult = await supabaseAdmin
      .from('profiles')
      .upsert(fallbackProfileData);
    profileError = retryResult.error;
  }

  if (profileError) {
    console.error('Final profile creation error:', profileError);
    if (profileError.code === '23505') return res.status(400).json({ error: 'Username already taken' });
    return res.status(400).json({ error: profileError.message || 'Failed to create profile' });
  }

  res.json({ success: true, message: 'Profile created successfully' });
  } catch (err: any) {
    console.error('Unhandled error in complete-profile:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// 4. Sign In (Email Address OR Username + Password)
app.post('/api/auth/signin', signinLimiter, async (req, res) => {
  const { email: rawEmail, loginInput, password } = req.body;
  const loginId = (loginInput || rawEmail || '').trim();
  if (!loginId || !password) {
    return res.status(400).json({ error: 'Email/Username and password are required' });
  }

  try {
    let email = '';
    const isEmail = loginId.includes('@');
    if (isEmail) {
      email = loginId.toLowerCase();
    } else {
      console.log(`[API-AUTH] Signin lookup by username: ${loginId}`);
      const { data: profileData, error: profileErr } = await supabaseAdmin
        .from('profiles')
        .select('email')
        .eq('username', loginId.toLowerCase())
        .maybeSingle();

      if (profileErr) {
        console.error('[API-AUTH] Error looking up email on profiles:', profileErr);
      }

      if (!profileData || !profileData.email) {
        return res.status(401).json({
          error: `The username "${loginId}" does not exist. Please check your spelling or sign in with your email address.`,
          code: 'INVALID_CREDENTIALS'
        });
      }

      email = profileData.email.toLowerCase();
      console.log(`[API-AUTH] Username "${loginId}" mapped to email "${email}"`);
    }

    // Auto-confirm the user's email administratively if a service key is available,
    // ensuring the login will not fail due to unconfirmed email status.
    if (hasServiceKey) {
      try {
        const { data: profileData } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .eq('email', email)
          .maybeSingle();

        if (profileData && profileData.id) {
          console.log(`[API-AUTH] Administrative check: confirming email on login for ${email} (${profileData.id})`);
          await supabaseAdmin.auth.admin.updateUserById(profileData.id, {
            email_confirm: true
          });
        } else {
          // Fallback check in case the profile row hasn't been created yet or isn't populated
          const { data: userData } = await supabaseAdmin.auth.admin.listUsers();
          const userObj = (userData?.users as any[])?.find((u: any) => u.email?.toLowerCase() === email.toLowerCase());
          if (userObj) {
            console.log(`[API-AUTH] Administrative check: found user in auth list for ${email}. Confirming email...`);
            await supabaseAdmin.auth.admin.updateUserById(userObj.id, {
              email_confirm: true
            });
          }
        }
      } catch (adminErr: any) {
        console.warn('[API-AUTH] Ignored administrative auto-confirm checker error:', adminErr.message || adminErr);
      }
    }

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
      let userMessage = 'Invalid email/username or password. Please try again.';
      
      if (error.message.includes('Email not confirmed')) {
        userMessage = 'Please confirm your email address. Check your inbox for the verification code we sent during signup.';
      } else if (error.message.includes('Invalid login credentials')) {
        userMessage = 'Invalid email/username or password. If you just signed up, please make sure you verified your email using the code we sent.';
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
        path: '/',
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        maxAge: data.session.expires_in * 1000
      });
      res.cookie('sb-refresh-token', data.session.refresh_token, {
        path: '/',
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        maxAge: 60 * 60 * 24 * 7 * 1000 // 7 days
      });
    }

    let profile = null;
    if (data.user) {
      try {
        const nowISO = new Date().toISOString();
        console.log('[API-AUTH] Updating profiles collection last_login_at and retrieving for user:', data.user.id);
        
        // Update last_login_at (requested column of profiles) and email
        const { data: pData, error: updateError } = await supabaseAdmin
          .from('profiles')
          .update({
            last_login_at: nowISO,
            email: email // ensure email is saved
          })
          .eq('id', data.user.id)
          .select()
          .maybeSingle();

        if (updateError) {
          console.error('[API-AUTH] Failed to update last_login_at, fetching current profile instead:', updateError);
          // Fallback to simple select
          const { data: fallbackData } = await supabaseAdmin
            .from('profiles')
            .select('*')
            .eq('id', data.user.id)
            .maybeSingle();
          profile = fallbackData;
        } else {
          profile = pData;
        }

        // Add compatibility mapping so client can reference last_login_date seamlessly
        if (profile) {
          profile.last_login_date = profile.last_login_at || nowISO;
        }
      } catch (profileErr) {
        console.warn('[API-AUTH] Failed to fetch profile on signin:', profileErr);
      }
    }

    res.json({ user: data.user, session: data.session, profile });
  } catch (err) {
    console.error('Signin error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Client synchronization point: Get current session from server cookies
app.get('/api/auth/session', async (req, res) => {
  const user = await getAuthenticatedUser(req, res);
  if (!user) return res.status(401).json({ session: null });

  // If getAuthenticatedUser refreshed the session, it attached it to req
  const freshSession = (req as any).freshSession;
  if (freshSession) {
    return res.json({ session: freshSession, user });
  }

  // Otherwise, we have a valid token in cookie but no full session object easily available without more work.
  // We can construct a minimal session or just return the user and let client handle it.
  // Actually, standard practice for this sync is to return enough to use setSession() on client.
  const accessToken = req.cookies['sb-access-token'];
  const refreshToken = req.cookies['sb-refresh-token'];
  
  return res.json({
    session: {
      access_token: accessToken,
      refresh_token: refreshToken,
      user: user,
      expires_in: 3600 // approximated if unknown
    },
    user
  });
});

app.post('/api/auth/session', async (req, res) => {
  const { session } = req.body;
  
  if (session) {
    console.log('Synchronizing session cookies for user:', session.user?.id);
    res.cookie('sb-access-token', session.access_token, {
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: session.expires_in * 1000
    });
    res.cookie('sb-refresh-token', session.refresh_token, {
      path: '/',
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
      .maybeSingle();

    // Map snake_case from DB to camelCase for App
    const mappedProfile = profile ? {
      id: profile.id,
      fullName: profile.full_name,
      username: profile.username,
      email: profile.email || user.email,
      phone: profile.phone,
      dob: profile.birth_date || profile.dob,
      location: profile.location,
      avatar: profile.avatar_url || `https://api.dicebear.com/7.x/lorelei/svg?seed=${profile.username}`,
      avatarId: profile.avatar_id || 'genz_1',
      streak: profile.streak || 0,
      onboardingCompleted: profile.onboarding_completed || (!!profile.username && !!profile.full_name),
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
      session: (req as any).freshSession || { 
        access_token: req.cookies['sb-access-token'],
        refresh_token: req.cookies['sb-refresh-token']
      } 
    });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- Zettl API Implementation ---

// 1. User & Friends
app.get('/api/users/search', async (req, res) => {
  const user = await getAuthenticatedUser(req, res);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  const query = req.query.q as string;
  if (!query) return res.json([]);

  try {
    const safeQuery = (query || '').trim();
    if (!safeQuery) return res.json([]);

    // Replace spaces with wildcards for flexible matching across columns
    const wildcard = `%${safeQuery.replace(/\s+/g, '%')}%`;

    console.log(`[SERVER] Searching profiles for: ${wildcard}`);

    // Determine which client to use for search
    let searchClient = supabaseAdmin;
    const freshSession = (req as any).freshSession;
    const token = freshSession?.access_token || req.cookies['sb-access-token'];
    
    // If we don't have a service key, we MUST use a client with the user's token
    // to benefit from the user's permissions, or at least bypass 'anon' restrictions.
    if (!hasServiceKey && token) {
      console.log('[SERVER] Service role missing, creating user-context client for search');
      searchClient = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false
        },
        global: { 
          headers: { 
            Authorization: `Bearer ${token}` 
          } 
        }
      });
    } else if (!hasServiceKey) {
      console.warn('[SERVER] Both Service Role and Token missing. Search will likely fail or return limited results.');
    }

    // Using .or with PostgREST. Note: values with spaces or special characters
    // in an .or() string are matching wildcards here, so we don't use double-quotes around them.
    const orCondition = `username.ilike.${wildcard},full_name.ilike.${wildcard}`;
    
    const { data, error } = await searchClient
      .from('profiles')
      .select('id, username, full_name, avatar_url')
      .or(orCondition)
      .neq('id', user.id)
      .limit(20);
    
    if (error) {
      console.error('[SERVER] Primary Search failed:', error.message);
      console.error(`[SERVER] Context: URL=${supabaseUrl}, Role=${hasServiceKey ? 'service_role' : (token ? 'authenticated' : 'anon')}`);
      
      // Fallback: search only by username which is simpler
      const { data: fallbackData, error: fbError } = await searchClient
        .from('profiles')
        .select('id, username, full_name, avatar_url')
        .ilike('username', wildcard)
        .neq('id', user.id)
        .limit(20);

      if (fbError) {
        console.error('[SERVER] Fallback Search failed:', fbError.message);
        return res.status(500).json({ error: 'Search failed', message: fbError.message });
      }
      
      const mappedFallback = (fallbackData || []).map((p: any) => ({
        id: p.id,
        username: p.username,
        full_name: p.full_name,
        fullName: p.full_name,
        avatar_url: p.avatar_url,
        avatar: p.avatar_url || `https://api.dicebear.com/7.x/lorelei/svg?seed=${p.username}`
      }));
      return res.json(mappedFallback);
    }
    
    const mapped = (data || []).map((p: any) => ({
      id: p.id,
      username: p.username,
      full_name: p.full_name,
      fullName: p.full_name,
      avatar_url: p.avatar_url,
      avatar: p.avatar_url || `https://api.dicebear.com/7.x/lorelei/svg?seed=${p.username}`
    }));
    res.json(mapped);
  } catch (err: any) {
    console.error('[SERVER] Search Exception:', err);
    res.status(500).json({ error: 'Search failed', message: err.message });
  }
});

app.post('/api/friends/request-by-username', async (req, res) => {
  const user = await getAuthenticatedUser(req, res);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  const { username: rawUsername } = req.body;
  if (!rawUsername) return res.status(400).json({ error: 'Username is required' });
  const username = rawUsername.trim();

  try {
    // 1. Find user by username (case-insensitive)
    const { data: targetUser, error: findError } = await supabaseAdmin
      .from('profiles')
      .select('id, username')
      .ilike('username', username)
      .maybeSingle();
    
    if (findError) throw findError;
    if (!targetUser) return res.status(404).json({ error: 'User not found' });
    if (targetUser.id === user.id) return res.status(400).json({ error: 'You cannot add yourself' });

    // 2. Check if relationship already exists in either direction
    const selectFields = hasFriendsStatusColumn ? 'id, status, user_id, friend_id' : 'id, user_id, friend_id';
    const { data: existing, error: checkError } = await (supabaseAdmin
      .from('friends')
      .select(selectFields) as any)
      .or(`and(user_id.eq.${user.id},friend_id.eq.${targetUser.id}),and(user_id.eq.${targetUser.id},friend_id.eq.${user.id})`)
      .maybeSingle();
    
    if (checkError) throw checkError;
    if (existing) {
      if (!hasFriendsStatusColumn || existing.status === 'accepted') {
        return res.status(400).json({ error: 'You are already friends' });
      }
      const direction = existing.user_id === user.id ? 'sent' : 'received';
      return res.status(400).json({ error: `You already have a ${direction} request with this user` });
    }

    // 3. Insert friend request
    const insertObj = hasFriendsStatusColumn
      ? { user_id: user.id, friend_id: targetUser.id, status: 'pending' }
      : { user_id: user.id, friend_id: targetUser.id };

    const { error: insertError } = await supabaseAdmin
      .from('friends')
      .insert(insertObj);
    
    if (insertError) throw insertError;

    res.json({ success: true, friendId: targetUser.id, friendUsername: targetUser.username });
  } catch (err: any) {
    console.error('Friend request by username failed:', err);
    res.status(500).json({ error: err.message || 'Friend request failed' });
  }
});

app.post('/api/friends/request', async (req, res) => {
  const user = await getAuthenticatedUser(req, res);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  const { friendId } = req.body;
  if (!friendId) return res.status(400).json({ error: 'friendId is required' });

  try {
    // Check if relationship already exists
    const selectFields = hasFriendsStatusColumn ? 'id, status, user_id, friend_id' : 'id, user_id, friend_id';
    const { data: existing, error: checkError } = await (supabaseAdmin
      .from('friends')
      .select(selectFields) as any)
      .or(`and(user_id.eq.${user.id},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${user.id})`)
      .maybeSingle();
    
    if (checkError) throw checkError;
    if (existing) {
      if (!hasFriendsStatusColumn || existing.status === 'accepted') {
        return res.status(400).json({ error: 'You are already friends' });
      }
      return res.status(400).json({ error: 'Relationship already exists' });
    }

    const insertObj = hasFriendsStatusColumn
      ? { user_id: user.id, friend_id: friendId, status: 'pending' }
      : { user_id: user.id, friend_id: friendId };

    const { error } = await supabaseAdmin
      .from('friends')
      .insert(insertObj);
    
    if (error) throw error;
    res.json({ success: true });
  } catch (err: any) {
    console.error('Friend request failed:', err);
    res.status(500).json({ error: err.message || 'Friend request failed' });
  }
});

app.post('/api/friends/accept/:requestId', async (req, res) => {
  const user = await getAuthenticatedUser(req, res);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  if (!hasFriendsStatusColumn) {
    // If friends table doesn't support status, friendship is implicitly active immediately
    return res.json({ success: true });
  }

  try {
    // Robustly find friendship row and verify either user is part of it before accepting
    const { data: friendship, error: findError } = await supabaseAdmin
      .from('friends')
      .select('id, user_id, friend_id')
      .eq('id', req.params.requestId)
      .maybeSingle();

    if (findError) throw findError;
    if (!friendship) return res.status(404).json({ error: 'Friend request not found' });

    // Allow user to accept as long as they are part of the transaction
    if (friendship.friend_id !== user.id && friendship.user_id !== user.id) {
      return res.status(403).json({ error: 'Unauthorized to respond to this request' });
    }

    const { error } = await supabaseAdmin
      .from('friends')
      .update({ status: 'accepted' })
      .eq('id', req.params.requestId);
    
    if (error) throw error;
    res.json({ success: true });
  } catch (err: any) {
    console.error('[FRIENDS] Accept failed:', err);
    res.status(500).json({ error: 'Accept failed', message: err.message });
  }
});

app.post('/api/friends/decline/:requestId', async (req, res) => {
  const user = await getAuthenticatedUser(req, res);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  try {
    // Robustly find friendship row and verify user belongs to it
    const { data: friendship, error: findError } = await supabaseAdmin
      .from('friends')
      .select('id, user_id, friend_id')
      .eq('id', req.params.requestId)
      .maybeSingle();

    if (findError) throw findError;
    if (!friendship) return res.status(404).json({ error: 'Friend request not found' });

    if (friendship.friend_id !== user.id && friendship.user_id !== user.id) {
      return res.status(403).json({ error: 'Unauthorized to decline this request' });
    }

    const { error } = await supabaseAdmin
      .from('friends')
      .delete()
      .eq('id', req.params.requestId);
    
    if (error) throw error;
    res.json({ success: true });
  } catch (err: any) {
    console.error('[FRIENDS] Decline failed:', err);
    res.status(500).json({ error: 'Decline failed', message: err.message });
  }
});

app.get('/api/friends/list', async (req, res) => {
  const user = await getAuthenticatedUser(req, res);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  try {
    const fields = hasFriendsStatusColumn 
      ? 'id, status, created_at, friend_id, user_id'
      : 'id, created_at, friend_id, user_id';

    // 1. Fetch raw relationships without relying on PostgREST joins (resilient to missing foreign constraints)
    const { data: friendships, error: friendsError } = await (supabaseAdmin
      .from('friends')
      .select(fields) as any)
      .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`);
    
    if (friendsError) throw friendsError;

    const rawFriendships = (friendships || []) as any[];

    // Filter into initiated (outgoing) vs received (incoming) from current user's perspective
    const initiatedList = rawFriendships.filter(f => f.user_id === user.id);
    const receivedList = rawFriendships.filter(f => f.friend_id === user.id);

    // Collect all involved friend IDs to fetch their profiles efficiently in a single roundtrip
    const friendIds = [
      ...initiatedList.map(f => f.friend_id),
      ...receivedList.map(f => f.user_id)
    ];

    const profilesMap = new Map();
    if (friendIds.length > 0) {
      const { data: profiles, error: profilesError } = await supabaseAdmin
        .from('profiles')
        .select('id, username, full_name, avatar_url')
        .in('id', friendIds);
      
      if (!profilesError && profiles) {
        profiles.forEach(p => {
          profilesMap.set(p.id, p);
        });
      }
    }

    const friendsList = [
      ...initiatedList.map(f => ({
        id: f.id,
        user_id: f.user_id,
        friend_id: f.friend_id,
        created_at: f.created_at,
        status: hasFriendsStatusColumn ? f.status : 'accepted',
        friend: profilesMap.get(f.friend_id) || {
          id: f.friend_id,
          username: 'user',
          full_name: 'Zettl Friend',
          avatar_url: `https://api.dicebear.com/7.x/lorelei/svg?seed=${f.friend_id}`
        },
        type: 'outgoing'
      })),
      ...receivedList.map(f => ({
        id: f.id,
        user_id: f.user_id,
        friend_id: f.user_id, // Map friend_id as the sender's user_id so storefront has correct reference
        created_at: f.created_at,
        status: hasFriendsStatusColumn ? f.status : 'accepted',
        friend: profilesMap.get(f.user_id) || {
          id: f.user_id,
          username: 'user',
          full_name: 'Zettl Friend',
          avatar_url: `https://api.dicebear.com/7.x/lorelei/svg?seed=${f.user_id}`
        },
        type: 'incoming'
      }))
    ];

    res.json(friendsList);
  } catch (err: any) {
    console.error('[FRIENDS] Custom retrieval failed:', err);
    res.status(500).json({ error: 'Fetch friends failed', message: err.message });
  }
});

// 2. Personal Zettl
app.post('/api/zettl/personal', async (req, res) => {
  const user = await getAuthenticatedUser(req, res);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  const { friendId, amount, note, dueDate, direction } = req.body;
  // direction: 'lent' (friend owes me) or 'borrowed' (I owe friend)
  
  if (!friendId || !amount) return res.status(400).json({ error: 'Missing required fields' });

  const txType = direction === 'lent' ? 'you_owe_me' : 'owe_you';

  if (useZettlFallback) {
    try {
      const db = readLocalZettlDB();
      const newTransaction = {
        id: 'fallback-' + Math.random().toString(36).substring(2, 15) + '-' + Date.now(),
        sender_id: user.id,
        receiver_id: friendId,
        amount: parseInt(amount, 10),
        type: txType,
        message_text: note || '',
        deadline: dueDate || null,
        is_settled: false,
        settled_at: null,
        created_at: new Date().toISOString()
      };
      if (!db.zettl_transactions) db.zettl_transactions = [];
      db.zettl_transactions.push(newTransaction);
      writeLocalZettlDB(db);

      // Map back to format the store expects
      const responseObj = {
        id: newTransaction.id,
        from_user_id: direction === 'lent' ? friendId : user.id,
        to_user_id: direction === 'lent' ? user.id : friendId,
        amount: newTransaction.amount,
        note: newTransaction.message_text,
        due_date: newTransaction.deadline,
        currency: 'INR',
        is_settled: false,
        settled_at: null,
        created_at: newTransaction.created_at
      };
      return res.json(responseObj);
    } catch (err: any) {
      console.error('[LOCAL DB] Personal creation failed:', err);
      return res.status(500).json({ error: 'Creation failed' });
    }
  }

  try {
    const { data: record, error } = await supabaseAdmin
      .from('zettl_transactions')
      .insert({
        sender_id: user.id,
        receiver_id: friendId,
        amount,
        type: txType,
        message_text: note,
        deadline: dueDate || null,
        is_settled: false
      })
      .select()
      .maybeSingle();
    
    if (error) throw error;

    // Map back to format the store expects
    const responseObj = {
      id: record.id,
      from_user_id: direction === 'lent' ? friendId : user.id,
      to_user_id: direction === 'lent' ? user.id : friendId,
      amount: record.amount,
      note: record.message_text,
      due_date: record.deadline,
      currency: 'INR',
      is_settled: record.is_settled,
      settled_at: record.settled_at,
      created_at: record.created_at
    };
    res.json(responseObj);
  } catch (err: any) {
    console.error('[SERVER] Personal transaction creation failed:', err);
    res.status(500).json({ error: 'Creation failed' });
  }
});

app.get('/api/zettl/personal/list', async (req, res) => {
  const user = await getAuthenticatedUser(req, res);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  if (useZettlFallback) {
    try {
      const db = readLocalZettlDB();
      const rawTx = (db.zettl_transactions || []).filter(
        (z: any) => (z.sender_id === user.id || z.receiver_id === user.id) && z.amount > 0
      );

      rawTx.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      if (rawTx.length === 0) {
        return res.json([]);
      }

      const userIds = Array.from(new Set([
        ...rawTx.map((z: any) => z.sender_id),
        ...rawTx.map((z: any) => z.receiver_id)
      ])).filter(Boolean);

      const { data: profiles, error: profilesError } = await supabaseAdmin
        .from('profiles')
        .select('id, username, full_name, avatar_url')
        .in('id', userIds);

      if (profilesError) throw profilesError;

      const profileMap = new Map(profiles?.map((p: any) => [p.id, p]) || []);

      const mappedZettls = rawTx.map((z: any) => {
        const fromUserId = z.type === 'owe_you' ? z.sender_id : z.receiver_id;
        const toUserId = z.type === 'owe_you' ? z.receiver_id : z.sender_id;
        return {
          id: z.id,
          from_user_id: fromUserId,
          to_user_id: toUserId,
          amount: z.amount,
          note: z.message_text,
          due_date: z.deadline,
          currency: 'INR',
          is_settled: z.is_settled,
          settled_at: z.settled_at,
          created_at: z.created_at,
          from_profile: profileMap.get(fromUserId) || { username: 'Unknown', full_name: 'Unknown User', avatar_url: '' },
          to_profile: profileMap.get(toUserId) || { username: 'Unknown', full_name: 'Unknown User', avatar_url: '' }
        };
      });

      return res.json(mappedZettls);
    } catch (err: any) {
      console.error('[LOCAL DB] Retrieve personal list failed:', err);
      return res.status(500).json({ error: 'Fetch failed', message: err.message });
    }
  }

  try {
    const { data: rawTx, error: rawError } = await supabaseAdmin
      .from('zettl_transactions')
      .select('*')
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .gt('amount', 0)
      .order('created_at', { ascending: false });
      
    if (rawError) throw rawError;
    if (!rawTx || rawTx.length === 0) {
      return res.json([]);
    }
    
    const userIds = Array.from(new Set([
      ...rawTx.map((z: any) => z.sender_id),
      ...rawTx.map((z: any) => z.receiver_id)
    ])).filter(Boolean);
    
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select('id, username, full_name, avatar_url')
      .in('id', userIds);
      
    if (profilesError) throw profilesError;
    
    const profileMap = new Map(profiles?.map((p: any) => [p.id, p]) || []);
    
    const mappedZettls = rawTx.map((z: any) => {
      const fromUserId = z.type === 'owe_you' ? z.sender_id : z.receiver_id;
      const toUserId = z.type === 'owe_you' ? z.receiver_id : z.sender_id;
      return {
        id: z.id,
        from_user_id: fromUserId,
        to_user_id: toUserId,
        amount: z.amount,
        note: z.message_text,
        due_date: z.deadline,
        currency: 'INR',
        is_settled: z.is_settled,
        settled_at: z.settled_at,
        created_at: z.created_at,
        from_profile: profileMap.get(fromUserId) || { username: 'Unknown', full_name: 'Unknown User', avatar_url: '' },
        to_profile: profileMap.get(toUserId) || { username: 'Unknown', full_name: 'Unknown User', avatar_url: '' }
      };
    });
    
    res.json(mappedZettls);
  } catch (err: any) {
    console.error('[SERVER] Retrieve personal list failed:', err);
    res.status(500).json({ error: 'Fetch failed', message: err.message });
  }
});

app.get('/api/zettl/personal/balance/:friendId', async (req, res) => {
  const user = await getAuthenticatedUser(req, res);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  const friendId = req.params.friendId;

  if (useZettlFallback) {
    try {
      const db = readLocalZettlDB();
      const rawTx = (db.zettl_transactions || []).filter(
        (z: any) => ((z.sender_id === user.id && z.receiver_id === friendId) || 
                     (z.sender_id === friendId && z.receiver_id === user.id)) && 
                     z.amount > 0 && !z.is_settled
      );

      let totalOwedToMe = 0;
      let totalIOwe = 0;

      rawTx.forEach((z: any) => {
        if (z.sender_id === user.id) {
          if (z.type === 'you_owe_me') totalOwedToMe += z.amount;
          if (z.type === 'owe_you') totalIOwe += z.amount;
        } else if (z.sender_id === friendId) {
          if (z.type === 'you_owe_me') totalIOwe += z.amount;
          if (z.type === 'owe_you') totalOwedToMe += z.amount;
        }
      });

      const net = totalOwedToMe - totalIOwe;

      return res.json({
        owed_to_me: totalOwedToMe,
        i_owe: totalIOwe,
        net,
        friend_id: friendId
      });
    } catch (err) {
      console.error('[LOCAL DB] Balance check failed:', err);
      return res.status(500).json({ error: 'Balance check failed' });
    }
  }

  try {
    const { data: rawTx, error } = await supabaseAdmin
      .from('zettl_transactions')
      .select('amount, sender_id, receiver_id, type')
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .eq('is_settled', false)
      .gt('amount', 0);
    
    if (error) throw error;

    let totalOwedToMe = 0;
    let totalIOwe = 0;

    (rawTx || []).forEach((z: any) => {
      // Ensure we only look at transactions involving the friend
      if (z.sender_id === friendId || z.receiver_id === friendId) {
        if (z.sender_id === user.id) {
          if (z.type === 'you_owe_me') totalOwedToMe += Number(z.amount);
          if (z.type === 'owe_you') totalIOwe += Number(z.amount);
        } else if (z.sender_id === friendId) {
          if (z.type === 'you_owe_me') totalIOwe += Number(z.amount);
          if (z.type === 'owe_you') totalOwedToMe += Number(z.amount);
        }
      }
    });

    const net = totalOwedToMe - totalIOwe;

    res.json({
      owed_to_me: totalOwedToMe,
      i_owe: totalIOwe,
      net,
      friend_id: friendId
    });
  } catch (err: any) {
    console.error('[SERVER] Balance check failed:', err);
    res.status(500).json({ error: 'Balance check failed' });
  }
});

app.post('/api/zettl/personal/:zettlId/remind', async (req, res) => {
  const user = await getAuthenticatedUser(req, res);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  if (useZettlFallback) {
    try {
      const db = readLocalZettlDB();
      const zettlIndex = (db.zettl_transactions || []).findIndex((z: any) => z.id === req.params.zettlId);
      if (zettlIndex === -1) return res.status(404).json({ error: 'Zettl not found' });
      const zettl = db.zettl_transactions[zettlIndex];
      const creditorId = zettl.type === 'owe_you' ? zettl.receiver_id : zettl.sender_id;
      if (creditorId !== user.id) return res.status(403).json({ error: 'Only the payee can remind' });

      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);

      if (zettl.reminder_last_sent_at && new Date(zettl.reminder_last_sent_at) > oneDayAgo) {
        return res.status(429).json({ error: 'Reminder sent recently. Please wait 24 hours.' });
      }
      if (zettl.reminder_count >= 10) {
        return res.status(400).json({ error: 'Maximum reminders reached for this Zettl' });
      }

      db.zettl_transactions[zettlIndex] = {
        ...zettl,
        reminder_last_sent_at: new Date().toISOString(),
        reminder_count: (zettl.reminder_count || 0) + 1
      };
      
      writeLocalZettlDB(db);
      return res.json({ success: true, message: 'Reminder sent!' });
    } catch (err) {
      console.error('[LOCAL DB] Reminder failed:', err);
      return res.status(500).json({ error: 'Reminder failed' });
    }
  }

  try {
    const { data: zettl } = await supabaseAdmin
      .from('zettl_transactions')
      .select('*')
      .eq('id', req.params.zettlId)
      .maybeSingle();

    if (!zettl) return res.status(404).json({ error: 'Zettl not found' });
    const creditorId = zettl.type === 'owe_you' ? zettl.receiver_id : zettl.sender_id;
    const debtorId = zettl.type === 'owe_you' ? zettl.sender_id : zettl.receiver_id;
    if (creditorId !== user.id) return res.status(403).json({ error: 'Only the payee can remind' });

    try {
      await supabaseAdmin.from('notifications').insert({
        user_id: debtorId,
        type: 'reminder',
        title: '🔔 Zettl Reminder',
        body: `Friendly reminder about ₹${zettl.amount} for "${zettl.message_text}".`,
        data: JSON.stringify({ debtId: zettl.id, amount: zettl.amount, note: zettl.message_text }),
        read: false
      });
    } catch (notifErr) {
      console.warn('[SERVER] Non-blocking reminder notification failed:', notifErr);
    }

    res.json({ success: true, message: 'Reminder sent!' });
  } catch (err) {
    res.status(500).json({ error: 'Reminder failed' });
  }
});

app.put('/api/zettl/personal/:zettlId/settle', async (req, res) => {
  const user = await getAuthenticatedUser(req, res);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  if (useZettlFallback) {
    try {
      const db = readLocalZettlDB();
      const zettlIndex = (db.zettl_transactions || []).findIndex(
        (z: any) => z.id === req.params.zettlId && (z.sender_id === user.id || z.receiver_id === user.id)
      );
      if (zettlIndex === -1) return res.status(404).json({ error: 'Zettl not found or unauthorized' });

      db.zettl_transactions[zettlIndex] = {
        ...db.zettl_transactions[zettlIndex],
        is_settled: true,
        settled_at: new Date().toISOString()
      };

      writeLocalZettlDB(db);
      return res.json({ success: true });
    } catch (err) {
      console.error('[LOCAL DB] Settlement failed:', err);
      return res.status(500).json({ error: 'Settlement failed' });
    }
  }

  try {
    const { error } = await supabaseAdmin
      .from('zettl_transactions')
      .update({ is_settled: true, settled_at: new Date().toISOString() })
      .eq('id', req.params.zettlId)
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`);
    
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Settlement failed' });
  }
});

app.delete('/api/zettl/personal/:zettlId', async (req, res) => {
  const user = await getAuthenticatedUser(req, res);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  if (useZettlFallback) {
    try {
      const db = readLocalZettlDB();
      const zettlIndex = (db.zettl_transactions || []).findIndex(
        (z: any) => z.id === req.params.zettlId && (z.sender_id === user.id || z.receiver_id === user.id)
      );
      if (zettlIndex === -1) return res.status(404).json({ error: 'Not found' });
      const zettl = db.zettl_transactions[zettlIndex];
      if (zettl.is_settled) return res.status(400).json({ error: 'Cannot delete settled Zettl' });

      db.zettl_transactions.splice(zettlIndex, 1);
      writeLocalZettlDB(db);
      return res.json({ success: true });
    } catch (err) {
      console.error('[LOCAL DB] Deletions failed:', err);
      return res.status(500).json({ error: 'Deletions failed' });
    }
  }

  try {
    const { data: zettl } = await supabaseAdmin
      .from('zettl_transactions')
      .select('is_settled, sender_id, receiver_id')
      .eq('id', req.params.zettlId)
      .maybeSingle();

    if (!zettl) return res.status(404).json({ error: 'Not found' });
    if (zettl.is_settled) return res.status(400).json({ error: 'Cannot delete settled Zettl' });
    
    const { error } = await supabaseAdmin
      .from('zettl_transactions')
      .delete()
      .eq('id', req.params.zettlId)
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`);
    
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Deletions failed' });
  }
});

// 3. Groups
app.post('/api/zettl/groups', async (req, res) => {
  const user = await getAuthenticatedUser(req, res);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  const { name, avatarUrl, memberIds } = req.body;
  if (!name) return res.status(400).json({ error: 'Group name required' });

  if (useZettlFallback) {
    try {
      const db = readLocalZettlDB();
      const newGroup = {
        id: 'group-' + Math.random().toString(36).substring(2, 15) + '-' + Date.now(),
        name,
        avatar_url: avatarUrl || null,
        created_by_user_id: user.id,
        created_at: new Date().toISOString()
      };
      db.zettl_groups.push(newGroup);

      const uniqueIds = [...new Set([user.id, ...(memberIds || [])])];
      uniqueIds.forEach(mId => {
        db.zettl_group_members.push({
          id: 'member-' + Math.random().toString(36).substring(2, 15) + '-' + Date.now(),
          group_id: newGroup.id,
          user_id: mId,
          joined_at: new Date().toISOString()
        });
      });

      writeLocalZettlDB(db);
      return res.json(newGroup);
    } catch (err) {
      console.error('[LOCAL DB] Group creation failed:', err);
      return res.status(500).json({ error: 'Group creation failed' });
    }
  }

  try {
    const { data: group, error } = await supabaseAdmin
      .from('zettl_groups')
      .insert({ name, avatar_url: avatarUrl, created_by_user_id: user.id })
      .select()
      .maybeSingle();
    
    if (error) throw error;

    // Add creator and requested members
    const uniqueIds = [...new Set([user.id, ...(memberIds || [])])];
    const members = uniqueIds.map(mId => ({
      group_id: group.id,
      user_id: mId
    }));

    await supabaseAdmin.from('zettl_group_members').insert(members);
    
    res.json(group);
  } catch (err) {
    res.status(500).json({ error: 'Group creation failed' });
  }
});

app.get('/api/zettl/groups/my', async (req, res) => {
  const user = await getAuthenticatedUser(req, res);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  if (useZettlFallback) {
    try {
      const db = readLocalZettlDB();
      // Find my memberships
      const myMemberships = db.zettl_group_members.filter((m: any) => m.user_id === user.id);
      const groupIds = myMemberships.map((m: any) => m.group_id);

      const rawGroups = db.zettl_groups.filter((g: any) => groupIds.includes(g.id));

      // Resolve profiles for all members in these groups
      const allMembers = db.zettl_group_members.filter((m: any) => groupIds.includes(m.group_id));
      const memberUserIds = Array.from(new Set(allMembers.map((m: any) => m.user_id))).filter(Boolean);

      let profileMap = new Map();
      if (memberUserIds.length > 0) {
        const { data: profiles } = await supabaseAdmin
          .from('profiles')
          .select('id, username, full_name, avatar_url')
          .in('id', memberUserIds);
        profileMap = new Map(profiles?.map((p: any) => [p.id, p]) || []);
      }

      const enrichedGroups = rawGroups.map((g: any) => {
        const groupMembers = allMembers
          .filter((m: any) => m.group_id === g.id)
          .map((m: any) => ({
            id: m.id,
            user_id: m.user_id,
            joined_at: m.joined_at,
            profiles: profileMap.get(m.user_id) || { username: 'Unknown', full_name: 'Unknown User', avatar_url: '' }
          }));
        return {
          ...g,
          members: groupMembers
        };
      });

      return res.json(enrichedGroups);
    } catch (err: any) {
      console.error('[LOCAL DB] Fetch groups failed:', err);
      return res.status(500).json({ error: 'Fetch groups failed' });
    }
  }

  try {
    // Find group IDs where I'm a member
    const { data: memberOf } = await supabaseAdmin
      .from('zettl_group_members')
      .select('group_id')
      .eq('user_id', user.id);
    
    if (!memberOf || memberOf.length === 0) return res.json([]);

    const groupIds = memberOf.map(m => m.group_id);

    const { data: groups } = await supabaseAdmin
      .from('zettl_groups')
      .select(`
        *,
        members:zettl_group_members(
          id, user_id, joined_at,
          profiles(username, full_name, avatar_url)
        )
      `)
      .in('id', groupIds);
    
    res.json(groups || []);
  } catch (err) {
    res.status(500).json({ error: 'Fetch groups failed' });
  }
});

app.post('/api/zettl/groups/:groupId/members', async (req, res) => {
  const user = await getAuthenticatedUser(req, res);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  const { memberIds } = req.body;
  if (!Array.isArray(memberIds)) return res.status(400).json({ error: 'memberIds array required' });

  if (useZettlFallback) {
    try {
      const db = readLocalZettlDB();
      memberIds.forEach((mId: string) => {
        const exists = db.zettl_group_members.some(
          (m: any) => m.group_id === req.params.groupId && m.user_id === mId
        );
        if (!exists) {
          db.zettl_group_members.push({
            id: 'member-' + Math.random().toString(36).substring(2, 15) + '-' + Date.now(),
            group_id: req.params.groupId,
            user_id: mId,
            joined_at: new Date().toISOString()
          });
        }
      });
      writeLocalZettlDB(db);
      return res.json({ success: true });
    } catch (err) {
      console.error('[LOCAL DB] Adding members failed:', err);
      return res.status(500).json({ error: 'Adding members failed' });
    }
  }

  try {
    const members = memberIds.map(mId => ({
      group_id: req.params.groupId,
      user_id: mId
    }));

    const { error } = await supabaseAdmin.from('zettl_group_members').insert(members);
    if (error && error.code !== '23505') throw error; // Ignore duplicates
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Adding members failed' });
  }
});

app.get('/api/zettl/groups/:groupId/summary', async (req, res) => {
  const user = await getAuthenticatedUser(req, res);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  if (useZettlFallback) {
    try {
      const db = readLocalZettlDB();
      const expenses = db.zettl_group_expenses.filter((e: any) => e.group_id === req.params.groupId);
      const expenseIds = expenses.map((e: any) => e.id);
      const splits = db.zettl_expense_splits.filter((s: any) => expenseIds.includes(s.expense_id));

      const balances: Record<string, number> = {};

      expenses.forEach((e: any) => {
        balances[e.paid_by_user_id] = (balances[e.paid_by_user_id] || 0) + e.total_amount;
      });

      splits.forEach((s: any) => {
        balances[s.user_id] = (balances[s.user_id] || 0) - s.amount_owed;
      });

      return res.json({ balances });
    } catch (err) {
      console.error('[LOCAL DB] Summary failed:', err);
      return res.status(500).json({ error: 'Summary failed' });
    }
  }

  try {
    // Get total paid vs total owed per member
    const { data: expenses } = await supabaseAdmin
      .from('zettl_group_expenses')
      .select('id, paid_by_user_id, total_amount')
      .eq('group_id', req.params.groupId);

    const { data: splits } = await supabaseAdmin
      .from('zettl_expense_splits')
      .select('expense_id, user_id, amount_owed, is_settled')
      .in('expense_id', (expenses || []).map(e => e.id));

    // Simple summary calculation
    const balances: Record<string, number> = {};
    
    expenses?.forEach(e => {
      balances[e.paid_by_user_id] = (balances[e.paid_by_user_id] || 0) + e.total_amount;
    });

    splits?.forEach(s => {
      balances[s.user_id] = (balances[s.user_id] || 0) - s.amount_owed;
    });

    res.json({ balances });
  } catch (err) {
    res.status(500).json({ error: 'Summary failed' });
  }
});

// 4. Group Zettl (expenses)
app.post('/api/zettl/groups/:groupId/expense', async (req, res) => {
  const user = await getAuthenticatedUser(req, res);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  const { amount, description, splits } = req.body;
  // splits: Array of { userId, amountOwed }

  if (useZettlFallback) {
    try {
      const db = readLocalZettlDB();
      const newExpense = {
        id: 'expense-' + Math.random().toString(36).substring(2, 15) + '-' + Date.now(),
        group_id: req.params.groupId,
        paid_by_user_id: user.id,
        total_amount: parseInt(amount, 10),
        description: description || '',
        created_at: new Date().toISOString()
      };
      db.zettl_group_expenses.push(newExpense);

      splits.forEach((s: any) => {
        db.zettl_expense_splits.push({
          id: 'split-' + Math.random().toString(36).substring(2, 15) + '-' + Date.now(),
          expense_id: newExpense.id,
          user_id: s.userId,
          amount_owed: parseInt(s.amountOwed, 10),
          is_settled: false,
          settled_at: null
        });
      });

      writeLocalZettlDB(db);
      return res.json(newExpense);
    } catch (err) {
      console.error('[LOCAL DB] Expense creation failed:', err);
      return res.status(500).json({ error: 'Expense creation failed' });
    }
  }

  try {
    const { data: expense, error } = await supabaseAdmin
      .from('zettl_group_expenses')
      .insert({
        group_id: req.params.groupId,
        paid_by_user_id: user.id,
        total_amount: amount,
        description
      })
      .select()
      .maybeSingle();
    
    if (error) throw error;

    const splitData = splits.map((s: any) => ({
      expense_id: expense.id,
      user_id: s.userId,
      amount_owed: s.amountOwed
    }));

    await supabaseAdmin.from('zettl_expense_splits').insert(splitData);
    
    res.json(expense);
  } catch (err) {
    res.status(500).json({ error: 'Expense creation failed' });
  }
});

app.get('/api/zettl/groups/:groupId/expenses', async (req, res) => {
  const user = await getAuthenticatedUser(req, res);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  if (useZettlFallback) {
    try {
      const db = readLocalZettlDB();
      const rawExpenses = db.zettl_group_expenses.filter((e: any) => e.group_id === req.params.groupId);
      rawExpenses.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      if (rawExpenses.length === 0) {
        return res.json([]);
      }

      const expenseIds = rawExpenses.map((re: any) => re.id);
      const paidByUids = rawExpenses.map((re: any) => re.paid_by_user_id).filter(Boolean);
      const rawSplits = db.zettl_expense_splits.filter((s: any) => expenseIds.includes(s.expense_id));

      const allUserIds = Array.from(new Set([
        ...paidByUids,
        ...rawSplits.map((s: any) => s.user_id)
      ])).filter(Boolean);

      let profileMap = new Map();
      if (allUserIds.length > 0) {
        const { data: profiles } = await supabaseAdmin
          .from('profiles')
          .select('id, username, full_name, avatar_url')
          .in('id', allUserIds);
        profileMap = new Map(profiles?.map((p: any) => [p.id, p]) || []);
      }

      const formattedSplits = rawSplits.map((s: any) => ({
        id: s.id,
        expense_id: s.expense_id,
        user_id: s.user_id,
        amount_owed: s.amount_owed,
        is_settled: s.is_settled,
        settled_at: s.settled_at,
        user_profile: profileMap.get(s.user_id) || { username: 'Unknown', full_name: 'Unknown User', avatar_url: '' }
      }));

      const enrichedExpenses = rawExpenses.map((e: any) => ({
        ...e,
        paid_by_profile: profileMap.get(e.paid_by_user_id) || { username: 'Unknown', full_name: 'Unknown User', avatar_url: '' },
        splits: formattedSplits.filter((s: any) => s.expense_id === e.id)
      }));

      return res.json(enrichedExpenses);
    } catch (err) {
      console.error('[LOCAL DB] Retrieve group expenses failed:', err);
      return res.status(500).json({ error: 'Fetch expenses failed' });
    }
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('zettl_group_expenses')
      .select(`
        *,
        paid_by_profile:profiles!zettl_group_expenses_paid_by_user_id_fkey(username, full_name, avatar_url),
        splits:zettl_expense_splits(
          id, user_id, amount_owed, is_settled, settled_at,
          user_profile:profiles(username, full_name, avatar_url)
        )
      `)
      .eq('group_id', req.params.groupId)
      .order('created_at', { ascending: false });
    
    if (!error) {
      return res.json(data || []);
    }
    
    console.warn('[SERVER] Direct group expenses query failed, falling back to manual profiles join:', error.message);
    
    const { data: rawExpenses, error: expError } = await supabaseAdmin
      .from('zettl_group_expenses')
      .select('*')
      .eq('group_id', req.params.groupId)
      .order('created_at', { ascending: false });
      
    if (expError) throw expError;
    if (!rawExpenses || rawExpenses.length === 0) {
      return res.json([]);
    }
    
    const expenseIds = rawExpenses.map((re: any) => re.id);
    const paidByUids = rawExpenses.map((re: any) => re.paid_by_user_id).filter(Boolean);
    
    const { data: rawSplits, error: splitErr } = await supabaseAdmin
      .from('zettl_expense_splits')
      .select('*')
      .in('expense_id', expenseIds);
      
    if (splitErr) throw splitErr;
    
    const allUserIds = Array.from(new Set([
      ...paidByUids,
      ...(rawSplits?.map((s: any) => s.user_id) || [])
    ])).filter(Boolean);
    
    const { data: profiles, error: profErr } = await supabaseAdmin
      .from('profiles')
      .select('id, username, full_name, avatar_url')
      .in('id', allUserIds);
      
    if (profErr) throw profErr;
    const profileMap = new Map(profiles?.map((p: any) => [p.id, p]) || []);
    
    const formattedSplits = (rawSplits || []).map((s: any) => ({
      id: s.id,
      expense_id: s.expense_id,
      user_id: s.user_id,
      amount_owed: s.amount_owed,
      is_settled: s.is_settled,
      settled_at: s.settled_at,
      user_profile: profileMap.get(s.user_id) || { username: 'Unknown', full_name: 'Unknown User', avatar_url: '' }
    }));
    
    const enrichedExpenses = rawExpenses.map((e: any) => ({
      ...e,
      paid_by_profile: profileMap.get(e.paid_by_user_id) || { username: 'Unknown', full_name: 'Unknown User', avatar_url: '' },
      splits: formattedSplits.filter((s: any) => s.expense_id === e.id)
    }));
    
    res.json(enrichedExpenses);
  } catch (err: any) {
    console.error('[SERVER] Retrieve group expenses failed:', err);
    res.status(500).json({ error: 'Fetch expenses failed', message: err.message });
  }
});

app.post('/api/zettl/groups/expense/:expenseId/settle/:userId', async (req, res) => {
  const user = await getAuthenticatedUser(req, res);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  if (useZettlFallback) {
    try {
      const db = readLocalZettlDB();
      const splitIndex = db.zettl_expense_splits.findIndex(
        (s: any) => s.expense_id === req.params.expenseId && s.user_id === req.params.userId
      );
      if (splitIndex !== -1) {
        db.zettl_expense_splits[splitIndex].is_settled = true;
        db.zettl_expense_splits[splitIndex].settled_at = new Date().toISOString();
        writeLocalZettlDB(db);
      }
      return res.json({ success: true });
    } catch (err) {
      console.error('[LOCAL DB] Group settlement failed:', err);
      return res.status(500).json({ error: 'Group settlement failed' });
    }
  }

  try {
    const { error } = await supabaseAdmin
      .from('zettl_expense_splits')
      .update({ is_settled: true, settled_at: new Date().toISOString() })
      .eq('expense_id', req.params.expenseId)
      .eq('user_id', req.params.userId);
    
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Group settlement failed' });
  }
});

// 5. Dashboard
app.get('/api/zettl/dashboard', async (req, res) => {
  const user = await getAuthenticatedUser(req, res);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  if (useZettlFallback) {
    try {
      const db = readLocalZettlDB();

      // 1. Personal Debts
      const rawTx = (db.zettl_transactions || []).filter(
        (z: any) => (z.sender_id === user.id || z.receiver_id === user.id) && z.amount > 0 && !z.is_settled
      );

      let personalOwedToMe = 0;
      let personalIOwe = 0;

      rawTx.forEach((z: any) => {
        if (z.sender_id === user.id) {
          if (z.type === 'you_owe_me') personalOwedToMe += z.amount;
          if (z.type === 'owe_you') personalIOwe += z.amount;
        } else if (z.receiver_id === user.id) {
          if (z.type === 'you_owe_me') personalIOwe += z.amount;
          if (z.type === 'owe_you') personalOwedToMe += z.amount;
        }
      });

      // 2. Group Debts (Splits)
      const groupIOweData = db.zettl_expense_splits.filter(
        (s: any) => s.user_id === user.id && !s.is_settled
      );
      const groupIOwe = groupIOweData.reduce((acc, curr) => acc + curr.amount_owed, 0);

      const myExpenses = db.zettl_group_expenses.filter(
        (e: any) => e.paid_by_user_id === user.id
      );
      const myExpenseIds = myExpenses.map((e: any) => e.id);

      const columnCheckZettlDBFieldOwedToMeSplits = db.zettl_expense_splits.filter(
        (s: any) => myExpenseIds.includes(s.expense_id) && s.user_id !== user.id && !s.is_settled
      );
      const groupOwedToMe = columnCheckZettlDBFieldOwedToMeSplits.reduce((acc, curr) => acc + curr.amount_owed, 0);

      const totalOwedToMe = personalOwedToMe + groupOwedToMe;
      const totalIOwe = personalIOwe + groupIOwe;

      // Recent Activity
      const rawRecentTx = (db.zettl_transactions || []).filter(
        (z: any) => (z.sender_id === user.id || z.receiver_id === user.id) && z.amount > 0
      );
      rawRecentTx.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      const recentZettls = rawRecentTx.slice(0, 5);

      let recentActivity: any[] = [];
      if (recentZettls.length > 0) {
        const userIds = Array.from(new Set([
          ...recentZettls.map((z: any) => z.sender_id),
          ...recentZettls.map((z: any) => z.receiver_id)
        ])).filter(Boolean);

        const { data: profiles } = await supabaseAdmin
          .from('profiles')
          .select('id, username, full_name, avatar_url')
          .in('id', userIds);

        const profileMap = new Map(profiles?.map((p: any) => [p.id, p]) || []);
        recentActivity = recentZettls.map((z: any) => {
          const fromUserId = z.type === 'owe_you' ? z.sender_id : z.receiver_id;
          const toUserId = z.type === 'owe_you' ? z.receiver_id : z.sender_id;
          return {
            id: z.id,
            from_user_id: fromUserId,
            to_user_id: toUserId,
            amount: z.amount,
            note: z.message_text,
            due_date: z.deadline,
            currency: 'INR',
            is_settled: z.is_settled,
            settled_at: z.settled_at,
            created_at: z.created_at,
            from_profile: profileMap.get(fromUserId) || { username: 'Unknown', full_name: 'Unknown User', avatar_url: '' },
            to_profile: profileMap.get(toUserId) || { username: 'Unknown', full_name: 'Unknown User', avatar_url: '' }
          };
        });
      }

      return res.json({
        total_owed_to_me: totalOwedToMe,
        total_i_owe: totalIOwe,
        net: totalOwedToMe - totalIOwe,
        recent_activity: recentActivity
      });
    } catch (err) {
      console.error('[LOCAL DB] Dashboard aggregates failed:', err);
      return res.status(500).json({ error: 'Dashboard failed' });
    }
  }

  try {
    // 1. Personal Debts
    const { data: rawTx, error: txError } = await supabaseAdmin
      .from('zettl_transactions')
      .select('amount, sender_id, receiver_id, type')
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .eq('is_settled', false)
      .gt('amount', 0);
    
    if (txError) throw txError;

    let personalOwedToMe = 0;
    let personalIOwe = 0;

    (rawTx || []).forEach((z: any) => {
      if (z.sender_id === user.id) {
        if (z.type === 'you_owe_me') personalOwedToMe += Number(z.amount);
        if (z.type === 'owe_you') personalIOwe += Number(z.amount);
      } else if (z.receiver_id === user.id) {
        if (z.type === 'you_owe_me') personalIOwe += Number(z.amount);
        if (z.type === 'owe_you') personalOwedToMe += Number(z.amount);
      }
    });

    // 2. Group Debts (Splits)
    // Splits I owe (where user_id = me)
    const { data: groupIOweData } = await supabaseAdmin
      .from('zettl_expense_splits')
      .select('amount_owed')
      .eq('user_id', user.id)
      .eq('is_settled', false);
    
    const groupIOwe = (groupIOweData || []).reduce((acc, curr) => acc + curr.amount_owed, 0);

    // Splits owed to me (where expense was paid by me and split user_id != me)
    const { data: groupOwedToMeData } = await supabaseAdmin
      .from('zettl_group_expenses')
      .select('id')
      .eq('paid_by_user_id', user.id);
    
    const myExpenseIds = (groupOwedToMeData || []).map(e => e.id);
    const { data: owedToMeSplits } = await supabaseAdmin
      .from('zettl_expense_splits')
      .select('amount_owed')
      .in('expense_id', myExpenseIds)
      .neq('user_id', user.id)
      .eq('is_settled', false);

    const groupOwedToMe = (owedToMeSplits || []).reduce((acc, curr) => acc + curr.amount_owed, 0);

    const totalOwedToMe = personalOwedToMe + groupOwedToMe;
    const totalIOwe = personalIOwe + groupIOwe;

    // Recent Activity
    const { data: rawRecent, error: recentError } = await supabaseAdmin
      .from('zettl_transactions')
      .select('*')
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .gt('amount', 0)
      .order('created_at', { ascending: false })
      .limit(5);

    if (recentError) throw recentError;

    let recentPersonal = [];
    if (rawRecent && rawRecent.length > 0) {
      const userIds = Array.from(new Set([
        ...rawRecent.map((z: any) => z.sender_id),
        ...rawRecent.map((z: any) => z.receiver_id)
      ])).filter(Boolean);

      const { data: profiles } = await supabaseAdmin
        .from('profiles')
        .select('id, username, full_name, avatar_url')
        .in('id', userIds);

      const profileMap = new Map(profiles?.map((p: any) => [p.id, p]) || []);

      recentPersonal = rawRecent.map((z: any) => {
        const fromUserId = z.type === 'owe_you' ? z.sender_id : z.receiver_id;
        const toUserId = z.type === 'owe_you' ? z.receiver_id : z.sender_id;
        return {
          id: z.id,
          from_user_id: fromUserId,
          to_user_id: toUserId,
          amount: z.amount,
          note: z.message_text,
          due_date: z.deadline,
          currency: 'INR',
          is_settled: z.is_settled,
          settled_at: z.settled_at,
          created_at: z.created_at,
          from_profile: profileMap.get(fromUserId) || { username: 'Unknown', full_name: 'Unknown User', avatar_url: '' },
          to_profile: profileMap.get(toUserId) || { username: 'Unknown', full_name: 'Unknown User', avatar_url: '' }
        };
      });
    }

    res.json({
      total_owed_to_me: totalOwedToMe,
      total_i_owe: totalIOwe,
      net: totalOwedToMe - totalIOwe,
      recent_activity: recentPersonal
    });
  } catch (err: any) {
    console.error('[SERVER] Dashboard aggregations failed:', err);
    res.status(500).json({ error: 'Dashboard failed' });
  }
});

// 6. Reminder Settings
app.get('/api/zettl/settings/reminders', async (req, res) => {
  const user = await getAuthenticatedUser(req, res);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  try {
    const { data } = await supabaseAdmin
      .from('profiles')
      .select('preferences')
      .eq('id', user.id)
      .maybeSingle();
    
    res.json(data?.preferences?.reminders || { enabled: false, time: '20:00', frequency: 'daily' });
  } catch (err) {
    res.status(500).json({ error: 'Settings fetch failed' });
  }
});

app.put('/api/zettl/settings/reminders', async (req, res) => {
  const user = await getAuthenticatedUser(req, res);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  const { enabled, time, frequency } = req.body;

  try {
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('preferences')
      .eq('id', user.id)
      .maybeSingle();

    const newPrefs = {
      ...(profile?.preferences || {}),
      reminders: { enabled, time, frequency }
    };

    await supabaseAdmin
      .from('profiles')
      .update({ preferences: newPrefs })
      .eq('id', user.id);
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Settings update failed' });
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
