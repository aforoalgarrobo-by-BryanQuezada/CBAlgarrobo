async function api(query) {
  const res = await fetch(CONFIG.API_URL + "?" + query);
  return await res.json();
}
