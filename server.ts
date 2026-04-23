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
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    let user = userData?.user;

    if ((userError || !user) && refreshToken && refreshToken !== 'undefined' && refreshToken !== 'null') {
      console.log('Token expired or invalid, attempting refresh using cookie...');
      try {
        const { data: refreshData, error: refreshError } = await supabaseAdmin.auth.refreshSession({ refresh_token: refreshToken });
        
        if (!refreshError && refreshData.session) {
          user = refreshData.user;
          // Update cookies with new session
          const session = refreshData.session;
          res.cookie('sb-access-token', session.access_token, {
            httpOnly: true,
            secure: true,
            sameSite: 'none',
            maxAge: session.expires_in * 1000
          });
          if (session.refresh_token) {
            res.cookie('sb-refresh-token', session.refresh_token, {
              httpOnly: true,
              secure: true,
              sameSite: 'none',
              maxAge: 60 * 60 * 24 * 7 * 1000
            });
          }
          // Attach the fresh tokens to the request object so handlers can access them
          (req as any).freshSession = session;
          return user;
        } else {
          console.warn('Refresh failed, clearing auth cookies:', refreshError?.message);
          res.clearCookie('sb-access-token', { path: '/', secure: true, sameSite: 'none' });
          res.clearCookie('sb-refresh-token', { path: '/', secure: true, sameSite: 'none' });
          return null;
        }
      } catch (refreshErr) {
        console.error('Refresh throw error:', refreshErr);
        res.clearCookie('sb-access-token', { path: '/', secure: true, sameSite: 'none' });
        res.clearCookie('sb-refresh-token', { path: '/', secure: true, sameSite: 'none' });
        return null;
      }
    }

    if (userError || !user) {
      res.clearCookie('sb-access-token', { path: '/', secure: true, sameSite: 'none' });
      return null;
    }
    
    return user;
  } catch (err) {
    console.error('Auth middleware catch error:', err);
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

// 2.2 Password Reset Request
app.post('/api/auth/reset-password-request', async (req, res) => {
  const { email: rawEmail } = req.body;
  if (!rawEmail) return res.status(400).json({ error: 'Email is required' });
  const email = rawEmail.trim().toLowerCase();

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

  // 0. Check if username is taken (3-20 chars, lowercase, numbers, underscore only)
  const usernameRegex = /^[a-z0-9_]{3,20}$/;
  if (!usernameRegex.test(username)) {
    return res.status(400).json({ error: 'Username must be 3-20 characters and contain only lowercase letters, numbers, and underscores.' });
  }

  const { data: existingUser } = await supabaseAdmin
    .from('user_profiles')
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
    onboarding_completed: false
  };

  console.log('Creating profile record for:', user.id);

  const { error: profileError } = await supabaseAdmin
    .from('user_profiles')
    .upsert(profileData);

  if (profileError) {
    console.error('Profile creation error:', profileError);
    if (profileError.code === '23505') return res.status(400).json({ error: 'Username already taken' });
    return res.status(400).json({ error: profileError.message || 'Failed to create profile' });
  }

  res.json({ success: true, message: 'Profile created successfully' });
  } catch (err: any) {
    console.error('Unhandled error in complete-profile:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// 4. Sign In (Email + Password)
app.post('/api/auth/signin', signinLimiter, async (req, res) => {
  const { email: rawEmail, password } = req.body;
  if (!rawEmail || !password) return res.status(400).json({ error: 'Email and password are required' });
  const email = rawEmail.trim().toLowerCase();

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
      .from('user_profiles')
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
      avatar: profile.avatar_url || `https://api.dicebear.com/7.x/lorelei/svg?seed=${profile.username}`,
      avatarId: profile.avatar_id || 1,
      streak: profile.streak || 0,
      onboardingCompleted: profile.onboarding_completed,
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
    const { data } = await supabaseAdmin
      .from('user_profiles')
      .select('id, username, full_name, avatar_url')
      .ilike('username', `%${query}%`)
      .neq('id', user.id)
      .limit(10);
    
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: 'Search failed' });
  }
});

app.post('/api/friends/request', async (req, res) => {
  const user = await getAuthenticatedUser(req, res);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  const { friendId } = req.body;
  if (!friendId) return res.status(400).json({ error: 'friendId is required' });

  try {
    const { error } = await supabaseAdmin
      .from('friends')
      .insert({ user_id: user.id, friend_id: friendId, status: 'pending' });
    
    if (error) {
      if (error.code === '23505') return res.status(400).json({ error: 'Relationship already exists' });
      throw error;
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Friend request failed' });
  }
});

app.post('/api/friends/accept/:requestId', async (req, res) => {
  const user = await getAuthenticatedUser(req, res);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  try {
    const { error } = await supabaseAdmin
      .from('friends')
      .update({ status: 'accepted' })
      .eq('id', req.params.requestId)
      .eq('friend_id', user.id); // Only the recipient can accept
    
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Accept failed' });
  }
});

app.post('/api/friends/decline/:requestId', async (req, res) => {
  const user = await getAuthenticatedUser(req, res);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  try {
    const { error } = await supabaseAdmin
      .from('friends')
      .delete()
      .eq('id', req.params.requestId)
      .eq('friend_id', user.id);
    
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Decline failed' });
  }
});

app.get('/api/friends/list', async (req, res) => {
  const user = await getAuthenticatedUser(req, res);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  try {
    // Relationships where I initiated
    const { data: initiated } = await supabaseAdmin
      .from('friends')
      .select(`
        id, status, created_at, friend_id,
        user_profiles!friends_friend_id_fkey(id, username, full_name, avatar_url)
      `)
      .eq('user_id', user.id);
    
    // Relationships where I am the recipient
    const { data: received } = await supabaseAdmin
      .from('friends')
      .select(`
        id, status, created_at, user_id,
        user_profiles!friends_user_id_fkey(id, username, full_name, avatar_url)
      `)
      .eq('friend_id', user.id);

    const friendsList = [
      ...(initiated || []).map(f => ({
        ...f,
        friend: (f as any).user_profiles,
        type: 'outgoing'
      })),
      ...(received || []).map(f => ({
        ...f,
        friend: (f as any).user_profiles,
        friend_id: f.user_id,
        type: 'incoming'
      }))
    ];

    res.json(friendsList);
  } catch (err) {
    res.status(500).json({ error: 'Fetch friends failed' });
  }
});

// 2. Personal Zettl
app.post('/api/zettl/personal', async (req, res) => {
  const user = await getAuthenticatedUser(req, res);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  const { friendId, amount, note, dueDate, direction } = req.body;
  // direction: 'lent' (friend owes me) or 'borrowed' (I owe friend)
  
  if (!friendId || !amount) return res.status(400).json({ error: 'Missing required fields' });

  const fromUserId = direction === 'lent' ? friendId : user.id;
  const toUserId = direction === 'lent' ? user.id : friendId;

  try {
    const { data, error } = await supabaseAdmin
      .from('personal_zettls')
      .insert({
        from_user_id: fromUserId,
        to_user_id: toUserId,
        amount,
        note,
        due_date: dueDate,
        currency: 'INR'
      })
      .select()
      .single();
    
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Creation failed' });
  }
});

app.get('/api/zettl/personal/list', async (req, res) => {
  const user = await getAuthenticatedUser(req, res);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  try {
    const { data, error } = await supabaseAdmin
      .from('personal_zettls')
      .select(`
        *,
        from_profile:user_profiles!personal_zettls_from_user_id_fkey(username, full_name, avatar_url),
        to_profile:user_profiles!personal_zettls_to_user_id_fkey(username, full_name, avatar_url)
      `)
      .or(`from_user_id.eq.${user.id},to_user_id.eq.${user.id}`)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: 'Fetch failed' });
  }
});

app.get('/api/zettl/personal/balance/:friendId', async (req, res) => {
  const user = await getAuthenticatedUser(req, res);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  const friendId = req.params.friendId;

  try {
    // Owed to me by this friend
    const { data: owedToMe } = await supabaseAdmin
      .from('personal_zettls')
      .select('amount')
      .eq('from_user_id', friendId)
      .eq('to_user_id', user.id)
      .eq('is_settled', false);

    // I owe to this friend
    const { data: iOwe } = await supabaseAdmin
      .from('personal_zettls')
      .select('amount')
      .eq('from_user_id', user.id)
      .eq('to_user_id', friendId)
      .eq('is_settled', false);

    const totalOwedToMe = (owedToMe || []).reduce((acc, curr) => acc + curr.amount, 0);
    const totalIOwe = (iOwe || []).reduce((acc, curr) => acc + curr.amount, 0);
    const net = totalOwedToMe - totalIOwe;

    res.json({
      owed_to_me: totalOwedToMe,
      i_owe: totalIOwe,
      net,
      friend_id: friendId
    });
  } catch (err) {
    res.status(500).json({ error: 'Balance check failed' });
  }
});

app.post('/api/zettl/personal/:zettlId/remind', async (req, res) => {
  const user = await getAuthenticatedUser(req, res);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  try {
    const { data: zettl } = await supabaseAdmin
      .from('personal_zettls')
      .select('*, from_user_id, to_user_id, reminder_last_sent_at, reminder_count')
      .eq('id', req.params.zettlId)
      .single();

    if (!zettl) return res.status(404).json({ error: 'Zettl not found' });
    if (zettl.to_user_id !== user.id) return res.status(403).json({ error: 'Only the payee can remind' });

    // Throttling: Max 1 every 24 hours, max 10 total
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    if (zettl.reminder_last_sent_at && new Date(zettl.reminder_last_sent_at) > oneDayAgo) {
      return res.status(429).json({ error: 'Reminder sent recently. Please wait 24 hours.' });
    }
    if (zettl.reminder_count >= 10) {
      return res.status(400).json({ error: 'Maximum reminders reached for this Zettl' });
    }

    await supabaseAdmin
      .from('personal_zettls')
      .update({ 
        reminder_last_sent_at: new Date().toISOString(),
        reminder_count: (zettl.reminder_count || 0) + 1
      })
      .eq('id', zettl.id);

    await supabaseAdmin
      .from('zettl_reminders_log')
      .insert({
        zettl_id: zettl.id,
        reminded_to_user_id: zettl.from_user_id,
        reminder_type: 'manual'
      });

    res.json({ success: true, message: 'Reminder sent!' });
  } catch (err) {
    res.status(500).json({ error: 'Reminder failed' });
  }
});

app.put('/api/zettl/personal/:zettlId/settle', async (req, res) => {
  const user = await getAuthenticatedUser(req, res);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  try {
    // Both parties can mark as settled or confirm? Let's say only payee can confirm standard settlement
    // or both for peer-to-peer trust
    const { error } = await supabaseAdmin
      .from('personal_zettls')
      .update({ is_settled: true, settled_at: new Date().toISOString() })
      .eq('id', req.params.zettlId)
      .or(`from_user_id.eq.${user.id},to_user_id.eq.${user.id}`);
    
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Settlement failed' });
  }
});

app.delete('/api/zettl/personal/:zettlId', async (req, res) => {
  const user = await getAuthenticatedUser(req, res);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  try {
    const { data: zettl } = await supabaseAdmin
      .from('personal_zettls')
      .select('is_settled, from_user_id, to_user_id')
      .eq('id', req.params.zettlId)
      .single();

    if (!zettl) return res.status(404).json({ error: 'Not found' });
    if (zettl.is_settled) return res.status(400).json({ error: 'Cannot delete settled Zettl' });
    
    const { error } = await supabaseAdmin
      .from('personal_zettls')
      .delete()
      .eq('id', req.params.zettlId)
      .or(`from_user_id.eq.${user.id},to_user_id.eq.${user.id}`);
    
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

  try {
    const { data: group, error } = await supabaseAdmin
      .from('zettl_groups')
      .insert({ name, avatar_url: avatarUrl, created_by_user_id: user.id })
      .select()
      .single();
    
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
          user_profiles(username, full_name, avatar_url)
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
      .single();
    
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

  try {
    const { data, error } = await supabaseAdmin
      .from('zettl_group_expenses')
      .select(`
        *,
        paid_by_profile:user_profiles!zettl_group_expenses_paid_by_user_id_fkey(username, full_name, avatar_url),
        splits:zettl_expense_splits(
          id, user_id, amount_owed, is_settled, settled_at,
          user_profile:user_profiles(username, full_name, avatar_url)
        )
      `)
      .eq('group_id', req.params.groupId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: 'Fetch expenses failed' });
  }
});

app.post('/api/zettl/groups/expense/:expenseId/settle/:userId', async (req, res) => {
  const user = await getAuthenticatedUser(req, res);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

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

  try {
    // 1. Personal Debts
    const { data: lent } = await supabaseAdmin
      .from('personal_zettls')
      .select('amount')
      .eq('to_user_id', user.id)
      .eq('is_settled', false);
    
    const { data: borrowed } = await supabaseAdmin
      .from('personal_zettls')
      .select('amount')
      .eq('from_user_id', user.id)
      .eq('is_settled', false);

    const personalOwedToMe = (lent || []).reduce((acc, curr) => acc + curr.amount, 0);
    const personalIOwe = (borrowed || []).reduce((acc, curr) => acc + curr.amount, 0);

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
    const { data: recentPersonal } = await supabaseAdmin
      .from('personal_zettls')
      .select(`
        *,
        from_profile:user_profiles!personal_zettls_from_user_id_fkey(username, full_name, avatar_url),
        to_profile:user_profiles!personal_zettls_to_user_id_fkey(username, full_name, avatar_url)
      `)
      .or(`from_user_id.eq.${user.id},to_user_id.eq.${user.id}`)
      .limit(5)
      .order('created_at', { ascending: false });

    res.json({
      total_owed_to_me: totalOwedToMe,
      total_i_owe: totalIOwe,
      net: totalOwedToMe - totalIOwe,
      recent_activity: recentPersonal || []
    });
  } catch (err) {
    res.status(500).json({ error: 'Dashboard failed' });
  }
});

// 6. Reminder Settings
app.get('/api/zettl/settings/reminders', async (req, res) => {
  const user = await getAuthenticatedUser(req, res);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  try {
    const { data } = await supabaseAdmin
      .from('user_profiles')
      .select('preferences')
      .eq('id', user.id)
      .single();
    
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
      .from('user_profiles')
      .select('preferences')
      .eq('id', user.id)
      .single();

    const newPrefs = {
      ...(profile?.preferences || {}),
      reminders: { enabled, time, frequency }
    };

    await supabaseAdmin
      .from('user_profiles')
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
