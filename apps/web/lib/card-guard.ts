/** True when text looks like a payment card number: 13 to 19 digits (spaces and dashes allowed) that pass the Luhn check. */
export function looksLikeCardNumber(s: string): boolean {
  const d = s.replace(/[ -]/g, "");
  if (!/^\d{13,19}$/.test(d)) return false;
  let sum = 0;
  for (let i = 0; i < d.length; i++) {
    let n = Number(d[d.length - 1 - i]);
    if (i % 2 === 1) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
  }
  return sum % 10 === 0;
}
