// static/js/admin/mesas.js

// Cargar mesas
async function cargarMesas() {
  try {
    const mesas = await API.get('/api/mesas');
    
    // Actualizar contador
    document.getElementById('mesas-count').textContent = mesas.length;
    
    let html = `
      <table>
        <thead>
          <tr>
            <th>Número</th>
            <th>Capacidad</th>
            <th>Ubicación</th>
            <th>Tipo</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody id="tbody-mesas">
    `;
    
    mesas.forEach(mesa => {
      const disponibleClass = mesa.disponible ? 'badge-success' : 'badge-warning';
      const disponibleText = mesa.disponible ? '✅ Disponible' : '🔒 Ocupada';
      
      html += `
        <tr data-disponible="${mesa.disponible}">
          <td><strong>Mesa #${mesa.numero}</strong></td>
          <td>${mesa.capacidad} personas</td>
          <td>${mesa.ubicacion || 'N/A'}</td>
          <td><span class="badge badge-${mesa.tipo}">${mesa.tipo}</span></td>
          <td><span class="badge ${disponibleClass}">${disponibleText}</span></td>
          <td>
            <button class="ghost small" onclick="window.editarMesa(${mesa.id}, ${JSON.stringify(mesa).replace(/"/g, '&quot;')})">✏️ Editar</button>
            <button class="ghost small" onclick="window.toggleDisponibilidadMesa(${mesa.id}, ${!mesa.disponible})">${mesa.disponible ? '🔒' : '✅'}</button>
          </td>
        </tr>
      `;
    });
    
    html += '</tbody></table>';
    document.getElementById('mesas-table').innerHTML = html;
    
  } catch (err) {
    console.error('Error:', err);
    document.getElementById('mesas-table').innerHTML = 
      `<p class="error" style="color:red">Error al cargar mesas: ${err.message}</p>`;
  }
}

// Funciones globales
window.crearMesa = async () => {
  try {
    const data = {
      numero: parseInt(document.getElementById('new-mesa-numero').value),
      capacidad: parseInt(document.getElementById('new-mesa-capacidad').value),
      ubicacion: document.getElementById('new-mesa-ubicacion').value,
      tipo: document.getElementById('new-mesa-tipo').value,
      disponible: document.getElementById('new-mesa-disponible').value === 'true'
    };
    
    if (!data.numero || !data.capacidad) {
      alert('Número y capacidad son requeridos');
      return;
    }
    
    await API.post('/api/mesas/crear', data);
    showToast('✅ Mesa creada exitosamente', 'success');
    
    // Limpiar formulario
    document.getElementById('form-crear-mesa').reset();
    cargarMesas();
  } catch (err) {
    showToast('❌ Error: ' + (err.message || 'No se pudo crear'), 'error');
  }
};

window.editarMesa = (id, mesa) => {
  const modalHTML = `
    <div id="modal-editar-mesa" class="modal-overlay">
      <div class="modal-content">
        <span class="close-modal" onclick="document.getElementById('modal-editar-mesa').remove()">&times;</span>
        <h2>Editar Mesa</h2>
        <form id="form-editar-mesa">
          <div class="row">
            <div><label>Número</label><input type="number" id="edit-mesa-numero" value="${mesa.numero}" required></div>
            <div><label>Capacidad</label><input type="number" id="edit-mesa-capacidad" value="${mesa.capacidad}" required></div>
          </div>
          <div class="row">
            <div><label>Ubicación</label><input type="text" id="edit-mesa-ubicacion" value="${mesa.ubicacion || ''}"></div>
            <div><label>Tipo</label>
              <select id="edit-mesa-tipo">
                <option value="interior" ${mesa.tipo === 'interior' ? 'selected' : ''}>Interior</option>
                <option value="terraza" ${mesa.tipo === 'terraza' ? 'selected' : ''}>Terraza</option>
                <option value="vip" ${mesa.tipo === 'vip' ? 'selected' : ''}>VIP</option>
              </select>
            </div>
          </div>
          <div class="row">
            <div><label>Disponible</label>
              <select id="edit-mesa-disponible">
                <option value="true" ${mesa.disponible ? 'selected' : ''}>Sí</option>
                <option value="false" ${!mesa.disponible ? 'selected' : ''}>No</option>
              </select>
            </div>
          </div>
          <div class="actions">
            <button type="submit" class="primary">Guardar Cambios</button>
            <button type="button" class="ghost" onclick="document.getElementById('modal-editar-mesa').remove()">Cancelar</button>
            <button type="button" class="danger" onclick="window.eliminarMesa(${id})">Eliminar</button>
          </div>
        </form>
      </div>
    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', modalHTML);
  
  document.getElementById('form-editar-mesa').onsubmit = async (e) => {
    e.preventDefault();
    try {
      const data = {
        numero: parseInt(document.getElementById('edit-mesa-numero').value),
        capacidad: parseInt(document.getElementById('edit-mesa-capacidad').value),
        ubicacion: document.getElementById('edit-mesa-ubicacion').value,
        tipo: document.getElementById('edit-mesa-tipo').value,
        disponible: document.getElementById('edit-mesa-disponible').value === 'true'
      };
      
      await API.put(`/api/mesas/${id}/actualizar`, data);
      showToast('✅ Mesa actualizada', 'success');
      document.getElementById('modal-editar-mesa').remove();
      cargarMesas();
    } catch (err) {
      showToast('❌ Error: ' + (err.message || 'No se pudo actualizar'), 'error');
    }
  };
};

window.toggleDisponibilidadMesa = async (id, disponible) => {
  try {
    await API.put(`/api/mesas/${id}/disponibilidad`, { disponible });
    showToast(`✅ Mesa ${disponible ? 'liberada' : 'ocupada'}`, 'success');
    cargarMesas();
  } catch (err) {
    showToast('❌ Error: ' + (err.message || 'No se pudo cambiar estado'), 'error');
  }
};

window.eliminarMesa = async (id) => {
  if (!confirm('⚠️ ¿Eliminar esta mesa?')) return;
  try {
    await API.del(`/api/mesas/${id}`);
    showToast('✅ Mesa eliminada', 'success');
    document.getElementById('modal-editar-mesa').remove();
    cargarMesas();
  } catch (err) {
    showToast('❌ Error: ' + (err.message || 'No se pudo eliminar'), 'error');
  }
};

window.filtrarMesas = () => {
  const soloDisponibles = document.getElementById('filter-mesas-disponibles').checked;
  const rows = document.querySelectorAll('#tbody-mesas tr');
  
  rows.forEach(row => {
    const esDisponible = row.dataset.disponible === 'true';
    row.style.display = (!soloDisponibles || esDisponible) ? '' : 'none';
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
window.mesasModuleLoaded = true;
cargarMesas();
