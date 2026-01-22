import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // 🔐 Auth + admin check
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Missing authorization header' });
  }

  const token = authHeader.replace('Bearer ', '');

  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser(token);

  if (
    authError ||
    !user ||
    user.app_metadata?.role !== 'admin'
  ) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  if (!req.body || typeof req.body !== 'object') {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  const { product, variants, attributes } = req.body;

  if (!product || !Array.isArray(variants) || variants.length === 0) {
    return res.status(400).json({ error: 'Invalid payload structure' });
  }

  const { data, error } = await supabase.rpc(
    'admin_create_product',
    {
      payload: {
        product,
        attributes: attributes ?? [],
        variants
      }
    }
  );

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  return res.status(200).json({
    success: true,
    product_id: data
  });
}