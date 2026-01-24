import { createClient } from '@supabase/supabase-js';

export const runtime = 'edge';

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405 }
    );
  }

  // 1. Auth header
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : null;

  if (!token) {
    return new Response(
      JSON.stringify({ error: 'Missing token' }),
      { status: 401 }
    );
  }

  // 2. Service role client
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // 3. Verify user
  const { data: { user }, error: userError } =
    await supabase.auth.getUser(token);

  if (userError || !user) {
    return new Response(
      JSON.stringify({ error: 'Invalid token' }),
      { status: 401 }
    );
  }

  // 4. Check admin
  const { data: profile, error: profileError } =
    await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

  if (profileError || profile?.role !== 'admin') {
    return new Response(
      JSON.stringify({ error: 'Forbidden' }),
      { status: 403 }
    );
  }

  // 5. Parse FormData
  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  const productId = formData.get('product_id') as string | null;

  if (!file || !productId) {
    return new Response(
      JSON.stringify({ error: 'Missing file or product_id' }),
      { status: 400 }
    );
  }

  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const filePath = `products/${productId}.${ext}`;

  // 6. Upload (overwrite thật)
  const { error: uploadError } = await supabase.storage
    .from('product-images')
    .upload(filePath, file, {
      upsert: true,
      contentType: file.type,
    });

  if (uploadError) {
    return new Response(
      JSON.stringify({ error: uploadError.message }),
      { status: 500 }
    );
  }

  return new Response(
    JSON.stringify({ path: filePath }),
    { status: 200 }
  );
}