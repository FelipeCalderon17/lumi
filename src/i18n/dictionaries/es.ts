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
    crisisBanner:
      "Si estás en una crisis emocional, llama o envía un mensaje de texto al 988 (988 Suicide & Crisis Lifeline). Hay atención en español.",
  },
  safety: {
    outsideUs:
      "Si estás fuera de Estados Unidos, comunícate con los servicios de emergencia locales.",
    emergency: {
      title: "Esto parece una emergencia.",
      steps: [
        "Llama al 911 ahora.",
        "Si estás en el hospital, avísale a una enfermera o presiona el botón de llamada de inmediato.",
        "Si estás fuera de Estados Unidos, comunícate con los servicios de emergencia locales.",
      ],
    },
    selfHarm: {
      title: "Por favor, pide ayuda ahora mismo.",
      steps: [
        "Si tú u otra persona están en peligro inmediato, llama al 911.",
        "Llama o envía un mensaje de texto al 988 para comunicarte con la 988 Suicide & Crisis Lifeline, a cualquier hora, de día o de noche. Hay atención en español.",
        "Si estás fuera de Estados Unidos, comunícate con los servicios de emergencia locales.",
      ],
    },
    crisis: {
      title: "Parece que estás pasando por un momento muy pesado.",
      body: "No tienes que cargar con esto a solas. Puedes hablar con alguien esta misma noche.",
      steps: [
        "Llama o envía un mensaje de texto al 988 para comunicarte con la 988 Suicide & Crisis Lifeline, a cualquier hora, de día o de noche. Hay atención en español.",
        "Si alguien está en peligro inmediato, llama al 911.",
        "Durante el día, el trabajador social de tu hospital puede ayudarte a encontrar apoyo continuo.",
        "Si estás fuera de Estados Unidos, comunícate con los servicios de emergencia locales.",
      ],
    },
    crisisLine:
      "Si estás en una crisis emocional, llama o envía un mensaje de texto al 988 para comunicarte con la 988 Suicide & Crisis Lifeline, a cualquier hora, de día o de noche. Hay atención en español.",
    medical: {
      title: "Esa es una pregunta para el equipo médico de tu hijo o hija.",
      body: "Lumi no da consejos médicos, porque tu equipo médico conoce a tu hijo o hija. Si no puede esperar, llama al número que te dio tu equipo médico para preguntas fuera de horario. Si es una emergencia, llama al 911.",
      articleLead: "Esta guía puede ayudarte a preparar qué preguntar:",
    },
    offTopic: {
      title: "Lumi solo puede ayudarte con el lado práctico del tratamiento.",
      body: "Prueba a preguntar sobre los días en el hospital, el dinero y el trabajo, la escuela y la familia, o cómo cuidarte a ti.",
    },
    fallback: {
      title: "Lumi no puede responder en este momento.",
      body: "Algo falló de nuestro lado. El trabajador social de tu hospital o el equipo de familias de Lumi pueden ayudarte. Si es una emergencia, llama al 911.",
      rateLimited: "Hagamos una pausa corta. Puedes volver a preguntar en un minuto.",
    },
    abstained: {
      title: "Todavía no tengo una guía sobre eso.",
      body: "El trabajador social de tu hospital o el equipo de familias de Lumi pueden ayudarte con esto.",
    },
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
    processingNotice:
      "Antes de preguntar: tu pregunta se envía a OpenAI para buscar una respuesta en nuestras guías. Lumi no guarda tu conversación. Por favor, no incluyas nombres ni otros datos que identifiquen a tu familia.",
    progress: "Buscando en nuestras guías para familias…",
  },
  gaps: {
    offer: "¿Quieres enviar esta pregunta al equipo de Lumi para que escriban una guía?",
    previewLabel: "Esto es lo que guardaríamos. Puedes editarlo y quitar cualquier dato personal:",
    disclosure:
      "El equipo de Lumi puede leer lo que guardes. Se conserva 30 días y luego se borra. No guardamos tu nombre, tu conversación ni los datos de tu dispositivo.",
    save: "Guardar esta pregunta",
    cancel: "No, gracias",
    saved: "Gracias. El equipo verá tu pregunta.",
    delete: "Borrarla",
    deleted: "Borrada.",
    failed: "No pudimos guardarla en este momento. Inténtalo más tarde.",
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
