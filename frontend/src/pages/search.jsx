import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import "../App.css";

const pageTitle = "\uc804\ub825 \uc18c\ube44 \ud328\ud134 \ubd84\uc11d \ud50c\ub7ab\ud3fc";
const askPlaceholder = "\uad81\uae08\ud55c \uc810\uc744 \uc785\ub825\ud558\uc138\uc694";

const themes = {
  quality: {
    label: "\ub370\uc774\ud130 \ud488\uc9c8",
    images: [
      { src: "/images/quality1.png", caption: "\uc218\uc9d1 \ub300\uc0c1\ubcc4 \ubd84\ud3ec" },
      { src: "/images/quality2.png", caption: "\uc9c0\uc5ed\ubcc4 \ub370\uc774\ud130 \ubd84\ud3ec" },
      { src: "/images/quality3.png", caption: "\uad6c\uc131\uc6d0 \uc218\ubcc4 \ub370\uc774\ud130 \ubd84\ud3ec" },
    ],
  },
  household: {
    label: "\uac00\uad6c \ubd84\uc11d",
    images: [
      { src: "/images/household1.png", caption: "\uad6c\uc131\uc6d0 \uc218\ubcc4 \ud3c9\uade0\u00b7\uc911\uc559\uac12" },
      { src: "/images/household2.png", caption: "\uc8fc\uac70 \ud615\ud0dc\ubcc4 \ud3c9\uade0\u00b7\uc911\uc559\uac12" },
      { src: "/images/household3.png", caption: "\uc8fc\uac70 \uba74\uc801\ubcc4 \ud3c9\uade0\u00b7\uc911\uc559\uac12" },
    ],
  },
  business: {
    label: "\uae30\uc5c5 \ubd84\uc11d",
    images: [
      { src: "/images/business1.png", caption: "\uc0b0\uc5c5 \uc885\ub958\ubcc4 \ud3c9\uade0\u00b7\uc911\uc559\uac12" },
      { src: "/images/business2.png", caption: "\uadfc\ubb34\uc790 \uc218\ubcc4 \ud3c9\uade0\u00b7\uc911\uc559\uac12" },
      { src: "/images/business3.png", caption: "\uadfc\ubb34 \uc2dc\uac04\ubcc4 \ud3c9\uade0\u00b7\uc911\uc559\uac12" },
    ],
  },
  region: {
    label: "\uc9c0\uc5ed \ubd84\uc11d",
    images: [
      { src: "/images/region1.png", caption: "\uc9c0\uc5ed\ubcc4 \ud3c9\uade0\u00b7\uc911\uc559\uac12\u00b7p95" },
      { src: "/images/region2.png", caption: "\uc9c0\uc5ed\ubcc4 p99\u00b7\ucd5c\ub313\uac12 \ube44\uad50" },
      { src: "/images/region3.png", caption: "\ub098\uc8fc \uc804\ub825 \uc18c\ube44 \uad6c\uac04\ubcc4 \ubd84\ud3ec" },
    ],
  },
  log: {
    label: "\uc9c8\ubb38 \ub85c\uadf8",
    images: [
      { src: "/images/log1.png", caption: "\ud14c\ub9c8\ubcc4 \uc9c8\ubb38 \uc218" },
      { src: "/images/log2.png", caption: "\ud14c\ub9c8\ubcc4 \ud3c9\uade0 \uc751\ub2f5 \uc2dc\uac04" },
      { src: "/images/log3.png", caption: "\uc9c8\ubb38 \uc131\uacf5\u00b7\uc2e4\ud328 \uc218" },
    ],
  },
};

const themeOrder = ["quality", "household", "business", "region", "log"];

function SearchPage() {
  const [searchParams] = useSearchParams();
  const themeKey = searchParams.get("theme");
  const [selectedThemeKey, setSelectedThemeKey] = useState(
    themes[themeKey] ? themeKey : "quality"
  );
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [queryOpen, setQueryOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);

  const selectedTheme = themes[selectedThemeKey];

  async function handleAsk(e) {
    e.preventDefault();

    if (!question.trim()) {
      setAnswer("\uad81\uae08\ud55c \uc810\uc744 \uba3c\uc800 \uc785\ub825\ud574\uc8fc\uc138\uc694.");
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
          theme: selectedTheme.label,
          question,
        }),
      });

      const data = await response.json();
      setAnswer(data.answer);
    } catch {
      setAnswer("\ub2f5\ubcc0\uc744 \ubd88\ub7ec\uc624\ub294 \uc911 \uc624\ub958\uac00 \ubc1c\uc0dd\ud588\uc2b5\ub2c8\ub2e4.");
    } finally {
      setLoading(false);
    }
  }

  function changeTheme(nextThemeKey) {
    setSelectedThemeKey(nextThemeKey);
    setGalleryOpen(false);
    setQueryOpen(false);
    setAnswer("");
  }

  return (
    <main className="select-page">
      <Link to="/" className="search-home-link">
        {pageTitle}
      </Link>

      <div className="select-wrap">
        <div className="select-bar">
          <span>{selectedTheme.label}</span>
          <button className="search-btn" type="button">
            <img src="/images/search.png" alt={"\uac80\uc0c9"} className="search-icon" />
          </button>
        </div>

        <div className="select-menu">
          {themeOrder.map((key) => (
            <button type="button" key={key} onClick={() => changeTheme(key)}>
              {themes[key].label}
            </button>
          ))}
        </div>
      </div>

      <section className="search-content">
        <div className="feature-panel-row">
          <button
            className="feature-card image-card"
            type="button"
            aria-label={`${selectedTheme.label} ${galleryOpen ? "\uc774\ubbf8\uc9c0 \ub2eb\uae30" : "\uc774\ubbf8\uc9c0 \uc5f4\uae30"}`}
            onClick={() => setGalleryOpen((prev) => !prev)}
          >
            {selectedTheme.images.map((image, index) => (
              <img
                key={image.src}
                src={image.src}
                alt={`${selectedTheme.label} ${image.caption}`}
                className={`preview-image preview-image-${index + 1}`}
              />
            ))}
          </button>

          <button
            className="feature-card query-card"
            type="button"
            aria-label={`${selectedTheme.label} ${queryOpen ? "\uc870\ud68c \ub2eb\uae30" : "\uc870\ud68c \uc5f4\uae30"}`}
            onClick={() => setQueryOpen((prev) => !prev)}
          >
            <span className="query-preview-input">{askPlaceholder}</span>
            <img src="/images/search.png" alt="" className="query-preview-icon" />
            <span className="query-preview-answer">
              <span />
              <span />
              <span />
            </span>
          </button>
        </div>

        {galleryOpen && (
          <div className="theme-image-area">
            {selectedTheme.images.map((image, index) => (
              <figure className="theme-figure" key={image.src}>
                <img
                  src={image.src}
                  alt={`${selectedTheme.label} ${image.caption}`}
                  className="theme-image"
                />
                <figcaption className="theme-caption">
                  {index + 1}. {image.caption}
                </figcaption>
              </figure>
            ))}
          </div>
        )}

        {queryOpen && (
          <div className="query-panel">
            <form className="ask-area" onSubmit={handleAsk}>
              <input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder={askPlaceholder}
                className="ask-input"
              />

              <button type="submit" className="ask-search-button">
                <img src="/images/search.png" alt={"\uac80\uc0c9"} className="ask-search-icon" />
              </button>
            </form>

            {loading && <div className="answer-box loading-box">{"\ub2f5\ubcc0\uc744 \ubd88\ub7ec\uc624\ub294 \uc911"}</div>}
            {!loading && answer && <div className="answer-box">{answer}</div>}
          </div>
        )}
      </section>
    </main>
  );
}

export default SearchPage;
