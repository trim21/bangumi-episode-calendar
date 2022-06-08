import { buildICS } from './lib'

import defaultHTMLPage from './index.html'

const usernameKey = 'username'

async function handleRequest (username: string): Promise<Response> {
  const init = {
    headers: {
      'content-type': 'text/plain;charset=UTF-8',
    },
  }
  return new Response(await buildICS(username), init)
}

addEventListener('fetch', (event: FetchEvent) => {
  const url = new URL(event.request.url)
  const username = url.searchParams.get(usernameKey)
  if (!username) {
    return event.respondWith(new Response(defaultHTMLPage, {
        status: 400,
        headers: { 'content-type': 'text/html' }
      }
    ))
  }
  return event.respondWith(handleRequest(username))
})
