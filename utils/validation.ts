export function isValidGitHubUrl(url: string): boolean {
  if (!url) return false;

  // Relaxed validation: Allow any HTTPS or HTTP URL
  // This supports GitHub, GitLab, Bitbucket, Azure DevOps, etc.
  // We just ensure it starts with http/https and has some content.
  const pattern = /^https?:\/\/.+$/;

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