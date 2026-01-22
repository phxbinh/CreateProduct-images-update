// MyTasks.js

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const BUCKET = 'user-pdfs';

function getFilePathFromUrl(url) {
  if (!url) return null;

  try {
    const { pathname } = new URL(url);

    // Regex chung: match /storage/v1/object/(public|sign|authenticated)/bucket-name/(path/to/file)
    const regex = /^\/storage\/v1\/object\/(public|sign|authenticated)\/([^/]+)\/(.+)$/;
    const match = pathname.match(regex);

    if (match) {
      // match[1]: type (public/sign/authenticated)
      // match[2]: bucket name
      // match[3]: file path (còn lại)
      return match[3];  // trả về path/to/file (không bao gồm bucket)
    }

    // Fallback cho các prefix cũ nếu cần
    const markers = [
      '/storage/v1/object/public/',
      '/storage/v1/object/sign/',
      '/storage/v1/object/authenticated/',
      '/storage/v1/object/'  // fallback nếu bucket ở ngay sau object/
    ];

    for (const marker of markers) {
      const idx = pathname.indexOf(marker);
      if (idx !== -1) {
        const remaining = pathname.substring(idx + marker.length);
        // Bỏ bucket nếu có (tìm vị trí / đầu tiên sau marker)
        const firstSlash = remaining.indexOf('/');
        if (firstSlash !== -1) {
          return remaining.substring(firstSlash + 1);
        }
        return remaining; // nếu không có bucket rõ ràng
      }
    }

    return null;
  } catch {
    return null;
  }
}


async function removePdfByUrl(url) {
  const path = getFilePathFromUrl(url);
  if (!path) return;
  
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) {
    console.error('Lỗi khi xóa file:', error);
  }
}

async function uploadPdf(file, taskId, userId) {
  if (!file) return null;
  if (!userId) throw new Error('Không tìm thấy user ID');

  if (file.size > MAX_FILE_SIZE) {
    throw new Error('File PDF vượt quá 50MB');
  }

  const ext = file.name.split('.').pop().toLowerCase();
  const timestamp = Date.now();
  const path = `${userId}/${taskId}/${timestamp}.${ext}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      upsert: false,
      contentType: file.type || 'application/pdf'
    });

  if (error) throw error;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

function MyTasks() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [user, setUser] = useState(null);

  const [newTitle, setNewTitle] = useState('');
  const [newPdf, setNewPdf] = useState(null);
  const newFileInputRef = useRef(null);

  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editPdf, setEditPdf] = useState(null);
  const editFileInputRef = useRef(null);

  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    getCurrentUser();
  }, []);

  useEffect(() => {
    if (user) {
      fetchTasks();
    }
  }, [user]);

  async function fetchTasks() {
    if (!user) return;
    
    setLoading(true);
    const { data, error } = await supabase
      .from('tasks')
      .select('id, title, completed, pdf_url, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      setMessage('Lỗi khi tải tasks: ' + error.message);
    } else {
      setTasks(data || []);
    }
    setLoading(false);
  }

  async function addTask() {
    if (!newTitle.trim() || !user) return;

    try {
      setLoading(true);

      const { data: task, error: insertError } = await supabase
        .from('tasks')
        .insert({ title: newTitle.trim(), user_id: user.id })
        .select()
        .single();

      if (insertError) throw insertError;

      let pdfUrl = null;
      if (newPdf) {
        pdfUrl = await uploadPdf(newPdf, task.id, user.id);
      }

      if (pdfUrl) {
        await supabase
          .from('tasks')
          .update({ pdf_url: pdfUrl })
          .eq('id', task.id);
      }

      setTasks([{ ...task, pdf_url: pdfUrl }, ...tasks]);
      setNewTitle('');
      setNewPdf(null);
      if (newFileInputRef.current) newFileInputRef.current.value = '';
      setMessage('Thêm task thành công!');
    } catch (e) {
      setMessage('Lỗi: ' + e.message);
    } finally {
      setLoading(false);
    }
  }

  async function saveEdit() {
    if (!user || !editingId) return;

    try {
      setLoading(true);

      const task = tasks.find(t => t.id === editingId);
      if (!task) return;

      let pdfUrl = task.pdf_url;

      if (editPdf) {
        // Xóa file cũ nếu có
        if (task.pdf_url) await removePdfByUrl(task.pdf_url);
        pdfUrl = await uploadPdf(editPdf, task.id, user.id);
      }

      const { error } = await supabase
        .from('tasks')
        .update({ 
          title: editTitle.trim(), 
          pdf_url: pdfUrl 
        })
        .eq('id', task.id)
        .eq('user_id', user.id);

      if (error) throw error;

      setTasks(tasks.map(t =>
        t.id === task.id ? { ...t, title: editTitle.trim(), pdf_url: pdfUrl } : t
      ));

      cancelEdit();
      if (editFileInputRef.current) editFileInputRef.current.value = '';
      setMessage('Cập nhật thành công!');
    } catch (e) {
      setMessage('Lỗi khi cập nhật: ' + e.message);
    } finally {
      setLoading(false);
    }
  }

  async function deleteTask(task) {
    if (!user) return;

    setLoading(true);
    setMessage('');

    try {
      // Xóa file PDF nếu có
      if (task.pdf_url) {
        await removePdfByUrl(task.pdf_url);
      }

      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', task.id)
        .eq('user_id', user.id);

      if (error) throw error;

      setTasks(tasks.filter(t => t.id !== task.id));
      setMessage('Đã xóa task và file PDF (nếu có)');
    } catch (err) {
      setMessage('Lỗi khi xóa: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function toggleCompleted(task) {
    if (!user) return;

    try {
      const newCompleted = !task.completed;
      
      await supabase
        .from('tasks')
        .update({ completed: newCompleted })
        .eq('id', task.id)
        .eq('user_id', user.id);

      setTasks(tasks.map(t =>
        t.id === task.id ? { ...t, completed: newCompleted } : t
      ));
    } catch (err) {
      console.error('Lỗi toggle completed:', err);
    }
  }

  function startEdit(task) {
    setEditingId(task.id);
    setEditTitle(task.title);
    setEditPdf(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditTitle('');
    setEditPdf(null);
    if (editFileInputRef.current) editFileInputRef.current.value = '';
  }

  function checkFile(e, setter) {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.size > MAX_FILE_SIZE) {
      alert('File PDF tối đa 50MB');
      e.target.value = '';
      return;
    }
    
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      alert('Chỉ chấp nhận file PDF');
      e.target.value = '';
      return;
    }
    
    setter(file);
  }

  if (!user) {
    return h('div', { class: 'tasks-container' },
      h('p', null, 'Vui lòng đăng nhập để quản lý tasks của bạn.')
    );
  }

  const TaskItem = ({ task }) =>
    h('li', { class: 'task-item', key: task.id },
      h('input', {
        type: 'checkbox',
        class: 'task-checkbox',
        checked: task.completed,
        onChange: () => toggleCompleted(task)
      }),

      editingId === task.id
        ? h('div', { class: 'edit-mode' },
            h('input', {
              class: 'edit-title-input',
              value: editTitle,
              onInput: e => setEditTitle(e.target.value),
              placeholder: "Tên task..."
            }),

            h('div', { class: 'edit-file-wrapper' },
              h('label', null, 'PDF mới (tùy chọn):'),
              h('input', {
                type: 'file',
                accept: '.pdf',
                class: 'file-input',
                ref: editFileInputRef,
                onChange: e => checkFile(e, setEditPdf)
              })
            ),

            task.pdf_url && h('a', {
              href: task.pdf_url,
              target: '_blank',
              class: 'current-pdf-link'
            }, 'Xem PDF hiện tại'),

            h('div', { class: 'edit-buttons' },
              h('button', { class: 'btn btn-save', onClick: saveEdit }, 'Lưu'),
              h('button', { class: 'btn btn-cancel', onClick: cancelEdit }, 'Hủy')
            )
          )
        : h('div', { class: 'view-mode' },
            h('span', { class: task.completed ? 'task-title completed' : 'task-title' }, task.title),
            task.pdf_url && h('a', {
              href: task.pdf_url,
              target: '_blank',
              class: 'pdf-link'
            }, '[PDF]')
          ),

      !editingId && h('button', {
        class: 'btn btn-edit',
        onClick: () => startEdit(task)
      }, 'Sửa'),

      h('button', {
        class: 'btn btn-delete',
        onClick: () => deleteTask(task)
      }, 'Xóa')
    );

  return h('div', { class: 'tasks-container' },
    h('h2', { class: 'page-title' }, 'Tasks của tôi + PDF'),

    h('div', { class: 'add-task-form' },
      h('input', {
        class: 'new-task-input',
        placeholder: 'Nhập task mới...',
        value: newTitle,
        onInput: e => setNewTitle(e.target.value)
      }),

      h('div', { class: 'file-upload-wrapper' },
        h('label', null, 'Đính kèm PDF (tùy chọn):'),
        h('br'),
        h('input', {
          type: 'file',
          accept: '.pdf',
          class: 'file-input',
          ref: newFileInputRef,
          onChange: e => checkFile(e, setNewPdf)
        })
      ),

      h('button', {
        class: `btn btn-add ${loading ? 'loading' : ''}`,
        onClick: addTask,
        disabled: loading
      }, loading ? 'Đang xử lý...' : 'Thêm')
    ),

    message && h('p', { class: 'message' }, message),

    loading && h('p', { class: 'loading-text' }, 'Đang tải...'),

    h('ul', { class: 'task-list' },
      tasks.map(task => TaskItem({ task }))
    )
  );
}









// /tasks/public → PublicTasks
function PublicTasks() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchTasks();
  }, []);

  async function fetchTasks() {
    setLoading(true);

    const { data, error } = await supabase
      .from('tasks')
      .select('id,title,pdf_url,created_at')
      .order('created_at', { ascending: false });

    if (error) setMessage(error.message);
    else setTasks(data || []);

    setLoading(false);
  }

  /* ================= TaskItem ================= */

/*
  const TaskItem = (task) =>
    h('li', { key: task.id },
      h('span', null,
        task.title,
        task.pdf_url && h(
          'a',
          {
            href: task.pdf_url,
            target: '_blank',
            style: 'margin-left:8px'
          },
          '[PDF]'
        )
      )
    );
    
*/

    const TaskItem = (task) =>
  h('li', { key: task.id, className: 'task-item' },
    h('span', { className: 'task-title' }, task.title),

    task.pdf_url && h(
      'a',
      {
        href: task.pdf_url,
        target: '_blank',
        download: '',
        className: 'task-pdf'
      },
      'PDF'
    )
  );
    
    

  return h('div', null,
    h('h2', null, 'Tasks + PDF'),

    loading && h('p', null, 'Đang tải...'),
    message && h('p', null, message),

    //h('ul', null, tasks.map(TaskItem))
    h('ul', { className: 'task-list' }, tasks.map(TaskItem))
  );
}




























// ====================
// Component Auth (Đăng nhập / Đăng ký)
// ====================
function AuthPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");          // Thêm cho signup
  const [fullName, setFullName] = useState("");          // Thêm cho signup
  const [avatarUrl, setAvatarUrl] = useState("");        // Optional cho signup
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");            // Thêm thông báo success signup
  const [user, setUser] = useState(null);

  // Kiểm tra session khi mount
  useEffect(() => {
    const { data: authListener } = window.supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null);
        if (session?.user) {
          //navigateTo("/dashboard");
        }
      }
    );

    // Kiểm tra session ban đầu
    window.supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      //if (session?.user) navigateTo("/dashboard");
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const checkUsernameUnique = async (username) => {
  try {
    const trimmed = username.trim();
    if (!trimmed) return false;

    const { data, error } = await window.supabase
      .from('profiles')
      .select('username')
      .eq('username', trimmed)
      .maybeSingle();

    if (error) throw error;
    return !data; // true = chưa tồn tại → có thể dùng
  } catch (err) {
    console.error('Lỗi kiểm tra username:', err);
    throw new Error('Không thể kiểm tra username. Vui lòng thử lại.');
  }
};

const handleSubmit = async (e) => {
  e.preventDefault();

  // Reset trạng thái
  setError('');
  setSuccess('');
  setLoading(true);

  try {
    // ── ĐĂNG NHẬP ───────────────────────────────────────
    if (isLogin) {
      const { error } = await window.supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) throw error;

      // onAuthStateChange listener sẽ tự redirect về dashboard
      return;
    }

    // ── ĐĂNG KÝ ─────────────────────────────────────────
    const trimmedUsername = username.trim();
    const trimmedFullName = fullName.trim();
    const trimmedAvatar = avatarUrl?.trim() || '';

    // 1. Kiểm tra username đã tồn tại chưa
    const isUsernameAvailable = await checkUsernameUnique(trimmedUsername);
    if (!isUsernameAvailable) {
      setError('Username đã được sử dụng. Vui lòng chọn tên khác.');
      return;
    }

    // 2. Thực hiện đăng ký
    const { error } = await window.supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          username: trimmedUsername,
          full_name: trimmedFullName,
          avatar_url: trimmedAvatar,
          // role sẽ được trigger tự động set là 'user'
        },
        emailRedirectTo: `${window.location.origin}/welcome`,
      },
    });

    if (error) throw error;

    setSuccess('Đăng ký thành công! Vui lòng kiểm tra email để xác thực.');

    // Optional: reset form
    setUsername('');
    setFullName('');
    setAvatarUrl('');


  } catch (err) {
/*
    const message = err.message || 'Có lỗi xảy ra, vui lòng thử lại sau.';
    setError(message);
*/
    console.error('Auth error:', err);

if (err.message?.includes('profiles_username_unique')) {
    setError('Username đã được sử dụng.');
  } else if (err.message?.includes('User already registered')) {
    setError('Email đã được đăng ký.');
  } else {
    setError('Có lỗi xảy ra, vui lòng thử lại.');
  }






  } finally {
    setLoading(false);
  }
};

  const handleForgotPassword = async () => {
    if (!email) return alert("Vui lòng nhập email trước!");

    const { error } = await window.supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + "/reset-password",
    });

    if (error) alert(error.message);
    else alert("📩 Đã gửi email đặt lại mật khẩu. Kiểm tra hộp thư!");
  };

  const handleSignOut = async () => {
    await window.supabase.auth.signOut();
    setUser(null);
    navigateTo("/auth");
  };

  // Nếu đã đăng nhập → hiển thị welcome
  if (user) {
    return h("div", { style: { padding: "2rem", textAlign: "center" } },
      h("h1", null, "Chào mừng bạn trở lại!"),
      h("p", null, `Email: ${user.email}`),
      h("button", {
        onClick: handleSignOut,
        style: { padding: "0.5rem 1rem", marginTop: "1rem", background: "#ff4d4d", color: "white", border: "none", borderRadius: "4px" }
      }, "Đăng xuất"),
      h("br"),
      h(Link, { to: "/dashboard" }, "Đi đến Dashboard")
    );
  }

  return h("div", {
    style: {
      maxWidth: "400px",
      margin: "4rem auto",
      padding: "2rem",
      border: "1px solid #ccc",
      borderRadius: "8px",
      boxShadow: "0 4px 12px rgba(0,0,0,0.1)"
    }
  },
    h("h2", { style: { textAlign: "center" } }, isLogin ? "Đăng nhập" : "Đăng ký"),

    error && h("p", { style: { color: "red", textAlign: "center", marginBottom: "1rem" } }, error),
    success && h("p", { style: { color: "green", textAlign: "center", marginBottom: "1rem" } }, success),

    h("form", { onSubmit: handleSubmit },
      // Email
      h("div", { style: { marginBottom: "1rem" } },
        h("label", { style: { display: "block", marginBottom: "0.5rem" } }, "Email"),
        h("input", {
          type: "email",
          value: email,
          required: true,
          disabled: loading,
          onInput: (e) => setEmail(e.target.value),
          style: { width: "100%", padding: "0.5rem", fontSize: "1rem" }
        })
      ),

      // Mật khẩu
      h("div", { style: { marginBottom: "1rem" } },
        h("label", { style: { display: "block", marginBottom: "0.5rem" } }, "Mật khẩu"),
        h("input", {
          type: "password",
          value: password,
          required: true,
          minLength: 6,
          disabled: loading,
          onInput: (e) => setPassword(e.target.value),
          style: { width: "100%", padding: "0.5rem", fontSize: "1rem" }
        })
      ),

      // Các field chỉ hiện khi ĐĂNG KÝ
      !isLogin && h("div", null,
        // Username
        h("div", { style: { marginBottom: "1rem" } },
          h("label", { style: { display: "block", marginBottom: "0.5rem" } }, "Username"),
          h("input", {
            type: "text",
            value: username,
            required: true,
            minLength: 3,
            disabled: loading,
            onInput: (e) => setUsername(e.target.value),
            style: { width: "100%", padding: "0.5rem", fontSize: "1rem" }
          })
        ),

        // Full Name
        h("div", { style: { marginBottom: "1rem" } },
          h("label", { style: { display: "block", marginBottom: "0.5rem" } }, "Họ và tên"),
          h("input", {
            type: "text",
            value: fullName,
            required: true,
            disabled: loading,
            onInput: (e) => setFullName(e.target.value),
            style: { width: "100%", padding: "0.5rem", fontSize: "1rem" }
          })
        ),

        // Avatar URL (optional)
        h("div", { style: { marginBottom: "1rem" } },
          h("label", { style: { display: "block", marginBottom: "0.5rem" } }, "Avatar URL (tùy chọn)"),
          h("input", {
            type: "url",
            value: avatarUrl,
            disabled: loading,
            onInput: (e) => setAvatarUrl(e.target.value),
            style: { width: "100%", padding: "0.5rem", fontSize: "1rem" }
          })
        )
      ),

      // Nút submit
      h("button", {
        type: "submit",
        disabled: loading,
        style: {
          width: "100%",
          padding: "0.75rem",
          background: "#0066ff",
          color: "white",
          border: "none",
          borderRadius: "4px",
          fontSize: "1rem",
          cursor: loading ? "not-allowed" : "pointer"
        }
      }, loading ? "Đang xử lý..." : (isLogin ? "Đăng nhập" : "Đăng ký")),

      // Toggle Login/Signup
      h("p", { style: { textAlign: "center", marginTop: "1rem" } },
        isLogin ? "Chưa có tài khoản? " : "Đã có tài khoản? ",
        h("a", {
          href: "#",
          onClick: (e) => { e.preventDefault(); setIsLogin(!isLogin); setError(""); setSuccess(""); }
        }, isLogin ? "Đăng ký ngay" : "Đăng nhập")
      ),

      // Quên mật khẩu
      isLogin && h("p", { style: { textAlign: "center", marginTop: "1rem" } },
        h("a", {
          href: "#",
          onClick: (e) => { e.preventDefault(); handleForgotPassword(); }
        }, "Quên mật khẩu?")
      )
    )
  );
}


// ====================
// Change Password Component
// ====================
function ChangePassword() {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const { error } = await window.supabase.auth.updateUser({
        password
      });
      if (error) throw error;

      setMessage("✅ Đổi mật khẩu thành công");
      setPassword("");
    } catch (err) {
      setError(err.message || "Đổi mật khẩu thất bại");
    } finally {
      setLoading(false);
    }
  };

  return h("div", {
    style: {
      maxWidth: "400px",
      margin: "2rem auto",
      padding: "1.5rem",
      border: "1px solid #ddd",
      borderRadius: "8px"
    }
  },
    h("h3", null, "Đổi mật khẩu"),
    error && h("p", { style: { color: "red" } }, error),
    message && h("p", { style: { color: "green" } }, message),

    h("form", { onSubmit: handleChangePassword },
      h("input", {
        type: "password",
        placeholder: "Mật khẩu mới (>= 6 ký tự)",
        required: true,
        minLength: 6,
        disabled: loading,
        value: password,
        onInput: (e) => setPassword(e.target.value),
        style: { width: "100%", padding: "0.5rem", marginBottom: "1rem" }
      }),
      h("button", {
        type: "submit",
        disabled: loading,
        style: {
          width: "100%",
          padding: "0.6rem",
          background: "#0066ff",
          color: "#fff",
          border: "none",
          borderRadius: "4px"
        }
      }, loading ? "Đang đổi..." : "Đổi mật khẩu")
    )
  );
}



// ====================
// Reset Password
// ====================
function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  const handleReset = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMsg("");

    try {
      const { error } = await window.supabase.auth.updateUser({
        password
      });
      if (error) throw error;

      setMsg("✅ Đặt lại mật khẩu thành công");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return h("div", { style: { padding: "2rem", maxWidth: "400px", margin: "auto" } },
    h("h2", null, "Đặt lại mật khẩu"),
    error && h("p", { style: { color: "red" } }, error),
    msg && h("p", { style: { color: "green" } }, msg),
    h("form", { onSubmit: handleReset },
      h("input", {
        type: "password",
        required: true,
        minLength: 6,
        value: password,
        onInput: e => setPassword(e.target.value),
        placeholder: "Mật khẩu mới",
        style: { width: "100%", padding: "0.5rem", marginBottom: "1rem" }
      }),
      h("button", { disabled: loading }, loading ? "Đang xử lý..." : "Xác nhận")
    )
  );
}



// ====================
// Dashboard (sau khi login)
// ====================
function Dashboard() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    window.supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });
  }, []);

  const handleSignOut = async () => {
    await window.supabase.auth.signOut();
    navigateTo("/auth");
  };

  return h("div", { style: { padding: "2rem", textAlign: "center" } },
    h("h1", null, "Dashboard"),
    h("p", null, user ? `Xin chào ${user.email}` : "Đang tải..."),

    user && h(ChangePassword),

    user && h(Link, {to: 'profile', children: "Chỉnh sửa hồ sơ"}),

    h("button", {
      onClick: handleSignOut,
      style: { padding: "0.5rem 1rem", marginTop: "1rem" }
    }, "Đăng xuất"),
    h("br"), h("br"),
    h(Link, { to: "/auth" }, "Về trang Auth")
  );
}


// ====================
// Component Profile Edit (Chỉnh sửa thông tin cá nhân)
// ====================
function ProfileEdit() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [formData, setFormData] = useState({
    username: "",
    full_name: "",
    avatar_url: "",
    bio: "",
    website: "",
    role: ""  // Chỉ hiển thị, không cho user thường sửa
  });

  // Lấy thông tin profile khi component mount
  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      setError("");

      try {
        const { data: { user } } = await window.supabase.auth.getUser();
        if (!user) throw new Error("Bạn chưa đăng nhập");

        const { data, error } = await window.supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();

        if (error) throw error;
        if (!data) throw new Error("Không tìm thấy profile");

        setProfile(data);
        setFormData({
          username: data.username || "",
          full_name: data.full_name || "",
          avatar_url: data.avatar_url || "",
          bio: data.bio || "",
          website: data.website || "",
          role: data.role || "user"
        });
      } catch (err) {
        setError(err.message || "Không thể tải thông tin cá nhân");
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  // Xử lý thay đổi input
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Lưu thông tin
  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const { data: { user } } = await window.supabase.auth.getUser();
      if (!user) throw new Error("Bạn chưa đăng nhập");

      const updates = {
        username: formData.username.trim(),
        full_name: formData.full_name.trim(),
        avatar_url: formData.avatar_url.trim(),
        bio: formData.bio.trim(),
        website: formData.website.trim(),
        updated_at: new Date().toISOString()
      };

      // Nếu là admin, cho phép update role (nếu có thay đổi)
      if (formData.role && profile.role !== formData.role) {
        if (profile.role === "admin") {
          updates.role = formData.role;
        } else {
          throw new Error("Bạn không có quyền thay đổi role");
        }
      }

      const { error } = await window.supabase
        .from("profiles")
        .update(updates)
        .eq("id", user.id);

      if (error) throw error;

      setSuccess("Cập nhật thông tin thành công!");
      setProfile({ ...profile, ...updates }); // Cập nhật local state
    } catch (err) {
      setError(err.message || "Cập nhật thất bại, vui lòng thử lại");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return h("div", { style: { textAlign: "center", padding: "2rem" } },
      h("p", null, "Đang tải thông tin cá nhân...")
    );
  }

  if (error) {
    return h("div", { style: { textAlign: "center", padding: "2rem", color: "red" } },
      h("p", null, error)
    );
  }

  return h("div", {
    style: {
      maxWidth: "500px",
      margin: "2rem auto",
      padding: "2rem",
      border: "1px solid #ddd",
      borderRadius: "8px",
      background: "#fff"
    }
  },
    h("h2", { style: { textAlign: "center", marginBottom: "1.5rem" } }, "Chỉnh sửa thông tin cá nhân"),

    success && h("p", { style: { color: "green", textAlign: "center", marginBottom: "1rem" } }, success),
    error && h("p", { style: { color: "red", textAlign: "center", marginBottom: "1rem" } }, error),

    h("form", { onSubmit: handleSave },

      // Username
      h("div", { style: { marginBottom: "1rem" } },
        h("label", { style: { display: "block", marginBottom: "0.5rem" } }, "Username"),
        h("input", {
          type: "text",
          name: "username",
          value: formData.username,
          onInput: handleChange,
          required: true,
          minLength: 3,
          disabled: saving,
          style: { width: "100%", padding: "0.6rem", fontSize: "1rem" }
        })
      ),

      // Họ và tên
      h("div", { style: { marginBottom: "1rem" } },
        h("label", { style: { display: "block", marginBottom: "0.5rem" } }, "Họ và tên"),
        h("input", {
          type: "text",
          name: "full_name",
          value: formData.full_name,
          onInput: handleChange,
          required: true,
          disabled: saving,
          style: { width: "100%", padding: "0.6rem", fontSize: "1rem" }
        })
      ),

      // Avatar URL
      h("div", { style: { marginBottom: "1rem" } },
        h("label", { style: { display: "block", marginBottom: "0.5rem" } }, "Avatar URL"),
        h("input", {
          type: "url",
          name: "avatar_url",
          value: formData.avatar_url,
          onInput: handleChange,
          placeholder: "https://example.com/avatar.jpg",
          disabled: saving,
          style: { width: "100%", padding: "0.6rem", fontSize: "1rem" }
        })
      ),

      // Bio
      h("div", { style: { marginBottom: "1rem" } },
        h("label", { style: { display: "block", marginBottom: "0.5rem" } }, "Giới thiệu (Bio)"),
        h("textarea", {
          name: "bio",
          value: formData.bio,
          onInput: handleChange,
          rows: 4,
          disabled: saving,
          style: { width: "100%", padding: "0.6rem", fontSize: "1rem" }
        })
      ),

      // Website
      h("div", { style: { marginBottom: "1rem" } },
        h("label", { style: { display: "block", marginBottom: "0.5rem" } }, "Website"),
        h("input", {
          type: "url",
          name: "website",
          value: formData.website,
          onInput: handleChange,
          placeholder: "https://example.com",
          disabled: saving,
          style: { width: "100%", padding: "0.6rem", fontSize: "1rem" }
        })
      ),

      // Role (chỉ hiển thị, không cho user thường sửa)
      h("div", { style: { marginBottom: "1.5rem" } },
        h("label", { style: { display: "block", marginBottom: "0.5rem" } }, "Vai trò (Role)"),
        h("input", {
          type: "text",
          value: formData.role,
          disabled: true,  // Luôn disable
          style: { width: "100%", padding: "0.6rem", fontSize: "1rem", background: "#f0f0f0" }
        }),
        profile?.role !== "admin" && h("small", { style: { color: "gray", display: "block", marginTop: "0.3rem" } },
          "Chỉ admin mới có thể thay đổi role"
        )
      ),

      // Nút lưu
      h("button", {
        type: "submit",
        disabled: saving,
        style: {
          width: "100%",
          padding: "0.8rem",
          background: "#0066ff",
          color: "white",
          border: "none",
          borderRadius: "4px",
          fontSize: "1rem",
          cursor: saving ? "not-allowed" : "pointer"
        }
      }, saving ? "Đang lưu..." : "Lưu thay đổi")
    )
  );
}











// ====================
// Component AdminUsers (Quản lý người dùng - chỉ admin)
// ====================











// ====================
// Home Page
// ====================
function Home() {
  return h("div", { style: { padding: "2rem", textAlign: "center" } },
    h("h1", null, "Welcome to My App"),
    h("p", null, "Đây là trang chủ"),
    h(Link, { to: "/auth", children: "Đi đến Đăng nhập / Đăng ký"}),
    h("br"), h("br"),
    h(Link, { to: "/dashboard", children: "Dashboard (yêu cầu đăng nhập)"})
  );
}

