// Builds a fully-qualified app URL with the required query params.
//
// Rules:
//  - Always include reference_id
//  - Include public_token
//  - extraParams (optional) is a flat object of additional key/value pairs to
//    preserve, for future-proofing. v1 callers can ignore it.
function buildUrl({ baseUrl, path, reference_id, public_token, extraParams }) {
  if (!baseUrl) {
    throw new Error("buildUrl: baseUrl is required");
  }
  // Normalize baseUrl so URL() resolves path against the origin, not a subpath.
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : baseUrl + "/";
  const cleanPath = path.startsWith("/") ? path.slice(1) : path;
  const url = new URL(cleanPath, normalizedBase);

  if (reference_id) {
    url.searchParams.set("reference_id", reference_id);
  }

  if (public_token) {
    url.searchParams.set("public_token", public_token);
  }

  if (extraParams && typeof extraParams === "object") {
    for (const [key, value] of Object.entries(extraParams)) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, value);
      }
    }
  }

  return url.toString();
}

export { buildUrl };
