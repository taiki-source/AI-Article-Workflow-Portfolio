
import 'dotenv/config';
import OpenAI from 'openai';

const MODEL = 'gpt-5-nano';

function parseArticle(response) {
  if (!response.output_text) {
    throw new Error('AI response is empty');
  }

  const article = JSON.parse(response.output_text);

  if (
    typeof article.title !== 'string' ||
    typeof article.body !== 'string' ||
    !article.title.trim() ||
    !article.body.trim()
  ) {
    throw new Error('Invalid AI article');
  }

  return article;
}

async function requestArticle(input) {
  const client = new OpenAI();

  const response = await client.responses.create({
    model: MODEL,
    reasoning: { effort: 'minimal' },
    input,
    text: {
      format: {
        type: 'json_schema',
        name: 'portfolio_article',
        strict: true,
        schema: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            body: { type: 'string' }
          },
          required: ['title', 'body'],
          additionalProperties: false
        }
      }
    },
    max_output_tokens: 3000
  });

  return parseArticle(response);
}

export async function generateArticle(theme) {
  if (!theme?.trim()) {
    throw new Error('Article theme is required');
  }

  return requestArticle(`
あなたはWebコンテンツの編集者です。
次のテーマについて実用的な記事を作成してください。

テーマ：${theme}

条件：
- タイトル・導入・見出し・本文・まとめを含める
- 確認できない統計や事実を追加しない
- 架空の体験談を実例として紹介しない
- 公開前に人間が確認する下書きとして生成する
`);
}

export async function reviseArticle(title, body, instruction) {
  if (!title?.trim() || !body?.trim() || !instruction?.trim()) {
    throw new Error('Title, body and instruction are required');
  }

  return requestArticle(`
以下の記事を人間の指示に従って修正してください。

元タイトル：${title}
元本文：
${body}

修正指示：
${instruction}

条件：
- 元記事の事実や主張を勝手に変更しない
- 確認できない情報を追加しない
- 修正指示を優先する
- タイトルと本文を出力する
`);
}
