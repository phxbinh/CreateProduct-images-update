import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 1. Auth header
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : null;

  if (!token) {
    return res.status(401).json({ error: 'Missing token' });
  }

  // 2. Service role client
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // 3. Verify user
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  // 4. Check admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  // 5. Parse FormData
  const formData = await req.formData();
  const file = formData.get('file');
  const productId = formData.get('product_id');

  if (!file || !productId) {
    return res.status(400).json({ error: 'Missing file or product_id' });
  }

  const ext = file.name.split('.').pop().toLowerCase();
  const filePath = `products/${productId}.${ext}`;

  // 6. Upload (overwrite chắc chắn)
  const { error } = await supabase.storage
    .from('product-images')
    .upload(filePath, file, {
      upsert: true,
      contentType: file.type,
    });

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.json({ path: filePath });
}