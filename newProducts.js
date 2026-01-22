function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-");
}

function ProductSection({ product, setProduct }) {
  function onNameChange(value) {
    setProduct({
      ...product,
      name: value,
      slug: product.slug || slugify(value)
    });
  }

  return h("section", { class: "card" }, [
    h("h3", {}, "1. Product Information"),

    h("label", {}, "Product name"),
    h("input", {
      value: product.name,
      placeholder: "T-shirt basic",
      oninput: e => onNameChange(e.target.value)
    }),

    h("label", {}, "Slug (unique)"),
    h("input", {
      value: product.slug,
      placeholder: "t-shirt-basic",
      oninput: e =>
        setProduct({ ...product, slug: e.target.value })
    }),

    h("label", {}, "Description"),
    h("textarea", {
      value: product.description,
      oninput: e =>
        setProduct({ ...product, description: e.target.value })
    })
  ]);
}

function AttributesSection({ attributes, setAttributes }) {
  function addAttribute() {
    setAttributes([
      ...attributes,
      { code: "", name: "", values: [] }
    ]);
  }

  function updateAttr(i, field, value) {
    const next = [...attributes];
    next[i][field] = value;
    setAttributes(next);
  }

  function addValue(i) {
    const next = [...attributes];
    next[i].values.push("");
    setAttributes(next);
  }

  function updateValue(i, vi, value) {
    const next = [...attributes];
    next[i].values[vi] = value;
    setAttributes(next);
  }

  return h("section", { class: "card" }, [
    h("h3", {}, "2. Attributes"),

    ...attributes.map((a, i) =>
      h("div", { class: "attr" }, [
        h("input", {
          placeholder: "Code (size, color)",
          value: a.code,
          oninput: e => updateAttr(i, "code", e.target.value)
        }),

        h("input", {
          placeholder: "Display name",
          value: a.name,
          oninput: e => updateAttr(i, "name", e.target.value)
        }),

        h("button", { onclick: () => addValue(i) }, "+ Value"),

        ...a.values.map((v, vi) =>
          h("input", {
            placeholder: "Value",
            value: v,
            oninput: e => updateValue(i, vi, e.target.value)
          })
        )
      ])
    ),

    h("button", { onclick: addAttribute }, "+ Add Attribute")
  ]);
}

function VariantsSection({ variants, setVariants }) {
  function addVariant() {
    setVariants([
      ...variants,
      {
        sku: "",
        title: "",
        price: "",
        stock: 0,
        is_active: true,
        attributes: {}
      }
    ]);
  }

  function update(i, field, value) {
    const next = [...variants];
    next[i][field] = value;
    setVariants(next);
  }

  return h("section", { class: "card" }, [
    h("h3", {}, "3. Variants"),

    ...variants.map((v, i) =>
      h("div", { class: "row" }, [
        h("input", {
          placeholder: "SKU",
          value: v.sku,
          oninput: e => update(i, "sku", e.target.value)
        }),

        h("input", {
          placeholder: "Title",
          value: v.title,
          oninput: e => update(i, "title", e.target.value)
        }),

        h("input", {
          type: "number",
          placeholder: "Price",
          value: v.price,
          oninput: e => update(i, "price", e.target.value)
        }),

        h("input", {
          type: "number",
          placeholder: "Stock",
          value: v.stock,
          oninput: e => update(i, "stock", +e.target.value)
        })
      ])
    ),

    h("button", { onclick: addVariant }, "+ Add Variant")
  ]);
}

function VariantAttributeSection({ variants, attributes, setVariants }) {
  function select(vi, code, value) {
    const next = [...variants];
    next[vi].attributes[code] = value;
    setVariants(next);
  }

  return h("section", { class: "card" }, [
    h("h3", {}, "4. Variant Attributes"),

    ...variants.map((v, vi) =>
      h("div", { class: "variant-attr" }, [
        h("strong", {}, v.sku || `Variant ${vi + 1}`),

        ...attributes.map(a =>
          h("div", {}, [
            h("span", {}, a.name || a.code),
            ...a.values.map(val =>
              h("label", {}, [
                h("input", {
                  type: "radio",
                  checked: v.attributes[a.code] === val,
                  onchange: () =>
                    select(vi, a.code, val)
                }),
                val
              ])
            )
          ])
        )
      ])
    )
  ]);
}


function buildPayload(product, variants, attributes) {
  // Basic validation
  if (!product.name || !product.slug) {
    throw new Error("Product name & slug required");
  }

  if (variants.length === 0) {
    throw new Error("At least one variant required");
  }

  for (const v of variants) {
    if (!v.price) throw new Error("Variant price required");

    for (const a of attributes) {
      if (!v.attributes[a.code]) {
        throw new Error(
          `Variant ${v.sku || ""} missing attribute ${a.code}`
        );
      }
    }
  }

  return {
    product,
    attributes,
    variants: variants.map(v => ({
      sku: v.sku || null,
      title: v.title || null,
      price: Number(v.price),
      stock: Number(v.stock || 0),
      is_active: v.is_active,
      attributes: v.attributes
    }))
  };
}

function ProductCreatePage() {
  const [product, setProduct] = useState({
    name: "",
    slug: "",
    description: "",
    status: "draft"
  });

  const [attributes, setAttributes] = useState([]);
  const [variants, setVariants] = useState([]);
  const [loading, setLoading] = useState(false);

async function loadUsers() {
  try {
    setLoading(true);
    setError("");

    const { data: { session } } =
      await supabase.auth.getSession();

    if (!session) {
      throw new Error("Chưa đăng nhập");
    }

    const res = await fetch("/api/createProduct", {
      headers: {
        Authorization: `Bearer ${session.access_token}`
      }
    });

    // ✅ XỬ LÝ STATUS Ở ĐÂY
    if (res.status === 401) {
      await supabase.auth.signOut();
      navigate("/login");
      return;
    }

    if (res.status === 403) {
      throw new Error("Bạn không có quyền truy cập");
    }

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Fetch users failed");
    }

    setUsers(data);
  } catch (err) {
    setError("Lỗi tải danh sách: " + err.message);
  } finally {
    setLoading(false);
  }
}

  useEffect(() => {
    loadUsers();
  }, []);


/*
  async function submitProduct() {
    try {
      setLoading(true);

      const payload = buildPayload(
        product,
        variants,
        attributes
      );

      const { error } = await supabase.rpc(
        "admin_create_product",
        { payload }
      );

      if (error) throw error;

      alert("Product created successfully");
      navigateTo("/");
    } catch (e) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  }
*/

/*
async function submitProduct() {
  try {
    setLoading(true);

    const payload = buildPayload(
      product,
      variants,
      attributes
    );

    const session = supabase.auth.session();
    if (!session) throw new Error("Not authenticated");

    const res = await fetch("/api/createProduct", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`
      },
      body: JSON.stringify(payload)
    });

    const result = await res.json();
    if (!res.ok) throw new Error(result.error);

    alert("Product created successfully");
    navigateTo("/");
  } catch (e) {
    alert(e.message);
  } finally {
    setLoading(false);
  }
}
*/
/*
async function submitProduct() {
  try {
    setLoading(true);

    const payload = buildPayload(
      product,
      variants,
      attributes
    );

    // ✅ Supabase v2
    const {
      data: { session },
      error
    } = await supabase.auth.getSession();

    if (error || !session) {
      throw new Error("Not authenticated");
    }

    const res = await fetch("/api/createProduct", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`
      },
      body: JSON.stringify(payload)
    });

    const result = await res.json();
    if (!res.ok) throw new Error(result.error || "Create product failed");

    alert("Product created successfully");
    navigateTo("/");
  } catch (e) {
    alert(e.message);
  } finally {
    setLoading(false);
  }
}
*/

async function submitProduct() {
  try {
    setLoading(true);

    const payload = buildPayload(product, variants, attributes);

    const {
      data: { session },
      error
    } = await supabase.auth.getSession();

    if (error) {
      throw error;
    }

    if (!session || !session.access_token) {
      throw new Error("Not authenticated");
    }

    const res = await fetch("/api/createProduct", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`
      },
      body: JSON.stringify(payload)
    });

    const result = await res.json();
    if (!res.ok) {
      throw new Error(result.error || "Create product failed");
    }

    alert("Product created successfully");
    navigateTo("/");
  } catch (e) {
    console.error("Create product error:", e);
    alert(e.message);
  } finally {
    setLoading(false);
  }
}










  return h("div", {}, [
    h("h2", {}, "Create Product"),

    h(ProductSection, { product, setProduct }),
    h(AttributesSection, { attributes, setAttributes }),
    h(VariantsSection, { variants, setVariants }),
    h(VariantAttributeSection, {
      variants,
      attributes,
      setVariants
    }),

    h("button", {
      onclick: submitProduct,
      disabled: loading
    }, loading ? "Saving..." : "Create Product")
  ]);
}