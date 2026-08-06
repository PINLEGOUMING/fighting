// functions/api/questions.js

export async function onRequest(context) {
  const { request, env } = context;
  const db = env.DB;

  // 通用响应头
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  // 预检请求
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers });
  }

  const url = new URL(request.url);

  try {
    // ================== 查询（GET）==================
    if (request.method === 'GET') {
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

      // 将存储的 JSON 字符串转换回数组
      const questions = results.map(q => ({
        ...q,
        options: JSON.parse(q.options || '[]'),
        answer: JSON.parse(q.answer || '[]'),
      }));

      return new Response(JSON.stringify(questions), { headers });
    }

    // ================== 新增（POST）==================
    if (request.method === 'POST') {
      const body = await request.json();
      if (!Array.isArray(body) || body.length === 0) {
        return new Response(JSON.stringify({ error: '请求体必须是题目数组' }), {
          status: 400,
          headers,
        });
      }

      const insertStmt = db.prepare(
        'INSERT INTO Fighting (subject, subCategory, chapter, type, question, options, answer) VALUES (?, ?, ?, ?, ?, ?, ?)'
      );

      const batch = body.map(item => {
        const { subject, subCategory, chapter, type, question, options, answer } = item;
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
          JSON.stringify(answer)
        );
      });

      await db.batch(batch);

      return new Response(JSON.stringify({ success: true, count: body.length }), {
        status: 201,
        headers,
      });
    }

    // ================== 删除（DELETE）==================
    if (request.method === 'DELETE') {
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

    // 其他方法
    return new Response(JSON.stringify({ error: '方法不允许' }), {
      status: 405,
      headers,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers,
    });
  }
}