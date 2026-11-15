export type CustomerLocale = "es" | "en";

const copy = {
  es: {
    joinEyebrow: "Programa de lealtad",
    joinTitle: "Únete",
    joinIntro: "Crea tu tarjeta. La aceptación del programa es obligatoria. Los mensajes de marketing son opcionales.",
    closed: "Este programa no está aceptando registros en este momento.",
    missing: "No encontramos ese enlace de registro.",
    firstName: "Nombre",
    lastName: "Apellido",
    email: "Correo",
    phone: "Teléfono",
    birthday: "Cumpleaños",
    accept: "Acepto las reglas de este programa de lealtad.",
    emailConsent: "Quiero recibir correos de esta empresa.",
    whatsappConsent: "Quiero recibir WhatsApp de esta empresa.",
    smsConsent: "Quiero recibir SMS de esta empresa.",
    joinSubmit: "Crear mi tarjeta",
    joinPending: "Creando…",
    optional: "Opcional",
    cardMissing: "Esta tarjeta no está disponible.",
    stamps: "Sellos",
    points: "Puntos",
    rewards: "Recompensas listas",
    noRewards: "Todavía no hay una recompensa lista.",
    membership: "Tarjeta",
    showQr: "Muestra este código en el local.",
    stampTitle: "Sumar un sello",
    stampIntro: "Este enlace es el mismo para el código QR y la etiqueta NFC.",
    stampSubmit: "Sumar sello",
    stampPending: "Sumando…",
    stampNeedCard: "Abre tu tarjeta en este teléfono antes de sumar un sello. El sello se aplica a esa tarjeta.",
    stampClosed: "Este sello no está disponible.",
    stampLabel: "Punto de sello",
    errors: {
      program_not_accepted: "Acepta las reglas del programa para crear la tarjeta.",
      already_enrolled: "Ese correo ya tiene una tarjeta en este negocio.",
      business_suspended: "Este negocio no puede registrar visitas en este momento.",
      rate_limited: "Hay demasiados intentos desde esta conexión. Espera un momento.",
      invalid_email: "Escribe un correo válido.",
      invalid_name: "Escribe tu nombre y apellido.",
      invalid_phone: "Revisa el teléfono.",
      invalid_birthday: "Revisa la fecha de cumpleaños.",
      stamp_cooldown: "Este sello ya se usó hace poco en tu tarjeta. Espera el tiempo del local.",
      stamp_code_invalid: "Este sello no corresponde a tu tarjeta.",
      stamp_code_used: "Este código ya se usó.",
      stamp_code_expired: "Este código ya venció.",
      not_found: "No encontramos ese registro.",
      enrollment_closed: "El registro está cerrado.",
      program_unavailable: "Este negocio todavía no tiene un programa activo.",
      generic: "No se pudo completar. Inténtalo de nuevo.",
    },
  },
  en: {
    joinEyebrow: "Loyalty program",
    joinTitle: "Join",
    joinIntro: "Create your card. Program acceptance is required. Marketing messages are optional.",
    closed: "This program is not accepting registrations right now.",
    missing: "That enrollment link could not be found.",
    firstName: "First name",
    lastName: "Last name",
    email: "Email",
    phone: "Phone",
    birthday: "Birthday",
    accept: "I accept the rules of this loyalty program.",
    emailConsent: "I want emails from this business.",
    whatsappConsent: "I want WhatsApp messages from this business.",
    smsConsent: "I want SMS messages from this business.",
    joinSubmit: "Create my card",
    joinPending: "Creating…",
    optional: "Optional",
    cardMissing: "This card is not available.",
    stamps: "Stamps",
    points: "Points",
    rewards: "Rewards ready",
    noRewards: "No reward is ready yet.",
    membership: "Card",
    showQr: "Show this code at the counter.",
    stampTitle: "Add a stamp",
    stampIntro: "This link is the same for the QR code and the NFC tag.",
    stampSubmit: "Add stamp",
    stampPending: "Adding…",
    stampNeedCard: "Open your card on this phone before adding a stamp. The stamp is applied to that card.",
    stampClosed: "This stamp is not available.",
    stampLabel: "Stamp point",
    errors: {
      program_not_accepted: "Accept the program rules to create the card.",
      already_enrolled: "That email already has a card at this business.",
      business_suspended: "This business cannot record visits right now.",
      rate_limited: "Too many attempts from this connection. Wait a moment.",
      invalid_email: "Enter a valid email.",
      invalid_name: "Enter your first and last name.",
      invalid_phone: "Check the phone number.",
      invalid_birthday: "Check the birthday.",
      stamp_cooldown: "This stamp was used on your card recently. Wait for the location cooldown.",
      stamp_code_invalid: "This stamp does not match your card.",
      stamp_code_used: "This code has already been used.",
      stamp_code_expired: "This code has expired.",
      not_found: "That record could not be found.",
      enrollment_closed: "Enrollment is closed.",
      program_unavailable: "This business does not have an active program yet.",
      generic: "That could not be completed. Try again.",
    },
  },
} as const;

export function customerLocale(value: string | null | undefined): CustomerLocale {
  return value?.toLowerCase().startsWith("es") ? "es" : "en";
}

export function customerCopy(locale: CustomerLocale) {
  switch (locale) {
    case "es":
      return copy.es;
    case "en":
      return copy.en;
    default: {
      const unknown: never = locale;
      return unknown;
    }
  }
}

export type CustomerCopy = ReturnType<typeof customerCopy>;

export function customerMessage(locale: CustomerLocale, error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  const code = message.match(/iago:([a-z0-9_]+)/)?.[1];
  const errors = customerCopy(locale).errors;
  if (code && code in errors) {
    return errors[code as keyof typeof errors];
  }
  return errors.generic;
}
