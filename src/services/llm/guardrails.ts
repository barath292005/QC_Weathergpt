export class Guardrails {
  private static readonly INJECTION_PATTERNS = [
    /ignore\s+(all\s+)?(previous|prior)\s+instructions/i,
    /system\s+override/i,
    /you\s+are\s+now\s+(in\s+)?(developer\s+mode|unrestricted|dan)/i,
    /disregard\s+(all\s+)?(safety|rules|instructions)/i,
    /reveal\s+(system\s+prompt|api\s+key|environment\s+variables)/i,
  ];

  public static sanitizeInput(input: string, maxLen = 1000): { cleanText: string; isSuspect: boolean } {
    if (!input) return { cleanText: '', isSuspect: false };
    const trimmed = input.trim().slice(0, maxLen);
    const isSuspect = this.INJECTION_PATTERNS.some((pat) => pat.test(trimmed));
    return { cleanText: trimmed, isSuspect };
  }

  public static wrapAsUntrustedData(label: string, text: string): string {
    // Treat context as purely untrusted data inside a fenced block
    return `<<<DATA_${label.toUpperCase()}>>>\n${text.replace(/<<</g, '').replace(/>>>/g, '')}\n<<<END_DATA_${label.toUpperCase()}>>>`;
  }
}
