// functions/api/questions.js

export async function onRequest(context) {
  const { request, env } = context;
  const db = env.DB; // 在 wrangler.toml 或仪表板中绑定名为 DB 的 D1 数据库

  // 处理 CORS（如需跨域可保留，同源可省略）
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers });
  }

  const url = new URL(request.url);

  try {
    if (request.method === 'GET') {
      // 获取筛选参数
      const subject = url.searchParams.get('subject') || '';
      const subCategory = url.searchParams.get('subCategory') || '';
      const chapter = url.searchParams.get('chapter') || '';

      // 动态构建查询条件，使用参数化防止 SQL 注入
      let sql = 'SELECT * FROM questions WHERE 1=1';
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

      // 将存储在 TEXT 中的 JSON 字符串解析为数组
      const questions = results.map(q => ({
        ...q,
        options: JSON.parse(q.options || '[]'),
        answer: JSON.parse(q.answer || '[]'),
      }));

      return new Response(JSON.stringify(questions), { headers });

    } else if (request.method === 'POST') {
      const body = await request.json();
      if (!Array.isArray(body) || body.length === 0) {
        return new Response(JSON.stringify({ error: '请求体必须是题目数组' }), {
          status: 400,
          headers,
        });
      }

      // 使用事务批量插入
      const insertStmt = db.prepare(
        'INSERT INTO questions (subject, subCategory, chapter, type, question, options, answer) VALUES (?, ?, ?, ?, ?, ?, ?)'
      );

      // 执行批量插入（D1 支持 batch）
      const batch = body.map(item => {
        const { subject, subCategory, chapter, type, question, options, answer } = item;
        // 基本校验
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
    } else {
      return new Response(JSON.stringify({ error: '方法不允许' }), {
        status: 405,
        headers,
      });
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers,
    });
  }
}