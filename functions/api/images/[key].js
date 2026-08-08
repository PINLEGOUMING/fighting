// functions/api/images/[key].js
export async function onRequest(context) {
  const { request, env, params } = context;
  const { key } = params;

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!key) {
    return new Response(JSON.stringify({ error: '缺少图片 key' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // 从 KV 读取
    const value = await env.IMAGES.get(key, { type: 'arrayBuffer' });
    if (value === null) {
      return new Response(JSON.stringify({ error: '图片不存在' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 获取元数据（Content-Type）
    const metadata = await env.IMAGES.getWithMetadata(key, { type: 'arrayBuffer' });
    const contentType = metadata.metadata?.contentType || 'image/png';

    return new Response(value, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: '读取图片失败: ' + error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}