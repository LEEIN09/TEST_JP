import curriculum from "./curriculum.json";

export type KanaId = keyof typeof curriculum;
export const allItems = Object.entries(curriculum).map(([id, item]) => ({
  ...item,
  id: id as KanaId,
}));
export type Kana = (typeof allItems)[number];
export const kana = allItems.filter((item) => item.kind === "kana");

export const lessons = [
  {
    id: "a-row",
    title: "히라가나 あ행",
    subtitle: "처음 만나는 히라가나",
    description: "あ · い · う · え · お, 모든 시작의 다섯 글자",
    introduction:
      "일본어의 기본 모음 다섯 개예요. 한글 표기는 발음을 돕는 참고용입니다.",
    symbol: "あ",
    kind: "kana",
    minutes: 5,
    ids: ["a", "i", "u", "e", "o"],
  },
  {
    id: "ka-row",
    title: "히라가나 か행",
    subtitle: "다섯 글자 더, 읽는 즐거움",
    description: "か · き · く · け · こ, 자음과 모음을 연결해요",
    introduction:
      "あ행에 k 소리를 더한 다섯 글자예요. 배운 모음과 연결해 읽어 보세요.",
    symbol: "か",
    kind: "kana",
    minutes: 5,
    ids: ["ka", "ki", "ku", "ke", "ko"],
  },
  {
    id: "greetings",
    title: "기본 인사말",
    subtitle: "처음 건네는 일본어 인사",
    description: "아침 인사부터 감사 인사까지, 네 가지 표현",
    introduction:
      "아직 모르는 글자는 소리를 듣고 표현째 익혀요. 문제에서는 발음 대신 한국어 뜻을 답합니다.",
    symbol: "話",
    kind: "greeting",
    minutes: 5,
    ids: ["ohayou", "konnichiwa", "arigatou", "oyasumi"],
  },
] as const;
export type LessonId = (typeof lessons)[number]["id"];
export type Lesson = (typeof lessons)[number];

export function getItem(id: KanaId): Kana {
  return allItems.find((item) => item.id === id)!;
}
export function getLesson(id: LessonId): Lesson {
  return lessons.find((lesson) => lesson.id === id)!;
}
export function answerLabel(card: Kana): string {
  return card.kind === "greeting" ? card.meaning : card.reading;
}
export function choiceOptions(id: KanaId): string[] {
  const lesson = lessons.find((lesson) =>
    lesson.ids.some((itemId) => itemId === id),
  )!;
  return shuffled(lesson.ids.map((itemId) => answerLabel(getItem(itemId))));
}
export function shuffled<T>(items: readonly T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
