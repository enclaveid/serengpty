'use server';

import { readZip } from '../services/readZip';

/**
 * Calculates the Shannon entropy of a string.
 * @param s the input string.
 * @returns the entropy in bits.
 */
function getShannonEntropy(s: string): number {
  const len = s.length;
  const frequencies: { [char: string]: number } = {};
  for (const char of s) {
    frequencies[char] = (frequencies[char] || 0) + 1;
  }
  let entropy = 0;
  for (const char in frequencies) {
    const p = frequencies[char] / len;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

// Regular expression to match email addresses.
const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
// Regular expression to match a variety of phone numbers.
const phoneRegex = /\b(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?){2}\d{4}\b/g;

/**
 * Cleans a single string by redacting emails, phone numbers,
 * and redacting the entire string if its entropy is higher than a threshold.
 * @param text the input text.
 * @returns the cleaned text.
 */
function cleanText(text: string): string {
  // Redact emails and phone numbers.
  const cleaned = text
    .replace(emailRegex, '[redacted email]')
    .replace(phoneRegex, '[redacted phone]');
  // If the text is long and has high entropy, redact the entire string.
  if (cleaned.length > 20 && getShannonEntropy(cleaned) > 4.5) {
    return '[redacted high entropy]';
  }
  return cleaned;
}

/**
 * Recursively cleans all string values within the JSON data.
 * @param data the input data (could be string, array or object)
 * @returns the data after processing string values.
 */
function cleanData(data: any): any {
  if (typeof data === 'string') {
    return cleanText(data);
  } else if (Array.isArray(data)) {
    return data.map((item) => cleanData(item));
  } else if (data && typeof data === 'object') {
    const result: any = {};
    for (const key in data) {
      result[key] = cleanData(data[key]);
    }
    return result;
  }
  return data;
}

/**
 * The cleanArchive action using yazul:
 * 1. Converts the uploaded ZIP file Blob to a Buffer.
 * 2. Unzips the archive.
 * 3. Extracts and parses conversations.json.
 * 4. Cleans its contents from emails, phone numbers, and high entropy strings.
 * 5. Updates the archive with the cleaned file.
 *
 * @param formData the FormData containing the uploaded ZIP file.
 * @returns an object with a success property.
 */
export async function cleanArchive(formData: FormData) {
  const file = formData.get('file') as File;
  if (!file) {
    return { success: false, conversations: null };
  }

  try {
    // Convert the File (Blob) to a Buffer.
    const buffer = Buffer.from(await file.arrayBuffer());

    const conversations = await readZip(buffer, 'conversations.json');

    // Read and parse the JSON.
    const content = conversations.toString('utf8');
    const jsonData = JSON.parse(content);

    // Clean the JSON data recursively.
    const cleanedJson = cleanData(jsonData);

    return { success: true, conversations: cleanedJson };
  } catch (error) {
    console.error('Error cleaning archive:', error);
    return { success: false, conversations: null };
  }
}
