import { type ClassValue, clsx } from "clsx";

export function cn(...inputs: ClassValue[]) {
    return clsx(inputs);
}

export function normalizePhone(phoneRaw: string): string {
    if (!phoneRaw) return "";

    // Split by common separators to handle multiple phones
    const phones = phoneRaw.split(/[\/;,|]|\s+ou\s+/);

    // Process the first phone found
    let phone = phones[0];

    // Remove non-digits
    phone = phone.replace(/\D/g, "");

    // Heuristics (optional, based on user request "519981636027")
    // If it starts with 0, remove it
    if (phone.startsWith("0")) {
        phone = phone.substring(1);
    }

    // If it has 12 or 13 digits and starts with 55, remove country code
    // 55 + 2 digit DDD + 8/9 digit number = 12/13 digits
    if (phone.startsWith("55") && (phone.length === 12 || phone.length === 13)) {
        phone = phone.substring(2);
    }

    // If it has 12 or 13 digits and starts with 55, maybe remove country code?
    // User example 51... suggests no country code.
    // But 519981636027 is 12 digits. 
    // Let's just return the digits for now as it's the safest "normalization" without more info.

    return phone;
}
