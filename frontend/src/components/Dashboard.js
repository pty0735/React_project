import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import axios from "axios";

const Dashboard = ({ user, onLogout }) => {
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchGoals();
  }, []);

  const fetchGoals = async () => {
    try {
      const response = await axios.get("/api/goals");
      setGoals(response.data);
    } catch (error) {
      console.error("목표 조회 실패:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("ko-KR");
  };

  const getCategoryColor = (category) => {
    const colors = {
      운동: "#e74c3c",
      공부: "#3498db",
      생활: "#2ecc71",
    };
    return colors[category] || "#95a5a6";
  };

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div className="header-content">
          <div className="header-left">
            <h1>맞춤 루틴 생성기</h1>
            <p>{user.name}님, 안녕하세요!</p>
          </div>
          <div className="header-right">
            <Link to="/goal-input" className="create-goal-btn">
              새 목표 만들기
            </Link>
            <button onClick={onLogout} className="logout-btn">
              로그아웃
            </button>
          </div>
        </div>
      </header>

      <main className="dashboard-main">
        <section className="stats-section">
          <div className="stat-card">
            <div className="stat-number">{goals.length}</div>
            <div className="stat-label">전체 목표</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">
              {goals.filter((goal) => goal.is_completed).length}
            </div>
            <div className="stat-label">완료된 목표</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">
              {goals.filter((goal) => !goal.is_completed).length}
            </div>
            <div className="stat-label">진행 중인 목표</div>
          </div>
        </section>

        <section className="goals-section">
          <div className="section-header">
            <h2>나의 목표들</h2>
            {goals.length === 0 && !loading && (
              <p className="empty-message">
                아직 목표가 없습니다. <Link to="/goal-input">첫 번째 목표</Link>
                를 만들어보세요!
              </p>
            )}
          </div>

          {loading ? (
            <div className="loading-container">
              <div className="loading-spinner"></div>
              <p>목표를 불러오는 중...</p>
            </div>
          ) : (
            <div className="goals-grid">
              {goals.map((goal) => (
                <div key={goal.id} className="goal-card">
                  <div className="goal-header">
                    <div
                      className="goal-category"
                      style={{
                        backgroundColor: getCategoryColor(goal.category),
                      }}
                    >
                      {goal.category}
                    </div>
                    <div
                      className={`goal-status ${
                        goal.is_completed ? "completed" : "in-progress"
                      }`}
                    >
                      {goal.is_completed ? "완료" : "진행중"}
                    </div>
                  </div>

                  <div className="goal-content">
                    <p className="goal-description">{goal.description}</p>
                    <div className="goal-meta">
                      <span className="goal-date">
                        목표 날짜: {formatDate(goal.target_date)}
                      </span>
                      <span className="goal-created">
                        생성일: {formatDate(goal.created_at)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default Dashboard;
