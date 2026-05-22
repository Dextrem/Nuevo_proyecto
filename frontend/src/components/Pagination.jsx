const Pagination = ({ pagination, onPageChange, loading }) => {
  if (!pagination || pagination.totalPages <= 1) return null;

  const { page, totalPages, hasNext, hasPrev, total } = pagination;

  return (
    <div className="pagination" style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      gap: '10px', 
      marginTop: '20px', 
      padding: '15px' 
    }}>
      <button
        className="btn btn-outline"
        onClick={() => onPageChange(page - 1)}
        disabled={!hasPrev || loading}
        style={{ padding: '8px 16px' }}
      >
        &laquo; Anterior
      </button>
      <span style={{ padding: '0 15px' }}>
        Página {page} de {totalPages} ({total} total)
      </span>
      <button
        className="btn btn-outline"
        onClick={() => onPageChange(page + 1)}
        disabled={!hasNext || loading}
        style={{ padding: '8px 16px' }}
      >
        Siguiente &raquo;
      </button>
    </div>
  );
};

export default Pagination;
