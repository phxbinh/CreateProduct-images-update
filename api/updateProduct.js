import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid product id' });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  /* ---------------- AUTH ---------------- */
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Missing Authorization header' });
  }

  const jwt = authHeader.replace('Bearer ', '');
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(jwt);

  if (authError || !user || user.app_metadata?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin only' });
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