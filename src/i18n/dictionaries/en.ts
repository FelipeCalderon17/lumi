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
      "In an emergency, call 911 now. If you're already at the hospital, tell a nurse or press the call button right away.",
    crisisBanner:
      "If you're in emotional crisis, call or text 988 (988 Suicide & Crisis Lifeline). For Spanish, choose the Spanish option when calling, or text AYUDA to 988.",
  },
  /**
   * Fixed, human-reviewed safety copy (ADR 0003, 0010). Never model-generated.
   * Lumi serves families in the US: 911 for emergencies, 988 for emotional crisis.
   * These are the ONLY places 988 may appear, plus the identical line in the self-care article.
   */
  safety: {
    outsideUs: "Outside the US, contact your local emergency services.",
    emergency: {
      title: "This sounds like an emergency.",
      steps: [
        "Call 911 now.",
        "If you're at the hospital, tell a nurse or press the call button right away.",
        "Outside the US, contact your local emergency services.",
      ],
    },
    selfHarm: {
      title: "Please reach out for help right now.",
      steps: [
        "If you or someone else is in immediate danger, call 911.",
        "Call or text 988 to reach the 988 Suicide & Crisis Lifeline, any time, day or night. For Spanish, choose the Spanish option when calling, or text AYUDA to 988.",
        "Outside the US, contact your local emergency services.",
      ],
    },
    crisis: {
      title: "It sounds like things are very heavy right now.",
      body: "You don't have to carry this alone. You can talk to someone tonight.",
      steps: [
        "Call or text 988 to reach the 988 Suicide & Crisis Lifeline, any time, day or night. For Spanish, choose the Spanish option when calling, or text AYUDA to 988.",
        "If anyone is in immediate danger, call 911.",
        "During the day, your hospital's social worker can help you find ongoing support.",
        "Outside the US, contact your local emergency services.",
      ],
    },
    /** 988 line reused verbatim in the KB self-care article (checked by the KB tests). */
    crisisLine:
      "If you're in emotional crisis, call or text 988 to reach the 988 Suicide & Crisis Lifeline, any time, day or night. For Spanish, choose the Spanish option when calling, or text AYUDA to 988.",
    medical: {
      title: "That's a question for your child's care team.",
      body: "Lumi doesn't give medical advice, because your care team knows your child. If it can't wait, call the number your care team gave you for questions after hours. If it's an emergency, call 911.",
      articleLead: "This guide can help you prepare what to ask:",
    },
    offTopic: {
      title: "Lumi can only help with the practical side of treatment.",
      body: "Try asking about hospital days, money and work, school and family, or looking after yourself.",
    },
    fallback: {
      title: "Lumi can't answer right now.",
      body: "For practical questions, ask your hospital's social worker. For questions about your child's health, contact the care team. In an emergency, call 911.",
      rateLimited: "Let's take a short pause. You can ask again in a minute.",
    },
    abstained: {
      title: "I don't have a guide on that yet.",
      body: "For practical questions, your hospital's social worker may help you find the right person to ask.",
    },
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
    processingNotice:
      "Before you ask: your question is sent to OpenAI to find an answer in our guides. Lumi doesn't save your conversation. Please don't include names or other details that identify your family.",
    progress: "Looking through our family guides…",
  },
  gaps: {
    offer: "Would you like to send this question to the Lumi team so they can write a guide?",
    previewLabel: "This is what we'd save. You can edit it, and remove anything personal:",
    disclosure:
      "Lumi staff can read the question you choose to save, so remove names and identifying details first. We save the edited question, its language, topic and submission date. Questions older than 30 days are deleted when someone saves a question or staff opens the list.",
    save: "Save this question",
    cancel: "No, thanks",
    saved: "Thank you. The team will see your question.",
    delete: "Delete it",
    deleted: "Deleted.",
    failed: "We couldn't save it right now. Please try again later.",
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
