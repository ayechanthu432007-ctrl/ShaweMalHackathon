/**
 * E-mail addresses are stored and compared in one canonical form: trimmed and lower-cased.
 * Nothing else is rewritten, so the address a person registers is the address they see
 * on their profile and the address they sign in with.
 */
export const normalizeEmailAddress = (value: unknown): string => String(value ?? '').trim().toLowerCase();

/**
 * Sign-up used to rewrite addresses before storing them (Gmail dots and "+tags" were
 * removed, for example). Accounts created then are stored in that rewritten form, so a
 * lookup also tries it; otherwise their owners could no longer sign in.
 */
const legacyStoredForm = (email: string): string => {
  const at = email.lastIndexOf('@');
  if (at <= 0) return email;
  let local = email.slice(0, at);
  let domain = email.slice(at + 1);

  if (domain === 'gmail.com' || domain === 'googlemail.com') {
    local = local.split('+')[0]!.replace(/\./g, '');
    domain = 'gmail.com';
  } else if (/^(outlook|hotmail|live|msn|windowslive)\./.test(domain) || domain === 'icloud.com' || domain === 'me.com') {
    local = local.split('+')[0]!;
  } else if (/^(yahoo|ymail|rocketmail)\./.test(domain)) {
    local = local.split('-')[0]!;
  }

  return local ? `${local}@${domain}` : email;
};

/** Every stored form an address may have, the canonical one first. */
export const emailLookupCandidates = (value: unknown): string[] => {
  const email = normalizeEmailAddress(value);
  return email ? [...new Set([email, legacyStoredForm(email)])] : [];
};
