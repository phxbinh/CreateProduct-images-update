

// ========================
// Product Card
// ========================
function ProductCard({ product }) {
  if (!product) {
    return h(
      "div",
      { className: "product-card product-card--empty" },
      "Không có sản phẩm"
    );
  }

  const {
    name,
    slug,
    thumbnail_url,
    min_price,
    original_price,
    discount_percentage,
    is_out_of_stock
  } = product;

  const hasPrice = min_price != null && !is_out_of_stock;
  const hasDiscount =
    discount_percentage > 0 &&
    original_price != null &&
    original_price > min_price;

  const priceText = hasPrice
    ? Number(min_price).toLocaleString("vi-VN") + " ₫"
    : "Hết hàng";

  const originalPriceText = hasDiscount
    ? Number(original_price).toLocaleString("vi-VN") + " ₫"
    : null;

  function goToDetail() {
    if (slug) navigateTo(`/products/${slug}`);
  }

  return h(
    "div",
    {
      className: [
        "product-card",
        is_out_of_stock && "product-card--out-of-stock",
        hasDiscount && "product-card--has-discount"
      ]
        .filter(Boolean)
        .join(" "),
      role: "button",
      tabindex: "0",
      onclick: goToDetail,
      onkeydown: e => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          goToDetail();
        }
      }
    },

    // Image
    h("div", { className: "product-card__image-container" }, [
      h("img", {
        //src: thumbnail_url || "/assets/images/placeholder-product.svg",
        src: getThumbnailUrl(product.thumbnail_url) || "/assets/images/placeholder-product.svg",
        alt: name || "Sản phẩm",
        loading: "lazy",
        className: "product-card__image",
        onerror: e => {
          e.target.src = "/assets/images/placeholder-product.svg";
        }
      }),

      hasDiscount &&
        h(
          "span",
          { className: "product-card__badge product-card__badge--discount" },
          `-${discount_percentage}%`
        ),

      is_out_of_stock &&
        h(
          "div",
          { className: "product-card__sold-out-overlay" },
          h("span", { className: "product-card__sold-out-text" }, "Hết hàng")
        )
    ]),

    // Info
    h("div", { className: "product-card__info" }, [
      h(
        "h3",
        { className: "product-card__name", title: name },
        name || "Tên sản phẩm"
      ),

      h("div", { className: "product-card__price-block" }, [
        h(
          "span",
          {
            className: hasPrice
              ? "product-card__current-price"
              : "product-card__price--unavailable"
          },
          priceText
        ),

        hasDiscount &&
          h(
            "span",
            { className: "product-card__original-price" },
            originalPriceText
          )
      ])
    ])
  );
}

//load anh tu bucket
// Trong component, ví dụ hiển thị thumbnail
const getThumbnailUrl = (path) => {
  if (!path) return ''; // fallback
  const { data } = supabase.storage.from('product-images').getPublicUrl(path);
  return data.publicUrl; // hoặc thêm transform: { width: 300, height: 300 }
}



// ========================
// Product List Page
// ========================
function ProductListPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    async function fetchProducts() {
      const { data, error } = await supabase
        .from("public_products_view")
        .select(`
          id,
          name,
          slug,
          thumbnail_url,
          min_price,
          original_price,
          discount_percentage,
          is_out_of_stock,
          created_at
        `)
        .order("created_at", { ascending: false });

      if (!error && alive) {
        setProducts(data || []);
      }

      setLoading(false);
    }

    fetchProducts();
    return () => { alive = false; };
  }, []);

  if (loading) {
    return h("div", { className: "product-list-loading" }, [
      h("div", { className: "spinner" }),
      h("p", {}, "Đang tải sản phẩm...")
    ]);
  }

  return h("div", {}, [
    h("h3", {}, "Danh sách sản phẩm"),

    h(
      "div",
      { className: "product-grid" },
      products.length === 0
        ? h("p", { className: "no-products" }, "Chưa có sản phẩm nào")
        : products.map(p =>
            h(ProductCard, { key: p.id, product: p })
          )
    )
  ]);
}

