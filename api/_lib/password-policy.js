/**
 * Shared password rules for register / reset / profile change.
 * Existing accounts keep their current passwords; rules apply when setting a new one.
 */
const MIN_PASSWORD_LENGTH = 10;

function validateNewPassword(password) {
  const pw = String(password || '');
  if (pw.length < MIN_PASSWORD_LENGTH) {
    return {
      ok: false,
      error: 'weak_password',
      message: 'Password must be at least 10 characters.',
    };
  }
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) {
    return {
      ok: false,
      error: 'weak_password',
      message: 'Password must include at least one letter and one number.',
    };
  }
  return { ok: true };
}

module.exports = {
  MIN_PASSWORD_LENGTH,
  validateNewPassword,
};
