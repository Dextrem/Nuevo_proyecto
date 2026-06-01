import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { backupService } from '../services/api';
import { extractColors } from '../utils/colorExtractor';

const Settings = () => {
  const { settings, updateSettings, loadSettings } = useApp();
  const [formData, setFormData] = useState({ ...settings });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [backupFile, setBackupFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(settings.logo || null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    const result = await updateSettings(formData);

    if (result.success) {
      setMessage({ type: 'success', text: 'Configuración guardada exitosamente' });
    } else {
      setMessage({ type: 'error', text: result.error });
    }

    setSaving(false);
  };

  const handleChange = (field, value) => {
    setFormData({ ...formData, [field]: value });
  };

  const handleLogoChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'La imagen debe ser menor a 2MB' });
      return;
    }

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result;
      setLogoPreview(base64);
      setFormData(prev => ({ ...prev, logo: base64 }));

      try {
        const colors = await extractColors(base64);
        setFormData(prev => ({ ...prev, ...colors }));
        setMessage({
          type: 'success',
          text: `Colores extraídos del logo: primario ${colors.primary}`,
        });
      } catch (err) {
        console.error('Error extrayendo colores:', err);
      }
    };
    reader.readAsDataURL(file);
  };

  const removeLogo = () => {
    setLogoPreview(null);
    setFormData({ ...formData, logo: null });
  };

  const handleExportBackup = async () => {
    try {
      setMessage(null);
      const response = await backupService.export();
      const backupJson = JSON.stringify(response.data, null, 2);
      const defaultFileName = `finandex_backup_${new Date().toISOString().split('T')[0]}.json`;

      if ('showSaveFilePicker' in window) {
        try {
          const options = {
            suggestedName: defaultFileName,
            types: [
              {
                description: 'Archivos JSON',
                accept: {
                  'application/json': ['.json'],
                },
              },
            ],
          };
          
          const fileHandle = await window.showSaveFilePicker(options);
          const writable = await fileHandle.createWritable();
          await writable.write(backupJson);
          await writable.close();
          
          setMessage({ type: 'success', text: `Backup guardado en: ${fileHandle.name}` });
        } catch (err) {
          if (err.name === 'AbortError') {
            setMessage({ type: 'info', text: 'Selección cancelada por el usuario' });
          } else {
            throw err;
          }
        }
      } else if ('showDirectoryPicker' in window) {
        try {
          const directoryHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
          const fileHandle = await directoryHandle.getFileHandle(defaultFileName, { create: true });
          const writable = await fileHandle.createWritable();
          await writable.write(backupJson);
          await writable.close();
          setMessage({ type: 'success', text: `Backup guardado en carpeta: ${directoryHandle.name}` });
        } catch (err) {
          if (err.name === 'AbortError') {
            setMessage({ type: 'info', text: 'Selección cancelada por el usuario' });
          } else {
            throw err;
          }
        }
      } else {
        const blob = new Blob([backupJson], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = defaultFileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setMessage({ type: 'success', text: 'Backup descargado exitosamente' });
      }
    } catch (error) {
      console.error('Error:', error);
      setMessage({ type: 'error', text: 'Error al exportar backup: ' + (error.message || 'Error desconocido') });
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setBackupFile(file);
    }
  };

  const handleRestoreBackup = async () => {
    if (!backupFile) {
      setMessage({ type: 'error', text: 'Selecciona un archivo de backup' });
      return;
    }

    try {
      const text = await backupFile.text();
      const backupData = JSON.parse(text);

      if (!backupData.data || !backupData.version) {
        setMessage({ type: 'error', text: 'Archivo de backup inválido' });
        return;
      }

      const response = await backupService.import(backupData);
      setShowRestoreConfirm(false);
      setBackupFile(null);
      setMessage({ type: 'success', text: 'Backup restaurado. Por favor, recarga la página.' });
      
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.error || 'Error al restaurar backup' });
    }
  };

  const handleScheduledBackup = async () => {
    try {
      setMessage(null);
      await backupService.schedule();
      setMessage({ type: 'success', text: 'Backup automático completado exitosamente' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Error en backup automático' });
    }
  };

  return (
    <div>
      <div className="view-header">
        <div>
          <h1>Configuración</h1>
          <p>Personaliza tu aplicación</p>
        </div>
      </div>

      {message && (
        <div
          style={{
            padding: '12px',
            backgroundColor: message.type === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
            color: message.type === 'success' ? 'var(--secondary)' : 'var(--danger)',
            borderRadius: '8px',
            marginBottom: '20px',
          }}
        >
          {message.text}
        </div>
      )}

      <div className="settings-container">
        <form onSubmit={handleSubmit}>
          <div className="settings-section">
            <h3>
              <i className="fas fa-building"></i>
              Información de la Empresa
            </h3>
            <div className="form-group">
              <label>Nombre de la Empresa</label>
              <input
                type="text"
                className="form-control"
                value={formData.companyName}
                onChange={(e) => handleChange('companyName', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>RNC</label>
              <input
                type="text"
                className="form-control"
                value={formData.companyRnc || ''}
                onChange={(e) => handleChange('companyRnc', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Dirección</label>
              <textarea
                className="form-control"
                value={formData.companyAddress || ''}
                onChange={(e) => handleChange('companyAddress', e.target.value)}
                rows="2"
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label>Teléfono</label>
                <input
                  type="text"
                  className="form-control"
                  value={formData.companyPhone || ''}
                  onChange={(e) => handleChange('companyPhone', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  className="form-control"
                  value={formData.companyEmail || ''}
                  onChange={(e) => handleChange('companyEmail', e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="settings-section">
            <h3>
              <i className="fas fa-image"></i>
              Logo de la Empresa
            </h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>
              Sube el logo de tu empresa para mostrarlo en el sistema y los receipts.
            </p>
            
            <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div style={{ 
                width: '150px', 
                height: '150px', 
                border: '2px dashed var(--border-color)',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'var(--bg-surface-hover)',
                overflow: 'hidden'
              }}>
                {logoPreview ? (
                  <img 
                    src={logoPreview} 
                    alt="Logo preview" 
                    style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} 
                  />
                ) : (
                  <i className="fas fa-image" style={{ fontSize: '3rem', color: 'var(--text-muted)' }}></i>
                )}
              </div>
              
              <div style={{ flex: 1, minWidth: '200px' }}>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoChange}
                  style={{ marginBottom: '12px' }}
                />
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
                  Formatos aceptados: JPG, PNG, GIF, SVG<br />
                  Tamaño máximo: 2MB
                </p>
                {logoPreview && (
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={removeLogo}
                    style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}
                  >
                    <i className="fas fa-trash"></i>
                    Eliminar Logo
                  </button>
                )}
              </div>
            </div>

            {logoPreview && (
              <div style={{ marginTop: '20px', padding: '16px', backgroundColor: 'var(--bg-surface-hover)', borderRadius: '8px' }}>
                <h4 style={{ marginBottom: '12px' }}>Vista Previa</h4>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <img 
                    src={logoPreview} 
                    alt="Logo preview" 
                    style={{ height: '40px', width: 'auto', objectFit: 'contain' }} 
                  />
                  <span style={{ fontWeight: '500' }}>{formData.companyName}</span>
                </div>
              </div>
            )}
          </div>

          <div className="settings-section">
            <h3>
              <i className="fas fa-coins"></i>
              Moneda y Impuestos
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label>Moneda</label>
                <select
                  className="form-control"
                  value={formData.currency}
                  onChange={(e) => handleChange('currency', e.target.value)}
                >
                  <option value="DOP">DOP - Peso Dominicano</option>
                  <option value="USD">USD - Dólar Estadounidense</option>
                  <option value="EUR">EUR - Euro</option>
                </select>
              </div>
              <div className="form-group">
                <label>Símbolo de Moneda</label>
                <input
                  type="text"
                  className="form-control"
                  value={formData.currencySymbol}
                  onChange={(e) => handleChange('currencySymbol', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Tasa de Impuesto (%)</label>
                <input
                  type="number"
                  step="0.01"
                  className="form-control"
                  value={(formData.taxRate * 100).toFixed(2)}
                  onChange={(e) => handleChange('taxRate', parseFloat(e.target.value) / 100)}
                />
              </div>
            </div>
            <div className="form-group">
              <label>Tasa de Interés (%)</label>
              <input
                type="number"
                step="0.01"
                className="form-control"
                value={(formData.interestRate * 100).toFixed(2)}
                onChange={(e) => handleChange('interestRate', parseFloat(e.target.value) / 100)}
                style={{ maxWidth: '200px' }}
              />
            </div>
          </div>

          <div className="settings-section">
            <h3>
              <i className="fas fa-percentage"></i>
              Comisiones
            </h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>
              Configura los parámetros para el cálculo de comisiones de vendedores.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label>Tasa de Comisión (%)</label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="100"
                  className="form-control"
                  value={(formData.commissionRate * 100).toFixed(1)}
                  onChange={(e) => handleChange('commissionRate', parseFloat(e.target.value) / 100)}
                />
                <small style={{ color: 'var(--text-muted)' }}>
                  Porcentaje que aplica sobre el excedente
                </small>
              </div>
              <div className="form-group">
                <label>Monto Mínimo (RD$)</label>
                <input
                  type="number"
                  step="100"
                  min="0"
                  className="form-control"
                  value={formData.commissionMinAmount || 4000}
                  onChange={(e) => handleChange('commissionMinAmount', parseFloat(e.target.value))}
                />
                <small style={{ color: 'var(--text-muted)' }}>
                  Ventas mínimas para generar comisión
                </small>
              </div>
            </div>
            <div className="form-group">
              <label>Tipo de Cálculo</label>
              <select
                className="form-control"
                value={formData.commissionType || 'BY_SALE'}
                onChange={(e) => handleChange('commissionType', e.target.value)}
                style={{ maxWidth: '300px' }}
              >
                <option value="BY_SALE">Por Venta (15% sobre excedente de {formData.commissionMinAmount || 4000})</option>
                <option value="ACCUMULATED">Acumulado (15% sobre total de ventas)</option>
              </select>
              <small style={{ color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                {formData.commissionType === 'BY_SALE' 
                  ? 'Aplica el porcentaje solo sobre el monto que excede el mínimo por venta'
                  : 'Aplica el porcentaje sobre el total acumulado de ventas en el período'}
              </small>
            </div>
          </div>

          <div className="settings-section">
            <h3><i className="fas fa-shield-alt"></i> Seguridad y Acceso</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>
              Configura las políticas de seguridad para sesiones y contraseñas.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label>Tiempo de Sesión (minutos)</label>
                <input type="number" min="5" max="480" className="form-control" value={formData.sessionTimeoutMinutes || 30} onChange={(e) => handleChange('sessionTimeoutMinutes', parseInt(e.target.value) || 30)} />
                <small style={{ color: 'var(--text-muted)' }}>Tiempo de inactividad antes de cerrar sesión (5-480 min)</small>
              </div>
              <div className="form-group">
                <label>Máx. Intentos de Login</label>
                <input type="number" min="1" max="20" className="form-control" value={formData.maxLoginAttempts || 5} onChange={(e) => handleChange('maxLoginAttempts', parseInt(e.target.value) || 5)} />
                <small style={{ color: 'var(--text-muted)' }}>Intentos fallidos antes de bloquear la cuenta</small>
              </div>
              <div className="form-group">
                <label>Duración de Bloqueo (minutos)</label>
                <input type="number" min="1" max="1440" className="form-control" value={formData.lockoutDurationMinutes || 15} onChange={(e) => handleChange('lockoutDurationMinutes', parseInt(e.target.value) || 15)} />
                <small style={{ color: 'var(--text-muted)' }}>Tiempo que permanece bloqueada la cuenta</small>
              </div>
              <div className="form-group">
                <label>Expiración de Contraseña (días)</label>
                <input type="number" min="7" max="365" className="form-control" value={formData.defaultPasswordExpDays || 90} onChange={(e) => handleChange('defaultPasswordExpDays', parseInt(e.target.value) || 90)} />
                <small style={{ color: 'var(--text-muted)' }}>Días antes de solicitar cambio de contraseña</small>
              </div>
            </div>
          </div>

          <div className="settings-section">
            <h3><i className="fas fa-cash-register"></i> Punto de Venta</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>
              Opciones que afectan el comportamiento del POS y las ventas.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label>Límite de Crédito por Defecto (RD$)</label>
                <input type="number" min="0" step="500" className="form-control" value={formData.defaultCreditLimit || 5000} onChange={(e) => handleChange('defaultCreditLimit', parseFloat(e.target.value) || 0)} />
                <small style={{ color: 'var(--text-muted)' }}>Se asigna a clientes nuevos creados desde el POS</small>
              </div>
              <div className="form-group">
                <label>Mensaje en Pie de Recibo</label>
                <input type="text" className="form-control" value={formData.receiptFooterMessage || ''} onChange={(e) => handleChange('receiptFooterMessage', e.target.value)} placeholder="Ej: ¡Gracias por su compra!" />
                <small style={{ color: 'var(--text-muted)' }}>Texto personalizado al final del recibo</small>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '16px' }}>
              <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <input type="checkbox" id="requireCashRegister" checked={formData.requireCashRegister !== false} onChange={(e) => handleChange('requireCashRegister', e.target.checked)} style={{ width: '20px', height: '20px' }} />
                <div>
                  <label htmlFor="requireCashRegister" style={{ cursor: 'pointer', marginBottom: 0 }}>Requerir Caja Abierta</label>
                  <small style={{ color: 'var(--text-muted)', display: 'block' }}>Bloquear ventas si no hay caja activa</small>
                </div>
              </div>
              <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <input type="checkbox" id="allowNegativeStock" checked={formData.allowNegativeStock === true} onChange={(e) => handleChange('allowNegativeStock', e.target.checked)} style={{ width: '20px', height: '20px' }} />
                <div>
                  <label htmlFor="allowNegativeStock" style={{ cursor: 'pointer', marginBottom: 0 }}>Permitir Stock Negativo</label>
                  <small style={{ color: 'var(--text-muted)', display: 'block' }}>Vender productos sin existencia disponible</small>
                </div>
              </div>
            </div>
          </div>

          <div className="settings-section">
            <h3><i className="fas fa-boxes"></i> Inventario</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label>Stock Mínimo por Defecto</label>
                <input type="number" min="0" className="form-control" value={formData.defaultMinStock || 5} onChange={(e) => handleChange('defaultMinStock', parseInt(e.target.value) || 0)} />
                <small style={{ color: 'var(--text-muted)' }}>Umbral de alerta para productos nuevos</small>
              </div>
              <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingTop: '24px' }}>
                <input type="checkbox" id="lowStockAlertEnabled" checked={formData.lowStockAlertEnabled !== false} onChange={(e) => handleChange('lowStockAlertEnabled', e.target.checked)} style={{ width: '20px', height: '20px' }} />
                <div>
                  <label htmlFor="lowStockAlertEnabled" style={{ cursor: 'pointer', marginBottom: 0 }}>Alertas de Stock Bajo</label>
                  <small style={{ color: 'var(--text-muted)', display: 'block' }}>Mostrar notificaciones cuando un producto esté bajo el mínimo</small>
                </div>
              </div>
            </div>
          </div>

          <div className="settings-section">
            <h3><i className="fas fa-file-invoice"></i> Facturación Fiscal (NCF)</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>
              Configuración para la emisión de comprobantes fiscales (DGII - República Dominicana).
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <input type="checkbox" id="fiscalEnabled" checked={formData.fiscalEnabled === true} onChange={(e) => handleChange('fiscalEnabled', e.target.checked)} style={{ width: '20px', height: '20px' }} />
                <div>
                  <label htmlFor="fiscalEnabled" style={{ cursor: 'pointer', marginBottom: 0 }}>Activar Facturación Fiscal</label>
                  <small style={{ color: 'var(--text-muted)', display: 'block' }}>Generar NCF automáticamente en cada venta</small>
                </div>
              </div>
              <div className="form-group">
                <label>Tipo NCF por Defecto</label>
                <select className="form-control" value={formData.defaultNcfType || '02'} onChange={(e) => handleChange('defaultNcfType', e.target.value)} disabled={!formData.fiscalEnabled}>
                  <option value="01">01 - Crédito Fiscal</option>
                  <option value="02">02 - Consumidor Final</option>
                  <option value="14">14 - Régimen Especial</option>
                  <option value="15">15 - Gubernamental</option>
                </select>
              </div>
            </div>
          </div>

          <div className="settings-section">
            <h3><i className="fas fa-shield-alt"></i> Garantía</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>
              Configura la emisión automática de certificados de garantía para ventas que superen el monto mínimo.
            </p>
            <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <input type="checkbox" id="warrantyEnabled" checked={formData.warrantyEnabled !== false} onChange={(e) => handleChange('warrantyEnabled', e.target.checked)} style={{ width: '20px', height: '20px' }} />
              <div>
                <label htmlFor="warrantyEnabled" style={{ cursor: 'pointer', marginBottom: 0 }}>Activar Certificado de Garantía</label>
                <small style={{ color: 'var(--text-muted)', display: 'block' }}>Mostrar opción de garantía en ventas que superen el monto mínimo</small>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label>Monto Mínimo (RD$)</label>
                <input type="number" min="0" step="100" className="form-control" value={formData.warrantyMinAmount || 2000} onChange={(e) => handleChange('warrantyMinAmount', parseFloat(e.target.value) || 0)} />
                <small style={{ color: 'var(--text-muted)' }}>Ventas desde este monto podrán incluir garantía</small>
              </div>
              <div className="form-group">
                <label>Días de Garantía por Defecto</label>
                <input type="number" min="1" max="3650" className="form-control" value={formData.warrantyDefaultDays || 90} onChange={(e) => handleChange('warrantyDefaultDays', parseInt(e.target.value) || 90)} />
                <small style={{ color: 'var(--text-muted)' }}>Período de cobertura predeterminado</small>
              </div>
            </div>
            <div className="form-group">
              <label>Texto de Cobertura</label>
              <textarea className="form-control" value={formData.warrantyCoverageText || ''} onChange={(e) => handleChange('warrantyCoverageText', e.target.value)} rows="3" placeholder="Ej: Defectos de fábrica en materiales y mano de obra" />
              <small style={{ color: 'var(--text-muted)' }}>Lo que cubre la garantía (editable por venta)</small>
            </div>
            <div className="form-group">
              <label>Texto de Exclusiones</label>
              <textarea className="form-control" value={formData.warrantyExclusionText || ''} onChange={(e) => handleChange('warrantyExclusionText', e.target.value)} rows="3" placeholder="Ej: Daños por mal uso, golpes, humedad, sobrecargas eléctricas" />
              <small style={{ color: 'var(--text-muted)' }}>Lo que NO cubre la garantía (editable por venta)</small>
            </div>
          </div>

          <div className="settings-section">
            <h3>
              <i className="fas fa-palette"></i>
              Apariencia
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label>Tema</label>
                <select
                  className="form-control"
                  value={formData.theme}
                  onChange={(e) => handleChange('theme', e.target.value)}
                >
                  <option value="light">Claro</option>
                  <option value="dark">Oscuro</option>
                </select>
              </div>
              <div className="form-group">
                <label>Color Principal</label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    type="color"
                    value={formData.primaryColor}
                    onChange={(e) => handleChange('primaryColor', e.target.value)}
                    style={{ width: '50px', height: '40px', cursor: 'pointer' }}
                  />
                  <input
                    type="text"
                    className="form-control"
                    value={formData.primaryColor}
                    onChange={(e) => handleChange('primaryColor', e.target.value)}
                    style={{ maxWidth: '150px' }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar Configuración'}
            </button>
          </div>
        </form>

        <div className="settings-section" style={{ marginTop: '24px' }}>
          <h3>
            <i className="fas fa-database"></i>
            Backup y Restauración
          </h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>
            Exporta tus datos para tener una copia de seguridad o restaura desde un backup anterior.
          </p>

          <div style={{ 
            padding: '20px', 
            backgroundColor: 'var(--bg-surface-hover)', 
            borderRadius: '8px',
            border: '1px solid var(--border-color)',
            marginBottom: '20px'
          }}>
            <h4 style={{ marginBottom: '12px' }}>
              <i className="fas fa-download"></i>
              Exportar Backup
            </h4>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '16px' }}>
              Al hacer clic en "Elegir ubicación", se abrirá un diálogo donde podrás seleccionar la carpeta exacta 
              donde deseas guardar el archivo de backup. También puedes cambiar el nombre del archivo si lo deseas.
            </p>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <button className="btn btn-primary" onClick={handleExportBackup}>
                <i className="fas fa-folder-open"></i>
                Elegir ubicación...
              </button>
              <button className="btn btn-outline" onClick={handleScheduledBackup}>
                <i className="fas fa-clock"></i>
                Backup Automático
              </button>
            </div>
          </div>

          <div style={{ 
            padding: '20px', 
            backgroundColor: 'rgba(239,68,68,0.05)', 
            borderRadius: '8px',
            border: '1px solid rgba(239,68,68,0.2)'
          }}>
            <h4 style={{ marginBottom: '16px', color: 'var(--danger)' }}>
              <i className="fas fa-upload"></i>
              Restaurar desde Backup
            </h4>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '16px' }}>
              Selecciona un archivo de backup (.json) para restaurar tus datos. 
              <strong style={{ color: 'var(--danger)' }}>Esta acción reemplazará TODOS los datos actuales.</strong>
            </p>
            <input
              type="file"
              accept=".json"
              onChange={handleFileChange}
              style={{ marginBottom: '16px' }}
            />
            {backupFile && (
              <div style={{ 
                padding: '12px', 
                backgroundColor: 'rgba(245,158,11,0.1)', 
                borderRadius: '8px',
                marginBottom: '16px',
                color: 'var(--accent)'
              }}>
                <strong>Archivo seleccionado:</strong> {backupFile.name}
                <br />
                <small>Tamaño: {(backupFile.size / 1024).toFixed(2)} KB</small>
              </div>
            )}
            <button 
              className="btn btn-primary" 
              onClick={() => setShowRestoreConfirm(true)}
              disabled={!backupFile}
              style={{ 
                backgroundColor: backupFile ? 'var(--danger)' : undefined,
                opacity: backupFile ? 1 : 0.5
              }}
            >
              <i className="fas fa-exclamation-triangle"></i>
              Restaurar Backup
            </button>
          </div>
        </div>

        <div className="settings-section" style={{ marginTop: '24px' }}>
          <h3>
            <i className="fas fa-tools"></i>
            Centro de Solución de Problemas
          </h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>
            Herramientas para diagnosticar y corregir comportamientos inesperados en el sistema.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
            <div style={{ 
              padding: '20px', 
              backgroundColor: 'var(--bg-surface-hover)', 
              borderRadius: '8px',
              border: '1px solid var(--border-color)'
            }}>
              <h4 style={{ marginBottom: '8px' }}>
                <i className="fas fa-sync-alt"></i>
                Forzar Sincronización
              </h4>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '16px' }}>
                Recalcula los balances internos de las cajas abiertas y actualiza la sincronización con el servidor.
              </p>
              <button className="btn btn-outline" onClick={() => {
                loadSettings();
                setMessage({ type: 'success', text: 'Datos sincronizados correctamente' });
                setTimeout(() => window.location.reload(), 1000);
              }} style={{ width: '100%' }}>
                Sincronizar Ahora
              </button>
            </div>

            <div style={{ 
              padding: '20px', 
              backgroundColor: 'var(--bg-surface-hover)', 
              borderRadius: '8px',
              border: '1px solid var(--border-color)'
            }}>
              <h4 style={{ marginBottom: '8px' }}>
                <i className="fas fa-eraser"></i>
                Reiniciar Aplicación
              </h4>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '16px' }}>
                Limpia los datos temporales del navegador. Útil si la interfaz se queda "congelada" o no carga.
              </p>
              <button className="btn btn-outline" onClick={() => {
                sessionStorage.clear();
                localStorage.removeItem('finandex_settings');
                window.location.href = '/login';
              }} style={{ width: '100%', color: 'var(--danger)', borderColor: 'rgba(239,68,68,0.3)' }}>
                Limpiar y Cerrar Sesión
              </button>
            </div>
          </div>
        </div>
      </div>

      {showRestoreConfirm && (
        <div className="modal-overlay" onClick={() => setShowRestoreConfirm(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div style={{ 
                width: '60px', 
                height: '60px', 
                backgroundColor: 'rgba(239,68,68,0.1)', 
                borderRadius: '50%', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                margin: '0 auto 16px'
              }}>
                <i className="fas fa-exclamation-triangle" style={{ fontSize: '30px', color: 'var(--danger)' }}></i>
              </div>
              <h2 style={{ color: 'var(--danger)', margin: '0 0 8px' }}>¡Advertencia!</h2>
              <p style={{ color: 'var(--text-muted)', margin: 0 }}>
                Esta acción <strong>eliminará todos los datos actuales</strong> y los reemplazará con los del backup.
              </p>
            </div>
            <div style={{ 
              padding: '16px', 
              backgroundColor: 'rgba(245,158,11,0.1)', 
              borderRadius: '8px',
              marginBottom: '20px'
            }}>
              <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--accent)' }}>
                <i className="fas fa-info-circle"></i>
                {' '}Se recomienda hacer un backup de los datos actuales antes de continuar.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button className="btn btn-primary" onClick={handleRestoreBackup} style={{ flex: 1 }}>
                Sí, Restaurar
              </button>
              <button className="btn btn-outline" onClick={() => setShowRestoreConfirm(false)} style={{ flex: 1 }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
