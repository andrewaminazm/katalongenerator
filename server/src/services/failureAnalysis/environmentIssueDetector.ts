export interface EnvironmentAnalysis {
  detected: boolean;
  problem: string;
  factors: string[];
  score: number;
}

export function detectEnvironmentIssues(corpus: string): EnvironmentAnalysis {
  const c = corpus.toLowerCase();
  const factors: string[] = [];

  if (/connection refused|econnrefused|enotfound|network unreachable/i.test(c)) {
    factors.push("Network connectivity failure");
  }
  if (/502|503|504|server error|service unavailable/i.test(c)) {
    factors.push("Upstream server unavailable");
  }
  if (/database|db\s|sql|jdbc|connection pool/i.test(c)) {
    factors.push("Database dependency issue");
  }
  if (/vpn|proxy|certificate|ssl|tls/i.test(c)) {
    factors.push("TLS/proxy/VPN configuration");
  }

  const detected = factors.length > 0;
  return {
    detected,
    problem: detected
      ? "Failure appears related to environment or infrastructure rather than test logic alone."
      : "",
    factors,
    score: Math.min(1, factors.length * 0.35),
  };
}
