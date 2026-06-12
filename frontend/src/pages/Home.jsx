import { Link } from "react-router-dom";
import "../App.css";

const pageTitle = "\uc804\ub825 \uc18c\ube44 \ud328\ud134 \ubd84\uc11d \ud50c\ub7ab\ud3fc";

const menuItems = [
  { label: "\ub370\uc774\ud130 \ud488\uc9c8", theme: "quality" },
  { label: "\uac00\uad6c \ubd84\uc11d", theme: "household" },
  { label: "\uae30\uc5c5 \ubd84\uc11d", theme: "business" },
  { label: "\uc9c0\uc5ed \ubd84\uc11d", theme: "region" },
  { label: "\uc9c8\ubb38 \ub85c\uadf8", theme: "log" },
];

function Home() {
  return (
    <main className="home">
      <h1 className="home-title">{pageTitle}</h1>

      <div className="menu-box">
        {menuItems.map((item) => (
          <div className="menu-item" key={item.theme}>
            {item.label}
            <Link to={`/search?theme=${item.theme}`} className="go-link">
              <img
                src="/images/go.png"
                alt={"\uc870\ud68c\ud558\ub7ec\uac00\uae30"}
                className="go-img"
              />
            </Link>
          </div>
        ))}
      </div>
    </main>
  );
}

export default Home;
