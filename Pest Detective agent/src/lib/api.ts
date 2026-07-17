export function getApiUrl(path: string) {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "";
  if (!path.startsWith("http")) {
    return `${baseUrl}${path}`.replace(/([^:]\/)\/{2,}/g, "$1/");
  }
  return path;
}
