import "../App.css";
import { Link } from "react-router-dom";

function Home() {
  return (
    <main className="home">
      <h1 className="home-title">전력 소비 패턴 분석 플랫폼</h1>

      
      <div className="menu-box">
        <div className="menu-item">
  구성원 수
  <Link to="/search?theme=member" className="go-link">
    <img src="/images/go.png" alt="조회하러가기" className="go-img" />
  </Link>
</div>

<div className="menu-item">
  주거 형태
  <Link to="/search?theme=house" className="go-link">
    <img src="/images/go.png" alt="조회하러가기" className="go-img" />
  </Link>
</div>

<div className="menu-item">
  지역
  <Link to="/search?theme=region" className="go-link">
    <img src="/images/go.png" alt="조회하러가기" className="go-img" />
  </Link>
</div>
      </div>
    </main>
  );
}

export default Home;
