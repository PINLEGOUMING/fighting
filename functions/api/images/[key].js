import { AwsClient } from 'aws4fetch';

export async function onRequest(context) {
  const { request, env, params } = context;
  const { key } = params;

  const s3 = new AwsClient({
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    region: env.S3_REGION || 'us-east-1',
    service: 's3',
  });

  const bucket = env.S3_BUCKET_NAME;
  const endpoint = env.S3_ENDPOINT;

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
    const s3Url = `${endpoint}/${bucket}/${key}`;
    const getResponse = await s3.fetch(s3Url, { method: 'GET' });

    if (!getResponse.ok) {
      if (getResponse.status === 404) {
        return new Response(JSON.stringify({ error: '图片不存在' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      throw new Error(`S3 获取失败: ${getResponse.status}`);
    }

    const contentType = getResponse.headers.get('content-type') || 'image/png';
    const body = await getResponse.arrayBuffer();

    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: '读取图片失败' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}