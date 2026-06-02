import { memo, useCallback, useState, useMemo, useEffect } from 'react';

const QuotationReceipt80 = memo(({ sale, settings, formatCurrency }) => {
  const issueDate = sale.createdAt ? new Date(sale.createdAt) : new Date();
  const expiryDate = new Date(issueDate);
  expiryDate.setDate(expiryDate.getDate() + (sale.validityDays || 30));
  
  const clientData = {
    name: sale.client?.name || sale.clientName || 'Público General',
    rnc: sale.client?.rnc || sale.clientRnc || '',
  };
  
  const paymentMethodLabels = {
    CASH: 'Efectivo',
    TRANSFER: 'Transferencia',
    CARD: 'Tarjeta',
    CREDIT: 'Crédito',
    MIXED: 'Mixto',
  };
  const paymentMethodDisplay = paymentMethodLabels[sale.paymentMethod] || 'Efectivo, Transferencia, Tarjeta';
  
  return (
    <div className="thermal-80">
      <div className="center" style={{ marginBottom: '8px' }}>
        {settings.logo && <img src={settings.logo} alt="Logo" style={{ maxHeight: '40px', maxWidth: '100%', marginBottom: '4px' }} />}
        <strong style={{ fontSize: '14px', display: 'block' }}>{settings.companyName}</strong>
        {settings.companyRnc && <div>RNC: {settings.companyRnc}</div>}
        {settings.companyAddress && <div>{settings.companyAddress}</div>}
        {settings.companyPhone && <div>Tel: {settings.companyPhone}</div>}
        <div style={{ marginTop: '4px' }}>----------------------------</div>
      </div>
      <div className="center" style={{ marginBottom: '8px' }}>
        <strong style={{ fontSize: '16px' }}>COTIZACIÓN</strong>
      </div>
      <div style={{ marginBottom: '8px' }}>
        <div>No. {sale.quotationNumber}</div>
        <div>Fecha: {issueDate.toLocaleDateString('es-DO')}</div>
        <div>Vence: {expiryDate.toLocaleDateString('es-DO')}</div>
        <div>Cliente: {clientData.name}</div>
        {clientData.rnc && <div>RNC: {clientData.rnc}</div>}
      </div>
      <div style={{ borderTop: '1px dashed #000', borderBottom: '1px dashed #000', padding: '4px 0', marginBottom: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
          <span>Producto</span><span>Cant</span><span>Total</span>
        </div>
      </div>
      {sale.items && sale.items.map((item, index) => (
        <div key={index} style={{ marginBottom: '2px', fontSize: '11px' }}>
          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.product?.name || item.productName || 'Producto'}</div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>x{item.quantity}</span><span>{formatCurrency((item.price || item.total) * item.quantity)}</span>
          </div>
        </div>
      ))}
      <div style={{ marginTop: '8px', borderTop: '1px dashed #000', paddingTop: '4px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}><span>Subtotal:</span><span>{formatCurrency(sale.subtotal)}</span></div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}><span>ITBIS:</span><span>{formatCurrency(sale.tax)}</span></div>
        {sale.discount > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}><span>Desc:</span><span>-{formatCurrency(sale.discount)}</span></div>}
        {sale.shippingCost > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}><span>Envío:</span><span>{formatCurrency(sale.shippingCost)}</span></div>}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '14px', borderTop: '1px solid #000', marginTop: '4px', paddingTop: '4px' }}>
          <span>TOTAL:</span><span>{formatCurrency(sale.total)}</span></div>
      </div>
      <div style={{ marginTop: '8px', borderTop: '1px dashed #000', paddingTop: '4px', fontSize: '11px' }}>
        <div><strong>Forma de Pago:</strong> {paymentMethodDisplay}</div>
        <div><strong>Validez:</strong> {sale.validityDays} días</div>
        {sale.deliveryTime && <div><strong>Entrega:</strong> {sale.deliveryTime}</div>}
        {sale.warranty && <div><strong>Garantía:</strong> {sale.warranty}</div>}
        {sale.hasWarranty && sale.warrantyData && (
          <div style={{ marginTop: '4px', borderTop: '1px dashed #000', paddingTop: '4px' }}>
            <strong>Certificado de Garantía</strong>
            <div>Vigencia: {sale.warrantyData.days} días</div>
            <div>Vence: {new Date(sale.warrantyData.expiryDate).toLocaleDateString('es-DO')}</div>
            {sale.warrantyData.coverage && <div>Cobertura: {sale.warrantyData.coverage}</div>}
            {sale.warrantyData.exclusions && <div>Excluye: {sale.warrantyData.exclusions}</div>}
          </div>
        )}
      </div>
      {sale.notes && (
        <div style={{ marginTop: '8px', padding: '4px', border: '1px dashed #000', fontSize: '11px' }}>
          <strong>Notas:</strong> {sale.notes}
        </div>
      )}
      {settings.receiptFooterMessage && (
        <div className="center" style={{ marginTop: '6px', fontSize: '11px' }}>{settings.receiptFooterMessage}</div>
      )}
      <div className="center" style={{ marginTop: '8px', fontSize: '11px' }}>
        ----------------------------<br />
        Esta cotización tiene validez de {sale.validityDays} días<br />
        Precios sujetos a variación
      </div>
    </div>
  );
});

const QuotationReceipt58 = memo(({ sale, settings, formatCurrency }) => {
  const issueDate = sale.createdAt ? new Date(sale.createdAt) : new Date();
  const expiryDate = new Date(issueDate);
  expiryDate.setDate(expiryDate.getDate() + (sale.validityDays || 30));
  
  const clientData = {
    name: sale.client?.name || sale.clientName || 'Público General',
  };
  
  const paymentMethodLabels = {
    CASH: 'Efectivo',
    TRANSFER: 'Transferencia',
    CARD: 'Tarjeta',
    CREDIT: 'Crédito',
    MIXED: 'Mixto',
  };
  const paymentMethodDisplay = paymentMethodLabels[sale.paymentMethod] || 'Efectivo, Transferencia';
  
  return (
    <div className="thermal-58">
      <div className="center" style={{ marginBottom: '4px' }}>
        {settings.logo && <img src={settings.logo} alt="Logo" style={{ maxHeight: '25px', maxWidth: '70px', marginBottom: '2px' }} />}
        <strong style={{ fontSize: '11px', display: 'block' }}>{settings.companyName}</strong>
        {settings.companyPhone && <div style={{ fontSize: '10px' }}>{settings.companyPhone}</div>}
        <div style={{ marginTop: '2px' }}>========================</div>
      </div>
      <div className="center" style={{ marginBottom: '4px' }}>
        <strong style={{ fontSize: '12px' }}>COTIZACIÓN</strong>
      </div>
      <div style={{ marginBottom: '4px', fontSize: '10px' }}>
        <div>#{sale.quotationNumber}</div>
        <div>F: {issueDate.toLocaleDateString('es-DO')}</div>
        <div>Vence: {expiryDate.toLocaleDateString('es-DO')}</div>
        <div>Cl: {clientData.name}</div>
      </div>
      <div style={{ borderTop: '1px dashed #000', borderBottom: '1px dashed #000', padding: '2px 0', marginBottom: '4px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}>
          <span>Producto</span><span>Cant</span><span>Total</span>
        </div>
      </div>
      {sale.items && sale.items.map((item, index) => (
        <div key={index} style={{ marginBottom: '1px', fontSize: '10px' }}>
          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.product?.name || item.productName || 'Prod'}</div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>x{item.quantity}</span><span>{formatCurrency((item.price || item.total) * item.quantity)}</span>
          </div>
        </div>
      ))}
      <div style={{ marginTop: '4px', borderTop: '1px dashed #000', paddingTop: '2px', fontSize: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Sub:</span><span>{formatCurrency(sale.subtotal)}</span></div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>ITBIS:</span><span>{formatCurrency(sale.tax)}</span></div>
        {sale.discount > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Des:</span><span>-{formatCurrency(sale.discount)}</span></div>}
        {sale.shippingCost > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Envío:</span><span>{formatCurrency(sale.shippingCost)}</span></div>}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', borderTop: '1px solid #000', marginTop: '2px', paddingTop: '2px' }}>
          <span>TOTAL:</span><span>{formatCurrency(sale.total)}</span>
        </div>
      </div>
      <div style={{ marginTop: '4px', fontSize: '10px' }}>
        <div><strong>Pago:</strong> {paymentMethodDisplay}</div>
        <div><strong>Vál:</strong> {sale.validityDays} días</div>
        {sale.hasWarranty && sale.warrantyData && (
          <div style={{ marginTop: '4px', borderTop: '1px dashed #000', paddingTop: '3px' }}>
            <strong>Garantía:</strong> {sale.warrantyData.days} días
            <div>Vence: {new Date(sale.warrantyData.expiryDate).toLocaleDateString('es-DO')}</div>
          </div>
        )}
      </div>
      {sale.notes && (
        <div style={{ marginTop: '4px', fontSize: '10px' }}>
          <strong>Notas:</strong> {sale.notes.substring(0, 50)}{sale.notes.length > 50 ? '...' : ''}
        </div>
      )}
      {settings.receiptFooterMessage && (
        <div className="center" style={{ marginTop: '3px', fontSize: '10px' }}>{settings.receiptFooterMessage}</div>
      )}
      <div className="center" style={{ marginTop: '4px', fontSize: '10px' }}>
        ========================<br />
        Válida {sale.validityDays} días
      </div>
    </div>
  );
});

const QuotationLetterReceipt = memo(({ sale, settings, formatCurrency }) => {
  const issueDate = sale.createdAt ? new Date(sale.createdAt) : new Date();
  const expiryDate = new Date(issueDate);
  expiryDate.setDate(expiryDate.getDate() + (sale.validityDays || 30));
  
  const taxRate = settings.taxRate || 0.18;
  
  const clientData = {
    name: sale.client?.name || sale.clientName || 'Público General',
    rnc: sale.client?.rnc || sale.clientRnc || 'N/A',
    phone: sale.client?.phone || sale.clientPhone || 'N/A',
    email: sale.client?.email || sale.clientEmail || 'N/A',
    address: sale.client?.address || sale.clientAddress || 'N/A',
  };

  const paymentMethodLabels = {
    CASH: 'Efectivo',
    TRANSFER: 'Transferencia',
    CARD: 'Tarjeta',
    CREDIT: 'Crédito',
    MIXED: 'Mixto',
  };
  const paymentMethodDisplay = paymentMethodLabels[sale.paymentMethod] || sale.paymentMethod || 'Efectivo, Transferencia, Tarjeta';

  return (
    <div className="letter" style={{ 
      fontFamily: 'Arial, Helvetica, sans-serif', 
      fontSize: '11pt', 
      color: '#1a1a1a', 
      width: '100%',
      maxWidth: '100%',
      margin: '0',
      padding: '20mm 25mm',
      position: 'relative'
    }}>
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%) rotate(-45deg)',
        fontSize: '48pt', color: '#000', opacity: 0.06,
        pointerEvents: 'none', zIndex: 0, whiteSpace: 'nowrap',
        fontWeight: 'bold'
      }}>
        {settings.companyName}
      </div>
      <div style={{ position: 'relative', zIndex: 1 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '25px' }}>
        <tbody>
          <tr>
            <td style={{ verticalAlign: 'middle', width: '55%' }}>
              {settings.logo && (
                <img src={settings.logo} alt="Logo" style={{ maxHeight: '80px', maxWidth: '200px', display: 'block' }} />
              )}
              <div style={{ marginTop: '10px' }}>
                <strong style={{ fontSize: '20pt', color: '#1a1a1a' }}>{settings.companyName || 'Nombre de la Empresa'}</strong>
              </div>
              {settings.companyAddress && <div style={{ fontSize: '11pt', color: '#444', marginTop: '4px' }}>{settings.companyAddress}</div>}
              <div style={{ fontSize: '11pt', color: '#444', marginTop: '4px' }}>
                {settings.companyPhone && <span>Tel: {settings.companyPhone}</span>}
                {settings.companyPhone && settings.companyEmail && <span> | </span>}
                {settings.companyEmail && <span>{settings.companyEmail}</span>}
              </div>
              {settings.companyRnc && <div style={{ fontSize: '11pt', color: '#444', marginTop: '4px' }}>RNC: {settings.companyRnc}</div>}
            </td>
            <td style={{ verticalAlign: 'middle', textAlign: 'right', width: '45%' }}>
              <div style={{ 
                backgroundColor: '#4F46E5', 
                color: 'white', 
                padding: '12px 35px', 
                display: 'inline-block'
              }}>
                <strong style={{ fontSize: '24pt', margin: 0, letterSpacing: '2px' }}>COTIZACIÓN</strong>
              </div>
              <table style={{ marginTop: '15px', marginLeft: 'auto', fontSize: '11pt' }}>
                <tbody>
                  <tr>
                    <td style={{ textAlign: 'right', padding: '3px 0', fontWeight: 'bold', color: '#666' }}>No.:</td>
                    <td style={{ textAlign: 'right', padding: '3px 0 3px 15px', fontWeight: 'bold', fontSize: '12pt' }}>{sale.quotationNumber || 'COT-000'}</td>
                  </tr>
                  <tr>
                    <td style={{ textAlign: 'right', padding: '3px 0', color: '#666' }}>Fecha:</td>
                    <td style={{ textAlign: 'right', padding: '3px 0 3px 15px' }}>{issueDate.toLocaleDateString('es-DO')}</td>
                  </tr>
                  <tr>
                    <td style={{ textAlign: 'right', padding: '3px 0', color: '#dc2626', fontWeight: 'bold' }}>Válida hasta:</td>
                    <td style={{ textAlign: 'right', padding: '3px 0 3px 15px', color: '#dc2626', fontWeight: 'bold' }}>{expiryDate.toLocaleDateString('es-DO')}</td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table>

      <div style={{ marginBottom: '20px', borderBottom: '2px solid #1a1a1a', paddingBottom: '12px' }}>
        <div style={{ fontWeight: 'bold', fontSize: '12pt', marginBottom: '8px', color: '#1a1a1a' }}>CLIENTE</div>
        <div style={{ fontSize: '11pt', lineHeight: '1.6' }}>
          <strong>{clientData.name}</strong>
          <span style={{ marginLeft: '20px', color: '#555' }}>RNC/Céd: {clientData.rnc}</span>
        </div>
        <div style={{ fontSize: '10pt', color: '#555', marginTop: '4px' }}>
          {clientData.address} | Tel: {clientData.phone} | {clientData.email}
        </div>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px', fontSize: '11pt' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #1a1a1a' }}>
            <th style={{ padding: '8px 8px', textAlign: 'center', width: '40px', fontWeight: 'bold', color: '#1a1a1a' }}>#</th>
            <th style={{ padding: '8px 8px', textAlign: 'left', fontWeight: 'bold', color: '#1a1a1a' }}>Código</th>
            <th style={{ padding: '8px 8px', textAlign: 'left', fontWeight: 'bold', color: '#1a1a1a' }}>Descripción del Producto/Servicio</th>
            <th style={{ padding: '8px 8px', textAlign: 'center', width: '60px', fontWeight: 'bold', color: '#1a1a1a' }}>Cant.</th>
            <th style={{ padding: '8px 8px', textAlign: 'right', width: '100px', fontWeight: 'bold', color: '#1a1a1a' }}>P. Unit.</th>
            <th style={{ padding: '8px 8px', textAlign: 'right', width: '100px', fontWeight: 'bold', color: '#1a1a1a' }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {sale.items && sale.items.map((item, index) => (
            <tr key={index}>
              <td style={{ padding: '8px', textAlign: 'center', borderBottom: '1px dotted #ccc' }}>{index + 1}</td>
              <td style={{ padding: '8px', borderBottom: '1px dotted #ccc' }}>{item.product?.sku || item.sku || '-'}</td>
              <td style={{ padding: '8px', borderBottom: '1px dotted #ccc' }}>{item.product?.name || item.productName || 'Producto'}</td>
              <td style={{ padding: '8px', textAlign: 'center', borderBottom: '1px dotted #ccc' }}>{item.quantity}</td>
              <td style={{ padding: '8px', textAlign: 'right', borderBottom: '1px dotted #ccc' }}>{formatCurrency(item.price || item.total)}</td>
              <td style={{ padding: '8px', textAlign: 'right', borderBottom: '1px dotted #ccc', fontWeight: 'bold' }}>{formatCurrency((item.price || item.total) * item.quantity)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <table style={{ width: '100%', marginBottom: '20px' }}>
        <tbody>
          <tr>
            <td style={{ width: '58%', verticalAlign: 'top', paddingRight: '20px' }}>
              <div style={{ borderTop: '2px solid #1a1a1a', paddingTop: '10px' }}>
                <strong style={{ fontSize: '11pt', color: '#1a1a1a' }}>CONDICIONES</strong>
                <table style={{ width: '100%', fontSize: '10pt', color: '#444', marginTop: '8px' }}>
                  <tbody>
                    <tr>
                      <td style={{ padding: '3px 0', width: '40%' }}><strong>Forma de Pago:</strong></td>
                      <td style={{ padding: '3px 0' }}>{paymentMethodDisplay}</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '3px 0' }}><strong>Validez de la Cotización:</strong></td>
                      <td style={{ padding: '3px 0' }}>{sale.validityDays || 30} días</td>
                    </tr>
                    {sale.deliveryTime && (
                      <tr>
                        <td style={{ padding: '3px 0' }}><strong>Tiempo de Entrega:</strong></td>
                        <td style={{ padding: '3px 0' }}>{sale.deliveryTime}</td>
                      </tr>
                    )}
                    {sale.warranty && (
                      <tr>
                        <td style={{ padding: '3px 0' }}><strong>Garantía:</strong></td>
                        <td style={{ padding: '3px 0' }}>{sale.warranty}</td>
                      </tr>
                    )}
                    {sale.hasWarranty && sale.warrantyData && (
                      <>
                        <tr>
                          <td style={{ padding: '3px 0' }}><strong>Vigencia:</strong></td>
                          <td style={{ padding: '3px 0' }}>{sale.warrantyData.days} días (vence {new Date(sale.warrantyData.expiryDate).toLocaleDateString('es-DO')})</td>
                        </tr>
                        {sale.warrantyData.coverage && (
                          <tr>
                            <td style={{ padding: '3px 0', verticalAlign: 'top' }}><strong>Cobertura:</strong></td>
                            <td style={{ padding: '3px 0' }}>{sale.warrantyData.coverage}</td>
                          </tr>
                        )}
                        {sale.warrantyData.exclusions && (
                          <tr>
                            <td style={{ padding: '3px 0', verticalAlign: 'top' }}><strong>Excluye:</strong></td>
                            <td style={{ padding: '3px 0' }}>{sale.warrantyData.exclusions}</td>
                          </tr>
                        )}
                      </>
                    )}
                  </tbody>
                </table>
                {sale.notes && (
                  <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #ddd', fontSize: '10pt' }}>
                    <strong>Notas:</strong> {sale.notes}
                  </div>
                )}
              </div>
            </td>
            <td style={{ width: '42%', verticalAlign: 'top' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginLeft: 'auto' }}>
                <tbody>
                  <tr>
                    <td style={{ padding: '8px 12px', fontSize: '11pt' }}>Subtotal:</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: '11pt' }}>{formatCurrency(sale.subtotal || 0)}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '8px 12px', fontSize: '11pt' }}>
                      ITBIS ({(taxRate * 100).toFixed(0)}%):
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: '11pt' }}>{formatCurrency(sale.tax || 0)}</td>
                  </tr>
                  {sale.discount > 0 && (
                    <tr>
                      <td style={{ padding: '8px 12px', fontSize: '11pt', color: '#dc2626' }}>Descuento:</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: '11pt', color: '#dc2626' }}>-{formatCurrency(sale.discount)}</td>
                    </tr>
                  )}
                  {sale.shippingCost > 0 && (
                    <tr>
                      <td style={{ padding: '8px 12px', fontSize: '11pt' }}>Envío:</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: '11pt' }}>{formatCurrency(sale.shippingCost)}</td>
                    </tr>
                  )}
                  <tr style={{ borderTop: '3px double #1a1a1a' }}>
                    <td style={{ padding: '8px 12px', fontSize: '14pt', fontWeight: 'bold', color: '#1a1a1a' }}>TOTAL A PAGAR:</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: '14pt', fontWeight: 'bold', color: '#1a1a1a' }}>{formatCurrency(sale.total || 0)}</td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '30px' }}>
        <tbody>
          <tr>
            <td style={{ width: '50%', padding: '30px', verticalAlign: 'bottom' }}>
              <div style={{ borderTop: '2px solid #333', paddingTop: '10px', fontSize: '11pt' }}>
                <strong>Nombre y Apellido:</strong> {settings.companyName || 'Representante'}
              </div>
            </td>
            <td style={{ width: '50%', padding: '30px', verticalAlign: 'bottom' }}>
              <div style={{ borderTop: '2px solid #333', paddingTop: '10px', fontSize: '11pt', textAlign: 'right' }}>
                <strong>Firma:</strong>
                <div style={{ marginTop: '30px' }}></div>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <div style={{ 
        marginTop: '40px', 
        padding: '15px 0',
        borderTop: '1px solid #ccc',
        fontSize: '10pt',
        color: '#666',
        textAlign: 'center'
      }}>
        <p style={{ margin: '0 0 5px' }}>
          <strong>NOTA LEGAL:</strong> Esta cotización es confidencial y está destinada únicamente al cliente indicado. 
          Queda prohibida la reproducción total o parcial sin autorización escrita de la empresa.
        </p>
        <p style={{ margin: '0' }}>
          Los precios pueden variar sin previo aviso. Esta cotización tiene validez de {sale.validityDays || 30} días.
        </p>
      </div>

      {settings.receiptFooterMessage && (
        <div style={{ textAlign: 'center', marginTop: '15px', fontSize: '9pt', fontStyle: 'italic', color: '#666' }}>{settings.receiptFooterMessage}</div>
      )}

      <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '9pt', color: '#999' }}>
        <p style={{ margin: '0' }}>Generado el {new Date().toLocaleString('es-DO')} | Sistema de Gestión</p>
      </div>
      </div>
    </div>
  );
});

const ThermalReceipt80 = memo(({ sale, settings, formatCurrency }) => (
  <div className="thermal-80">
    <div className="center" style={{ marginBottom: '8px' }}>
      {settings.logo && <img src={settings.logo} alt="Logo" style={{ maxHeight: '40px', maxWidth: '100%', marginBottom: '4px' }} />}
      <strong style={{ fontSize: '14px', display: 'block', color: '#000' }}>{settings.companyName}</strong>
      {settings.companyRnc && <div style={{ color: '#000' }}>RNC: {settings.companyRnc}</div>}
      {settings.companyAddress && <div style={{ color: '#000' }}>{settings.companyAddress}</div>}
      <div style={{ marginTop: '4px', color: '#000' }}>----------------------------</div>
    </div>
    <div style={{ marginBottom: '8px', color: '#000', fontWeight: 600 }}>
      <div>Fecha: {new Date(sale.createdAt).toLocaleString()}</div>
      <div>Cajero: {sale.user?.name || 'N/A'}</div>
      {sale.client ? (
        <div>Cliente: {sale.client.name}</div>
      ) : (
        <div>Cliente: Público General</div>
      )}
      {sale.client?.rnc && <div>RNC Cliente: {sale.client.rnc}</div>}
      <div>Factura: {sale.invoiceNumber}</div>
      {sale.ncf && <div>NCF: {sale.ncf}</div>}
    </div>
    <div style={{ borderTop: '1px dashed #000', borderBottom: '1px dashed #000', padding: '4px 0', marginBottom: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#000', fontWeight: 600 }}>
        <span>Producto</span><span>Cant</span><span>Total</span>
      </div>
    </div>
      {sale.items.map((item, index) => (
        <div key={index} style={{ marginBottom: '2px', color: '#000', fontWeight: 600 }}>
          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.product?.name || 'Producto'}</div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>x{item.quantity}</span><span>{formatCurrency(item.total)}</span>
          </div>
        </div>
      ))}
    <div style={{ marginTop: '8px', borderTop: '1px dashed #000', paddingTop: '4px', color: '#000', fontWeight: 600 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Subtotal:</span><span>{formatCurrency(sale.subtotal)}</span></div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>ITBIS:</span><span>{formatCurrency(sale.tax)}</span></div>
      {sale.discount > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', color: '#000' }}><span>Desc:</span><span>-{formatCurrency(sale.discount)}</span></div>}
      {sale.shippingCost > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Envío:</span><span>{formatCurrency(sale.shippingCost)}</span></div>}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '14px', borderTop: '1px solid #000', marginTop: '4px', paddingTop: '4px', color: '#000' }}>
        <span>TOTAL:</span><span>{formatCurrency(sale.total)}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Pagado:</span><span>{formatCurrency(sale.paidAmount)}</span></div>
      {sale.change > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', color: '#000' }}><span>Cambio:</span><span>{formatCurrency(sale.change)}</span></div>}
    </div>
    {sale.hasWarranty && sale.warrantyData && (
      <div style={{ marginTop: '6px', borderTop: '1px dashed #000', paddingTop: '4px', color: '#000', fontWeight: 600 }}>
        <div style={{ fontWeight: 'bold', marginBottom: '2px', color: '#000' }}>CERTIFICADO DE GARANTÍA</div>
        <div>Vigencia: {sale.warrantyData.days} días</div>
        <div>Vence: {new Date(sale.warrantyData.expiryDate).toLocaleDateString('es-DO')}</div>
        {sale.warrantyData.coverage && <div>Cobertura: {sale.warrantyData.coverage}</div>}
        {sale.warrantyData.exclusions && <div>Excluye: {sale.warrantyData.exclusions}</div>}
      </div>
    )}
    {settings.receiptFooterMessage && (
      <div className="center" style={{ marginTop: '4px', fontSize: '11px', color: '#000', fontWeight: 600 }}>{settings.receiptFooterMessage}</div>
    )}
    <div className="center" style={{ marginTop: '8px', color: '#000', fontWeight: 600 }}>----------------------------<br />¡Gracias por su compra!</div>
  </div>
));

const ThermalReceipt58 = memo(({ sale, settings, formatCurrency }) => (
  <div className="thermal-58">
    <div className="center" style={{ marginBottom: '6px' }}>
      {settings.logo && <img src={settings.logo} alt="Logo" style={{ maxHeight: '30px', maxWidth: '80px', marginBottom: '2px' }} />}
      <strong style={{ fontSize: '12px', display: 'block', color: '#000' }}>{settings.companyName}</strong>
      {settings.companyRnc && <div style={{ color: '#000' }}>RNC: {settings.companyRnc}</div>}
      <div style={{ marginTop: '2px', color: '#000' }}>========================</div>
    </div>
    <div style={{ marginBottom: '6px', color: '#000', fontWeight: 600 }}>
      <div>F: {new Date(sale.createdAt).toLocaleDateString()}</div>
      <div>Cajero: {sale.user?.name || 'N/A'}</div>
      {sale.client ? (
        <div>Cl: {sale.client.name}</div>
      ) : (
        <div>Cl: Público General</div>
      )}
      {sale.client?.rnc && <div>RNC Cl: {sale.client.rnc}</div>}
      <div>#{sale.invoiceNumber}</div>
      {sale.ncf && <div>NCF: {sale.ncf}</div>}
    </div>
    {sale.items.map((item, index) => (
      <div key={index} style={{ marginBottom: '2px', fontSize: '10px', color: '#000', fontWeight: 600 }}>
        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.product?.name}</div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>x{item.quantity}</span><span>{formatCurrency(item.total)}</span>
        </div>
      </div>
    ))}
    <div style={{ marginTop: '6px', borderTop: '1px dashed #000', paddingTop: '3px', color: '#000', fontWeight: 600 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Sub:</span><span>{formatCurrency(sale.subtotal)}</span></div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>ITBIS:</span><span>{formatCurrency(sale.tax)}</span></div>
      {sale.discount > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Des:</span><span>-{formatCurrency(sale.discount)}</span></div>}
      {sale.shippingCost > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Envío:</span><span>{formatCurrency(sale.shippingCost)}</span></div>}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', borderTop: '1px solid #000', marginTop: '3px', paddingTop: '3px', color: '#000' }}>
        <span>TOTAL:</span><span>{formatCurrency(sale.total)}</span>
      </div>
    </div>
    {sale.hasWarranty && sale.warrantyData && (
      <div style={{ marginTop: '4px', borderTop: '1px dashed #000', paddingTop: '3px', fontSize: '10px', color: '#000', fontWeight: 600 }}>
        <div style={{ fontWeight: 'bold', color: '#000' }}>CERTIFICADO DE GARANTÍA</div>
        <div>Vigencia: {sale.warrantyData.days} días</div>
        <div>Vence: {new Date(sale.warrantyData.expiryDate).toLocaleDateString('es-DO')}</div>
        {sale.warrantyData.coverage && <div>Cobertura: {sale.warrantyData.coverage}</div>}
        {sale.warrantyData.exclusions && <div>Excluye: {sale.warrantyData.exclusions}</div>}
      </div>
    )}
    {settings.receiptFooterMessage && (
      <div className="center" style={{ marginTop: '3px', fontSize: '10px', color: '#000', fontWeight: 600 }}>{settings.receiptFooterMessage}</div>
    )}
    <div className="center" style={{ marginTop: '6px', color: '#000', fontWeight: 600 }}>========================<br />¡GRACIAS!</div>
  </div>
));

const LetterReceipt = memo(({ sale, settings, formatCurrency }) => (
  <div className="letter">
    <div className="center" style={{ marginBottom: '20px', paddingBottom: '15px', borderBottom: '2px solid #333' }}>
      {settings.logo && <img src={settings.logo} alt="Logo" style={{ maxHeight: '80px', maxWidth: '200px', marginBottom: '10px' }} />}
      <h2 style={{ margin: '0 0 5px' }}>{settings.companyName}</h2>
      {settings.companyRnc && <p style={{ margin: '2px 0' }}>RNC: {settings.companyRnc}</p>}
      {settings.companyAddress && <p style={{ margin: '2px 0' }}>{settings.companyAddress}</p>}
      {settings.companyPhone && <p style={{ margin: '2px 0' }}>Tel: {settings.companyPhone}</p>}
    </div>
    <div style={{ marginBottom: '15px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
        <span><strong>Factura:</strong> {sale.invoiceNumber}</span>
        <span><strong>Fecha:</strong> {new Date(sale.createdAt).toLocaleString()}</span>
      </div>
      {sale.ncf && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
          <span><strong>NCF:</strong> {sale.ncf}</span>
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span><strong>Cajero:</strong> {sale.user?.name || 'N/A'}</span>
        <span><strong>Cliente:</strong> {sale.client?.name || 'Público General'} {sale.client?.rnc && `(RNC: ${sale.client.rnc})`}</span>
      </div>
    </div>
    <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '15px' }}>
      <thead>
        <tr style={{ backgroundColor: '#f0f0f0' }}>
          <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>Producto</th>
          <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>Cantidad</th>
          <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right' }}>Precio</th>
          <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right' }}>Total</th>
        </tr>
      </thead>
      <tbody>
        {sale.items.map((item, index) => (
          <tr key={index}>
            <td style={{ border: '1px solid #ddd', padding: '8px' }}>{item.product?.name || 'Producto'}</td>
            <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>{item.quantity}</td>
            <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right' }}>{formatCurrency(item.price)}</td>
            <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right' }}>{formatCurrency(item.total)}</td>
          </tr>
        ))}
      </tbody>
    </table>
    <div style={{ width: '250px', marginLeft: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Subtotal:</span><span>{formatCurrency(sale.subtotal)}</span></div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>ITBIS ({(settings.taxRate * 100).toFixed(0)}%):</span><span>{formatCurrency(sale.tax)}</span></div>
      {sale.discount > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', color: 'red' }}><span>Descuento:</span><span>-{formatCurrency(sale.discount)}</span></div>}
      {sale.shippingCost > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Envío:</span><span>{formatCurrency(sale.shippingCost)}</span></div>}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '16px', borderTop: '2px solid #333', marginTop: '8px', paddingTop: '8px' }}>
        <span>TOTAL:</span><span>{formatCurrency(sale.total)}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px' }}><span>Método:</span><span>{sale.paymentMethod}</span></div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Pagado:</span><span>{formatCurrency(sale.paidAmount)}</span></div>
      {sale.change > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', color: 'green' }}><span>Cambio:</span><span>{formatCurrency(sale.change)}</span></div>}
    </div>
    {sale.hasWarranty && sale.warrantyData && (
      <div style={{ marginTop: '15px', borderTop: '1px solid #333', paddingTop: '10px' }}>
        <strong style={{ fontSize: '11px' }}>CERTIFICADO DE GARANTÍA</strong>
        <div style={{ fontSize: '10px', marginTop: '5px' }}>
          <div>Vigencia: {sale.warrantyData.days} días (vence {new Date(sale.warrantyData.expiryDate).toLocaleDateString('es-DO')})</div>
          {sale.warrantyData.coverage && <div><strong>Cobertura:</strong> {sale.warrantyData.coverage}</div>}
          {sale.warrantyData.exclusions && <div><strong>Excluye:</strong> {sale.warrantyData.exclusions}</div>}
        </div>
      </div>
    )}
    {settings.receiptFooterMessage && (
      <div className="center" style={{ marginTop: '10px', fontSize: '9pt', fontStyle: 'italic', color: '#666' }}>{settings.receiptFooterMessage}</div>
    )}
    <div className="center" style={{ marginTop: '30px', paddingTop: '15px', borderTop: '1px solid #ccc' }}>
      <p>¡Gracias por su compra!</p>
    </div>
  </div>
));

const A4Receipt = memo(({ sale, settings, formatCurrency }) => (
  <div className="a4">
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '30px', paddingBottom: '20px', borderBottom: '3px solid #333' }}>
      <div>
        {settings.logo && <img src={settings.logo} alt="Logo" style={{ maxHeight: '100px', maxWidth: '250px', marginBottom: '10px' }} />}
        <h1 style={{ margin: '0 0 5px', fontSize: '24px' }}>{settings.companyName}</h1>
        {settings.companyAddress && <p style={{ margin: '2px 0' }}>{settings.companyAddress}</p>}
        {settings.companyPhone && <p style={{ margin: '2px 0' }}>Tel: {settings.companyPhone}</p>}
        {settings.companyEmail && <p style={{ margin: '2px 0' }}>Email: {settings.companyEmail}</p>}
      </div>
      <div style={{ textAlign: 'right' }}>
        {settings.companyRnc && <p><strong>RNC:</strong> {settings.companyRnc}</p>}
        <h2 style={{ margin: '10px 0', color: '#333' }}>FACTURA</h2>
        <p style={{ margin: '5px 0' }}><strong>No. {sale.invoiceNumber}</strong></p>
        {sale.ncf && <p style={{ margin: '5px 0' }}><strong>NCF:</strong> {sale.ncf}</p>}
        <p style={{ margin: '5px 0' }}>Fecha: {new Date(sale.createdAt).toLocaleString()}</p>
      </div>
    </div>
    <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f9f9f9', borderRadius: '5px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div>
          <h4 style={{ margin: '0 0 5px' }}>Datos del Cliente:</h4>
          {sale.client ? (
            <>
              <p style={{ margin: '2px 0' }}><strong>Nombre:</strong> {sale.client.name}</p>
              {sale.client.rnc && <p style={{ margin: '2px 0' }}><strong>RNC/Céd:</strong> {sale.client.rnc}</p>}
              {sale.client.address && <p style={{ margin: '2px 0' }}><strong>Dirección:</strong> {sale.client.address}</p>}
            </>
          ) : (
            <>
              <p style={{ margin: '2px 0' }}><strong>Nombre:</strong> Público General</p>
            </>
          )}
        </div>
        <div style={{ textAlign: 'right' }}>
          <h4 style={{ margin: '0 0 5px' }}>Datos del Vendedor:</h4>
          <p style={{ margin: '2px 0' }}><strong>Cajero:</strong> {sale.user?.name || 'N/A'}</p>
        </div>
      </div>
    </div>
    <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
      <thead>
        <tr style={{ backgroundColor: '#4F46E5', color: 'white' }}>
          <th style={{ padding: '12px 8px', textAlign: 'left' }}>#</th>
          <th style={{ padding: '12px 8px', textAlign: 'left' }}>Descripción</th>
          <th style={{ padding: '12px 8px', textAlign: 'center' }}>Cantidad</th>
          <th style={{ padding: '12px 8px', textAlign: 'right' }}>Precio Unit.</th>
          <th style={{ padding: '12px 8px', textAlign: 'right' }}>ITBIS</th>
          <th style={{ padding: '12px 8px', textAlign: 'right' }}>Subtotal</th>
        </tr>
      </thead>
      <tbody>
        {sale.items.map((item, index) => (
          <tr key={index} style={{ borderBottom: '1px solid #ddd' }}>
            <td style={{ padding: '10px 8px' }}>{index + 1}</td>
            <td style={{ padding: '10px 8px' }}>{item.product?.name || 'Producto'}</td>
            <td style={{ padding: '10px 8px', textAlign: 'center' }}>{item.quantity}</td>
            <td style={{ padding: '10px 8px', textAlign: 'right' }}>{formatCurrency(item.price)}</td>
            <td style={{ padding: '10px 8px', textAlign: 'right' }}>{formatCurrency(item.tax)}</td>
            <td style={{ padding: '10px 8px', textAlign: 'right' }}>{formatCurrency(item.total)}</td>
          </tr>
        ))}
      </tbody>
    </table>
    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
      <div style={{ width: '300px' }}>
        <table style={{ width: '100%' }}>
          <tbody>
            <tr><td style={{ padding: '5px 10px' }}>Subtotal:</td><td style={{ padding: '5px 10px', textAlign: 'right' }}>{formatCurrency(sale.subtotal)}</td></tr>
            <tr><td style={{ padding: '5px 10px' }}>ITBIS ({(settings.taxRate * 100).toFixed(0)}%):</td><td style={{ padding: '5px 10px', textAlign: 'right' }}>{formatCurrency(sale.tax)}</td></tr>
            {sale.discount > 0 && <tr style={{ color: 'red' }}><td style={{ padding: '5px 10px' }}>Descuento:</td><td style={{ padding: '5px 10px', textAlign: 'right' }}>-{formatCurrency(sale.discount)}</td></tr>}
            {sale.shippingCost > 0 && <tr><td style={{ padding: '5px 10px' }}>Envío:</td><td style={{ padding: '5px 10px', textAlign: 'right' }}>{formatCurrency(sale.shippingCost)}</td></tr>}
            <tr style={{ backgroundColor: '#4F46E5', color: 'white', fontWeight: 'bold', fontSize: '16px' }}>
              <td style={{ padding: '12px 10px' }}>TOTAL A PAGAR:</td>
              <td style={{ padding: '12px 10px', textAlign: 'right' }}>{formatCurrency(sale.total)}</td>
            </tr>
            <tr><td style={{ padding: '5px 10px' }}>Método de Pago:</td><td style={{ padding: '5px 10px', textAlign: 'right' }}>{sale.paymentMethod}</td></tr>
            <tr><td style={{ padding: '5px 10px' }}>Monto Pagado:</td><td style={{ padding: '5px 10px', textAlign: 'right' }}>{formatCurrency(sale.paidAmount)}</td></tr>
            {sale.change > 0 && <tr style={{ color: 'green' }}><td style={{ padding: '5px 10px' }}>Cambio:</td><td style={{ padding: '5px 10px', textAlign: 'right' }}>{formatCurrency(sale.change)}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
    {sale.hasWarranty && sale.warrantyData && (
      <div style={{ marginTop: '15px', borderTop: '2px solid #333', paddingTop: '10px' }}>
        <h3 style={{ margin: '0 0 8px', fontSize: '14px', color: '#333' }}>CERTIFICADO DE GARANTÍA</h3>
        <table style={{ width: '100%', fontSize: '11px' }}>
          <tbody>
            <tr><td style={{ padding: '3px 5px', fontWeight: 'bold' }}>Vigencia:</td><td style={{ padding: '3px 5px' }}>{sale.warrantyData.days} días (vence {new Date(sale.warrantyData.expiryDate).toLocaleDateString('es-DO')})</td></tr>
            {sale.warrantyData.coverage && <tr><td style={{ padding: '3px 5px', fontWeight: 'bold', verticalAlign: 'top' }}>Cobertura:</td><td style={{ padding: '3px 5px' }}>{sale.warrantyData.coverage}</td></tr>}
            {sale.warrantyData.exclusions && <tr><td style={{ padding: '3px 5px', fontWeight: 'bold', verticalAlign: 'top' }}>Excluye:</td><td style={{ padding: '3px 5px' }}>{sale.warrantyData.exclusions}</td></tr>}
          </tbody>
        </table>
      </div>
    )}
    {settings.receiptFooterMessage && (
      <div className="center" style={{ marginTop: '20px', fontSize: '10px', fontStyle: 'italic', color: '#666' }}>{settings.receiptFooterMessage}</div>
    )}
    <div className="center" style={{ marginTop: '50px', paddingTop: '20px', borderTop: '2px solid #ccc' }}>
      <p style={{ fontSize: '14px', fontStyle: 'italic' }}>¡Gracias por preferirnos!</p>
      <p style={{ fontSize: '10px', color: '#666', marginTop: '20px' }}>Esta factura es un documento legal conforme a las leyes vigentes.</p>
    </div>
  </div>
));

const ReceiptModal = memo(({ sale, settings, printType, onPrintTypeChange, onPrint, onClose, formatCurrency }) => {
  const getReceiptComponent = () => {
    switch (printType) {
      case 'thermal-80':
        return <ThermalReceipt80 sale={sale} settings={settings} formatCurrency={formatCurrency} />;
      case 'thermal-58':
        return <ThermalReceipt58 sale={sale} settings={settings} formatCurrency={formatCurrency} />;
      case 'letter':
        return <LetterReceipt sale={sale} settings={settings} formatCurrency={formatCurrency} />;
      case 'a4':
        return <A4Receipt sale={sale} settings={settings} formatCurrency={formatCurrency} />;
      default:
        return <ThermalReceipt80 sale={sale} settings={settings} formatCurrency={formatCurrency} />;
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div style={{
            width: '60px',
            height: '60px',
            backgroundColor: 'var(--secondary)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 12px',
          }}>
            <i className="fas fa-check" style={{ fontSize: '30px', color: 'white' }}></i>
          </div>
          <h2 style={{ margin: 0, color: 'var(--secondary)' }}>¡Venta Procesada!</h2>
          <p style={{ margin: '8px 0 0', color: 'var(--text-muted)' }}>
            Factura #{sale.invoiceNumber}
          </p>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>Seleccionar tipo de impresión:</label>
          <select
            className="form-control"
            value={printType}
            onChange={(e) => onPrintTypeChange(e.target.value)}
          >
            <option value="thermal-80">🖨️ Ticket 80mm (Thermal)</option>
            <option value="thermal-58">🖨️ Ticket 58mm (Thermal Compact)</option>
            <option value="letter">📄 Carta (Matricial/Office)</option>
            <option value="a4">📑 A4 (Oficina)</option>
          </select>
        </div>

        <div
          id="receipt-preview"
          style={{
            backgroundColor: 'white',
            border: '1px solid #e0e0e0',
            borderRadius: '12px',
            padding: '20px',
            marginBottom: '20px',
            color: '#333',
            maxHeight: '400px',
            overflowY: 'auto',
          }}
        >
          {getReceiptComponent()}
        </div>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={onPrint} style={{ flex: 1, minWidth: '120px' }}>
            <i className="fas fa-print"></i>
            Imprimir
          </button>
          <button className="btn btn-outline" onClick={onClose} style={{ flex: 1, minWidth: '120px' }}>
            Nueva Venta
          </button>
        </div>
      </div>
    </div>
  );
});

ReceiptModal.displayName = 'ReceiptModal';

const NewClientModal = memo(({ isOpen, onClose, onSubmit, newClientData, setNewClientData }) => {
  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit();
  };

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
        <h2>➕ Nuevo Cliente para Crédito</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Nombre del Cliente *</label>
            <input
              type="text"
              className="form-control"
              placeholder="Ej: Juan Pérez"
              value={newClientData.name}
              onChange={(e) => setNewClientData({ ...newClientData, name: e.target.value })}
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label>Cédula / RNC *</label>
            <input
              type="text"
              className="form-control"
              placeholder="Ej: 00112345678"
              value={newClientData.rnc}
              onChange={(e) => setNewClientData({ ...newClientData, rnc: e.target.value })}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label>Teléfono *</label>
              <input
                type="tel"
                className="form-control"
                placeholder="809-000-0000"
                value={newClientData.phone}
                onChange={(e) => setNewClientData({ ...newClientData, phone: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                className="form-control"
                placeholder="juan@email.com"
                value={newClientData.email}
                onChange={(e) => setNewClientData({ ...newClientData, email: e.target.value })}
              />
            </div>
          </div>

          <div className="form-group">
            <label>Dirección *</label>
            <textarea
              className="form-control"
              placeholder="Calle, Sector, Ciudad..."
              value={newClientData.address}
              onChange={(e) => setNewClientData({ ...newClientData, address: e.target.value })}
              required
              style={{ height: '60px', resize: 'none' }}
            />
          </div>

          <div className="form-group">
            <label>Límite de Crédito</label>
            <input
              type="number"
              className="form-control"
              placeholder="5000"
              value={newClientData.creditLimit}
              onChange={(e) => setNewClientData({ ...newClientData, creditLimit: e.target.value })}
              step="100"
              min="0"
            />
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
            <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
              ✅ Crear Cliente
            </button>
            <button
              type="button"
              className="btn btn-outline"
              onClick={onClose}
              style={{ flex: 1 }}
            >
              ❌ Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
});

NewClientModal.displayName = 'NewClientModal';

const ManualProductModal = memo(({ isOpen, onClose, onSelect, products, formatCurrency }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredProducts = useMemo(() => {
    if (!searchTerm) return products;
    const term = searchTerm.toLowerCase();
    return products.filter(p => 
      p.name.toLowerCase().includes(term) ||
      p.sku?.toLowerCase().includes(term) ||
      p.barcode?.toLowerCase().includes(term)
    );
  }, [products, searchTerm]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content" style={{ maxWidth: '600px', width: '100%' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <i className="fas fa-list-ul"></i> Seleccionar Producto
        </h2>
        
        <div style={{ marginBottom: '16px' }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            background: 'var(--bg-main)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            padding: '0 12px',
          }}>
            <i className="fas fa-search" style={{ color: 'var(--text-muted)' }}></i>
            <input
              type="text"
              className="form-control"
              placeholder="Buscar por nombre, SKU o código..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              autoFocus
              style={{ 
                border: 'none', 
                boxShadow: 'none',
              }}
            />
          </div>
        </div>

        <div style={{ maxHeight: '400px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
          {filteredProducts.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <i className="fas fa-search" style={{ fontSize: '2rem', marginBottom: '10px' }}></i>
              <p>No se encontraron productos</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {filteredProducts.map((product) => (
                <div
                  key={product.id}
                  onClick={() => {
                    onSelect(product);
                    onClose();
                    setSearchTerm('');
                  }}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px 16px',
                    borderBottom: '1px solid var(--border-color)',
                    cursor: product.stock > 0 ? 'pointer' : 'not-allowed',
                    background: product.stock === 0 ? 'rgba(239,68,68,0.05)' : 'transparent',
                    opacity: product.stock === 0 ? 0.5 : 1,
                  }}
                  onMouseOver={(e) => product.stock > 0 && (e.currentTarget.style.background = 'var(--bg-surface-hover)')}
                  onMouseOut={(e) => product.stock > 0 && (e.currentTarget.style.background = product.stock === 0 ? 'rgba(239,68,68,0.05)' : 'transparent')}
                >
                  <div>
                    <div style={{ fontWeight: 500 }}>{product.name}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {product.sku || product.barcode || 'Sin código'}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 600, color: 'var(--primary)' }}>
                      {formatCurrency(product.price)}
                    </div>
                    <div style={{ 
                      fontSize: '0.8rem', 
                      color: product.stock === 0 ? 'var(--danger)' : product.stock <= (product.minStock || 0) ? 'var(--accent)' : 'var(--text-muted)'
                    }}>
                      {product.stock === 0 ? 'Sin stock' : `Stock: ${product.stock}`}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ marginTop: '16px', display: 'flex', gap: '12px' }}>
          <button className="btn btn-outline" onClick={onClose} style={{ flex: 1 }}>
            <i className="fas fa-times"></i> Cerrar
          </button>
        </div>
      </div>
    </div>
  );
});

const DueDateModal = memo(({ isOpen, onClose, dueDate, setDueDate, total, formatCurrency }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div style={{
            width: '60px',
            height: '60px',
            backgroundColor: 'var(--warning)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 12px',
          }}>
            <i className="fas fa-calendar-alt" style={{ fontSize: '30px', color: 'white' }}></i>
          </div>
          <h2 style={{ margin: 0, color: 'var(--text-main)' }}>Fecha de Pago</h2>
          <p style={{ margin: '8px 0 0', color: 'var(--text-muted)' }}>
            Selecciona cuándo debe pagar el cliente
          </p>
        </div>

        <div className="form-group">
          <label>Vencimiento del Crédito</label>
          <input
            type="date"
            className="form-control"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            min={new Date().toISOString().split('T')[0]}
            max={new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
            style={{ fontSize: '1.1rem', padding: '12px' }}
            autoFocus
          />
        </div>

        <div style={{ padding: '12px', background: 'rgba(245, 158, 11, 0.1)', borderRadius: '8px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
            <span>Total a Crédito:</span>
            <strong>{formatCurrency(total)}</strong>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            className="btn btn-primary" 
            onClick={onClose} 
            style={{ flex: 1 }}
            disabled={!dueDate}
          >
            Confirmar Fecha
          </button>
        </div>
      </div>
    </div>
  );
});

DueDateModal.displayName = 'DueDateModal';

const WarrantyModal = memo(({ isOpen, onClose, onConfirm, settings, initialData }) => {
  const [includeWarranty, setIncludeWarranty] = useState(false);
  const [warrantyDays, setWarrantyDays] = useState(settings.warrantyDefaultDays || 90);
  const [coverageText, setCoverageText] = useState(settings.warrantyCoverageText || '');
  const [exclusionText, setExclusionText] = useState(settings.warrantyExclusionText || '');

  useEffect(() => {
    if (initialData) {
      setIncludeWarranty(true);
      setWarrantyDays(initialData.days || settings.warrantyDefaultDays || 90);
      setCoverageText(initialData.coverage || settings.warrantyCoverageText || '');
      setExclusionText(initialData.exclusions || settings.warrantyExclusionText || '');
    } else {
      setIncludeWarranty(false);
      setWarrantyDays(settings.warrantyDefaultDays || 90);
      setCoverageText(settings.warrantyCoverageText || '');
      setExclusionText(settings.warrantyExclusionText || '');
    }
  }, [isOpen, initialData, settings]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (!includeWarranty) {
      onConfirm(null);
      return;
    }
    const now = new Date();
    const expiry = new Date(now);
    expiry.setDate(expiry.getDate() + warrantyDays);
    onConfirm({
      hasWarranty: true,
      days: warrantyDays,
      coverage: coverageText,
      exclusions: exclusionText,
      issueDate: now.toISOString(),
      expiryDate: expiry.toISOString(),
    });
  };

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div style={{
            width: '60px', height: '60px',
            background: 'rgba(16,185,129,0.15)',
            borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 12px',
          }}>
            <i className="fas fa-certificate" style={{ fontSize: '30px', color: '#10B981' }}></i>
          </div>
          <h2 style={{ margin: 0, color: 'var(--text-main)' }}>Certificado de Garantía</h2>
          <p style={{ margin: '8px 0 0', color: 'var(--text-muted)' }}>
            Configura el certificado de garantía para esta venta
          </p>
        </div>

        <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', padding: '12px', background: 'var(--bg-surface-hover)', borderRadius: '8px' }}>
          <input type="checkbox" id="includeWarranty" checked={includeWarranty} onChange={(e) => setIncludeWarranty(e.target.checked)} style={{ width: '20px', height: '20px' }} />
          <label htmlFor="includeWarranty" style={{ cursor: 'pointer', marginBottom: 0, fontWeight: 500 }}>Incluir Certificado de Garantía</label>
        </div>

        {includeWarranty && (
          <>
            <div className="form-group">
              <label>Días de Garantía</label>
              <input type="number" min="1" max="3650" className="form-control" value={warrantyDays} onChange={(e) => setWarrantyDays(parseInt(e.target.value) || 90)} />
            </div>
            <div className="form-group">
              <label>Cobertura</label>
              <textarea className="form-control" value={coverageText} onChange={(e) => setCoverageText(e.target.value)} rows="2" placeholder="Defectos de fábrica en materiales y mano de obra" />
            </div>
            <div className="form-group">
              <label>Exclusiones</label>
              <textarea className="form-control" value={exclusionText} onChange={(e) => setExclusionText(e.target.value)} rows="2" placeholder="Daños por mal uso, golpes, humedad" />
            </div>
          </>
        )}

        <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
          <button className="btn btn-primary" onClick={handleConfirm} style={{ flex: 1 }}>
            {includeWarranty ? 'Guardar Garantía' : 'Quitar Garantía'}
          </button>
          <button className="btn btn-outline" onClick={onClose} style={{ flex: 1 }}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
});

WarrantyModal.displayName = 'WarrantyModal';

export { ReceiptModal, NewClientModal, ManualProductModal, DueDateModal, WarrantyModal, ThermalReceipt80, ThermalReceipt58, LetterReceipt, A4Receipt, QuotationReceipt80, QuotationReceipt58, QuotationLetterReceipt };
