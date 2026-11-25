import JsBarcode from "jsbarcode";

export function codificarEtiqueta(codigo: string) {
  const resultado: { encodings?: { data: string }[] } = {};
  try {
    JsBarcode(resultado, codigo, { format: "CODE128", displayValue: false });
    const modulos = resultado.encodings?.map(({ data }) => data).join("");
    if (!modulos) return null;

    // Diez módulos blancos a cada lado delimitan la lectura.
    return {
      ancho: modulos.length + 20,
      trazado: [...modulos.matchAll(/1+/g)]
        .map((grupo) => {
          const x = (grupo.index ?? 0) + 10;
          const ancho = grupo[0].length;
          return `M${x} 0h${ancho}v40H${x}z`;
        })
        .join(""),
    };
  } catch {
    return null;
  }
}
