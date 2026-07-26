export type PasswordValidation = {
  valid: boolean;
  errors: string[];
};

export function validatePassword(password: string): PasswordValidation {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push("Minimal 8 karakter.");
  }

  if (!/[a-z]/.test(password)) {
    errors.push("Harus memiliki huruf kecil.");
  }

  if (!/[A-Z]/.test(password)) {
    errors.push("Harus memiliki huruf besar.");
  }

  if (!/[0-9]/.test(password)) {
    errors.push("Harus memiliki angka.");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
