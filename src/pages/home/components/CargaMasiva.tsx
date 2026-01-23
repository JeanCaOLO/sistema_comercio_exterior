import { useState } from 'react';
import { supabase } from '../../../lib/supabase';

export default function CargaMasiva() {
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [importStats, setImportStats] = useState<{total: number, success: number, errors: number} | null>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (file: File) => {
    const validTypes = ['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
    
    if (!validTypes.includes(file.type) && !file.name.endsWith('.csv')) {
      setError('Por favor, suba un archivo CSV o Excel válido');
      return;
    }

    setFile(file);
    setError('');
    parseFile(file);
  };

  const parseFile = (file: File) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        setError('El archivo debe contener al menos una fila de encabezados y una fila de datos');
        return;
      }

      const headers = lines[0].split(',').map(h => h.trim());
      const data = lines.slice(1, 6).map(line => {
        const values = line.split(',').map(v => v.trim());
        const obj: any = {};
        headers.forEach((header, index) => {
          obj[header] = values[index] || '';
        });
        return obj;
      });

      setPreviewData(data);
    };

    reader.readAsText(file);
  };

  // Función para convertir fechas de dd/mm/yyyy a yyyy-mm-dd
  const convertirFecha = (fecha: string): string => {
    if (!fecha || fecha.trim() === '') return new Date().toISOString().split('T')[0];
    
    const fechaLimpia = fecha.trim();
    
    // Si ya está en formato yyyy-mm-dd válido, retornar tal cual
    if (/^\d{4}-\d{2}-\d{2}$/.test(fechaLimpia)) {
      const [año, mes, dia] = fechaLimpia.split('-').map(Number);
      if (mes >= 1 && mes <= 12 && dia >= 1 && dia <= 31) {
        return fechaLimpia;
      }
    }
    
    // Convertir de dd/mm/yyyy a yyyy-mm-dd
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(fechaLimpia)) {
      const [dia, mes, año] = fechaLimpia.split('/').map(Number);
      if (mes >= 1 && mes <= 12 && dia >= 1 && dia <= 31) {
        return `${año}-${mes.toString().padStart(2, '0')}-${dia.toString().padStart(2, '0')}`;
      }
    }
    
    // Convertir de yyyy/mm/dd a yyyy-mm-dd
    if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(fechaLimpia)) {
      const [año, mes, dia] = fechaLimpia.split('/').map(Number);
      if (mes >= 1 && mes <= 12 && dia >= 1 && dia <= 31) {
        return `${año}-${mes.toString().padStart(2, '0')}-${dia.toString().padStart(2, '0')}`;
      }
    }
    
    // Intentar parsear con Date
    try {
      const date = new Date(fechaLimpia);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    } catch (e) {
      console.warn(`⚠️ No se pudo convertir la fecha: ${fechaLimpia}`);
    }
    
    // Si no coincide con ningún formato válido, retornar fecha actual
    console.warn(`⚠️ Formato de fecha no reconocido: ${fechaLimpia}, usando fecha actual`);
    return new Date().toISOString().split('T')[0];
  };

  const handleImport = async () => {
    if (!file) {
      setError('Por favor, seleccione un archivo primero');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess(false);
    setImportStats(null);

    try {
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        try {
          const text = e.target?.result as string;
          const lines = text.split('\n').filter(line => line.trim());
          
          if (lines.length < 2) {
            setError('El archivo debe contener al menos una fila de encabezados y una fila de datos');
            setLoading(false);
            return;
          }

          const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/ /g, '_'));
          const dataLines = lines.slice(1);
          
          console.log(`📊 Procesando ${dataLines.length} registros...`);
          
          const expedientes = dataLines.map((line, index) => {
            const values = line.split(',').map(v => v.trim());
            const obj: any = {};
            
            headers.forEach((header, idx) => {
              obj[header] = values[idx] || '';
            });

            return {
              po_tiquetera: obj.po_tiquetera || obj.po || `PO-${Date.now()}-${index}`,
              tipo_po: obj.tipo_po || obj.tipo || 'Compra Directa',
              solicitante: obj.solicitante || 'Sin especificar',
              fecha_solicitud: convertirFecha(obj.fecha_solicitud),
              prioridad: obj.prioridad || 'Media',
              prioridad_urgente: obj.prioridad_urgente === 'true' || obj.prioridad_urgente === '1' || obj.prioridad_urgente === 'TRUE',
              dificultad: obj.dificultad || 'Media',
              tiempo_minutos: parseInt(obj.tiempo_minutos || obj.tiempo || '60') || 60,
              dias_entrega: parseInt(obj.dias_entrega || obj.dias || '5') || 5,
              fecha_requerimiento: convertirFecha(obj.fecha_requerimiento),
              exp_id: obj.exp_id || obj.exp || `EXP-${Date.now()}-${index}`,
              lineas_oc: parseInt(obj.lineas_oc || obj.lineas || '0') || 0,
              fecha_creacion_expediente: convertirFecha(obj.fecha_creacion_expediente),
              estado_expediente: obj.estado_expediente || obj.estado || 'Nuevo',
              responsable_creacion: obj.responsable_creacion || obj.responsable || 'Sin asignar',
              instrucciones_adicionales: obj.instrucciones_adicionales || obj.instrucciones || null
            };
          });

          console.log('📤 Insertando datos en Supabase...', expedientes);

          const { data, error: insertError } = await supabase
            .from('expedientes')
            .insert(expedientes)
            .select();

          if (insertError) {
            console.error('❌ Error de Supabase:', insertError);
            throw insertError;
          }

          console.log('✅ Datos insertados exitosamente:', data);

          setImportStats({
            total: dataLines.length,
            success: data?.length || dataLines.length,
            errors: 0
          });

          setSuccess(true);
          setFile(null);
          setPreviewData([]);
          
          // Recargar la página después de 2 segundos para actualizar el dashboard
          setTimeout(() => {
            window.location.reload();
          }, 2000);

        } catch (innerError: any) {
          console.error('❌ Error en el procesamiento:', innerError);
          setError(`Error al procesar el archivo: ${innerError.message}`);
          setLoading(false);
        }
      };

      reader.onerror = () => {
        setError('Error al leer el archivo');
        setLoading(false);
      };

      reader.readAsText(file);
    } catch (error: any) {
      console.error('❌ Error general:', error);
      setError(`Error al importar datos: ${error.message}`);
      setLoading(false);
    }
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Carga Masiva de Datos</h1>
        <p className="text-gray-500 mt-2">Importe datos históricos desde archivos CSV o Excel</p>
      </div>

      {success && importStats && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <i className="ri-checkbox-circle-line text-green-600 text-2xl"></i>
            <div className="flex-1">
              <p className="text-green-800 font-semibold">¡Datos importados exitosamente!</p>
              <p className="text-green-600 text-sm mt-1">
                Se han cargado {importStats.success} de {importStats.total} expedientes en la base de datos
              </p>
              <p className="text-green-600 text-sm mt-1">
                La página se actualizará automáticamente...
              </p>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <i className="ri-error-warning-line text-red-600 text-2xl"></i>
            <div className="flex-1">
              <p className="text-red-800 font-semibold">Error al importar</p>
              <p className="text-red-600 text-sm mt-1">{error}</p>
            </div>
            <button
              onClick={() => setError('')}
              className="text-red-600 hover:text-red-700 cursor-pointer"
            >
              <i className="ri-close-line text-xl"></i>
            </button>
          </div>
        </div>
      )}

      {loading && (
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <i className="ri-loader-4-line animate-spin text-blue-600 text-2xl"></i>
            <div>
              <p className="text-blue-800 font-semibold">Procesando archivo...</p>
              <p className="text-blue-600 text-sm">Por favor espere mientras se cargan los datos</p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Formato del Archivo</h2>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <p className="text-sm text-blue-800 mb-2">
            <strong>Columnas requeridas (CSV):</strong>
          </p>
          <code className="text-xs text-blue-900 block bg-white p-3 rounded border border-blue-200 overflow-x-auto">
            po_tiquetera,tipo_po,solicitante,fecha_solicitud,prioridad,prioridad_urgente,dificultad,tiempo_minutos,dias_entrega,fecha_requerimiento,exp_id,lineas_oc,fecha_creacion_expediente,estado_expediente,responsable_creacion,instrucciones_adicionales
          </code>
        </div>
        <p className="text-sm text-gray-600">
          Asegúrese de que su archivo incluya todas las columnas necesarias. Los valores de fecha deben estar en formato YYYY-MM-DD.
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Subir Archivo</h2>
        
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${
            dragActive ? 'border-teal-500 bg-teal-50' : 'border-gray-300 bg-gray-50'
          }`}
        >
          <i className="ri-upload-cloud-2-line text-6xl text-gray-400 mb-4"></i>
          <p className="text-lg font-medium text-gray-700 mb-2">
            Arrastre y suelte su archivo aquí
          </p>
          <p className="text-sm text-gray-500 mb-4">o</p>
          <label className="inline-block px-6 py-3 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 transition-colors cursor-pointer whitespace-nowrap">
            Seleccionar Archivo
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleChange}
              className="hidden"
            />
          </label>
          {file && (
            <div className="mt-4 flex items-center justify-center gap-2 text-sm text-gray-700">
              <i className="ri-file-text-line text-teal-600"></i>
              <span>{file.name}</span>
              <button
                onClick={() => {
                  setFile(null);
                  setPreviewData([]);
                }}
                className="text-red-600 hover:text-red-700 cursor-pointer"
              >
                <i className="ri-close-line"></i>
              </button>
            </div>
          )}
        </div>
      </div>

      {previewData.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Vista Previa de Datos</h2>
          <p className="text-sm text-gray-600 mb-4">
            Mostrando las primeras 5 filas del archivo
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  {Object.keys(previewData[0]).map((key) => (
                    <th key={key} className="text-left py-2 px-3 font-semibold text-gray-700 whitespace-nowrap">
                      {key}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewData.map((row, index) => (
                  <tr key={index} className="border-b border-gray-100">
                    {Object.values(row).map((value: any, i) => (
                      <td key={i} className="py-2 px-3 text-gray-600 whitespace-nowrap">
                        {value}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {file && (
        <div className="flex items-center justify-end gap-4">
          <button
            onClick={() => {
              setFile(null);
              setPreviewData([]);
              setError('');
              setImportStats(null);
            }}
            disabled={loading}
            className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancelar
          </button>
          <button
            onClick={handleImport}
            disabled={loading}
            className="px-8 py-3 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <i className="ri-loader-4-line animate-spin mr-2"></i>
                Sincronizando...
              </>
            ) : (
              <>
                <i className="ri-download-line mr-2"></i>
                Sincronizar Histórico
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
