// ====================
// Routes
// ====================
window.App.Router.addRoute("/", Home);
window.App.Router.addRoute("/auth", AuthPage);
window.App.Router.addRoute("/dashboard", Dashboard);
window.App.Router.addRoute("/reset-password", ResetPasswordPage);
window.App.Router.addRoute("/profile", ProfileEdit);
window.App.Router.addRoute("/tasks", MyTasks);
window.App.Router.addRoute("/tasks/publictasks", PublicTasks);
window.App.Router.addRoute("/admin/role", AdminUsersPage);
window.App.Router.addRoute("/admin/products/create", ProductCreatePage);
window.App.Router.addRoute("/admin/products/list", AdminProductList);
window.App.Router.addRoute("/products", ProductListPage);
window.App.Router.addRoute("/products/:slug", ProductDetailPage);

// Navbar đơn giản
window.App.Router.navbarDynamic({
  navbar: () => h("nav", {
    style: {
      background: "#333",
      color: "white",
      padding: "1rem",
      textAlign: "center"
    }
  },
    h(Link, { to: "/", style: { color: "white", margin: "0 1rem" }, children: "Home"}),
    h(Link, { to: "/auth", style: { color: "white", margin: "0 1rem" }, children: "Auth"}),
    h(Link, { to: "/dashboard", style: { color: "white", margin: "0 1rem" }, children: "Dashboard" }),
    h(Link, { to: "/tasks", style: { color: "white", margin: "0 1rem" }, children: "Tasks" }),
    h(Link, { to: "/tasks/publictasks", style: { color: "white", margin: "0 1rem" }, children: "Public tasks" }),
    h(Link, { to: "/admin/role", style: { color: "white", margin: "0 1rem" }, children: "Change role" }),
    h(Link, { to: "/admin/products/create", style: { color: "white", margin: "0 1rem" }, children: "CreProducts" }),
    h(Link, { to: "/products", style: { color: "white", margin: "0 1rem" }, children: "RendProducts" }),
    h(Link, { to: "/admin/products/list", style: { color: "white", margin: "0 1rem" }, children: "Danh sách" })

  )
});


// ====================
// Khởi động App
// ====================
const mountEl = document.getElementById("app");
window.App.Router.init(mountEl, { hash: false }); // Dùng history mode

// Fallback 404
window.App.Router.setNotFound(() => h("div", { style: { padding: "2rem", textAlign: "center" } },
  h("h1", null, "404 - Không tìm thấy trang")
));