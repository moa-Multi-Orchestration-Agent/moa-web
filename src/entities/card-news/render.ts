import type { CardNewsDeck, NewsCard } from './model';

export interface CardImage { blob: Blob; filename: string }
const WIDTH = 1080;
const HEIGHT = 1350;

function lines(ctx: CanvasRenderingContext2D, text: string, width: number) {
  const result: string[] = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    for (const word of paragraph.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(next).width > width) {
        result.push(line);
        line = '';
      }
      if (ctx.measureText(word).width > width) {
        for (const character of Array.from(word)) {
          if (line && ctx.measureText(line + character).width > width) { result.push(line); line = ''; }
          line += character;
        }
      } else line = line ? `${line} ${word}` : word;
    }
    result.push(line);
  }
  return result;
}

function text(ctx: CanvasRenderingContext2D, value: string, y: number, size: number, maxLines: number, weight = 500, bottom = 1150) {
  let wrapped: string[] = [];
  do {
    ctx.font = `${weight} ${size}px "Pretendard Variable", "Malgun Gothic", sans-serif`;
    wrapped = lines(ctx, value, 888);
    if (wrapped.length <= maxLines && y + wrapped.length * size * 1.45 <= bottom) break;
    size -= 2;
  } while (size >= 24);
  if (wrapped.length > maxLines || y + wrapped.length * size * 1.45 > bottom) throw new Error('카드에 들어갈 수 있도록 문안을 줄여 주세요.');
  wrapped.forEach((line, index) => ctx.fillText(line, 96, y + index * size * 1.45));
  return y + wrapped.length * size * 1.45;
}

function draw(ctx: CanvasRenderingContext2D, card: NewsCard, account: string, index: number) {
  const cover = card.kind === 'cover';
  ctx.fillStyle = cover ? '#14254b' : '#f6f7f9';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = '#6b8ef0';
  ctx.fillRect(96, 104, 72, 8);
  ctx.font = '600 27px sans-serif';
  ctx.fillText('MOA · 국내 주식 브리핑', 96, 170);
  ctx.fillStyle = cover ? '#ffffff' : '#1c1c1a';
  const end = text(ctx, card.title, cover ? 390 : 300, cover ? 88 : 64, 5, 800, cover ? 800 : 630);
  ctx.fillStyle = cover ? '#b9c8eb' : '#535c6c';
  text(ctx, card.body, Math.max(end + 64, cover ? 850 : 650), 38, 9);
  ctx.fillStyle = cover ? '#b9c8eb' : '#6b6f78';
  if (!cover) text(ctx, card.source, 1170, 24, 2, 500, 1240);
  ctx.font = '500 24px sans-serif';
  ctx.fillText(`@${account}`, 96, 1260);
  ctx.textAlign = 'right';
  ctx.fillText(`${index + 1} / 5`, 984, 1260);
  ctx.textAlign = 'left';
}

/** 외부 이미지나 HTML을 쓰지 않아 한글·출처를 그대로 JPEG로 렌더링한다. */
export async function renderCardNews(deck: CardNewsDeck): Promise<CardImage[]> {
  if (deck.cards.length !== 5) throw new Error('카드는 정확히 5장이어야 합니다.');
  await document.fonts?.ready;
  const images: CardImage[] = [];
  for (const [index, card] of deck.cards.entries()) {
    const canvas = document.createElement('canvas');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('이 브라우저에서 이미지 생성을 지원하지 않습니다.');
    draw(ctx, card, deck.account, index);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => b ? resolve(b) : reject(new Error('이미지를 생성하지 못했습니다.')), 'image/jpeg', 0.95));
    images.push({ blob, filename: `moa-stock-news-${String(index + 1).padStart(2, '0')}.jpg` });
  }
  return images;
}
