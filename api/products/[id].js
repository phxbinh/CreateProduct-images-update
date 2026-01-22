
import { createClient } from '@supabase/supabase-js';

export default async function handler(
  req, res
) {
  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid product id' });
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

  if (!req.body || typeof req.body !== 'object') {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  /* ---------------- PAYLOAD ---------------- */
  const { expected_updated_at, data } = req.body;

  if (!expected_updated_at) {
    return res.status(400).json({
      error: 'expected_updated_at is required for optimistic lock',
    });
  }

  if (!data || typeof data !== 'object') {
    return res.status(400).json({ error: 'Missing update data' });
  }

  /* ---------------- CALL RPC ---------------- */
  const { error: rpcError } = await supabase.rpc(
    'admin_update_product',
    {
      payload: {
        product_id: id,
        expected_updated_at,
        data,
      },
    }
  );

  if (rpcError) {
    return res.status(409).json({
      error: rpcError.message,
    });
  }

  return res.json({ success: true });
}









