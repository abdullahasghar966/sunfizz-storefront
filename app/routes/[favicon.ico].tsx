import favicon from '~/assets/favicon.svg';

/**
 * Some browsers still ask for /favicon.ico on their own (before or without
 * reading <link rel="icon">). Point them at the SVG icon instead of a 404.
 */
export function loader() {
  return new Response(null, {
    status: 301,
    headers: {
      Location: favicon,
      'Cache-Control': `max-age=${60 * 60 * 24}`,
    },
  });
}
