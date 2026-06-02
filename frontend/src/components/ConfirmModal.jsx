const ConfirmModal = ({
  show,
  onConfirm,
  onCancel,
  title = 'Confirmar',
  message = '',
  icon = 'fa-exclamation-triangle',
  iconColor = '#F59E0B',
  confirmText = 'S\u00ed, confirmar',
  cancelText = 'Cancelar',
  confirmButtonClass = 'btn btn-primary',
}) => {
  if (!show) return null;

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '450px' }}>
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div style={{ fontSize: '3rem', marginBottom: '16px', color: iconColor }}>
            <i className={`fas ${icon}`}></i>
          </div>
          <h3 style={{ margin: '0 0 12px 0', color: iconColor }}>{title}</h3>
          <p style={{ color: 'var(--text-muted)', lineHeight: 1.6, margin: 0, fontSize: '0.95rem', whiteSpace: 'pre-wrap' }}>
            {message}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          <button className={confirmButtonClass} onClick={onConfirm}>
            <i className="fas fa-check"></i> {confirmText}
          </button>
          <button className="btn btn-outline" onClick={onCancel}>
            {cancelText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
