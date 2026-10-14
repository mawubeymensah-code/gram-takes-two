export const interests = ['General membership', 'Events', 'Volunteering', 'Partnerships'];
export const topics = ['General question', 'Event inquiry', 'Community partnership'];
export class InputError extends Error {}
function text(input, key, max, required = true) {
  if (typeof input[key] !== 'string') throw new InputError(`Enter a valid ${key}.`);
  const value = input[key].trim();
  if ((required && !value) || value.length > max || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value))
    throw new InputError(`${key} must be ${required ? '1' : '0'}–${max} characters.`);
  return value;
}
export function validateSubmission(input, kind) {
  if (!input || Array.isArray(input) || typeof input !== 'object') throw new InputError('Enter valid form data.');
  if (!['interest', 'contact'].includes(kind)) throw new InputError('Choose a valid form.');
  if (input.consent !== true) throw new InputError('Please agree to the submission privacy notice.');
  const name = text(input, 'name', 100);
  const email = text(input, 'email', 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new InputError('Enter a valid email address.');
  const category = text(input, 'category', 50);
  if (!(kind === 'interest' ? interests : topics).includes(category)) throw new InputError('Choose a valid category.');
  const message = text(input, 'message', 2000, kind === 'contact');
  return { kind, name, email, category, message };
}
