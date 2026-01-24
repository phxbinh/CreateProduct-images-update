async function uploadProductThumbnail(productId, file) {
  const fileExt = file.name.split(".").pop().toLowerCase();
  const fileName = `${productId}.${fileExt}`;
  const filePath = `products/${fileName}`;

  const { error } = await supabase.storage
    .from("product-images")
    .upload(filePath, file, {
      upsert: true,
      contentType: file.type,
    });

  if (error) throw error;

  return filePath;
}

async function getThumbnailUrl(path) {
  if (!path) return '';

  const { data, error } = await supabase
    .storage
    .from('product-images')
    .createSignedUrl(path, 300); // ⬅️ FIX: tăng TTL

  if (error) {
    console.error(error);
    return '';
  }

  return data.signedUrl;
}

function AdminProductEditPage({ params }) {

  const productId = params?.id;

  const [product, setProduct] = useState(null);
  const [form, setForm] = useState({});
  const [thumbnailFile, setThumbnailFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // ❗ FIX: dùng useState, không phải useEffect
  const [thumbnailUrl, setThumbnailUrl] =
    useState("/assets/images/placeholder-large.svg");

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

  /* =========================
     Load thumbnail (SIGNED URL)
     ========================= */
  useEffect(() => {
    if (!product?.thumbnail_url) return;

    async function load() {
      const url = await getThumbnailUrl(product.thumbnail_url);
      setThumbnailUrl(url || "/assets/images/placeholder-large.svg");
    }

    load();
  }, [product?.thumbnail_url]);

  if (loading) {
    return h("p", {}, "Đang tải sản phẩm...");
  }

  if (error) {
    return h("p", { style: { color: "red" } }, error);
  }

  /* =========================
     Submit
     ========================= */
  async function submit() {
    try {
      setSaving(true);

      let thumbnail_url = product.thumbnail_url;

      // ⬅️ Upload + refresh signed URL ngay
      if (thumbnailFile) {
        thumbnail_url = await uploadProductThumbnail(
          product.id,
          thumbnailFile
        );

        const freshUrl = await getThumbnailUrl(thumbnail_url);
        setThumbnailUrl(freshUrl);
      }

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
      location.reload();

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
    h("img", {
      src: thumbnailUrl,
      key: thumbnailUrl, // ⬅️ FIX: force re-render
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