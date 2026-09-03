import { useCallback, useEffect } from 'react';
import { corregirTexto, precargarDiccionario } from '@/lib/autocorrector';

// Hook reutilizable para autocorregir la ortografía en textareas de comentarios.
// Al soltar el valor en un textarea controlado, corrige la última palabra
// escrita (cuando se presionó espacio) y restaura la posición del cursor.
export function useAutocorrector() {
  useEffect(() => {
    precargarDiccionario();
  }, []);

  const corregir = useCallback(
    async (elemento: HTMLTextAreaElement, aplicar: (valor: string) => void) => {
      const valor = elemento.value;
      const cursor = elemento.selectionStart ?? valor.length;

      try {
        const resultado = await corregirTexto(valor, cursor);
        if (resultado && resultado.texto !== valor) {
          aplicar(resultado.texto);
          requestAnimationFrame(() => {
            elemento.setSelectionRange(resultado.cursor, resultado.cursor);
          });
        }
      } catch {
        // Si el diccionario no está disponible, simplemente no se corrige.
      }
    },
    []
  );

  return { corregir };
}