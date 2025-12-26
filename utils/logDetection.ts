export function detectLogs(text: string): boolean {
  if (!text || text.trim().length === 0) return false;

  const patterns = [
    // Java/Kotlin stack traces
    /at\s+[\w.$]+\([\w.]+:\d+\)/,
    /^\s+at\s+/m,

    // Python stack traces
    /File\s+"[^"]+",\s+line\s+\d+/i,
    /Traceback\s+\(most recent call last\)/i,

    // JavaScript errors
    /at\s+\w+\s+\([^)]+:\d+:\d+\)/,
    /^\s+at\s+Object\./m,

    // C# exceptions
    /at\s+[\w.]+\([^)]*\)\s+in\s+[^:]+:\s*line\s+\d+/i,

    // Exception keywords
    /Exception|Error|Throwable/i,
    /Caused by:/i,

    // Log levels with timestamps
    /\d{4}-\d{2}-\d{2}[\sT]\d{2}:\d{2}:\d{2}.*?(ERROR|WARN|FATAL|Exception)/i,
    /\[(ERROR|WARN|FATAL)\]/i,

    // Generic stack traces
    /^\s*at\s+.+:\d+/m,
    /stack trace:/i,
  ];

  return patterns.some(pattern => pattern.test(text));
}

export function countLogLines(text: string): number {
  return text.split('\n').filter(line => line.trim().length > 0).length;
}

export function extractRequirement(text: string): string {
  const lines = text.split('\n');
  const requirementLines: string[] = [];

  for (const line of lines) {
    if (detectLogs(line)) break;
    requirementLines.push(line);
  }

  return requirementLines.join('\n').trim() || text;
}

export function extractLogs(text: string): string {
  const lines = text.split('\n');
  const logLines: string[] = [];
  let foundLogs = false;

  for (const line of lines) {
    if (detectLogs(line)) {
      foundLogs = true;
    }
    if (foundLogs) {
      logLines.push(line);
    }
  }

  return logLines.join('\n').trim() || text;
}
