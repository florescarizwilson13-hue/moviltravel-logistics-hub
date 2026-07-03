export function formatDisplayName(value: string | null | undefined) {
  return formatName(value, true);
}

export function formatPersonName(value: string | null | undefined) {
  return formatName(value, false);
}

function formatName(value: string | null | undefined, preserveUppercaseWords: boolean) {
  const cleanValue = value?.trim();

  if (!cleanValue) {
    return "";
  }

  return cleanValue
    .split(/\s+/)
    .map((word) =>
      word
        .split("-")
        .map((part) => formatDisplayWord(part, preserveUppercaseWords))
        .join("-")
    )
    .join(" ");
}

export function normalizeChileanPhone(value: string | null | undefined) {
  const cleanValue = value?.trim();
  const digits = cleanValue?.replace(/\D/g, "");

  if (!digits) {
    return null;
  }

  if (digits.length === 8) {
    return `+569${digits}`;
  }

  if (digits.length === 9 && digits.startsWith("9")) {
    return `+56${digits}`;
  }

  if (digits.length === 11 && digits.startsWith("569")) {
    return `+${digits}`;
  }

  if (digits.length === 12 && digits.startsWith("0569")) {
    return `+${digits.slice(1)}`;
  }

  return cleanValue ?? null;
}

export function normalizeVehiclePlate(value: string | null | undefined) {
  const cleanValue = value?.trim();

  if (!cleanValue) {
    return null;
  }

  return cleanValue.toLocaleUpperCase("es-CL");
}

export function formatVehicleCapacity(value: number | null | undefined) {
  if (!value) {
    return "Capacidad pendiente";
  }

  return `${value} ${value === 1 ? "pasajero" : "pasajeros"}`;
}

function formatDisplayWord(word: string, preserveUppercaseWords: boolean) {
  if (preserveUppercaseWords && word === word.toUpperCase()) {
    return word;
  }

  if (/\d/.test(word)) {
    return word.toUpperCase();
  }

  return `${word.slice(0, 1).toLocaleUpperCase("es-CL")}${word
    .slice(1)
    .toLocaleLowerCase("es-CL")}`;
}
