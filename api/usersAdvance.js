import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // =========================
  // 1. Lấy token
  // =========================
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : null;

  if (!token) {
    return res.status(401).json({ error: 'Missing access token' });
  }

  // =========================
  // 2. Service role client
  // =========================
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // =========================
  // 3. Verify token
  // =========================
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser(token);

  if (userError || !user) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  // =========================
  // 4. Check admin role
  // =========================
  const { data: profile, error: profileError } =
    await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

  if (profileError) {
    return res.status(500).json({ error: profileError.message });
  }

  if (profile.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  // =========================
  // 5. Admin action
  // =========================
  const { data: authUsers, error: authUsersError } =
    await supabase.auth.admin.listUsers();

  if (authUsersError) {
    return res.status(500).json({ error: authUsersError.message });
  }

  const { data: profiles } =
    await supabase
      .from('profiles')
      .select('id, role');

  const roleMap = Object.fromEntries(
    profiles.map(p => [p.id, p.role])
  );

  const users = authUsers.users.map(u => ({
    id: u.id,
    email: u.email,
    role: roleMap[u.id] || 'user',
    created_at: u.created_at
  }));

  return res.status(200).json(users);
}