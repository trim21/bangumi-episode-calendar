import { buildICS } from './lib'

import defaultHTMLPage from './index.html'

const cache = caches.default

const usernameKey = 'username'

async function handleRequest (username: string): Promise<Response> {
  try {
    console.log(`try to fetch calendar for ${username}`)
    const cacheKey = `https://bangumi-calendar.trim21.workers.dev/${username}.txt`
    const cachedRes = await cache.match(cacheKey)
    if (cachedRes) {
      console.log('request.ts cached')
      return cachedRes
    }

    console.log('request.ts not cached')
    const res = new Response(await buildICS(username), {
        status: 200,
        headers: {
          'cache-control': 'public, max-age=86400',
          'content-type': 'text/plain;charset=UTF-8',
        },
      }
    )
    const putResult = await cache.put(cacheKey, res.clone())
    console.log(putResult)
    return res
  } catch (e: any) {
    return new Response(e.toString(), { status: 500 })
  }
}

addEventListener('fetch', (event: FetchEvent) => {
  const url = new URL(event.request.url)
  if (url.pathname.startsWith('/favicon.ico')) {
    return event.respondWith(new Response('', { status: 404 }))
  }

  const username = url.searchParams.get(usernameKey)
  if (!username || username === 'null') {
    return event.respondWith(new Response(defaultHTMLPage, {
        status: 400,
        headers: { 'content-type': 'text/html' }
      }
    ))
  }
  return event.respondWith(handleRequest(username))
})
