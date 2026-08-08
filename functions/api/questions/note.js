export async function onRequest(context) {
  const { request, env } = context;
  const db = env.DB;

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers });
  }

  if (request.method !== 'PATCH') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers,
    });
  }

  try {
    const { id, notes } = await request.json();
    if (!id) {
      return new Response(JSON.stringify({ error: '请提供题目 id' }), {
        status: 400,
        headers,
      });
    }

    const { meta } = await db
      .prepare('UPDATE Fighting SET notes = ? WHERE id = ?')
      .bind(notes || '', id)
      .run();

    if (meta.changes === 0) {
      return new Response(JSON.stringify({ error: '未找到该题目' }), {
        status: 404,
        headers,
      });
    }

    return new Response(JSON.stringify({ success: true }), { headers });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers,
    });
  }
}