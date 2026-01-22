// ========================
// Admin Product List
// ========================
function AdminProductList() {
    /*
  const { h } = window.App.VDOM;
  const { useState, useEffect } = window.App.Hooks;
  const { navigateTo } = window.App.Router;
*/

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadProducts() {
      setLoading(true);
      setError("");

      const { data, error } = await supabase
        .from("products")
        .select(`
          id,
          name,
          slug,
          status,
          thumbnail_url,
          updated_at,
          created_at
        `)
        .order("created_at", { ascending: false });

      if (!mounted) return;

      if (error) {
        setError(error.message);
      } else {
        setProducts(data || []);
      }

      setLoading(false);
    }

    loadProducts();
    return () => (mounted = false);
  }, []);

  /* =========================
     Render states
     ========================= */
  if (loading) {
    return h("p", {}, "Đang tải sản phẩm...");
  }

  if (error) {
    return h("p", { style: { color: "red" } }, error);
  }

  if (products.length === 0) {
    return h("p", {}, "Chưa có sản phẩm nào");
  }

  /* =========================
     Render table
     ========================= */
  return h("div", { class: "card" }, [
    h("h2", {}, "Products"),

    h("table", {
      style: {
        width: "100%",
        borderCollapse: "collapse",
        marginTop: "12px",
      },
      border: 1,
      cellPadding: 8,
    }, [
      h("thead", {}, 
        h("tr", {}, [
          h("th", {}, "Thumbnail"),
          h("th", {}, "Name"),
          h("th", {}, "Slug"),
          h("th", {}, "Status"),
          h("th", {}, "Updated"),
          h("th", {}, "Actions"),
        ])
      ),

      h("tbody", {}, 
        products.map(p =>
          h("tr", { key: p.id }, [
            h("td", {}, 
              p.thumbnail_url
                ? h("img", {
                    src: p.thumbnail_url,
                    style: { width: "48px", height: "48px", objectFit: "cover" },
                  })
                : "—"
            ),

            h("td", {}, p.name),
            h("td", {}, p.slug),
            h("td", {}, p.status),

            h("td", {}, 
              new Date(p.updated_at).toLocaleString("vi-VN")
            ),

            h("td", {}, 
              h("button", {
                onclick: () =>
                  navigateTo(`/admin/products/${p.id}`),
              }, "Edit")
            ),
          ])
        )
      ),
    ]),
  ]);
}