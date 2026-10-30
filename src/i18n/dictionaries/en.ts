/**
 * English is the reference dictionary: its shape defines the `Dictionary` type,
 * so a missing key in Spanish is a compile error. Copy rules: docs/CONTENT-GUIDELINES.md.
 */
export const en = {
  meta: {
    title: "Lumi — a little light for the long nights",
    description:
      "Practical, kind help for families going through childhood cancer treatment. A prototype for a fictional foundation.",
  },
  nav: {
    label: "Main",
    home: "Home",
    help: "Ask Lumi",
    donate: "Donate",
    volunteer: "Volunteer",
    switchLanguage: "Español",
    switchLanguageLabel: "Ver esta página en español",
  },
  emergency: {
    banner:
      "If your child needs urgent medical help, call 911 or your hospital's emergency line now.",
  },
  home: {
    eyebrow: "For families in treatment",
    title: "A little light for the long nights.",
    lede: "Lumi helps families with the practical side of childhood cancer treatment: hospital days, paperwork, school, siblings and looking after yourself. Ask a question any time, in English or Spanish.",
    cta: "Ask Lumi a question",
    sections: {
      help: {
        title: "Ask Lumi",
        body: "Plain answers from a small library of guides written for families. When Lumi doesn't know, it says so and points you to a person.",
      },
      donate: {
        title: "Donate",
        body: "Placeholder. In a full site, this is where people could fund family support.",
      },
      volunteer: {
        title: "Volunteer",
        body: "Placeholder. In a full site, this is where people could offer their time.",
      },
    },
  },
  help: {
    title: "Ask Lumi",
    lede: "Ask about the practical side of treatment. Lumi answers from guides written for families and always shows where an answer comes from.",
    boundaries:
      "Lumi doesn't give medical advice. For anything about your child's health, your care team is the right place, and Lumi can help you prepare your questions for them.",
    placeholder: "The assistant isn't connected yet.",
  },
  staff: {
    gapsTitle: "Unanswered questions",
    gapsLede:
      "Questions Lumi couldn't answer, shared by parents who chose to. No names or conversations are stored. Use them to decide which guides to write next.",
    placeholder: "This view will be protected by a staff passcode.",
  },
  footer: {
    fictional: "Lumi is a fictional foundation, built as a prototype. It is not a medical service.",
  },
};

export type Dictionary = typeof en;
