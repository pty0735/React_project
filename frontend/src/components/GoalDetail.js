import React, { useState, useEffect } from "react";
import axios from "axios";

const GoalDetail = ({ goalId, user, onLogout, onBack }) => {
  const [goalDetail, setGoalDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updatingRoutine, setUpdatingRoutine] = useState(null);

  useEffect(() => {
    fetchGoalDetail();
  }, [goalId]);

  const fetchGoalDetail = async () => {
    try {
      const response = await axios.get(`/api/goals/${goalId}`);
      setGoalDetail(response.data);
    } catch (error) {
      console.error("목표 상세 조회 실패:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (routineId, status) => {
    if (updatingRoutine === routineId) return;

    setUpdatingRoutine(routineId);

    try {
      await axios.put(`/api/routines/${routineId}/progress`, {
        status,
        actualTimeSpent: null,
        feedback: null,
      });

      // 상태 업데이트 후 다시 조회
      await fetchGoalDetail();
    } catch (error) {
      console.error("루틴 상태 업데이트 실패:", error);
      alert(error.response?.data?.error || "상태 업데이트에 실패했습니다");
    } finally {
      setUpdatingRoutine(null);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "long",
    });
  };

  const getStatusColor = (status, routineStatus) => {
    if (routineStatus === "auto_failed") return "#dc3545";

    switch (status) {
      case "완료":
        return "#28a745";
      case "진행중":
        return "#ffc107";
      case "미완료":
        return "#dc3545";
      default:
        return "#6c757d";
    }
  };

  const getStatusText = (status, routineStatus) => {
    if (routineStatus === "auto_failed") return "미완료 (자동)";
    return status || "미완료";
  };

  const canUpdateStatus = (routine) => {
    return routine.routine_status === "today";
  };

  const getCategoryColor = (category) => {
    const colors = {
      운동: "#e74c3c",
      공부: "#3498db",
      생활: "#2ecc71",
    };
    return colors[category] || "#95a5a6";
  };

  const getRoutineCardClass = (routine) => {
    let baseClass = "routine-card";

    if (routine.routine_status === "today") {
      baseClass += " today-highlight";
    } else if (routine.routine_status === "auto_failed") {
      baseClass += " auto-failed";
    } else if (routine.routine_status === "future") {
      baseClass += " future";
    }

    return baseClass;
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>목표 상세 정보를 불러오는 중...</p>
      </div>
    );
  }

  if (!goalDetail) {
    return (
      <div className="error-container">
        <p>목표 정보를 찾을 수 없습니다.</p>
        <button onClick={onBack} className="back-btn">
          돌아가기
        </button>
      </div>
    );
  }

  const { goal, routines } = goalDetail;
  const totalRoutines = routines.length;
  const completedRoutines = routines.filter((r) => r.status === "완료").length;
  const failedRoutines = routines.filter(
    (r) => r.status === "미완료" || r.routine_status === "auto_failed"
  ).length;
  const inProgressRoutines = routines.filter(
    (r) => r.status === "진행중"
  ).length;

  return (
    <div className="goal-detail-container">
      <header className="goal-detail-header">
        <div className="header-content">
          <div className="header-left">
            <button onClick={onBack} className="back-button">
              ← 대시보드로 돌아가기
            </button>
            <div className="goal-info">
              <div className="goal-title-section">
                <div
                  className="goal-category-badge"
                  style={{ backgroundColor: getCategoryColor(goal.category) }}
                >
                  {goal.category}
                </div>
                <h1>목표 상세 정보</h1>
              </div>
              <p className="goal-description">{goal.description}</p>
            </div>
          </div>
          <div className="header-right">
            <button onClick={onLogout} className="logout-btn">
              로그아웃
            </button>
          </div>
        </div>
      </header>

      <main className="goal-detail-main">
        <section className="goal-summary">
          <div className="summary-card">
            <h3>목표 정보</h3>
            <div className="summary-content">
              <div className="summary-item">
                <span className="label">목표 달성 날짜:</span>
                <span className="value">{formatDate(goal.target_date)}</span>
              </div>
              <div className="summary-item">
                <span className="label">목표 생성일:</span>
                <span className="value">{formatDate(goal.created_at)}</span>
              </div>
              <div className="summary-item">
                <span className="label">전체 루틴:</span>
                <span className="value">{totalRoutines}개</span>
              </div>
            </div>
          </div>

          <div className="progress-cards">
            <div className="progress-card completed">
              <div className="progress-number">{completedRoutines}</div>
              <div className="progress-label">완료</div>
            </div>
            <div className="progress-card in-progress">
              <div className="progress-number">{inProgressRoutines}</div>
              <div className="progress-label">진행중</div>
            </div>
            <div className="progress-card failed">
              <div className="progress-number">{failedRoutines}</div>
              <div className="progress-label">미완료</div>
            </div>
            <div className="progress-card remaining">
              <div className="progress-number">
                {totalRoutines -
                  completedRoutines -
                  failedRoutines -
                  inProgressRoutines}
              </div>
              <div className="progress-label">예정</div>
            </div>
          </div>
        </section>

        <section className="routines-section">
          <h2>일일 루틴 계획</h2>

          {routines.length === 0 ? (
            <div className="empty-routines">
              <p>생성된 루틴이 없습니다.</p>
            </div>
          ) : (
            <div className="routines-list">
              {routines.map((routine, index) => (
                <div key={routine.id} className={getRoutineCardClass(routine)}>
                  <div className="routine-header">
                    <div className="routine-date-info">
                      <span className="routine-day">Day {index + 1}</span>
                      <span className="routine-date">
                        {formatDate(routine.date)}
                      </span>
                      {routine.routine_status === "today" && (
                        <span className="today-badge">📅 오늘</span>
                      )}
                      {routine.routine_status === "future" && (
                        <span className="future-badge">⏳ 예정</span>
                      )}
                    </div>
                    <div
                      className="routine-status-badge"
                      style={{
                        backgroundColor: getStatusColor(
                          routine.status,
                          routine.routine_status
                        ),
                      }}
                    >
                      {getStatusText(routine.status, routine.routine_status)}
                    </div>
                  </div>

                  <div className="routine-content">
                    <p className="routine-activity">{routine.activity}</p>
                    <div className="routine-meta">
                      <span className="routine-duration">
                        예상 소요시간: {routine.estimated_duration}분
                      </span>
                      {routine.actual_time_spent && (
                        <span className="routine-actual">
                          실제 소요시간: {routine.actual_time_spent}분
                        </span>
                      )}
                    </div>

                    {routine.feedback && (
                      <div className="routine-feedback">
                        <strong>피드백:</strong> {routine.feedback}
                      </div>
                    )}

                    {canUpdateStatus(routine) && (
                      <div className="routine-actions">
                        <p className="actions-title">
                          🎯 오늘의 루틴을 완료하셨나요?
                        </p>
                        <div className="status-buttons">
                          <button
                            className="status-btn completed"
                            onClick={() =>
                              handleStatusUpdate(routine.id, "완료")
                            }
                            disabled={updatingRoutine === routine.id}
                          >
                            {updatingRoutine === routine.id
                              ? "처리중..."
                              : "✅ 완료"}
                          </button>
                          <button
                            className="status-btn in-progress"
                            onClick={() =>
                              handleStatusUpdate(routine.id, "진행중")
                            }
                            disabled={updatingRoutine === routine.id}
                          >
                            {updatingRoutine === routine.id
                              ? "처리중..."
                              : "🔄 진행중"}
                          </button>
                          <button
                            className="status-btn failed"
                            onClick={() =>
                              handleStatusUpdate(routine.id, "미완료")
                            }
                            disabled={updatingRoutine === routine.id}
                          >
                            {updatingRoutine === routine.id
                              ? "처리중..."
                              : "❌ 미완료"}
                          </button>
                        </div>
                      </div>
                    )}

                    {routine.routine_status === "future" && (
                      <div className="future-notice">
                        <p>
                          📋 예정된 루틴입니다. 해당 날짜가 되면 상태를 변경할
                          수 있습니다.
                        </p>
                      </div>
                    )}

                    {routine.routine_status === "auto_failed" && (
                      <div className="auto-failed-notice">
                        <p>⚠️ 기한이 지나 자동으로 미완료 처리되었습니다.</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      <style jsx>{`
        .goal-detail-container {
          min-height: 100vh;
          background: linear-gradient(
            135deg,
            rgb(178, 192, 255) 0%,
            #764ba2 100%
          );
          font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
        }

        .goal-detail-header {
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(10px);
          border-bottom: 1px solid rgba(255, 255, 255, 0.2);
          padding: 1.5rem 0;
          margin-bottom: 2rem;
        }

        .header-content {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 2rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .back-button {
          background: #6c5ce7;
          color: white;
          border: none;
          padding: 0.75rem 1.5rem;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 500;
          margin-bottom: 1rem;
          transition: background 0.3s ease;
        }

        .back-button:hover {
          background: #5a4fcf;
        }

        .goal-title-section {
          display: flex;
          align-items: center;
          gap: 1rem;
          margin-bottom: 0.5rem;
        }

        .goal-category-badge {
          padding: 0.5rem 1rem;
          border-radius: 20px;
          color: white;
          font-weight: 600;
          font-size: 0.9rem;
        }

        .goal-description {
          color: #666;
          font-size: 1.1rem;
          margin: 0;
        }

        .logout-btn {
          background: #e17055;
          color: white;
          border: none;
          padding: 0.75rem 1.5rem;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 500;
          transition: background 0.3s ease;
        }

        .logout-btn:hover {
          background: #d63031;
        }

        .goal-detail-main {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 2rem 3rem;
        }

        .goal-summary {
          display: grid;
          grid-template-columns: 1fr 2fr;
          gap: 2rem;
          margin-bottom: 3rem;
        }

        .summary-card {
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(10px);
          padding: 2rem;
          border-radius: 16px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
        }

        .summary-card h3 {
          margin: 0 0 1.5rem 0;
          color: #2d3436;
          font-size: 1.3rem;
        }

        .summary-item {
          display: flex;
          justify-content: space-between;
          margin-bottom: 1rem;
          padding-bottom: 1rem;
          border-bottom: 1px solid #eee;
        }

        .summary-item:last-child {
          border-bottom: none;
          margin-bottom: 0;
          padding-bottom: 0;
        }

        .label {
          font-weight: 500;
          color: #636e72;
        }

        .value {
          font-weight: 600;
          color: #2d3436;
        }

        .progress-cards {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 1rem;
        }

        .progress-card {
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(10px);
          padding: 1.5rem;
          border-radius: 12px;
          text-align: center;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
          transition: transform 0.3s ease;
        }

        .progress-card:hover {
          transform: translateY(-2px);
        }

        .progress-number {
          font-size: 2rem;
          font-weight: bold;
          margin-bottom: 0.5rem;
        }

        .progress-card.completed .progress-number {
          color: #00b894;
        }

        .progress-card.in-progress .progress-number {
          color: #fdcb6e;
        }

        .progress-card.failed .progress-number {
          color: #e17055;
        }

        .progress-card.remaining .progress-number {
          color: #74b9ff;
        }

        .progress-label {
          font-size: 0.9rem;
          font-weight: 500;
          color: #636e72;
        }

        .routines-section h2 {
          color: white;
          margin-bottom: 2rem;
          font-size: 1.8rem;
          text-align: center;
        }

        .routines-list {
          display: grid;
          gap: 1.5rem;
        }

        .routine-card {
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(10px);
          border-radius: 16px;
          padding: 1.5rem;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
          transition: transform 0.3s ease;
        }

        .routine-card:hover {
          transform: translateY(-2px);
        }

        .today-highlight {
          border: 3px solid #00b894;
          background: rgba(0, 184, 148, 0.05);
          box-shadow: 0 8px 32px rgba(0, 184, 148, 0.2);
        }

        .future {
          background: rgba(255, 255, 255, 0.7);
        }

        .auto-failed {
          border: 2px solid #e17055;
          background: rgba(225, 112, 85, 0.05);
        }

        .routine-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
        }

        .routine-date-info {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .routine-day {
          background: #6c5ce7;
          color: white;
          padding: 0.3rem 0.8rem;
          border-radius: 12px;
          font-size: 0.8rem;
          font-weight: 600;
        }

        .routine-date {
          color: #636e72;
          font-weight: 500;
        }

        .today-badge {
          background: #00b894;
          color: white;
          padding: 0.3rem 0.8rem;
          border-radius: 12px;
          font-size: 0.8rem;
          font-weight: 600;
          animation: pulse 2s infinite;
        }

        .future-badge {
          background: #74b9ff;
          color: white;
          padding: 0.3rem 0.8rem;
          border-radius: 12px;
          font-size: 0.8rem;
          font-weight: 600;
        }

        @keyframes pulse {
          0% {
            box-shadow: 0 0 0 0 rgba(0, 184, 148, 0.7);
          }
          70% {
            box-shadow: 0 0 0 10px rgba(0, 184, 148, 0);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(0, 184, 148, 0);
          }
        }

        .routine-status-badge {
          padding: 0.5rem 1rem;
          border-radius: 20px;
          color: white;
          font-size: 0.8rem;
          font-weight: 600;
        }

        .routine-activity {
          font-size: 1.1rem;
          font-weight: 600;
          color: #2d3436;
          margin-bottom: 1rem;
        }

        .routine-meta {
          display: flex;
          gap: 1rem;
          margin-bottom: 1rem;
          color: #636e72;
          font-size: 0.9rem;
        }

        .routine-feedback {
          background: #f8f9fa;
          padding: 1rem;
          border-radius: 8px;
          margin-bottom: 1rem;
          border-left: 4px solid #74b9ff;
        }

        .routine-actions {
          background: rgba(108, 92, 231, 0.05);
          padding: 1.5rem;
          border-radius: 12px;
          border: 1px solid rgba(108, 92, 231, 0.1);
        }

        .actions-title {
          margin: 0 0 1rem 0;
          font-weight: 600;
          color: #2d3436;
          text-align: center;
        }

        .status-buttons {
          display: flex;
          gap: 0.8rem;
          justify-content: center;
        }

        .status-btn {
          padding: 0.8rem 1.5rem;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 600;
          transition: all 0.3s ease;
          font-size: 0.9rem;
        }

        .status-btn.completed {
          background: #00b894;
          color: white;
        }

        .status-btn.completed:hover {
          background: #00a085;
          transform: translateY(-1px);
        }

        .status-btn.in-progress {
          background: #fdcb6e;
          color: white;
        }

        .status-btn.in-progress:hover {
          background: #e17055;
          transform: translateY(-1px);
        }

        .status-btn.failed {
          background: #e17055;
          color: white;
        }

        .status-btn.failed:hover {
          background: #d63031;
          transform: translateY(-1px);
        }

        .status-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
        }

        .future-notice,
        .auto-failed-notice {
          background: #f8f9fa;
          padding: 1rem;
          border-radius: 8px;
          margin-top: 1rem;
          text-align: center;
          font-size: 0.9rem;
        }

        .future-notice {
          border-left: 4px solid #74b9ff;
          color: #2980b9;
        }

        .auto-failed-notice {
          border-left: 4px solid #e17055;
          color: #c0392b;
        }

        .loading-container,
        .error-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          color: white;
          text-align: center;
        }

        .loading-spinner {
          width: 50px;
          height: 50px;
          border: 3px solid rgba(255, 255, 255, 0.3);
          border-top: 3px solid white;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin-bottom: 1rem;
        }

        @keyframes spin {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }

        .empty-routines {
          text-align: center;
          padding: 3rem;
          background: rgba(255, 255, 255, 0.9);
          border-radius: 16px;
          color: #636e72;
          font-size: 1.1rem;
        }

        @media (max-width: 768px) {
          .goal-summary {
            grid-template-columns: 1fr;
          }

          .progress-cards {
            grid-template-columns: repeat(2, 1fr);
          }

          .header-content {
            flex-direction: column;
            gap: 1rem;
          }

          .status-buttons {
            flex-direction: column;
          }

          .routine-header {
            flex-direction: column;
            gap: 1rem;
            align-items: flex-start;
          }
        }
      `}</style>
    </div>
  );
};

export default GoalDetail;
