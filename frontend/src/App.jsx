import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import MemberPage from "./pages/search";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/search" element={<MemberPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
