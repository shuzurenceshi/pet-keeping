export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  
  const apiURL = 'https://pet-keeping-api.shuzurenceshi.workers.dev' + url.pathname + url.search;
  
  const newRequest = new Request(apiURL, {
    method: request.method,
    headers: request.headers,
    body: request.body,
    redirect: 'manual'
  });
  
  return fetch(newRequest);
}
