export function isValidGitHubUrl(url: string): boolean {
  if (!url) return false;

  // Must be HTTPS
  if (!url.startsWith('https://')) return false;

  // GitHub URL pattern: https://github.com/username/repository
  // Updated to allow subpaths like /tree/branch, /blob/main, etc.
  const pattern = /^https:\/\/github\.com\/[\w-]+\/[\w.-]+(\/.*)?$/;

  return pattern.test(url.trim());
}

export function isValidLogFile(file: File): boolean {
  const validExtensions = ['.log', '.txt', '.out', '.err'];
  return validExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}