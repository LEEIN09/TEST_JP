import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  CircleHelp,
  Clock3,
  Flower2,
  Home,
  Leaf,
  RotateCcw,
  Sparkles,
  Sprout,
  TrendingUp,
  X,
} from "lucide-react";
import {
  allItems,
  lessons,
  getItem,
  getLesson,
  choiceOptions,
  answerLabel,
  type KanaId,
  type LessonId,
} from "./content";
import {
  answerCard,
  dueCards,
  emptyProgress,
  finishSession,
  isLessonComplete,
  loadProgress,
  saveProgress,
  type Progress,
} from "./progress";
import { Dialog } from "./Dialog";
import { CourseList, StudyNotes } from "./CurriculumViews";
import { AudioButton, stopAudio } from "./AudioButton";
import { checkReading, normalizeReading } from "./reading";

type Tab = "home" | "notes" | "review" | "history";
type Session = {
  mode: "lesson" | "review";
  lessonId: LessonId;
  phase: "learn" | "quiz" | "recall" | "result";
  ids: KanaId[];
  index: number;
  answers: boolean[];
  selected: string | null;
  options: string[];
  draft: string;
};
const navigation = [
  { id: "home", label: "오늘의 학습", icon: Home },
  { id: "notes", label: "글자 노트", icon: BookOpen },
  { id: "review", label: "복습", icon: RotateCcw },
  { id: "history", label: "학습 기록", icon: TrendingUp },
] as const;

const formatDate = (at: number) =>
  new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(at);

export default function App() {
  const [initial] = useState(() => {
    try {
      return loadProgress(window.localStorage);
    } catch {
      return {
        progress: emptyProgress(),
        warning:
          "이 브라우저에서는 기록을 저장할 수 없어요. 현재 화면에서 학습할 수 있습니다.",
      };
    }
  });
  const [progress, setProgress] = useState(initial.progress);
  const [warning, setWarning] = useState(initial.warning);
  const [tab, setTab] = useState<Tab>("home");
  const [session, setSession] = useState<Session | null>(null);
  const [now, setNow] = useState(Date.now());
  const [showHelp, setShowHelp] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const composing = useRef(false);
  const due = dueCards(progress, now);
  const learned = Object.keys(progress.cards).length;
  const completed = lessons.every((lesson) =>
    isLessonComplete(progress, lesson.id),
  );
  const nextLesson =
    lessons.find((lesson) => !isLessonComplete(progress, lesson.id)) ??
    lessons[0];
  const nextLessonPracticed = nextLesson.ids.some((id) => progress.cards[id]);
  const today = new Date(now).toDateString();
  const todaysActivities = progress.activities.filter(
    (a) => new Date(a.at).toDateString() === today,
  );
  const totalAnswers = Object.values(progress.cards).reduce(
    (sum, c) => sum + c.attempts,
    0,
  );

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    heading.current?.focus();
    stopAudio();
    composing.current = false;
  }, [session?.phase, session?.index, tab]);

  useEffect(() => {
    if (confirmExit || showHelp) stopAudio();
  }, [confirmExit, showHelp]);

  function commit(next: Progress) {
    setProgress(next);
    try {
      setWarning(
        saveProgress(window.localStorage, next)
          ? ""
          : "기록을 저장하지 못했어요. 창을 닫으면 이번 학습 기록이 사라질 수 있습니다.",
      );
    } catch {
      setWarning(
        "기록을 저장하지 못했어요. 창을 닫으면 이번 학습 기록이 사라질 수 있습니다.",
      );
    }
    setNow(Date.now());
  }

  function start(
    mode: "lesson" | "review",
    lessonId: LessonId = nextLesson.id,
  ) {
    const ids =
      mode === "lesson"
        ? [...getLesson(lessonId).ids]
        : dueCards(progress, Date.now());
    if (!ids.length) return;
    setSession({
      mode,
      lessonId,
      phase: mode === "lesson" ? "learn" : "recall",
      ids,
      index: 0,
      answers: [],
      selected: null,
      options: choiceOptions(ids[0]),
      draft: "",
    });
    setConfirmExit(false);
    window.scrollTo(0, 0);
  }

  function respond(reading: string) {
    if (!session || session.selected !== null) return;
    const card = getItem(session.ids[session.index]);
    const outcome = checkReading(card, reading);
    if (outcome === "empty" || composing.current) return;
    const correct = outcome === "correct";
    commit(
      answerCard(
        progress,
        card.id,
        correct,
        Date.now(),
        session.phase === "quiz" ? "choice" : "recall",
      ),
    );
    setSession({
      ...session,
      selected: normalizeReading(reading),
      answers: [...session.answers, correct],
    });
  }

  function next() {
    if (!session) return;
    if (session.index < session.ids.length - 1) {
      setSession({
        ...session,
        index: session.index + 1,
        selected: null,
        options: choiceOptions(session.ids[session.index + 1]),
        draft: "",
      });
    } else if (session.phase === "learn") {
      setSession({ ...session, phase: "quiz", index: 0 });
    } else if (session.phase === "quiz") {
      setSession({
        ...session,
        phase: "recall",
        index: 0,
        selected: null,
        answers: [],
        draft: "",
      });
    } else {
      commit(
        finishSession(progress, {
          at: Date.now(),
          total: session.ids.length,
          correct: session.answers.filter(Boolean).length,
          mode: session.mode,
          exercise: "recall",
          ...(session.mode === "lesson" ? { lessonId: session.lessonId } : {}),
        }),
      );
      setSession({ ...session, phase: "result" });
    }
  }

  function goTab(id: Tab) {
    setTab(id);
    window.scrollTo(0, 0);
  }

  const current = session ? getItem(session.ids[session.index]) : null;
  const greeting = current?.kind === "greeting";
  const currentAnswer = current ? answerLabel(current) : "";
  const sessionProgress = !session
    ? 0
    : session.phase === "result"
      ? 100
      : (((session.mode === "review"
          ? 0
          : session.phase === "learn"
            ? 0
            : session.phase === "quiz"
              ? 1
              : 2) *
          session.ids.length +
          session.index +
          Number(session.selected !== null)) /
          (session.ids.length * (session.mode === "review" ? 1 : 3))) *
        100;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            if (session && session.phase !== "result") {
              setConfirmExit(true);
            } else {
              setSession(null);
              goTab("home");
            }
          }}
          aria-label="하루 홈"
        >
          <span className="brand-mark" lang="ja">
            は
          </span>
          <span>
            하루<span className="brand-sub">나의 첫 일본어</span>
          </span>
        </a>
        <div className="sidebar-label">MY JAPANESE JOURNEY</div>
        <nav aria-label="주 메뉴">
          {navigation.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`nav-item ${tab === id ? "active" : ""}`}
              aria-current={tab === id ? "page" : undefined}
              onClick={() => {
                if (session && session.phase !== "result") {
                  setConfirmExit(true);
                  return;
                }
                setSession(null);
                goTab(id);
              }}
            >
              <Icon size={20} strokeWidth={1.8} />
              <span>{label}</span>
              {id === "review" && due.length > 0 && (
                <span className="nav-count">{due.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="little-garden">
            <Sprout size={29} strokeWidth={1.5} />
            <p>
              조금씩, 꾸준히.
              <br />
              <strong>어제보다 한 걸음 더.</strong>
            </p>
          </div>
          <button className="help-button" onClick={() => setShowHelp(true)}>
            <CircleHelp size={18} /> 하루 이용 안내
          </button>
          <span className="sidebar-foot">작은 배움이 쌓이는 곳 · 하루</span>
        </div>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <span>처음부터 차근차근, 나만의 속도로</span>
          <div className="topbar-right">
            <span className="level-pill">
              <span />
              입문 · 첫걸음
            </span>
            <span className="avatar" aria-label="학습자">
              나
            </span>
          </div>
        </header>
        <main>
          {warning && (
            <div className="storage-warning" role="status">
              {warning}
            </div>
          )}
          {session && current ? (
            <section className="session-page">
              <div className="session-top">
                <button
                  className="text-button"
                  onClick={() =>
                    session.phase === "result"
                      ? setSession(null)
                      : setConfirmExit(true)
                  }
                >
                  <ArrowLeft size={17} />{" "}
                  {session.phase === "result" ? "학습 홈" : "나가기"}
                </button>
                <span>
                  {session.mode === "review"
                    ? "기억을 꺼내는 시간"
                    : getLesson(session.lessonId).title}
                </span>
                <span>
                  {session.phase === "result"
                    ? "완료"
                    : `${session.index + 1} / ${session.ids.length}`}
                </span>
              </div>
              <div className="session-progress">
                <div
                  style={{
                    width: `${sessionProgress}%`,
                  }}
                />
              </div>
              {session.phase === "learn" && (
                <>
                  <div className="session-heading">
                    <span className="eyebrow">
                      {greeting
                        ? "STEP 01 · 표현 만나기"
                        : "STEP 01 · 글자 만나기"}
                    </span>
                    <h1 ref={heading} tabIndex={-1}>
                      {greeting
                        ? `‘${current.meaning}’라는 뜻이에요.`
                        : `이 글자는 ‘${current.reading}’예요.`}
                    </h1>
                    <p>
                      {greeting
                        ? "소리를 듣고, 언제 쓰는 표현인지 함께 익혀요."
                        : "모양을 눈에 담고, 소리 내어 읽어 보세요."}
                    </p>
                  </div>
                  <div
                    className={`learning-card ${greeting ? "phrase-card" : ""}`}
                  >
                    <span className="card-label">
                      {greeting ? "GREETING" : "HIRAGANA"}
                    </span>
                    <div
                      className={`big-glyph ${greeting ? "phrase-glyph" : ""}`}
                      lang="ja"
                    >
                      {current.glyph}
                    </div>
                    <div className="pronunciation">
                      {current.reading}
                      <span>{current.roman}</span>
                    </div>
                    <p>{current.hint}</p>
                    <AudioButton
                      key={current.id}
                      id={current.id}
                      glyph={current.glyph}
                    />
                    <div className="example">
                      {greeting ? (
                        <>
                          <span>이럴 때 써요</span>
                          <span>{current.context}</span>
                        </>
                      ) : (
                        <>
                          <span>단어 속에서는</span>
                          <strong lang="ja">{current.example}</strong>
                          <span>
                            {current.exampleReading} · {current.meaning}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <p className="pronunciation-note">
                    한글 발음은 처음 읽기를 돕는 참고 표기예요.
                  </p>
                  <button className="primary session-continue" onClick={next}>
                    {session.index === session.ids.length - 1
                      ? "이제 기억해 볼까요?"
                      : greeting
                        ? "다음 표현"
                        : "다음 글자"}
                    <ArrowRight size={18} />
                  </button>
                </>
              )}
              {(session.phase === "quiz" || session.phase === "recall") && (
                <>
                  <div className="session-heading">
                    <span className="eyebrow">
                      {session.mode === "review"
                        ? "REVIEW · 다시 떠올리기"
                        : session.phase === "recall"
                          ? "STEP 03 · 스스로 떠올리기"
                          : greeting
                            ? "STEP 02 · 뜻 골라보기"
                            : "STEP 02 · 소리 골라보기"}
                    </span>
                    <h1 ref={heading} tabIndex={-1}>
                      {session.phase === "recall"
                        ? greeting
                          ? "뜻을 직접 적어 볼까요?"
                          : "소리를 직접 적어 볼까요?"
                        : greeting
                          ? "어떤 뜻일까요?"
                          : "어떻게 읽을까요?"}
                    </h1>
                    <p>
                      {session.phase === "recall"
                        ? greeting
                          ? "언제 쓰는 인사인지 떠올리고 한국어 뜻을 적어 주세요."
                          : "선택지 없이, 기억나는 발음을 적어 주세요."
                        : greeting
                          ? "이 인사말의 한국어 뜻을 골라 주세요."
                          : "글자를 보고 알맞은 소리를 골라 주세요."}
                    </p>
                  </div>
                  <div
                    className={`quiz-glyph ${greeting ? "phrase-glyph" : ""}`}
                    lang="ja"
                  >
                    {current.glyph}
                  </div>
                  {session.phase === "recall" ? (
                    <form
                      className="recall-form"
                      onSubmit={(event) => {
                        event.preventDefault();
                        respond(session.draft);
                      }}
                    >
                      <label htmlFor="reading-answer">
                        {greeting ? "이 인사말의 뜻" : "이 글자의 발음"}
                      </label>
                      <input
                        id="reading-answer"
                        value={session.draft}
                        maxLength={32}
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="none"
                        spellCheck={false}
                        enterKeyHint="done"
                        placeholder={
                          greeting ? "한국어 뜻 입력" : "한글 또는 로마자 입력"
                        }
                        disabled={session.selected !== null}
                        aria-describedby="reading-help"
                        onChange={(event) =>
                          setSession({ ...session, draft: event.target.value })
                        }
                        onCompositionStart={() => {
                          composing.current = true;
                        }}
                        onCompositionEnd={() => {
                          composing.current = false;
                        }}
                        onKeyDown={(event) => {
                          if (
                            event.key === "Enter" &&
                            (composing.current ||
                              event.nativeEvent.isComposing ||
                              event.keyCode === 229)
                          )
                            event.preventDefault();
                        }}
                      />
                      <p id="reading-help">
                        {greeting
                          ? "발음 대신 한국어 뜻을 답해 주세요."
                          : "한글 발음이나 로마자로 답할 수 있어요."}
                      </p>
                      {session.selected === null && (
                        <button
                          className="primary"
                          type="submit"
                          disabled={!normalizeReading(session.draft)}
                        >
                          정답 확인
                          <Check size={17} />
                        </button>
                      )}
                    </form>
                  ) : (
                    <div
                      className={`answer-options ${greeting ? "phrase-options" : ""}`}
                    >
                      {session.options.map((reading, i) => (
                        <button
                          key={reading}
                          disabled={session.selected !== null}
                          className={`answer ${session.selected !== null && reading === currentAnswer ? "correct" : ""} ${session.selected === reading && reading !== currentAnswer ? "incorrect" : ""}`}
                          onClick={() => respond(reading)}
                        >
                          <span>{i + 1}</span>
                          {reading}
                          {session.selected !== null &&
                            reading === currentAnswer && <Check size={20} />}
                        </button>
                      ))}
                    </div>
                  )}
                  {session.selected !== null && (
                    <div
                      className={`feedback ${checkReading(current, session.selected) === "correct" ? "success" : "retry"}`}
                      role="status"
                    >
                      <strong>
                        {checkReading(current, session.selected) === "correct"
                          ? "잘 기억했어요!"
                          : greeting
                            ? `괜찮아요. ‘${current.meaning}’라는 뜻이에요.`
                            : `괜찮아요. ${current.glyph}는 ‘${current.reading}’라고 읽어요.`}
                      </strong>
                      <p>
                        {checkReading(current, session.selected) === "correct"
                          ? session.phase === "quiz"
                            ? "다음 단계에서는 선택지 없이 직접 떠올려 볼 거예요."
                            : "조금씩 복습하면 더 오래 기억할 수 있어요."
                          : "틀린 글자는 학습이 끝나면 다시 만나 볼게요."}
                      </p>
                      <AudioButton
                        key={current.id}
                        id={current.id}
                        glyph={current.glyph}
                      />
                    </div>
                  )}
                  {(session.phase === "quiz" || session.selected !== null) && (
                    <button
                      className="primary session-continue"
                      disabled={session.selected === null}
                      onClick={next}
                    >
                      {session.index === session.ids.length - 1
                        ? session.phase === "quiz"
                          ? "직접 답해보기"
                          : "결과 보기"
                        : "다음 문제"}
                      <ArrowRight size={18} />
                    </button>
                  )}
                </>
              )}
              {session.phase === "result" && (
                <div className="result-content">
                  <div className="result-flower">
                    <Flower2 size={44} strokeWidth={1.3} />
                  </div>
                  <span className="eyebrow">A LITTLE PROGRESS, EVERY DAY</span>
                  <h1 ref={heading} tabIndex={-1}>
                    오늘도 한 걸음 가까워졌어요.
                  </h1>
                  <p>
                    직접 입력한 답을 기준으로 정리했어요. 다시 만나면 더
                    익숙해져요.
                  </p>
                  <div className="result-stats">
                    <div>
                      <strong>{session.ids.length}</strong>
                      <span>풀어 본 항목</span>
                    </div>
                    <div>
                      <strong>{session.answers.filter(Boolean).length}</strong>
                      <span>맞힌 항목</span>
                    </div>
                    <div>
                      <strong>
                        {session.answers.filter((a) => !a).length}
                      </strong>
                      <span>다시 볼 항목</span>
                    </div>
                  </div>
                  <div className="result-note">
                    <Leaf size={20} />
                    <p>
                      {due.length
                        ? "복습할 항목을 지금 다시 연습할 수 있어요."
                        : "잘했어요! 복습할 시간이 되면 홈에 알려 드릴게요."}
                      <br />
                      <span>
                        정답 기록과 복습 일정은 이 브라우저에 저장돼요.
                      </span>
                    </p>
                  </div>
                  {due.length > 0 && (
                    <button className="primary" onClick={() => start("review")}>
                      {due.every((id) => progress.cards[id]?.needsRetry)
                        ? `오답 ${due.length}개 복습하기`
                        : `${due.length}개 복습하기`}
                      <RotateCcw size={17} />
                    </button>
                  )}
                  <button
                    className={due.length ? "secondary" : "primary"}
                    onClick={() => {
                      setSession(null);
                      goTab("home");
                    }}
                  >
                    오늘의 학습으로
                    <ArrowRight size={17} />
                  </button>
                </div>
              )}
            </section>
          ) : (
            <>
              <section className="page-heading">
                <div>
                  <div className="eyebrow">
                    {tab === "home"
                      ? "YOUR DAILY JAPANESE"
                      : tab === "notes"
                        ? "MY FIRST HIRAGANA"
                        : tab === "review"
                          ? "MAKE IT STICK"
                          : "SMALL STEPS, REAL PROGRESS"}
                  </div>
                  <h1 ref={heading} tabIndex={-1}>
                    {tab === "home"
                      ? "반가워요, 오늘도 하루 한 걸음"
                      : tab === "notes"
                        ? "나의 첫 글자 노트"
                        : tab === "review"
                          ? "기억이 되는 복습"
                          : "차곡차곡 쌓인 배움"}
                    <span className="heading-dot">.</span>
                  </h1>
                  <p>
                    {tab === "home"
                      ? "서두르지 않아도 괜찮아요. 오늘의 작은 배움을 시작해 볼까요?"
                      : tab === "notes"
                        ? "글자부터 인사말까지, 소리와 뜻을 함께 익혀 보세요."
                        : tab === "review"
                          ? "잊기 전에 한 번 더. 틀린 글자부터 함께 살펴봐요."
                          : "정답보다 중요한 건, 다시 시작하는 마음이에요."}
                  </p>
                </div>
                {tab === "home" && (
                  <span className="today-date">{formatDate(now)}</span>
                )}
              </section>

              {tab === "home" && (
                <>
                  <section className="hero">
                    <div className="hero-copy">
                      <span className="hero-tag">
                        <span />
                        처음 시작하는 일본어
                      </span>
                      <h2>
                        작은 배움이 모여,
                        <br />
                        새로운 세상이 열려요.
                      </h2>
                      <p>
                        오늘의 추천 단원: {nextLesson.title}
                        <br />
                        아는 만큼, 읽을 수 있는 세상이 넓어질 거예요.
                      </p>
                      <button
                        className="primary"
                        onClick={() => start("lesson")}
                      >
                        {completed
                          ? "한 번 더 학습하기"
                          : nextLessonPracticed
                            ? "이어서 학습하기"
                            : nextLesson.id === "a-row"
                              ? "첫 학습 시작하기"
                              : "다음 단원 시작하기"}
                        <ArrowRight size={18} />
                      </button>
                      <span className="hero-meta">
                        <Clock3 size={14} /> 약 {nextLesson.minutes}분
                        <span>·</span>
                        {nextLesson.ids.length}개 항목
                      </span>
                    </div>
                    <div className="hero-art" aria-hidden="true">
                      <span className="art-ring ring-one" />
                      <span className="art-ring ring-two" />
                      <span className="art-spark spark-one">✳</span>
                      <span className="art-spark spark-two">+</span>
                      <div className="back-card">
                        <span>い</span>
                      </div>
                      <div className="front-card">
                        <span className="flashcard-label">나의 첫 일본어</span>
                        <span className="flashcard-glyph" lang="ja">
                          あ
                        </span>
                        <span className="flashcard-reading">a · 아</span>
                        <span className="flashcard-line" />
                      </div>
                      <div className="floating-leaf">
                        <Leaf size={25} strokeWidth={1.4} />
                      </div>
                      <span className="art-caption">a little, every day</span>
                    </div>
                  </section>
                  <section className="stats-strip" aria-label="학습 요약">
                    <div>
                      <span className="stat-icon peach">
                        <BookOpen size={21} />
                      </span>
                      <div>
                        <span>만나 본 글자·표현</span>
                        <strong>
                          {learned}
                          <small> / {allItems.length}개</small>
                        </strong>
                      </div>
                    </div>
                    <div>
                      <span className="stat-icon green">
                        <RotateCcw size={21} />
                      </span>
                      <div>
                        <span>지금 복습할 항목</span>
                        <strong>
                          {due.length}
                          <small>개</small>
                        </strong>
                      </div>
                    </div>
                    <div>
                      <span className="stat-icon violet">
                        <CheckCircle2 size={21} />
                      </span>
                      <div>
                        <span>오늘 마친 학습</span>
                        <strong>
                          {todaysActivities.length}
                          <small>회</small>
                        </strong>
                      </div>
                    </div>
                  </section>
                  <div className="dashboard-lower">
                    <CourseList
                      progress={progress}
                      onStart={(id) => start("lesson", id)}
                    />
                    <section className="review-card">
                      <div className="review-card-head">
                        <span className="review-symbol">
                          <RotateCcw size={22} />
                        </span>
                        <span className="small-label">나를 위한 복습</span>
                      </div>
                      <h2>
                        {due.length
                          ? "기억을 한 번 더 꺼내 볼까요?"
                          : learned
                            ? "기억이 자라는 중이에요"
                            : "배운 만큼, 오래 기억하도록"}
                      </h2>
                      <p>
                        {due.length
                          ? `${due.length}개의 글자·표현이 기다리고 있어요. 다시 보면 더 익숙해져요.`
                          : learned
                            ? "복습할 시간이 되면 이곳에 알려 드릴게요. 오늘 배운 내용을 천천히 떠올려 보세요."
                            : "학습을 시작하면 글자마다 복습할 때를 챙겨 드릴게요."}
                      </p>
                      <button
                        className="review-link"
                        onClick={() => goTab("review")}
                      >
                        {due.length
                          ? `지금 ${due.length}개 복습하기`
                          : "복습 일정 보기"}
                        <ArrowRight size={17} />
                      </button>
                    </section>
                  </div>
                  <div className="gentle-note">
                    <Sparkles size={17} />
                    <span>많이 외우는 하루보다, 하나라도 기억하는 하루.</span>
                    <span lang="ja">一歩ずつ</span>
                  </div>
                </>
              )}

              {tab === "notes" && (
                <StudyNotes
                  progress={progress}
                  onStart={(id) => start("lesson", id)}
                />
              )}

              {tab === "review" && (
                <>
                  <div className="review-intro">
                    <div className="review-symbol large">
                      <RotateCcw size={29} />
                    </div>
                    <h2>
                      {due.length
                        ? `${due.length}개의 항목을 다시 만날 시간이에요`
                        : learned
                          ? "지금은 복습할 항목이 없어요"
                          : "첫 학습부터 시작해 볼까요?"}
                    </h2>
                    <p>
                      {due.length
                        ? "정답을 보기 전에 먼저 떠올려 보세요. 틀려도 괜찮아요."
                        : learned
                          ? "첫 정답은 다음 날, 고쳐 맞힌 항목는 10분 뒤에 다시 만나요. 정답이 쌓이면 복습 간격이 늘어나요."
                          : "글자를 배우고 문제를 풀면, 나에게 맞는 복습 일정이 생겨요."}
                    </p>
                    {due.length ? (
                      <button
                        className="primary"
                        onClick={() => start("review")}
                      >
                        복습 시작하기
                        <ArrowRight size={17} />
                      </button>
                    ) : (
                      <button
                        className="secondary"
                        onClick={() => start("lesson")}
                      >
                        {learned ? "지금 다시 연습하기" : "첫 학습 시작하기"}
                        <ArrowRight size={17} />
                      </button>
                    )}
                  </div>
                  {learned > 0 && (
                    <section className="schedule">
                      <h2>글자·표현별 복습 일정</h2>
                      {allItems
                        .filter((c) => progress.cards[c.id])
                        .map((c) => {
                          const saved = progress.cards[c.id]!;
                          return (
                            <div className="schedule-row" key={c.id}>
                              <span
                                className={`schedule-glyph ${c.kind === "greeting" ? "schedule-phrase" : ""}`}
                                lang="ja"
                              >
                                {c.glyph}
                              </span>
                              <div>
                                <strong>
                                  {c.kind === "greeting"
                                    ? c.meaning
                                    : c.reading}
                                </strong>
                                <span>
                                  {saved.needsRetry
                                    ? "한 번 더 연습해요"
                                    : "차근차근 익히는 중"}
                                </span>
                              </div>
                              <span
                                className={
                                  saved.dueAt <= now ? "due-label" : ""
                                }
                              >
                                {saved.dueAt <= now
                                  ? "지금 복습"
                                  : new Intl.DateTimeFormat("ko-KR", {
                                      month: "short",
                                      day: "numeric",
                                      hour: "numeric",
                                      minute: "2-digit",
                                    }).format(saved.dueAt)}
                              </span>
                            </div>
                          );
                        })}
                    </section>
                  )}
                  <div className="info-banner">
                    <Leaf size={22} />
                    <p>
                      선택 문제를 맞혔다고 완전히 외운 것은 아니에요.
                      <br />
                      복습할 때는 글자의 소리나 인사말의 뜻을 스스로 떠올려
                      보세요.
                    </p>
                  </div>
                </>
              )}

              {tab === "history" && (
                <>
                  <div className="history-summary">
                    <div>
                      <span>만나 본 글자·표현</span>
                      <strong>
                        {learned}
                        <small>개</small>
                      </strong>
                    </div>
                    <div>
                      <span>답해 본 문제</span>
                      <strong>
                        {totalAnswers}
                        <small>개</small>
                      </strong>
                    </div>
                    <div>
                      <span>마친 학습과 복습</span>
                      <strong>
                        {progress.activities.length}
                        <small>회</small>
                      </strong>
                    </div>
                  </div>
                  <section className="schedule">
                    <h2>나의 학습 발자국</h2>
                    {progress.activities.length ? (
                      progress.activities.map((a, i) => (
                        <div className="activity-row" key={`${a.at}-${i}`}>
                          <span
                            className={`stat-icon ${a.mode === "lesson" ? "peach" : "green"}`}
                          >
                            {a.mode === "lesson" ? (
                              <BookOpen size={20} />
                            ) : (
                              <RotateCcw size={20} />
                            )}
                          </span>
                          <div>
                            <strong>
                              {a.mode === "lesson"
                                ? a.exercise === "recall"
                                  ? `${getLesson(a.lessonId ?? "a-row").title} 직접 입력 학습`
                                  : "히라가나 あ행 학습"
                                : a.exercise === "recall"
                                  ? "글자 직접 입력 복습"
                                  : "글자 복습"}
                            </strong>
                            <span>
                              {formatDate(a.at)} ·{" "}
                              {new Intl.DateTimeFormat("ko-KR", {
                                hour: "numeric",
                                minute: "2-digit",
                              }).format(a.at)}
                            </span>
                          </div>
                          <span>
                            {a.total}개 중 {a.correct}개 정답
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="empty-state">
                        <Sprout size={34} />
                        <h3>첫 발자국을 기다리고 있어요</h3>
                        <p>학습을 마치면 이곳에 기록이 쌓여요.</p>
                        <button
                          className="text-button"
                          onClick={() => start("lesson")}
                        >
                          첫 학습 시작하기
                          <ArrowRight size={17} />
                        </button>
                      </div>
                    )}
                  </section>
                  <p className="local-note">
                    기록은 현재 기기의 이 브라우저에만 보관돼요. 브라우저
                    데이터를 삭제하면 기록도 사라집니다.
                  </p>
                </>
              )}
              <footer>
                <span>
                  하루<span className="footer-dot">·</span>나의 첫 일본어
                </span>
                <button
                  className="footer-help"
                  onClick={() => setShowHelp(true)}
                >
                  이용 안내 · 음성 출처
                </button>
                <span>매일 조금씩, 나에게 남는 배움.</span>
              </footer>
            </>
          )}
        </main>
      </div>

      {confirmExit && (
        <Dialog titleId="exit-heading" onClose={() => setConfirmExit(false)}>
          <h2 id="exit-heading">잠시 쉬어 갈까요?</h2>
          <p>
            {warning
              ? "기록이 저장되지 않을 수 있어요. 저장 안내를 확인해 주세요."
              : "이미 답한 글자의 기록은 저장됐어요."}
            <br />
            진행 중인 학습은 다음에 처음부터 시작합니다.
          </p>
          <button
            className="primary"
            autoFocus
            onClick={() => setConfirmExit(false)}
          >
            계속 학습하기
          </button>
          <button
            className="secondary"
            onClick={() => {
              setConfirmExit(false);
              setSession(null);
              goTab("home");
            }}
          >
            학습 홈으로 나가기
          </button>
        </Dialog>
      )}
      {showHelp && (
        <Dialog titleId="help-heading" onClose={() => setShowHelp(false)}>
          <button
            className="modal-close circle-button"
            aria-label="이용 안내 닫기"
            autoFocus
            onClick={() => setShowHelp(false)}
          >
            <X size={20} />
          </button>
          <span className="eyebrow">WELCOME TO HARU</span>
          <h2 id="help-heading">작은 배움부터 시작해요.</h2>
          <p>
            ① 단원을 고르고, 글자와 인사말을 배워요.
            <br />② 소리를 고르고, 다음엔 직접 입력해요.
            <br />③ 틀린 글자는 바로 다시 연습해요.
          </p>
          <div className="help-note">
            정답은 다음 날부터 간격을 늘려 복습해요. 틀린 글자를 고쳐 맞히면
            10분 뒤에 다시 만나요. 기록은 현재 브라우저에 저장됩니다.
          </div>
          <p className="audio-credit">
            일본어 합성 음성 · HTS Voice Mei (MMDAgent Project Team)
            <br />
            <a
              href={`${import.meta.env.BASE_URL}audio/NOTICE.txt`}
              target="_blank"
              rel="noreferrer"
            >
              음성 출처와 이용 조건 보기
            </a>
          </p>
          <button className="primary" onClick={() => setShowHelp(false)}>
            알겠어요
            <Check size={17} />
          </button>
        </Dialog>
      )}
      <nav className="mobile-nav" aria-label="모바일 주 메뉴">
        {navigation.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            aria-current={tab === id ? "page" : undefined}
            className={tab === id ? "active" : ""}
            onClick={() => {
              if (session && session.phase !== "result") {
                setConfirmExit(true);
                return;
              }
              setSession(null);
              goTab(id);
            }}
          >
            <Icon size={21} />
            <span>{label}</span>
            {id === "review" && due.length > 0 && <i>{due.length}</i>}
          </button>
        ))}
      </nav>
    </div>
  );
}
