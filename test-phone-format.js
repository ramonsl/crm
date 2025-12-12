// Test script to validate phone number formatting
const testPhone = '54981671163';

console.log('Testing phone:', testPhone);
console.log('Length:', testPhone.length); // 11 dígitos

// Simulate the formatting logic from whatsapp.ts
let formattedPhone = testPhone.replace(/\D/g, '');
console.log('After removing non-digits:', formattedPhone);

// Remove leading 0 if present
if (formattedPhone.startsWith('0')) {
    formattedPhone = formattedPhone.substring(1);
}
console.log('After removing leading 0:', formattedPhone);

// Add country code if it's a local number (10 or 11 digits)
if (formattedPhone.length === 10 || formattedPhone.length === 11) {
    formattedPhone = '55' + formattedPhone;
}
console.log('After adding country code:', formattedPhone);
console.log('Final length:', formattedPhone.length);

// Check if it starts with 55 (Brazil)
if (formattedPhone.startsWith('55')) {
    console.log('✓ Is Brazilian number');

    if (formattedPhone.length === 13) {
        const phone12 = formattedPhone.substring(0, 4) + formattedPhone.substring(5);
        const phone13 = formattedPhone;
        console.log('13-digit version:', phone13);
        console.log('12-digit version (without 9):', phone12);
    } else if (formattedPhone.length === 12) {
        const phone12 = formattedPhone;
        const phone13 = formattedPhone.substring(0, 4) + '9' + formattedPhone.substring(4);
        console.log('12-digit version:', phone12);
        console.log('13-digit version (with 9):', phone13);
    }
}
