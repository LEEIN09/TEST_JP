import { useState } from "react";
import { ArrowRight, BookOpen } from "lucide-react";
import {
  allItems,
  getItem,
  getLesson,
  lessons,
  type LessonId,
} from "./content";
import { isLessonComplete, type Progress } from "./progress";
import { AudioButton, stopAudio } from "./AudioButton";

export function CourseList({
  progress,
  onStart,
}: {
  progress: Progress;
  onStart: (id: LessonId) => void;
}) {
  const completeCount = lessons.filter((lesson) =>
    isLessonComplete(progress, lesson.id),
  ).length;
  return (
    <section className="learning-path">
      <div className="section-title">
        <h2>학습 목차</h2>
        <span>
          {completeCount} / {lessons.length}단원 완료
        </span>
      </div>
      <div className="course-list">
        {lessons.map((lesson, index) => {
          const practiced = lesson.ids.filter(
            (id) => progress.cards[id],
          ).length;
          const completed = isLessonComplete(progress, lesson.id);
          return (
            <article className="course-card" key={lesson.id}>
              <div className="course-symbol" aria-hidden="true">
                {String(index + 1).padStart(2, "0")}
              </div>
              <div className="course-copy">
                <span className="eyebrow">
                  제 {index + 1} 과 ·{" "}
                  {lesson.kind === "kana" ? "문자와 소리" : "뜻과 쓰임"}
                </span>
                <h3>{lesson.title}</h3>
                <p>{lesson.description}</p>
                <div
                  className="course-progress"
                  aria-label={`${lesson.title} 연습한 항목 ${practiced}개`}
                >
                  <span
                    style={{
                      width: `${(practiced / lesson.ids.length) * 100}%`,
                    }}
                  />
                </div>
                <div className="course-foot">
                  <span>
                    {completed
                      ? "학습 완료 · 다시 학습할 수 있어요"
                      : practiced
                        ? `${practiced} / ${lesson.ids.length}개 연습 중`
                        : "처음부터 천천히 배워요"}
                  </span>
                  <span>약 {lesson.minutes}분</span>
                </div>
              </div>
              <button
                className="circle-button"
                aria-label={`${lesson.title} 학습 시작`}
                onClick={() => onStart(lesson.id)}
              >
                <ArrowRight size={20} />
              </button>
            </article>
          );
        })}
      </div>
      <p className="curriculum-note">
        あ행 → か행 → 인사말 순서로 추천해요. 원하는 단원부터 시작해도 괜찮아요.
      </p>
    </section>
  );
}

export function StudyNotes({
  progress,
  onStart,
}: {
  progress: Progress;
  onStart: (id: LessonId) => void;
}) {
  const [selected, setSelected] = useState<LessonId>("a-row");
  const lesson = getLesson(selected);
  return (
    <>
      <div className="lesson-filters" role="group" aria-label="노트 단원 선택">
        {lessons.map((item) => (
          <button
            key={item.id}
            aria-pressed={selected === item.id}
            onClick={() => {
              stopAudio();
              setSelected(item.id);
            }}
          >
            {item.title}
          </button>
        ))}
      </div>
      <div className="info-banner">
        <BookOpen size={21} />
        <p>
          <strong>{lesson.title}</strong>
          <br />
          {lesson.introduction}
        </p>
      </div>
      <div
        className={`notes-grid ${lesson.kind === "greeting" ? "greeting-notes" : ""}`}
      >
        {lesson.ids.map((id) => {
          const card = getItem(id);
          return (
            <article className="note-card" key={id}>
              <div className="note-card-top">
                <span>{lesson.kind === "kana" ? "HIRAGANA" : "GREETING"}</span>
                <span className={progress.cards[id] ? "seen-badge" : ""}>
                  {progress.cards[id] ? "연습한 항목" : "처음 만날 항목"}
                </span>
              </div>
              <div
                className={`note-glyph ${card.kind === "greeting" ? "phrase-glyph" : ""}`}
                lang="ja"
              >
                {card.glyph}
              </div>
              <h2>
                {card.reading}
                <span>{card.roman}</span>
              </h2>
              {card.kind === "greeting" && (
                <strong className="phrase-meaning">{card.meaning}</strong>
              )}
              <p>{card.hint}</p>
              <AudioButton id={id} glyph={card.glyph} />
              <div className="note-example">
                {card.kind === "greeting" ? (
                  <span>{card.context}</span>
                ) : (
                  <>
                    <strong lang="ja">{card.example}</strong>
                    <span>
                      {card.exampleReading} · {card.meaning}
                    </span>
                  </>
                )}
              </div>
            </article>
          );
        })}
      </div>
      <button className="primary" onClick={() => onStart(selected)}>
        {lesson.title} 학습하기
        <ArrowRight size={17} />
      </button>
      <p className="local-note">
        총 {allItems.length}개의 글자·표현을 배울 수 있어요. 한글 발음은 참고
        표기입니다.
      </p>
    </>
  );
}
