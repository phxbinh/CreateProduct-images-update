// AdminTasksCRUD.js
  // Helper: generate signed URL cho ảnh private
  async function getSignedUrl(path) {
    if (!path) return null;
    const { data, error } = await App.supabase.storage
      .from('admin-data')
      .createSignedUrl(path, 3600); // 1 giờ
    return error ? null : data.signedUrl;
  }

  // Component chính
  function AdminTasksCRUD() {
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isAdmin, setIsAdmin] = useState(false);

    // Form state
    const [form, setForm] = useState({
      id: null,
      title: '',
      description: '',
      priority: 'medium',
      status: 'pending',
      imageFile: null,
      imagePreview: null,
    });

    const fileInputRef = useRef(null);

    // Check role admin
    useEffect(() => {
      async function checkAdmin() {
        const { data: { user } } = await App.supabase.auth.getUser();
        if (!user) {
          setIsAdmin(false);
          return;
        }

        const { data: profile } = await App.supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();

        const isAdmin = profile?.role === 'admin';
        setIsAdmin(isAdmin);
        if (!isAdmin) setError('Bạn không có quyền admin');
      }
      checkAdmin();
    }, []);

    // Load tasks khi mount (chỉ admin)
    useEffect(() => {
      if (!isAdmin) return;

      async function fetchTasks() {
        setLoading(true);
        const { data, error } = await App.supabase
          .from('admin_tasks')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) {
          setError(error.message);
        } else {
          // Generate signed URLs cho tất cả ảnh
          const tasksWithSigned = await Promise.all(
            data.map(async (task) => {
              const signedUrl = await getSignedUrl(task.image_path);
              return { ...task, signedUrl };
            })
          );
          setTasks(tasksWithSigned);
        }
        setLoading(false);
      }

      fetchTasks();
    }, [isAdmin]);

    // Xử lý chọn file + preview
    function handleFileChange(e) {
      const file = e.target.files[0];
      if (!file) return;

      if (!file.type.startsWith('image/')) {
        setError('Chỉ chấp nhận file ảnh');
        return;
      }

      const preview = URL.createObjectURL(file);
      setForm({ ...form, imageFile: file, imagePreview: preview });
    }

    // Upload file → trả về path
    async function uploadImage(taskId) {
      if (!form.imageFile) return null;

      const fileExt = form.imageFile.name.split('.').pop();
      const fileName = `${taskId}.${fileExt}`;
      const filePath = `tasks/${taskId}/${fileName}`;

      const { error } = await App.supabase.storage
        .from('admin-data')
        .upload(filePath, form.imageFile, {
          upsert: true,
          cacheControl: '3600',
        });

      if (error) {
        throw new Error(`Upload ảnh thất bại: ${error.message}`);
      }

      return filePath;
    }

    // Submit form (create or update)
    async function handleSubmit(e) {
      e.preventDefault();
      if (!isAdmin) return;

      try {
        let imagePath = form.image_path || null;

        // Nếu có file mới → upload trước
        if (form.imageFile) {
          // Nếu edit → dùng id hiện tại, nếu create → tạm tạo id trước
          const tempId = form.id || crypto.randomUUID();
          imagePath = await uploadImage(tempId);
        }

        const payload = {
          title: form.title.trim(),
          description: form.description.trim(),
          priority: form.priority,
          status: form.status,
          image_path: imagePath,
        };

        let result;
        if (form.id) {
          // Update
          result = await App.supabase
            .from('admin_tasks')
            .update(payload)
            .eq('id', form.id)
            .select()
            .single();
        } else {
          // Create
          result = await App.supabase
            .from('admin_tasks')
            .insert(payload)
            .select()
            .single();
        }

        if (result.error) throw result.error;

        const newTask = result.data;
        const signedUrl = await getSignedUrl(newTask.image_path);

        // Cập nhật danh sách
        setTasks((prev) =>
          form.id
            ? prev.map((t) => (t.id === newTask.id ? { ...newTask, signedUrl } : t))
            : [{ ...newTask, signedUrl }, ...prev]
        );

        // Reset form
        setForm({
          id: null,
          title: '',
          description: '',
          priority: 'medium',
          status: 'pending',
          imageFile: null,
          imagePreview: null,
        });
        if (fileInputRef.current) fileInputRef.current.value = '';
      } catch (err) {
        setError(err.message);
      }
    }

    // Xóa task
    async function handleDelete(task) {
      if (!confirm(`Xóa task "${task.title}"?`)) return;

      try {
        // Xóa file ảnh nếu có
        if (task.image_path) {
          await App.supabase.storage
            .from('admin-data')
            .remove([task.image_path]);
        }

        const { error } = await App.supabase
          .from('admin_tasks')
          .delete()
          .eq('id', task.id);

        if (error) throw error;

        setTasks((prev) => prev.filter((t) => t.id !== task.id));
      } catch (err) {
        setError(err.message);
      }
    }

    // Edit task → điền form
    function handleEdit(task) {
      setForm({
        id: task.id,
        title: task.title,
        description: task.description || '',
        priority: task.priority,
        status: task.status,
        imageFile: null,
        imagePreview: task.signedUrl || null,
        image_path: task.image_path,
      });
    }

    // Nếu không phải admin → thông báo
    if (!isAdmin) {
      return h('div', { style: { padding: '2rem', color: 'red' } },
        h('h2', {}, 'Access Denied'),
        h('p', {}, error || 'Bạn cần quyền admin để truy cập phần này.')
      );
    }

    return h('div', { className: 'admin-tasks-crud', style: { padding: '1rem' } },

      // Tiêu đề
      h('h1', {}, 'Quản lý Admin Tasks'),

      // Error
      error && h('div', { style: { color: 'red', marginBottom: '1rem' } }, error),

      // Form tạo/sửa
      h('form', { onsubmit: handleSubmit, style: { marginBottom: '2rem' } },
        h('div', {},
          h('label', {}, 'Tiêu đề:'),
          h('input', {
            type: 'text',
            value: form.title,
            oninput: (e) => setForm({ ...form, title: e.target.value }),
            required: true,
            style: { width: '100%', marginBottom: '0.5rem' }
          })
        ),

        h('div', {},
          h('label', {}, 'Mô tả:'),
          h('textarea', {
            value: form.description,
            oninput: (e) => setForm({ ...form, description: e.target.value }),
            rows: 4,
            style: { width: '100%', marginBottom: '0.5rem' }
          })
        ),

        h('div', { style: { display: 'flex', gap: '1rem', marginBottom: '1rem' } },
          h('div', {},
            h('label', {}, 'Priority:'),
            h('select', {
              value: form.priority,
              onchange: (e) => setForm({ ...form, priority: e.target.value })
            },
              h('option', { value: 'low' }, 'Low'),
              h('option', { value: 'medium' }, 'Medium'),
              h('option', { value: 'high' }, 'High'),
              h('option', { value: 'urgent' }, 'Urgent')
            )
          ),

          h('div', {},
            h('label', {}, 'Status:'),
            h('select', {
              value: form.status,
              onchange: (e) => setForm({ ...form, status: e.target.value })
            },
              h('option', { value: 'pending' }, 'Pending'),
              h('option', { value: 'in_progress' }, 'In Progress'),
              h('option', { value: 'completed' }, 'Completed'),
              h('option', { value: 'cancelled' }, 'Cancelled')
            )
          )
        ),

        h('div', {},
          h('label', {}, 'Ảnh đính kèm:'),
          h('input', {
            type: 'file',
            accept: 'image/*',
            ref: fileInputRef,
            onchange: handleFileChange
          }),
          form.imagePreview && h('div', { style: { marginTop: '0.5rem' } },
            h('img', {
              src: form.imagePreview,
              alt: 'Preview',
              style: { maxWidth: '200px', maxHeight: '200px', border: '1px solid #ccc' }
            })
          )
        ),

        h('button', {
          type: 'submit',
          style: { marginTop: '1rem', padding: '0.5rem 1rem' }
        }, form.id ? 'Cập nhật Task' : 'Tạo Task mới')
      ),

      // Danh sách tasks
      loading ? h('p', {}, 'Đang tải...') :
      h('div', {},
        h('h2', {}, 'Danh sách Tasks'),
        tasks.length === 0 ? h('p', {}, 'Chưa có task nào') :
        h('ul', { style: { listStyle: 'none', padding: 0 } },
          tasks.map(task =>
            h('li', {
              key: task.id,
              style: {
                border: '1px solid #ddd',
                padding: '1rem',
                marginBottom: '1rem',
                borderRadius: '4px'
              }
            },
              h('h3', {}, task.title),
              task.description && h('p', {}, task.description),
              h('p', {}, `Priority: ${task.priority} | Status: ${task.status}`),
              task.signedUrl && h('div', {},
                h('img', {
                  src: task.signedUrl,
                  alt: task.title,
                  style: { maxWidth: '150px', marginTop: '0.5rem' }
                })
              ),
              h('div', { style: { marginTop: '1rem' } },
                h('button', {
                  onclick: () => handleEdit(task),
                  style: { marginRight: '0.5rem' }
                }, 'Sửa'),
                h('button', {
                  onclick: () => handleDelete(task),
                  style: { background: '#e74c3c', color: 'white' }
                }, 'Xóa')
              )
            )
          )
        )
      )
    );
  }