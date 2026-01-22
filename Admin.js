function UserRoleEditor({ user, onChangeRole }) {
  const { h } = window.App.VDOM;
  const { useState } = window.App.Hooks;

  const [nextRole, setNextRole] = useState(user.role);

  return h("div", { style: { minWidth: "160px" } }, [

    // Role hiện tại
    h("div", {
      style: {
        fontWeight: "bold",
        marginBottom: "4px",
        color: user.role === "admin" ? "#c0392b" : "#333"
      }
    }, `Role: ${user.role}`),

    h("hr"),

    // Chọn role mới
    h("div", { style: { display: "flex", gap: "6px" } }, [

      h("select", {
        onChange: e => setNextRole(e.target.value),
        defaultValue: user.role   // ⚠️ uncontrolled → không bug
      },
        ["-Select Role-", "user", "admin", "moderator"].map(r =>
          h("option", { value: r }, r)
        )
      ),

      h("button", {
        //disabled: nextRole === user.role,
disabled: nextRole === user.role || nextRole === "-Select Role-",
        onClick: () => onChangeRole(user, nextRole),
        style: {
          padding: "4px 8px",
          cursor: nextRole === user.role ? "not-allowed" : "pointer"
        }
      }, "Đổi")
    ])
  ]);
}
 
function AdminUsersPage() {
  const { h } = window.App.VDOM;
  const { useState, useEffect } = window.App.Hooks;

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // ===============================
  // Load users
  // ===============================
/*
  async function loadUsers() {
    try {
      setLoading(true);
      setError("");

      const res = await fetch("/api/users");
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
*/

async function loadUsers() {
  try {
    setLoading(true);
    setError("");

    const { data: { session } } =
      await supabase.auth.getSession();

    if (!session) {
      throw new Error("Chưa đăng nhập");
    }

    const res = await fetch("/api/usersAdvance", {
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

  // ===============================
  // Change role
  // ===============================
  async function changeRole(user, newRole) {
    if (newRole === user.role) return;

    if (!confirm(`Đổi role của ${user.email} thành ${newRole}?`)) {
      return;
    }

    try {
      const res = await fetch("/api/change-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, newRole })
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || "Không xác định");
      }

      alert("Đổi role thành công");
      loadUsers(); // reload list
    } catch (err) {
      alert("Lỗi: " + err.message);
    }
  }

  // ===============================
  // Delete user
  // ===============================
  async function deleteUser(user) {
    if (!confirm(`Xóa người dùng ${user.email}?`)) return;

    try {
      const res = await fetch("/api/delete-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id })
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || "Không xác định");
      }

      alert("Xóa thành công");
      loadUsers();
    } catch (err) {
      alert("Lỗi: " + err.message);
    }
  }

  // ===============================
  // Render states
  // ===============================
  if (loading) {
    return h("div", { id: "loading" }, "Đang tải danh sách...");
  }

  if (error) {
    return h("div", { style: { color: "red", padding: "20px" } }, error);
  }

  // ===============================
  // Render table
  // ===============================
  return h("div", { style: { padding: "20px" } },
    h("a", { style: { textAlign: "center" }, href: "/debug-users"}, "Thông tin đầy đủ"),
    h("h1", { style: { textAlign: "center" } }, "Admin - Quản lý người dùng"),

    h("table", {
      style: {
        width: "100%",
        borderCollapse: "collapse",
        background: "white",
        marginTop: "20px"
      },
      border: 1,
      cellPadding: 10
    },
      h("thead", null,
        h("tr", null,
          h("th", null, "Email"),
          h("th", null, "User ID"),
          h("th", null, "Role"),
          h("th", null, "Thao tác")
        )
      ),

      h("tbody", null,
        users.map(user =>
          h("tr", { key: user.id },

            h("td", null, user.email),

            h("td", null, user.id.slice(0, 8) + "..."),

            h("td", null,         
              h(UserRoleEditor, {
                user,
                onChangeRole: changeRole
              })
            ),
            h("td", null,
              h("button", {
                onClick: () => deleteUser(user),
                style: {
                  padding: "6px 12px",
                  background: "#e74c3c",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer"
                }
              }, "Xóa")
            )
          )
        )
      )
    )
  );
}