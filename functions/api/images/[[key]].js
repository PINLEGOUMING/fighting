// functions/api/images/[[key]].js
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export async function onRequest(context) {
  const { request, env, params } = context;

  // 从环境变量读取配置
  const endpoint = env.BITIFUL_ENDPOINT || 'https://s3.bitiful.net';
  const region = env.BITIFUL_REGION;
  const bucket = env.BITIFUL_BUCKET;
  const accessKeyId = env.BITIFUL_ACCESS_KEY_ID;
  const secretAccessKey = env.BITIFUL_SECRET_ACCESS_KEY;

  if (!bucket || !accessKeyId || !secretAccessKey) {
    return new Response(
      JSON.stringify({ error: '服务器配置缺失：请设置 BITIFUL_BUCKET, BITIFUL_ACCESS_KEY_ID, BITIFUL_SECRET_ACCESS_KEY' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      }
    );
  }

  const s3Client = new S3Client({
    endpoint,
    region,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
    forcePathStyle: false,
    signatureVersion: 'v4',
  });

  // 恢复完整的 key（路径可能包含多级目录）
  const key = params.key ? params.key.join('/') : '';

  // CORS 预检
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
    // 生成预签名 GET URL（有效期 1 小时）
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });
    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

    // 302 重定向到预签名 URL
    return new Response(null, {
      status: 302,
      headers: {
        'Location': signedUrl,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache',
      },
    });

  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: '读取图片失败: ' + error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
}