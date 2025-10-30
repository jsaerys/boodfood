// static/js/admin/inventario.js

// Cargar inventario
async function cargarInventario() {
  try {
    const inventario = await API.get('/api/inventario');
    
    // Actualizar contador
    document.getElementById('inventario-items-count').textContent = inventario.length;
    
    let html = `
      <table>
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Cantidad</th>
            <th>Unidad</th>
            <th>Stock Mínimo</th>
            <th>Precio Unit.</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody id="tbody-inventario">
    `;
    
    inventario.forEach(item => {
      const stockBajo = item.cantidad <= item.stock_minimo;
      const estadoClass = stockBajo ? 'badge-danger' : 'badge-success';
      const estadoText = stockBajo ? '⚠️ Stock Bajo' : '✅ OK';
      
      html += `
        <tr data-stock-bajo="${stockBajo}" class="${stockBajo ? 'row-warning' : ''}">
          <td><strong>${item.nombre}</strong></td>
          <td>${item.cantidad}</td>
          <td>${item.unidad}</td>
          <td>${item.stock_minimo}</td>
          <td>${item.precio_unitario ? currency(item.precio_unitario) : 'N/A'}</td>
          <td><span class="badge ${estadoClass}">${estadoText}</span></td>
          <td>
            <button class="ghost small" onclick="window.editarInventario(${item.id}, ${JSON.stringify(item).replace(/"/g, '&quot;')})">✏️ Editar</button>
            <button class="ghost small" onclick="window.ajustarStock(${item.id}, '${item.nombre}', ${item.cantidad})">📦 Ajustar</button>
          </td>
        </tr>
      `;
    });
    
    html += '</tbody></table>';
    document.getElementById('inventario-table').innerHTML = html;
    
  } catch (err) {
    console.error('Error:', err);
    document.getElementById('inventario-table').innerHTML = 
      `<p class="error" style="color:red">Error al cargar inventario: ${err.message}</p>`;
  }
}

// Funciones globales
window.crearInventarioItem = async () => {
  try {
    const data = {
      nombre: document.getElementById('new-inv-nombre').value.trim(),
      cantidad: parseFloat(document.getElementById('new-inv-cantidad').value),
      unidad: document.getElementById('new-inv-unidad').value,
      precio_unitario: parseFloat(document.getElementById('new-inv-precio').value) || null,
      stock_minimo: parseFloat(document.getElementById('new-inv-stock-min').value) || 0,
      descripcion: document.getElementById('new-inv-descripcion').value
    };
    
    if (!data.nombre || isNaN(data.cantidad)) {
      alert('Nombre y cantidad son requeridos');
      return;
    }
    
    await API.post('/api/inventario/crear', data);
    showToast('✅ Item agregado al inventario', 'success');
    
    // Limpiar formulario
    document.getElementById('form-crear-inventario').reset();
    cargarInventario();
  } catch (err) {
    showToast('❌ Error: ' + (err.message || 'No se pudo crear'), 'error');
  }
};

window.editarInventario = (id, item) => {
  const modalHTML = `
    <div id="modal-editar-inventario" class="modal-overlay">
      <div class="modal-content">
        <span class="close-modal" onclick="document.getElementById('modal-editar-inventario').remove()">&times;</span>
        <h2>Editar Item de Inventario</h2>
        <form id="form-editar-inventario">
          <div class="row">
            <div><label>Nombre</label><input type="text" id="edit-inv-nombre" value="${item.nombre}" required></div>
            <div><label>Unidad</label>
              <select id="edit-inv-unidad">
                <option value="kg" ${item.unidad === 'kg' ? 'selected' : ''}>kg</option>
                <option value="g" ${item.unidad === 'g' ? 'selected' : ''}>g</option>
                <option value="L" ${item.unidad === 'L' ? 'selected' : ''}>L</option>
                <option value="ml" ${item.unidad === 'ml' ? 'selected' : ''}>ml</option>
                <option value="unidad" ${item.unidad === 'unidad' ? 'selected' : ''}>Unidades</option>
                <option value="paquete" ${item.unidad === 'paquete' ? 'selected' : ''}>Paquetes</option>
              </select>
            </div>
          </div>
          <div class="row">
            <div><label>Precio Unitario</label><input type="number" id="edit-inv-precio" min="0" step="0.01" value="${item.precio_unitario || ''}"></div>
            <div><label>Stock Mínimo</label><input type="number" id="edit-inv-stock-min" min="0" step="0.01" value="${item.stock_minimo}"></div>
          </div>
          <div class="row">
            <div><label>Descripción</label><textarea id="edit-inv-descripcion" rows="2">${item.descripcion || ''}</textarea></div>
          </div>
          <div class="actions">
            <button type="submit" class="primary">Guardar Cambios</button>
            <button type="button" class="ghost" onclick="document.getElementById('modal-editar-inventario').remove()">Cancelar</button>
            <button type="button" class="danger" onclick="window.eliminarInventario(${id})">Eliminar</button>
          </div>
        </form>
      </div>
    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', modalHTML);
  
  document.getElementById('form-editar-inventario').onsubmit = async (e) => {
    e.preventDefault();
    try {
      const data = {
        nombre: document.getElementById('edit-inv-nombre').value,
        unidad: document.getElementById('edit-inv-unidad').value,
        precio_unitario: parseFloat(document.getElementById('edit-inv-precio').value) || null,
        stock_minimo: parseFloat(document.getElementById('edit-inv-stock-min').value),
        descripcion: document.getElementById('edit-inv-descripcion').value
      };
      
      await API.put(`/api/inventario/${id}/actualizar`, data);
      showToast('✅ Item actualizado', 'success');
      document.getElementById('modal-editar-inventario').remove();
      cargarInventario();
    } catch (err) {
      showToast('❌ Error: ' + (err.message || 'No se pudo actualizar'), 'error');
    }
  };
};

window.ajustarStock = (id, nombre, cantidadActual) => {
  const modalHTML = `
    <div id="modal-ajustar-stock" class="modal-overlay">
      <div class="modal-content" style="max-width: 400px;">
        <span class="close-modal" onclick="document.getElementById('modal-ajustar-stock').remove()">&times;</span>
        <h2>Ajustar Stock</h2>
        <p><strong>${nombre}</strong></p>
        <p>Cantidad actual: ${cantidadActual}</p>
        
        <form id="form-ajustar-stock">
          <div class="row">
            <div>
              <label>Tipo de Movimiento</label>
              <select id="ajuste-tipo" required>
                <option value="entrada">Entrada (sumar)</option>
                <option value="salida">Salida (restar)</option>
              </select>
            </div>
          </div>
          <div class="row">
            <div>
              <label>Cantidad</label>
              <input type="number" id="ajuste-cantidad" min="0" step="0.01" required>
            </div>
          </div>
          <div class="row">
            <div>
              <label>Notas</label>
              <textarea id="ajuste-notas" rows="2" placeholder="Motivo del ajuste"></textarea>
            </div>
          </div>
          <div class="actions">
            <button type="submit" class="primary">Registrar Movimiento</button>
            <button type="button" class="ghost" onclick="document.getElementById('modal-ajustar-stock').remove()">Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', modalHTML);
  
  document.getElementById('form-ajustar-stock').onsubmit = async (e) => {
    e.preventDefault();
    try {
      const data = {
        tipo: document.getElementById('ajuste-tipo').value,
        cantidad: parseFloat(document.getElementById('ajuste-cantidad').value),
        notas: document.getElementById('ajuste-notas').value
      };
      
      await API.post(`/api/inventario/${id}/movimiento`, data);
      showToast('✅ Movimiento registrado', 'success');
      document.getElementById('modal-ajustar-stock').remove();
      cargarInventario();
    } catch (err) {
      showToast('❌ Error: ' + (err.message || 'No se pudo registrar'), 'error');
    }
  };
};

window.eliminarInventario = async (id) => {
  if (!confirm('⚠️ ¿Eliminar este item del inventario?')) return;
  try {
    await API.del(`/api/inventario/${id}`);
    showToast('✅ Item eliminado', 'success');
    document.getElementById('modal-editar-inventario').remove();
    cargarInventario();
  } catch (err) {
    showToast('❌ Error: ' + (err.message || 'No se pudo eliminar'), 'error');
  }
};

window.filtrarInventario = () => {
  const soloStockBajo = document.getElementById('filter-stock-bajo').checked;
  const rows = document.querySelectorAll('#tbody-inventario tr');
  
  rows.forEach(row => {
    const esStockBajo = row.dataset.stockBajo === 'true';
    row.style.display = (!soloStockBajo || esStockBajo) ? '' : 'none';
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
window.inventarioModuleLoaded = true;
cargarInventario();
