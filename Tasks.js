// Tasks.jsx
const { h } = window.App.VDOM;
const { useState, useEffect } = window.App.Hooks;

const supabase = window.supabase;

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const BUCKET = 'task-pdfs';

function getFilePathFromUrl(url) {
  if (!url) return null;
  return url.split('/').slice(-2).join('/');
}

function getPathFromPublicUrl(url) {
  if (!url) return null;
  const idx = url.indexOf('/task-pdfs/');
  if (idx === -1) return null;
  return url.substring(idx + '/task-pdfs/'.length);
}

async function removePdfByUrl(url) {
  const path = getFilePathFromUrl(url);
  if (!path) return;
  await supabase.storage.from(BUCKET).remove([path]);
}

async function uploadPdf(file, taskId) {
  if (!file) return null;

  if (file.size > MAX_FILE_SIZE) {
    throw new Error('File PDF vượt quá 50MB');
  }

  const ext = file.name.split('.').pop();
  const path = `${taskId}/${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: false });

  if (error) throw error;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

function Tasks() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const [newTitle, setNewTitle] = useState('');
  const [newPdf, setNewPdf] = useState(null);

  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editPdf, setEditPdf] = useState(null);

  useEffect(() => {
    fetchTasks();
  }, []);

  async function fetchTasks() {
    setLoading(true);
    const { data, error } = await supabase
      .from('tasks')
      .select('id,title,completed,pdf_url,created_at')
      .order('created_at', { ascending: false });

    if (error) {
      setMessage(error.message);
    } else {
      setTasks(data || []);
    }
    setLoading(false);
  }

  async function addTask() {
    if (!newTitle.trim()) return;

    try {
      setLoading(true);

      const { data: task, error } = await supabase
        .from('tasks')
        .insert({ title: newTitle.trim() })
        .select()
        .single();

      if (error) throw error;

      let pdfUrl = null;
      if (newPdf) {
        pdfUrl = await uploadPdf(newPdf, task.id);
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
      setMessage('Thêm task thành công');
    } catch (e) {
      setMessage(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function saveEdit() {
    try {
      setLoading(true);

      const task = tasks.find(t => t.id === editingId);
      if (!task) return;

      let pdfUrl = task.pdf_url;

      if (editPdf) {
        if (task.pdf_url) await removePdfByUrl(task.pdf_url);
        pdfUrl = await uploadPdf(editPdf, task.id);
      }

      await supabase
        .from('tasks')
        .update({ title: editTitle.trim(), pdf_url: pdfUrl })
        .eq('id', task.id);

      setTasks(tasks.map(t =>
        t.id === task.id ? { ...t, title: editTitle, pdf_url: pdfUrl } : t
      ));

      cancelEdit();
      setMessage('Cập nhật thành công');
    } catch (e) {
      setMessage(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function deleteTask(task) {
    setLoading(true);
    setMessage('');

    try {
      if (task.pdf_url) {
        const filePath = getPathFromPublicUrl(task.pdf_url);
        if (filePath) {
          const { error: storageError } = await supabase.storage
            .from('task-pdfs')
            .remove([filePath]);

          if (storageError) throw new Error('Không xoá được file PDF');
        }
      }

      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', task.id);

      if (error) throw error;

      setTasks(tasks => tasks.filter(t => t.id !== task.id));
      setMessage('Đã xoá task + PDF');
    } catch (err) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function toggleCompleted(task) {
    await supabase
      .from('tasks')
      .update({ completed: !task.completed })
      .eq('id', task.id);

    setTasks(tasks.map(t =>
      t.id === task.id ? { ...t, completed: !t.completed } : t
    ));
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
  }

  function checkFile(e, setter) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) {
      alert('File PDF tối đa 50MB');
      e.target.value = '';
      return;
    }
    setter(file);
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
              h('label', null, 'PDF mới:'),
              h('input', {
                type: 'file',
                accept: '.pdf',
                class: 'file-input',
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
    h('h2', { class: 'page-title' }, 'Tasks + PDF'),

    h('div', { class: 'add-task-form' },
      h('input', {
        class: 'new-task-input',
        placeholder: 'Nhập task mới...',
        value: newTitle,
        onInput: e => setNewTitle(e.target.value)
      }),

      h('div', { class: 'file-upload-wrapper' },
        h('label', null, 'Đính kèm PDF:'),
        h('input', {
          type: 'file',
          accept: '.pdf',
          class: 'file-input',
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

    h('ul', { class: 'task-list' },
      tasks.map(task => TaskItem({ task }))
    )
  );
}

// App.Router.addRoute('/tasks', Tasks);