// functions/api/questions.js
import { AwsClient } from 'aws4fetch';

export async function onRequest(context) {
  const { request, env } = context;
  const db = env.DB;

  // 初始化 S3 客户端（使用 aws4fetch）
  const s3 = new AwsClient({
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    region: env.S3_REGION || 'us-east-1',
    service: 's3',
  });

  const bucket = env.S3_BUCKET_NAME;
  const endpoint = env.S3_ENDPOINT; // 如 https://s3.cstcloud.cn

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers });
  }

  const url = new URL(request.url);
  const pathname = url.pathname;

  try {
    // ================== 获取题目列表 ==================
    if (request.method === 'GET' && pathname === '/api/questions') {
      const subject = url.searchParams.get('subject') || '';
      const subCategory = url.searchParams.get('subCategory') || '';
      const chapter = url.searchParams.get('chapter') || '';

      let sql = 'SELECT * FROM Fighting WHERE 1=1';
      const params = [];

      if (subject) {
        sql += ' AND subject = ?';
        params.push(subject);
      }
      if (subCategory) {
        sql += ' AND subCategory = ?';
        params.push(subCategory);
      }
      if (chapter) {
        sql += ' AND chapter = ?';
        params.push(chapter);
      }

      sql += ' ORDER BY id DESC';
      const stmt = db.prepare(sql).bind(...params);
      const { results } = await stmt.all();

      const questions = results.map(q => ({
        ...q,
        options: JSON.parse(q.options || '[]'),
        answer: JSON.parse(q.answer || '[]'),
        notes: q.notes || '',
      }));

      return new Response(JSON.stringify(questions), { headers });
    }

    // ================== 新增题目 ==================
    if (request.method === 'POST' && pathname === '/api/questions') {
      const body = await request.json();
      if (!Array.isArray(body) || body.length === 0) {
        return new Response(JSON.stringify({ error: '请求体必须是题目数组' }), {
          status: 400,
          headers,
        });
      }

      const insertStmt = db.prepare(
        'INSERT INTO Fighting (subject, subCategory, chapter, type, question, options, answer, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      );

      const batch = body.map(item => {
        const { subject, subCategory, chapter, type, question, options, answer, notes = '' } = item;
        if (!subject || !type || !question || !Array.isArray(options) || !Array.isArray(answer)) {
          throw new Error('题目数据不完整：subject, type, question, options, answer 都是必需的');
        }
        return insertStmt.bind(
          subject,
          subCategory || '',
          chapter || '',
          type,
          question,
          JSON.stringify(options),
          JSON.stringify(answer),
          notes || ''
        );
      });

      await db.batch(batch);

      return new Response(JSON.stringify({ success: true, count: body.length }), {
        status: 201,
        headers,
      });
    }

    // ================== 删除题目 ==================
    if (request.method === 'DELETE' && pathname === '/api/questions') {
      const id = url.searchParams.get('id');
      if (!id) {
        return new Response(JSON.stringify({ error: '请提供要删除的题目 id' }), {
          status: 400,
          headers,
        });
      }

      const { meta } = await db.prepare('DELETE FROM Fighting WHERE id = ?').bind(id).run();
      if (meta.changes === 0) {
        return new Response(JSON.stringify({ error: '未找到该题目' }), {
          status: 404,
          headers,
        });
      }

      return new Response(JSON.stringify({ success: true }), { headers });
    }

    // ================== 更新笔记 ==================
    if (request.method === 'PATCH' && pathname === '/api/questions/notes') {
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
    }

    // ================== 上传图片到 S3 ==================
    if (request.method === 'POST' && pathname === '/api/upload/image') {
      const formData = await request.formData();
      const file = formData.get('image');
      const questionId = formData.get('questionId');

      if (!file || !questionId) {
        return new Response(JSON.stringify({ error: '缺少图片文件或题目ID' }), {
          status: 400,
          headers,
        });
      }

      // 生成唯一文件名
      const timestamp = Date.now();
      const ext = file.name.split('.').pop() || 'png';
      const key = `notes/${questionId}/${timestamp}_${file.name}`;

      // 构造 S3 对象 URL（路径寻址：endpoint/bucket/key）
      const s3Url = `${endpoint}/${bucket}/${key}`;

      // 读取文件数据
      const buffer = await file.arrayBuffer();

      // 使用 aws4fetch 发送 PUT 请求
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
    }

    // ================== 获取图片（私有代理） ==================
    if (request.method === 'GET' && pathname.startsWith('/api/images/')) {
      const key = pathname.replace('/api/images/', '');
      if (!key) {
        return new Response(JSON.stringify({ error: '缺少图片 key' }), {
          status: 400,
          headers,
        });
      }

      const s3Url = `${endpoint}/${bucket}/${key}`;

      try {
        // 使用 aws4fetch 发送 GET 请求（自动签名）
        const getResponse = await s3.fetch(s3Url, {
          method: 'GET',
        });

        if (!getResponse.ok) {
          if (getResponse.status === 404) {
            return new Response(JSON.stringify({ error: '图片不存在' }), {
              status: 404,
              headers,
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
      } catch (err) {
        return new Response(JSON.stringify({ error: '读取图片失败' }), {
          status: 500,
          headers,
        });
      }
    }

    // ================== 删除图片（可选，供清理使用） ==================
    if (request.method === 'DELETE' && pathname === '/api/images') {
      const key = url.searchParams.get('key');
      if (!key) {
        return new Response(JSON.stringify({ error: '缺少图片 key' }), {
          status: 400,
          headers,
        });
      }

      const s3Url = `${endpoint}/${bucket}/${key}`;
      try {
        const deleteResponse = await s3.fetch(s3Url, { method: 'DELETE' });
        if (!deleteResponse.ok) {
          throw new Error(`S3 删除失败: ${deleteResponse.status}`);
        }
        return new Response(JSON.stringify({ success: true }), { headers });
      } catch (err) {
        return new Response(JSON.stringify({ error: '删除图片失败' }), {
          status: 500,
          headers,
        });
      }
    }

    // 其他请求
    return new Response(JSON.stringify({ error: '接口不存在' }), {
      status: 404,
      headers,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers,
    });
  }
}