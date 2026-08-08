// functions/api/questions.js

export async function onRequest(context) {
  const { request, env } = context;
  const db = env.DB;

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
    // ================== GET /api/questions ==================
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

    // ================== POST /api/questions ==================
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

    // ================== DELETE /api/questions ==================
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

    // ================== PATCH /api/questions/notes ==================
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

    // 其他路径返回 404
    return new Response(JSON.stringify({ error: 'Not Found' }), {
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