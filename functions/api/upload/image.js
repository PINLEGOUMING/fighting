import { AwsClient } from 'aws4fetch';

export async function onRequest(context) {
  const { request, env } = context;

  const s3 = new AwsClient({
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    region: env.S3_REGION || 'us-east-1',
    service: 's3',
  });

  const bucket = env.S3_BUCKET_NAME;      // "page"
  const endpoint = env.S3_ENDPOINT;       // "https://s3.cstcloud.cn"

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers,
    });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('image');
    const questionId = formData.get('questionId');

    if (!file || !questionId) {
      return new Response(JSON.stringify({ error: '缺少图片文件或题目ID' }), {
        status: 400,
        headers,
      });
    }

    const timestamp = Date.now();
    const ext = file.name.split('.').pop() || 'png';
    const key = `notes/${questionId}/${timestamp}_${file.name}`;

    // 路径寻址 (Path-Style) => endpoint/bucket/key
    const s3Url = `${endpoint}/${bucket}/${key}`;
    const buffer = await file.arrayBuffer();

    const putResponse = await s3.fetch(s3Url, {
      method: 'PUT',
      body: buffer,
      headers: {
        'Content-Type': file.type || 'image/png',
        'Content-Length': buffer.byteLength.toString(),
      },
    });

    if (!putResponse.ok) {
      const errText = await putResponse.text();
      throw new Error(`S3 上传失败: ${putResponse.status} ${errText}`);
    }

    return new Response(JSON.stringify({ success: true, key }), {
      status: 200,
      headers,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers,
    });
  }
}