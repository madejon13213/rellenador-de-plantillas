// Genera una plantilla .docx de ejemplo con campos {{ campo }}.
//
// Uso (desde la raíz del repo):
//   node .claude/skills/plantillas-docx/scripts/generar_plantilla.js <salida.docx> "<Título>" campo1 campo2 ...
// Ej.:
//   node .claude/skills/plantillas-docx/scripts/generar_plantilla.js backend/templates/ficha.docx "FICHA" nombre apellidos dni
//
// Necesita el paquete "docx":  npm install docx   (en cualquier carpeta; usa NODE_PATH si no es la actual)
// Cada campo va en un único fragmento de texto, que es lo que necesita docxtpl.
const fs = require("fs");
const { Document, Packer, Paragraph, TextRun, AlignmentType } = require("docx");

const [salida, titulo, ...campos] = process.argv.slice(2);
if (!salida || !titulo || campos.length === 0) {
  console.error('Uso: node generar_plantilla.js <salida.docx> "<Título>" campo1 campo2 ...');
  process.exit(1);
}
const invalidos = campos.filter((c) => !/^[A-Za-z_][A-Za-z0-9_]*$/.test(c));
if (invalidos.length) {
  console.error(`Nombres de campo no válidos (solo letras, números y _; sin espacios ni acentos): ${invalidos.join(", ")}`);
  process.exit(1);
}

const parrafo = (texto, opciones = {}) =>
  new Paragraph({
    spacing: { after: 200, line: 300 },
    alignment: opciones.alineacion,
    children: [new TextRun({ text: texto, bold: opciones.negrita, size: opciones.tamano || 24, font: "Calibri" })],
  });

const documento = new Document({
  sections: [
    {
      children: [
        parrafo(titulo, { negrita: true, tamano: 36, alineacion: AlignmentType.CENTER }),
        parrafo(""),
        ...campos.map((c) => parrafo(`${c}: {{ ${c} }}`)),
      ],
    },
  ],
});

Packer.toBuffer(documento).then((buffer) => {
  fs.writeFileSync(salida, buffer);
  console.log(`Plantilla creada: ${salida} (${campos.length} campos)`);
});
