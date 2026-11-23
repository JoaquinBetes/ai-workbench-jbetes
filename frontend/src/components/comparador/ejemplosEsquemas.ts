// Ejemplos para el modo "Salidas estructuradas": esquema + texto + respuesta correcta.

export type EjemploEsquema = {
  id: string;
  nombre: string;
  esquema: object;
  texto: string;
  esperado: unknown;
};

export const EJEMPLOS_ESQUEMAS: EjemploEsquema[] = [
  {
    id: "persona",
    nombre: "Datos de una persona",
    esquema: {
      type: "object",
      properties: {
        nombre: { type: "string", description: "Nombre y apellido" },
        edad: { type: "integer" },
        ciudad: { type: "string" },
        profesion: { type: "string" },
      },
      required: ["nombre", "edad", "ciudad", "profesion"],
    },
    texto:
      "Me llamo Lucía Fernández, tengo 29 años y trabajo como ingeniera civil en Rosario desde hace tres años.",
    esperado: { nombre: "Lucía Fernández", edad: 29, ciudad: "Rosario", profesion: "ingeniera civil" },
  },
  {
    id: "evento",
    nombre: "Un evento con fecha",
    esquema: {
      type: "object",
      properties: {
        titulo: { type: "string" },
        fecha: { type: "string", description: "Formato AAAA-MM-DD" },
        hora: { type: "string", description: "Formato HH:MM, 24 horas" },
        lugar: { type: "string" },
        gratuito: { type: "boolean" },
      },
      required: ["titulo", "fecha", "hora", "lugar", "gratuito"],
    },
    texto:
      "El sábado 14 de marzo de 2026 a las 19:30 se presenta la Orquesta Juvenil en el Teatro del Libertador. La entrada es libre y gratuita.",
    // El título no se puntúa: hay muchas formas válidas de escribirlo.
    esperado: { fecha: "2026-03-14", hora: "19:30", lugar: "Teatro del Libertador", gratuito: true },
  },
  {
    id: "compra",
    nombre: "Lista de productos con precios",
    esquema: {
      type: "object",
      properties: {
        productos: {
          type: "array",
          items: {
            type: "object",
            properties: {
              nombre: { type: "string" },
              cantidad: { type: "integer" },
              precio_unitario: { type: "number" },
            },
            required: ["nombre", "cantidad", "precio_unitario"],
          },
        },
        total: { type: "number" },
      },
      required: ["productos", "total"],
    },
    texto:
      "Compré 3 alfajores a $1200 cada uno, 2 litros de leche a $1500 el litro y un paquete de yerba de $4800.",
    esperado: {
      productos: [
        { nombre: "alfajores", cantidad: 3, precio_unitario: 1200 },
        { nombre: "leche", cantidad: 2, precio_unitario: 1500 },
        { nombre: "yerba", cantidad: 1, precio_unitario: 4800 },
      ],
      total: 11400,
    },
  },
];
