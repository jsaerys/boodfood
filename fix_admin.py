#!/usr/bin/env python
# Script temporal para eliminar líneas duplicadas
with open('routes/admin.py', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Mantener solo las primeras 736 líneas
with open('routes/admin.py', 'w', encoding='utf-8') as f:
    f.writelines(lines[:736])

print(f"✅ Archivo limpiado. Líneas totales: {len(lines[:736])}")
