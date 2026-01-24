/*
async function uploadProductThumbnail(productId, file) {
  const fileExt = file.name.split(".").pop();
  const filePath = `products/${productId}.${fileExt}`;

  const { error } = await supabase.storage
    .from("product-images")
    .upload(filePath, file, {
      upsert: true,
      contentType: file.type,
    });

  if (error) throw error;

  const { data } = supabase.storage
    .from("product-images")
    .getPublicUrl(filePath);

  return data.publicUrl;
}
*/

async function uploadProductThumbnail(productId, file) {
  const fileExt = file.name.split(".").pop().toLowerCase(); // lowercase cho an toàn
  const fileName = `${productId}.${fileExt}`; // ví dụ: 123.jpg
  const filePath = `products/${fileName}`;   // thuần path: products/123.jpg

  const { error } = await supabase.storage
    .from("product-images")
    .upload(filePath, file, {
      upsert: true,   //false           // cho phép overwrite thumbnail cũ
      contentType: file.type,    // giữ MIME type đúng (image/jpeg, image/webp...)
    });

  if (error) throw error;
  
  alert(filePath);

  // Trả về thuần path thay vì full URL
  return filePath;
}


async function uploadProductThumbnailViaApi(productId, file, session) {
  const form = new FormData();
  form.append('file', file);
  form.append('product_id', productId);

  const res = await fetch('/api/products/upload-product-thumbnail-api', {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
    body: form,
  });

  const json = await res.json();
  if (!res.ok) throw new Error(json.error);

  return json.path; // products/xxx.jpg
}



function AdminProductEditPage({ params }) {
    /*
  const { h } = window.App.VDOM;
  const { useState, useEffect } = window.App.Hooks;
    */
  const productId = params?.id;

  const [product, setProduct] = useState(null);
  const [form, setForm] = useState({});
  const [thumbnailFile, setThumbnailFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  /* =========================
     Load product
     ========================= */
  useEffect(() => {
    let mounted = true;

    async function load() {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("id", productId)
        .single();

      if (!mounted) return;

      if (error) {
        setError(error.message);
      } else {
        setProduct(data);
        setForm({
          name: data.name,
          slug: data.slug,
          description: data.description,
          short_description: data.short_description,
          status: data.status,
        });
      }
      setLoading(false);
    }

    load();
    return () => (mounted = false);
  }, [productId]);

  if (loading) {
    return h("p", {}, "Đang tải sản phẩm...");
  }

  if (error) {
    return h("p", { style: { color: "red" } }, error);
  }
  
  
  
  
  /*
  const getThumbnailUrl = (path) => {
  if (!path) return ''; // fallback
  const { data } = supabase.storage.from('product-images').getPublicUrl(path);
  return data.publicUrl; // hoặc thêm transform: { width: 300, height: 300 }
};
*/

const getThumbnailUrl = (path, updatedAt) => {
  if (!path) return '';

  const { data } = supabase
    .storage
    .from('product-images')
    .getPublicUrl(path);

  return `${data.publicUrl}?v=${new Date(updatedAt).getTime()}`;
};




  /* =========================
     Submit
     ========================= */
  async function submit() {
    try {
      setSaving(true);

      let thumbnail_url = product.thumbnail_url;

      // Upload thumbnail nếu có
      if (thumbnailFile) {
        thumbnail_url = await uploadProductThumbnail(
          product.id,
          thumbnailFile
        );
        alert('thumbnail_url: '+thumbnail_url);
      }

/*
if (thumbnailFile) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  thumbnail_url = await uploadProductThumbnailViaApi(
    product.id,
    thumbnailFile,
    session
  );

  alert('thumbnail_url: ' + thumbnail_url);
}
*/

      const { data: { session } } =
        await supabase.auth.getSession();

      if (!session) {
        throw new Error("Not authenticated");
      }


      const res = await fetch(
        `/api/products/${product.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            expected_updated_at: product.updated_at,
            data: {
              ...form,
              thumbnail_url,
            },
          }),
        }
      );

      const result = await res.json();
      if (!res.ok) throw new Error(result.error);

      alert("Cập nhật sản phẩm thành công");
      location.reload(); // reload để lấy updated_at mới
    } catch (e) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  }

  /* =========================
     Render
     ========================= */
  return h("div", { class: "card" }, [
    h("h2", {}, "Edit Product"),

    h("label", {}, "Name"),
    h("input", {
      value: form.name,
      oninput: e => setForm({ ...form, name: e.target.value }),
    }),

    h("label", {}, "Slug"),
    h("input", {
      value: form.slug,
      oninput: e => setForm({ ...form, slug: e.target.value }),
    }),

    h("label", {}, "Description"),
    h("textarea", {
      value: form.description,
      oninput: e =>
        setForm({ ...form, description: e.target.value }),
    }),

    h("label", {}, "Short description"),
    h("textarea", {
      value: form.short_description,
      oninput: e =>
        setForm({ ...form, short_description: e.target.value }),
    }),

    h("label", {}, "Status"),
    h(
      "select",
      {
        value: form.status,
        onchange: e =>
          setForm({ ...form, status: e.target.value }),
      },
      ["draft", "active", "archived"].map(s =>
        h("option", { value: s }, s)
      )
    ),

    h("label", {}, "Thumbnail"),
    product.thumbnail_url &&
      h("img", {
        //src: getThumbnailUrl(product.thumbnail_url)|| "/assets/images/placeholder-large.svg",
        src: getThumbnailUrl(product.thumbnail_url, product.updated_at)|| "/assets/images/placeholder-large.svg",
        style: { maxWidth: "120px", display: "block" },
      }),

    h("input", {
      type: "file",
      accept: "image/*",
      onchange: e => setThumbnailFile(e.target.files[0]),
    }),

    h(
      "button",
      {
        onclick: submit,
        disabled: saving,
      },
      saving ? "Saving..." : "Save changes"
    ),
  ]);
}