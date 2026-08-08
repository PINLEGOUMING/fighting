// functions/api/upload/image.js
export async function onRequest(context) {
  const { request, env } = context;

  // CORS 预检
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('image');
    const questionId = formData.get('questionId');

    if (!file || !questionId) {
      return new Response(JSON.stringify({ error: '缺少图片文件或题目ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    // 生成唯一键名
    const timestamp = Date.now();
    const fileName = file.name;
    const key = `notes/${questionId}/${timestamp}_${fileName}`;

    // 读取文件二进制数据
    const arrayBuffer = await file.arrayBuffer();
    const contentType = file.type || 'application/octet-stream';

    // 存入 KV
    await env.IMAGES.put(key, arrayBuffer, {
      metadata: { contentType }, // 存储 Content-Type
    });

    return new Response(JSON.stringify({ success: true, key }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
}