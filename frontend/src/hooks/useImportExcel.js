import { useState, useCallback, useRef } from 'react';
import * as XLSX from 'xlsx';

const REQUIRED_HEADERS = ['name', 'sku', 'price', 'stock'];
const OPTIONAL_HEADERS = ['description', 'barcode', 'cost', 'minStock', 'categoryId'];

export const useImportExcel = ({ onSuccess, onError }) => {
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState(null);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef(null);

  const validateHeaders = useCallback((headers) => {
    const normalizedHeaders = headers.map(h => h.toLowerCase().trim());
    const missing = REQUIRED_HEADERS.filter(
      req => !normalizedHeaders.some(h => h === req || h === req.replace('_', ''))
    );
    return {
      valid: missing.length === 0,
      missing,
      available: normalizedHeaders,
    };
  }, []);

  const normalizeRow = useCallback((row, headers) => {
    const normalized = {};
    const headerMap = {};
    
    headers.forEach((h, i) => {
      headerMap[h.toLowerCase().trim()] = i;
    });

    const getValue = (possibleNames) => {
      for (const name of possibleNames) {
        const idx = headerMap[name.toLowerCase()];
        if (idx !== undefined && row[idx] !== undefined && row[idx] !== '') {
          return row[idx];
        }
      }
      return null;
    };

    normalized.name = getValue(['name', 'producto', 'product', 'articulo', 'descripcion']) || '';
    normalized.sku = getValue(['sku', 'codigo', 'code', 'código', 'cod']) || '';
    normalized.price = parseFloat(getValue(['price', 'precio', 'cost', 'costo'])) || 0;
    normalized.stock = parseInt(getValue(['stock', 'cantidad', 'quantity', 'qty'])) || 0;
    normalized.description = getValue(['description', 'descripcion', 'desc', 'notas']) || '';
    normalized.barcode = getValue(['barcode', 'barcode', 'codbar', 'código de barras']) || null;
    normalized.cost = parseFloat(getValue(['cost', 'costo', 'precio costo'])) || 0;
    normalized.minStock = parseInt(getValue(['minstock', 'stockmin', 'stock mínimo', 'min stock'])) || 5;

    return normalized;
  }, []);

  const validateRow = useCallback((row, index) => {
    const errors = [];
    
    if (!row.name || row.name.trim().length === 0) {
      errors.push(`Fila ${index + 1}: Nombre es requerido`);
    }
    if (!row.sku || row.sku.trim().length === 0) {
      errors.push(`Fila ${index + 1}: SKU es requerido`);
    }
    if (row.price < 0) {
      errors.push(`Fila ${index + 1}: Precio no puede ser negativo`);
    }
    if (row.stock < 0) {
      errors.push(`Fila ${index + 1}: Stock no puede ser negativo`);
    }
    
    return errors;
  }, []);

  const handleFileSelect = useCallback(async (file) => {
    if (!file) return;
    
    if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
      onError?.('Por favor selecciona un archivo Excel (.xlsx, .xls) o CSV');
      return;
    }

    setImporting(true);
    setProgress(0);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      if (jsonData.length < 2) {
        throw new Error('El archivo debe contener encabezados y al menos una fila de datos');
      }

      const headers = jsonData[0];
      const rows = jsonData.slice(1);
      
      const validation = validateHeaders(headers);
      if (!validation.valid) {
        throw new Error(`Faltan columnas requeridas: ${validation.missing.join(', ')}`);
      }

      setProgress(30);

      const normalizedRows = rows.map(row => normalizeRow(row, headers));
      const allErrors = [];
      const validRows = [];

      normalizedRows.forEach((row, index) => {
        const errors = validateRow(row, index);
        if (errors.length > 0) {
          allErrors.push(...errors);
        } else {
          validRows.push(row);
        }
      });

      setProgress(70);

      setPreview({
        headers,
        rows: normalizedRows,
        validRows,
        errors: allErrors,
        totalRows: rows.length,
        validCount: validRows.length,
        errorCount: allErrors.length,
      });

      setProgress(100);
    } catch (error) {
      onError?.(error.message);
      setPreview(null);
    } finally {
      setImporting(false);
    }
  }, [normalizeRow, validateHeaders, validateRow, onError]);

  const clearPreview = useCallback(() => {
    setPreview(null);
    setProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const confirmImport = useCallback(async (createProducts) => {
    if (!preview?.validRows?.length) return { imported: 0, failed: 0 };

    setImporting(true);
    let imported = 0;
    let failed = 0;
    const errors = [];

    for (let i = 0; i < preview.validRows.length; i++) {
      try {
        await createProducts(preview.validRows[i]);
        imported++;
        setProgress(Math.round((i + 1) / preview.validRows.length * 100));
      } catch (error) {
        failed++;
        errors.push(`Error en "${preview.validRows[i].name}": ${error.message}`);
      }
    }

    setImporting(false);
    onSuccess?.({ imported, failed, errors });
    clearPreview();

    return { imported, failed, errors };
  }, [preview, onSuccess, clearPreview]);

  return {
    importing,
    progress,
    preview,
    fileInputRef,
    handleFileSelect,
    clearPreview,
    confirmImport,
  };
};

export const ImportExcelModal = ({ isOpen, onClose, onImport, importing, progress }) => {
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onImport(e.dataTransfer.files[0]);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
        <h2>📥 Importar Productos desde Excel</h2>
        
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          style={{
            border: `2px dashed ${dragActive ? 'var(--primary)' : 'var(--border-color)'}`,
            borderRadius: 'var(--radius-md)',
            padding: '40px',
            textAlign: 'center',
            marginBottom: '16px',
            background: dragActive ? 'rgba(79,70,229,0.05)' : 'var(--bg-main)',
            transition: 'all var(--transition-fast)',
          }}
        >
          <div style={{ fontSize: '3rem', marginBottom: '16px' }}>📊</div>
          <p style={{ marginBottom: '16px' }}>
            Arrastra y suelta tu archivo Excel aquí
          </p>
          <p style={{ color: 'var(--text-muted)', marginBottom: '16px' }}>
            Formatos aceptados: .xlsx, .xls, .csv
          </p>
          <label style={{ cursor: 'pointer' }}>
            <span className="btn btn-primary">Seleccionar archivo</span>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => e.target.files[0] && onImport(e.target.files[0])}
              style={{ display: 'none' }}
            />
          </label>
        </div>

        <div style={{ background: 'var(--bg-main)', padding: '16px', borderRadius: 'var(--radius-md)', marginBottom: '16px' }}>
          <h4 style={{ marginBottom: '8px' }}>Formato esperado:</h4>
          <table style={{ width: '100%', fontSize: '0.85rem' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '4px 8px' }}>Columna</th>
                <th style={{ textAlign: 'left', padding: '4px 8px' }}>Requerido</th>
                <th style={{ textAlign: 'left', padding: '4px 8px' }}>Ejemplo</th>
              </tr>
            </thead>
            <tbody>
              {['name', 'sku', 'price', 'stock'].map(col => (
                <tr key={col}>
                  <td style={{ padding: '4px 8px', fontWeight: 500 }}>{col}</td>
                  <td style={{ padding: '4px 8px', color: 'var(--danger)' }}>Sí</td>
                  <td style={{ padding: '4px 8px', color: 'var(--text-muted)' }}>
                    {col === 'price' ? '29.99' : col === 'stock' ? '100' : 'Ejemplo'}
                  </td>
                </tr>
              ))}
              {['description', 'barcode', 'cost', 'minStock'].map(col => (
                <tr key={col}>
                  <td style={{ padding: '4px 8px', fontWeight: 500 }}>{col}</td>
                  <td style={{ padding: '4px 8px', color: 'var(--secondary)' }}>No</td>
                  <td style={{ padding: '4px 8px', color: 'var(--text-muted)' }}>Opcional</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {importing && (
          <div style={{ marginBottom: '16px' }}>
            <div style={{ height: '8px', background: 'var(--bg-main)', borderRadius: '4px', overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: `${progress}%`,
                  background: 'var(--primary)',
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
            <p style={{ textAlign: 'center', marginTop: '8px', fontSize: '0.9rem' }}>
              {progress < 100 ? `Importando... ${progress}%` : '¡Importación completada!'}
            </p>
          </div>
        )}

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button onClick={onClose} className="btn btn-outline" disabled={importing}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
};

export default useImportExcel;
