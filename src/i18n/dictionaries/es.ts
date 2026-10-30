import type { Dictionary } from "./en";

/** Español neutro latinoamericano, tuteo. Ver docs/CONTENT-GUIDELINES.md. */
export const es: Dictionary = {
  meta: {
    title: "Lumi — una lucecita para las noches largas",
    description:
      "Ayuda práctica y cálida para familias que atraviesan el tratamiento del cáncer infantil. Un prototipo para una fundación ficticia.",
  },
  nav: {
    label: "Principal",
    home: "Inicio",
    help: "Pregúntale a Lumi",
    donate: "Donar",
    volunteer: "Voluntariado",
    switchLanguage: "English",
    switchLanguageLabel: "View this page in English",
  },
  emergency: {
    banner:
      "Si tu hijo o hija necesita atención médica urgente, llama al 911 o a la línea de emergencias de tu hospital ahora.",
  },
  home: {
    eyebrow: "Para familias en tratamiento",
    title: "Una lucecita para las noches largas.",
    lede: "Lumi ayuda a las familias con el lado práctico del tratamiento del cáncer infantil: los días en el hospital, los trámites, la escuela, los hermanos y cuidarte a ti. Pregunta cuando quieras, en español o en inglés.",
    cta: "Hazle una pregunta a Lumi",
    sections: {
      help: {
        title: "Pregúntale a Lumi",
        body: "Respuestas claras a partir de una pequeña biblioteca de guías escritas para familias. Cuando Lumi no sabe algo, te lo dice y te indica con quién hablar.",
      },
      donate: {
        title: "Donar",
        body: "Espacio reservado. En un sitio completo, aquí se podría apoyar económicamente a las familias.",
      },
      volunteer: {
        title: "Voluntariado",
        body: "Espacio reservado. En un sitio completo, aquí se podría ofrecer tiempo como voluntario.",
      },
    },
  },
  help: {
    title: "Pregúntale a Lumi",
    lede: "Pregunta sobre el lado práctico del tratamiento. Lumi responde a partir de guías escritas para familias y siempre te muestra de dónde sale cada respuesta.",
    boundaries:
      "Lumi no da consejos médicos. Para todo lo relacionado con la salud de tu hijo o hija, tu equipo médico es el lugar indicado, y Lumi puede ayudarte a preparar tus preguntas para ellos.",
    placeholder: "El asistente todavía no está conectado.",
  },
  staff: {
    gapsTitle: "Preguntas sin respuesta",
    gapsLede:
      "Preguntas que Lumi no pudo responder, compartidas por familias que decidieron hacerlo. No se guardan nombres ni conversaciones. Sirven para decidir qué guías escribir.",
    placeholder: "Esta vista estará protegida con una clave para el equipo.",
  },
  footer: {
    fictional: "Lumi es una fundación ficticia, creada como prototipo. No es un servicio médico.",
  },
};
