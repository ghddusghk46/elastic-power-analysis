import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import "../App.css";

const themeName = {
  member: "구성원 수",
  house: "주거 형태",
  region: "지역",
};

const themeImages = {
  "구성원 수": ["/images/member1.png", "/images/member2.png"],
  "주거 형태": ["/images/house1.png", "/images/house2.png"],
  "지역": ["/images/region1.png", "/images/region2.png"],
};

function MemberPage() {
  const [searchParams] = useSearchParams();
  const theme = searchParams.get("theme");
  const [selectedMenu, setSelectedMenu] = useState(
    themeName[theme] || "구성원 수"
  );

  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleAsk(e) {
    e.preventDefault();

    if (!question.trim()) {
      setAnswer("궁금한 점을 먼저 입력해주세요.");
      return;
    }

    setLoading(true);
    setAnswer("");

    try {
      const response = await fetch("http://localhost:4000/api/ask", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          theme: selectedMenu,
          question,
        }),
      });

      const data = await response.json();
      setAnswer(data.answer);
    } catch {
      setAnswer("답변을 불러오는 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="select-page">
      <Link to="/" className="search-home-link">
        전력 소비 패턴 분석 플랫폼
      </Link>

      <div className="select-wrap">
        <div className="select-bar">
          <span>{selectedMenu}</span>
          <button className="search-btn" type="button">
            <img src="/images/search.png" alt="검색" className="search-icon" />
          </button>
        </div>

        <div className="select-menu">
          <button type="button" onClick={() => setSelectedMenu("구성원 수")}>
            구성원 수
          </button>
          <button type="button" onClick={() => setSelectedMenu("주거 형태")}>
            주거 형태
          </button>
          <button type="button" onClick={() => setSelectedMenu("지역")}>
            지역
          </button>
        </div>
      </div>

      <section className="search-content">
        <div className="theme-image-area">
          {themeImages[selectedMenu].map((imageSrc, index) => (
            <img
              key={imageSrc}
              src={imageSrc}
              alt={`${selectedMenu} 이미지 ${index + 1}`}
              className="theme-image"
            />
          ))}
        </div>

        <form className="ask-area" onSubmit={handleAsk}>
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="궁금한점을 입력하세요"
            className="ask-input"
          />

          <button type="submit" className="ask-search-button">
            <img src="/images/search.png" alt="검색" className="ask-search-icon" />
          </button>
        </form>

        {loading && <div className="answer-box loading-box">답변을 불러오는 중</div>}
        {!loading && answer && <div className="answer-box">{answer}</div>}
      </section>
    </main>
  );
}

export default MemberPage;
