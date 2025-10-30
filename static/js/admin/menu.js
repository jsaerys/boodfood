// static/js/admin/menu.js

// Cargar contenido del menú
async function cargarContenidoMenu() {
  try {
    const [categorias, menuItems] = await Promise.all([
      API.get('/api/categorias/lista'),
      API.get('/api/menu/items')
    ]);
    
    // Actualizar contador
    document.getElementById('menu-items-count').textContent = menuItems.length;
    
    // Cargar categorías en el formulario de creación
    const catSelect = document.getElementById('new-menu-categoria');
    if (catSelect) {
      catSelect.innerHTML = '<option value="">-- Sin categoría --</option>';
      categorias.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.id;
        option.textContent = cat.nombre;
        catSelect.appendChild(option);
      });
    }
    
    // Generar tabla de items
    const tableHTML = `
      <table>
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Precio</th>
            <th>Categoría</th>
            <th>Disponible</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          ${menuItems.map(item => `
            <tr>
              <td>${item.nombre}</td>
              <td>${currency(item.precio)}</td>
              <td>${item.categoria_id ? categorias.find(c => c.id == item.categoria_id)?.nombre || 'Sin categoría' : 'Sin categoría'}</td>
              <td>${item.disponible ? '✅' : '❌'}</td>
              <td>
                <button class="ghost" onclick="window.editarMenuItem(${item.id}, ${JSON.stringify(item).replace(/"/g, '&quot;')})">Editar</button>
                <button class="ghost" onclick="window.eliminarMenuItem(${item.id})">Eliminar</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
    
    document.getElementById('menu-items-table').innerHTML = tableHTML;
    
  } catch (err) {
    console.error('Error cargando menú:', err);
    document.getElementById('menu-items-table').innerHTML = 
      `<p class="error" style="color:red">Error al cargar el menú: ${err.message}</p>`;
  }
}

// Funciones globales
window.crearMenuItem = async () => {
  try {
    const nombre = document.getElementById('new-menu-nombre').value.trim();
    const precioRaw = document.getElementById('new-menu-precio').value;
    const precio = precioRaw === '' ? NaN : parseFloat(precioRaw);
    const categoria = document.getElementById('new-menu-categoria').value || null;
    const descripcion = document.getElementById('new-menu-descripcion').value;
    const disponible = document.getElementById('new-menu-disponible').value === 'true';

    // Validaciones básicas en frontend para evitar errores en el servidor
    if (!nombre) {
      alert('El nombre del plato es requerido');
      return;
    }
    if (isNaN(precio) || precio <= 0) {
      alert('El precio debe ser un número mayor que 0');
      return;
    }

    const data = {
      nombre,
      precio,
      categoria_id: categoria,
      descripcion,
      disponible,
      restaurante_id: 1
    };
    
    if (!data.nombre || !data.precio) {
      alert('Nombre y precio son requeridos');
      return;
    }
    
    const res = await API.post('/api/menu/crear', data);
    // API.post lanza si status != ok, por lo que aquí normalmente es éxito
    if (res && res.success) {
      alert('✅ Item creado exitosamente');
    } else {
      // Por si el backend devuelve un 200 con success=false
      alert('❌ Error al crear item: ' + (res && res.message ? res.message : JSON.stringify(res)));
    }
    
    // Limpiar formulario
    document.getElementById('new-menu-nombre').value = '';
    document.getElementById('new-menu-precio').value = '';
    document.getElementById('new-menu-descripcion').value = '';
    
    // Recargar contenido
    cargarContenidoMenu();
  } catch (err) {
    alert('❌ Error: ' + (err.message || 'No se pudo crear el item'));
  }
};

window.eliminarMenuItem = async (id) => {
  if (!confirm('⚠️ ¿Eliminar este item del menú?')) return;
  try {
    await API.del(`/api/menu/${id}`);
    alert('✅ Item eliminado');
    cargarContenidoMenu();
  } catch (err) {
    alert('❌ Error: ' + (err.message || 'No se pudo eliminar'));
  }
};

window.editarMenuItem = (id, item) => {
  const modalHTML = `
    <div id="modal-editar-menu" class="modal-overlay">
      <div class="modal-content">
        <span class="close-modal" onclick="document.getElementById('modal-editar-menu').remove()">&times;</span>
        <h2>Editar Item del Menú</h2>
        <form id="form-editar-menu">
          <input type="hidden" id="edit-menu-id" value="${item.id}">
          <div class="row">
            <div><label>Nombre</label><input type="text" id="edit-menu-nombre" value="${item.nombre}" required></div>
            <div><label>Precio</label><input type="number" id="edit-menu-precio" min="0" step="0.01" value="${item.precio}" required></div>
          </div>
          <div class="row">
            <div><label>Categoría</label>
              <select id="edit-menu-categoria">
                <option value="">-- Sin categoría --</option>
                <!-- Se llenará dinámicamente -->
              </select>
            </div>
            <div><label>Disponible</label>
              <select id="edit-menu-disponible">
                <option value="true" ${item.disponible ? 'selected' : ''}>Sí</option>
                <option value="false" ${!item.disponible ? 'selected' : ''}>No</option>
              </select>
            </div>
          </div>
          <div class="row">
            <div><label>Descripción</label><textarea id="edit-menu-descripcion" rows="2">${item.descripcion || ''}</textarea></div>
          </div>
          <div class="actions">
            <button type="submit" class="primary">Guardar Cambios</button>
            <button type="button" class="ghost" onclick="document.getElementById('modal-editar-menu').remove()">Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', modalHTML);
  
  // Cargar categorías en el modal
  API.get('/api/categorias/lista').then(categorias => {
    const select = document.getElementById('edit-menu-categoria');
    select.innerHTML = '<option value="">-- Sin categoría --</option>';
    categorias.forEach(cat => {
      const option = document.createElement('option');
      option.value = cat.id;
      option.textContent = cat.nombre;
      if (cat.id == item.categoria_id) option.selected = true;
      select.appendChild(option);
    });
  });
  
  // Manejar envío
  document.getElementById('form-editar-menu').onsubmit = async (e) => {
    e.preventDefault();
    try {
      const data = {
        nombre: document.getElementById('edit-menu-nombre').value,
        precio: parseFloat(document.getElementById('edit-menu-precio').value),
        categoria_id: document.getElementById('edit-menu-categoria').value || null,
        descripcion: document.getElementById('edit-menu-descripcion').value,
        disponible: document.getElementById('edit-menu-disponible').value === 'true'
      };
      
      await API.put(`/api/menu/${id}/actualizar`, data);
      alert('✅ Item actualizado');
      document.getElementById('modal-editar-menu').remove();
      cargarContenidoMenu();
    } catch (err) {
      alert('❌ Error: ' + (err.message || 'No se pudo actualizar'));
    }
  };
};