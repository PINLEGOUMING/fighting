import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export async function onRequest(context) {
  const { request, env } = context;

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
    const key = `notes/${questionId}/${timestamp}_${fileName}`;

    // 创建 S3 客户端，强制路径风格
    const client = new S3Client({
      region: S3_REGION || 'us-east-1',
      endpoint: S3_ENDPOINT,          // 例如 https://s3.cstcloud.cn
      credentials: {
        accessKeyId: S3_ACCESS_KEY_ID,
        secretAccessKey: S3_SECRET_ACCESS_KEY,
      },
      forcePathStyle: true,           // 关键：使用路径风格
    });

    const command = new PutObjectCommand({
      Bucket: S3_BUCKET_NAME,
      Key: key,
      ContentType: 'application/octet-stream', // 签名时会包含此头
    });

    const url = await getSignedUrl(client, command, { expiresIn: 3600 });

    return new Response(JSON.stringify({
      success: true,
      url,
      key,
    }), {
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