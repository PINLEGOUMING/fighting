import { AwsClient } from 'aws4fetch';

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

  const { S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_BUCKET_NAME, S3_ENDPOINT, S3_REGION } = env;
  if (!S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY || !S3_BUCKET_NAME || !S3_ENDPOINT) {
    return new Response(JSON.stringify({ error: 'S3 环境变量未配置' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  try {
    const { questionId, fileName } = await request.json();
    if (!questionId || !fileName) {
      return new Response(JSON.stringify({ error: '缺少 questionId 或 fileName' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    const timestamp = Date.now();
    const ext = fileName.split('.').pop() || 'png';
    const key = `notes/${questionId}/${timestamp}_${fileName}`;

    // 构建对象 URL
    const objectUrl = new URL(`${S3_ENDPOINT}/${S3_BUCKET_NAME}/${key}`);
    objectUrl.searchParams.set('X-Amz-Expires', '3600'); // 1 小时有效期

    const aws = new AwsClient({
      accessKeyId: S3_ACCESS_KEY_ID,
      secretAccessKey: S3_SECRET_ACCESS_KEY,
      region: S3_REGION || 'us-east-1',
      service: 's3',
    });

    // 生成预签名 URL（签名放在查询参数）
    const signedRequest = await aws.sign(objectUrl.toString(), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/octet-stream', // 实际会被覆盖
      },
      aws: { signQuery: true },
    });

    return new Response(JSON.stringify({
      success: true,
      url: signedRequest.url,
      key: key,
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
}