import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import GoalDetail from "./GoalDetail";

const Dashboard = ({ user, onLogout }) => {
  const [goals, setGoals] = useState({
    inProgress: [],
    completed: [],
    failed: [],
  });
  const [activeTab, setActiveTab] = useState("inProgress");
  const [selectedGoal, setSelectedGoal] = useState(null);
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

  const getTabTitle = (tab) => {
    const titles = {
      inProgress: "진행 중인 목표",
      completed: "완료된 목표",
      failed: "미완료 목표",
    };
    return titles[tab];
  };

  const getTabCount = (tab) => {
    return goals[tab]?.length || 0;
  };

  const handleGoalClick = (goalId) => {
    setSelectedGoal(goalId);
  };

  const handleBackToDashboard = () => {
    setSelectedGoal(null);
    fetchGoals(); // 상태 업데이트를 위해 다시 조회
  };

  if (selectedGoal) {
    return (
      <GoalDetail
        goalId={selectedGoal}
        user={user}
        onLogout={onLogout}
        onBack={handleBackToDashboard}
      />
    );
  }

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
            <div className="stat-number">{getTabCount("inProgress")}</div>
            <div className="stat-label">진행 중</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">{getTabCount("completed")}</div>
            <div className="stat-label">완료됨</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">{getTabCount("failed")}</div>
            <div className="stat-label">미완료</div>
          </div>
        </section>

        <section className="goals-section">
          <div className="section-header">
            <div className="tab-navigation">
              {["inProgress", "completed", "failed"].map((tab) => (
                <button
                  key={tab}
                  className={`tab-button ${activeTab === tab ? "active" : ""}`}
                  onClick={() => setActiveTab(tab)}
                >
                  {getTabTitle(tab)} ({getTabCount(tab)})
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="loading-container">
              <div className="loading-spinner"></div>
              <p>목표를 불러오는 중...</p>
            </div>
          ) : (
            <div className="goals-content">
              {goals[activeTab]?.length === 0 ? (
                <div className="empty-message">
                  <p>
                    {activeTab === "inProgress" &&
                      "진행 중인 목표가 없습니다. "}
                    {activeTab === "completed" && "완료된 목표가 없습니다. "}
                    {activeTab === "failed" && "미완료 목표가 없습니다. "}
                    {activeTab === "inProgress" && (
                      <Link to="/goal-input">첫 번째 목표</Link>
                    )}
                    {activeTab === "inProgress" && "를 만들어보세요!"}
                  </p>
                </div>
              ) : (
                <div className="goals-grid">
                  {goals[activeTab]?.map((goal) => (
                    <div
                      key={goal.id}
                      className="goal-card clickable"
                      onClick={() => handleGoalClick(goal.id)}
                    >
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
                            activeTab === "completed"
                              ? "completed"
                              : activeTab === "failed"
                              ? "failed"
                              : "in-progress"
                          }`}
                        >
                          {activeTab === "completed"
                            ? "완료"
                            : activeTab === "failed"
                            ? "미완료"
                            : "진행중"}
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
                          {goal.total_routines > 0 && (
                            <div className="routine-progress">
                              완료: {goal.completed_routines || 0}/
                              {goal.total_routines}
                            </div>
                          )}
                        </div>
                        <div className="goal-actions">
                          <span className="view-detail">자세히 보기 →</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default Dashboard;
