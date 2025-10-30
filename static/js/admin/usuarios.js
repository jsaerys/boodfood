// static/js/admin/usuarios.js

// Cargar usuarios
async function cargarUsuarios() {
  try {
    const usuarios = await API.get('/api/usuarios');
    
    // Actualizar contador
    document.getElementById('usuarios-count').textContent = usuarios.length;
    
    let html = `
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Nombre</th>
            <th>Email</th>
            <th>Teléfono</th>
            <th>Rol</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody id="tbody-usuarios">
    `;
    
    usuarios.forEach(u => {
      const rolClass = 
        u.rol === 'admin' ? 'badge-danger' :
        u.rol === 'mesero' ? 'badge-info' :
        u.rol === 'cocinero' ? 'badge-warning' :
        u.rol === 'cajero' ? 'badge-success' :
        'badge-secondary';
      
      const estadoClass = u.activo ? 'badge-success' : 'badge-danger';
      const estadoText = u.activo ? '✅ Activo' : '❌ Inactivo';
      
      html += `
        <tr data-rol="${u.rol}" data-activo="${u.activo}">
          <td>${u.id}</td>
          <td><strong>${u.nombre} ${u.apellido || ''}</strong></td>
          <td>${u.email}</td>
          <td>${u.telefono || 'N/A'}</td>
          <td><span class="badge ${rolClass}">${u.rol}</span></td>
          <td><span class="badge ${estadoClass}">${estadoText}</span></td>
          <td>
            <button class="ghost small" onclick="window.editarUsuario(${u.id}, ${JSON.stringify(u).replace(/"/g, '&quot;')})">✏️ Editar</button>
            <button class="ghost small" onclick="window.toggleEstadoUsuario(${u.id}, ${!u.activo})">${u.activo ? '🔒' : '✅'}</button>
          </td>
        </tr>
      `;
    });
    
    html += '</tbody></table>';
    document.getElementById('usuarios-table').innerHTML = html;
    
  } catch (err) {
    console.error('Error:', err);
    document.getElementById('usuarios-table').innerHTML = 
      `<p class="error" style="color:red">Error al cargar usuarios: ${err.message}</p>`;
  }
}

// Funciones globales
window.crearUsuario = async () => {
  try {
    const data = {
      nombre: document.getElementById('new-user-nombre').value.trim(),
      apellido: document.getElementById('new-user-apellido').value.trim(),
      email: document.getElementById('new-user-email').value.trim(),
      telefono: document.getElementById('new-user-telefono').value.trim(),
      rol: document.getElementById('new-user-rol').value,
      password: document.getElementById('new-user-password').value,
      activo: document.getElementById('new-user-activo').value === 'true'
    };
    
    if (!data.nombre || !data.email || !data.password) {
      alert('Nombre, email y contraseña son requeridos');
      return;
    }
    
    // Validar email
    if (!data.email.includes('@')) {
      alert('Email inválido');
      return;
    }
    
    await API.post('/api/usuarios/crear', data);
    showToast('✅ Usuario creado exitosamente', 'success');
    
    // Limpiar formulario
    document.getElementById('form-crear-usuario').reset();
    cargarUsuarios();
  } catch (err) {
    showToast('❌ Error: ' + (err.message || 'No se pudo crear'), 'error');
  }
};

window.editarUsuario = (id, usuario) => {
  const modalHTML = `
    <div id="modal-editar-usuario" class="modal-overlay">
      <div class="modal-content">
        <span class="close-modal" onclick="document.getElementById('modal-editar-usuario').remove()">&times;</span>
        <h2>Editar Usuario</h2>
        <form id="form-editar-usuario">
          <div class="row">
            <div><label>Nombre</label><input type="text" id="edit-user-nombre" value="${usuario.nombre}" required></div>
            <div><label>Apellido</label><input type="text" id="edit-user-apellido" value="${usuario.apellido || ''}"></div>
          </div>
          <div class="row">
            <div><label>Email</label><input type="email" id="edit-user-email" value="${usuario.email}" required></div>
            <div><label>Teléfono</label><input type="tel" id="edit-user-telefono" value="${usuario.telefono || ''}"></div>
          </div>
          <div class="row">
            <div><label>Rol</label>
              <select id="edit-user-rol">
                <option value="cliente" ${usuario.rol === 'cliente' ? 'selected' : ''}>Cliente</option>
                <option value="mesero" ${usuario.rol === 'mesero' ? 'selected' : ''}>Mesero</option>
                <option value="cocinero" ${usuario.rol === 'cocinero' ? 'selected' : ''}>Cocinero</option>
                <option value="cajero" ${usuario.rol === 'cajero' ? 'selected' : ''}>Cajero</option>
                <option value="admin" ${usuario.rol === 'admin' ? 'selected' : ''}>Administrador</option>
              </select>
            </div>
            <div><label>Estado</label>
              <select id="edit-user-activo">
                <option value="true" ${usuario.activo ? 'selected' : ''}>Activo</option>
                <option value="false" ${!usuario.activo ? 'selected' : ''}>Inactivo</option>
              </select>
            </div>
          </div>
          <div class="row">
            <div>
              <label>Nueva Contraseña (dejar vacío para no cambiar)</label>
              <input type="password" id="edit-user-password" placeholder="Nueva contraseña">
            </div>
          </div>
          <div class="actions">
            <button type="submit" class="primary">Guardar Cambios</button>
            <button type="button" class="ghost" onclick="document.getElementById('modal-editar-usuario').remove()">Cancelar</button>
            <button type="button" class="danger" onclick="window.eliminarUsuario(${id})">Eliminar</button>
          </div>
        </form>
      </div>
    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', modalHTML);
  
  document.getElementById('form-editar-usuario').onsubmit = async (e) => {
    e.preventDefault();
    try {
      const data = {
        nombre: document.getElementById('edit-user-nombre').value,
        apellido: document.getElementById('edit-user-apellido').value,
        email: document.getElementById('edit-user-email').value,
        telefono: document.getElementById('edit-user-telefono').value,
        rol: document.getElementById('edit-user-rol').value,
        activo: document.getElementById('edit-user-activo').value === 'true'
      };
      
      const password = document.getElementById('edit-user-password').value;
      if (password) {
        data.password = password;
      }
      
      await API.put(`/api/usuarios/${id}/actualizar`, data);
      showToast('✅ Usuario actualizado', 'success');
      document.getElementById('modal-editar-usuario').remove();
      cargarUsuarios();
    } catch (err) {
      showToast('❌ Error: ' + (err.message || 'No se pudo actualizar'), 'error');
    }
  };
};

window.toggleEstadoUsuario = async (id, activo) => {
  try {
    await API.put(`/api/usuarios/${id}/estado`, { activo });
    showToast(`✅ Usuario ${activo ? 'activado' : 'desactivado'}`, 'success');
    cargarUsuarios();
  } catch (err) {
    showToast('❌ Error: ' + (err.message || 'No se pudo cambiar estado'), 'error');
  }
};

window.eliminarUsuario = async (id) => {
  if (!confirm('⚠️ ¿Eliminar este usuario? Esta acción no se puede deshacer.')) return;
  try {
    await API.del(`/api/usuarios/${id}`);
    showToast('✅ Usuario eliminado', 'success');
    document.getElementById('modal-editar-usuario').remove();
    cargarUsuarios();
  } catch (err) {
    showToast('❌ Error: ' + (err.message || 'No se pudo eliminar'), 'error');
  }
};

window.filtrarUsuarios = () => {
  const rolFilter = document.getElementById('filter-rol-usuario').value;
  const rows = document.querySelectorAll('#tbody-usuarios tr');
  
  rows.forEach(row => {
    const mostrar = rolFilter === 'todos' || row.dataset.rol === rolFilter;
    row.style.display = mostrar ? '' : 'none';
  });
};

window.buscarUsuarios = () => {
  const searchTerm = document.getElementById('search-usuario').value.toLowerCase();
  const rows = document.querySelectorAll('#tbody-usuarios tr');
  
  rows.forEach(row => {
    const texto = row.textContent.toLowerCase();
    row.style.display = texto.includes(searchTerm) ? '' : 'none';
  });
};

function showToast(message, type = 'info') {
  if (typeof Toastify !== 'undefined') {
    Toastify({
      text: message,
      duration: 3000,
      gravity: "top",
      position: "right",
      backgroundColor: type === 'success' ? '#4caf50' : type === 'error' ? '#f44336' : '#2196f3',
    }).showToast();
  } else {
    alert(message);
  }
}

// Inicialización del módulo
window.usuariosModuleLoaded = true;
cargarUsuarios();
