import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";

const GoalInput = ({ user, onLogout }) => {
  const [formData, setFormData] = useState({
    category: "",
    description: "",
    target_date: "",
  });
  const [aiRoutine, setAiRoutine] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setAiRoutine("");

    try {
      const response = await axios.post("/api/goals", formData);
      setAiRoutine(response.data.aiRoutine);
    } catch (error) {
      setError(error.response?.data?.error || "AI 루틴 생성에 실패했습니다");
    } finally {
      setLoading(false);
    }
  };

  const handleGoToDashboard = () => {
    navigate("/dashboard");
  };

  // 오늘 날짜를 YYYY-MM-DD 형식으로 가져오기
  const getTodayDate = () => {
    return new Date().toISOString().split("T")[0];
  };

  return (
    <div className="goal-input-container">
      <header className="goal-input-header">
        <div className="header-content">
          <div className="header-left">
            <h1>새 목표 만들기</h1>
            <p>
              {user.name}님의 목표를 AI가 분석해서 맞춤 루틴을 만들어드립니다
            </p>
          </div>
          <div className="header-right">
            <Link to="/dashboard" className="back-btn">
              대시보드로
            </Link>
            <button onClick={onLogout} className="logout-btn">
              로그아웃
            </button>
          </div>
        </div>
      </header>

      <main className="goal-input-main">
        <div className="goal-form-container">
          <form onSubmit={handleSubmit} className="goal-form">
            {error && <div className="error-message">{error}</div>}

            <div className="form-group">
              <label htmlFor="category">목표 카테고리</label>
              <select
                id="category"
                name="category"
                value={formData.category}
                onChange={handleChange}
                required
              >
                <option value="">카테고리를 선택하세요</option>
                <option value="운동">운동</option>
                <option value="공부">공부</option>
                <option value="생활">생활</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="description">목표 설명</label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                required
                placeholder="구체적인 목표를 입력해주세요. 예: '매일 30분씩 조깅하여 5kg 감량하기', '토익 800점 달성하기', '매일 책 30분씩 읽기' 등"
                rows="4"
              />
            </div>

            <div className="form-group">
              <label htmlFor="target_date">목표 달성 날짜</label>
              <input
                type="date"
                id="target_date"
                name="target_date"
                value={formData.target_date}
                onChange={handleChange}
                min={getTodayDate()}
                required
              />
            </div>

            <button type="submit" className="generate-btn" disabled={loading}>
              {loading
                ? "AI가 루틴을 생성중입니다..."
                : "AI 맞춤 루틴 생성하기"}
            </button>
          </form>

          {loading && (
            <div className="ai-loading">
              <div className="loading-spinner"></div>
              <p>AI가 당신만의 맞춤 루틴을 생성중입니다...</p>
              <p>잠시만 기다려주세요</p>
            </div>
          )}

          {aiRoutine && (
            <div className="ai-routine-result">
              <div className="result-header">
                <h3>🤖 AI가 생성한 맞춤 루틴</h3>
                <button
                  onClick={handleGoToDashboard}
                  className="save-complete-btn"
                >
                  저장 완료 - 대시보드로 이동
                </button>
              </div>
              <div className="routine-content">
                <pre>{aiRoutine}</pre>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default GoalInput;
