// functions/api/upload/image.js
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

export async function onRequest(context) {
  const { request, env } = context;

  // 从环境变量读取配置（若未设置则抛出错误）
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
    forcePathStyle: false,        // 缤纷云通常需要路径风格
    signatureVersion: 'v4',
  });

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

    const timestamp = Date.now();
    const fileName = file.name;
    const key = `notes/${questionId}/${timestamp}_${fileName}`;

    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: uint8Array,
      ContentType: file.type || 'application/octet-stream',
    });

    await s3Client.send(command);

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