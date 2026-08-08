// functions/api/images/[[key]].js
export async function onRequest(context) {
  const { request, env, params } = context;
  // 此时 params.key 是一个数组，如 ['notes', '1', '1786194005685_1234.jpg']
  const key = params.key.join('/');   // 还原为 "notes/1/1786194005685_1234.jpg"

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
    // 从 Cloudflare KV 命名空间读取（非 R2 对象存储）
    const value = await env.IMAGES.get(key);
    // if (value === null) {
    //   return new Response(JSON.stringify({ error: '图片不存在' }), {
    //     status: 404,
    //     headers: { 'Content-Type': 'application/json' },
    //   });
    // }

    // 获取元数据中的 Content-Type
    const metadata = await env.IMAGES.getWithMetadata(key);
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