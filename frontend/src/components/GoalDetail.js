import React, { useState, useEffect } from "react";
import axios from "axios";
import "../App.css";

const GoalDetail = ({ goalId, user, onLogout, onBack }) => {
  const [goalDetail, setGoalDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updatingRoutine, setUpdatingRoutine] = useState(null);
  const [deletingGoal, setDeletingGoal] = useState(false);

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

  const handleDeleteGoal = async () => {
    if (deletingGoal) return;

    const confirmDelete = window.confirm(
      `"${goal.description}" 목표를 완전히 삭제하시겠습니까?\n모든 루틴과 진행상황이 삭제되며 복구할 수 없습니다.`
    );
    if (!confirmDelete) return;

    setDeletingGoal(true);

    try {
      await axios.delete(`/api/goals/${goalId}`);
      alert("목표가 삭제되었습니다.");
      onBack(); // 대시보드로 돌아가기
    } catch (error) {
      console.error("목표 삭제 실패:", error);
      alert(error.response?.data?.error || "목표 삭제에 실패했습니다");
    } finally {
      setDeletingGoal(false);
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
        return "#ffc107"; // 기본값을 진행중 색상으로 변경
    }
  };

  const getStatusText = (status, routineStatus) => {
    if (routineStatus === "auto_failed") return "미완료 (자동)";
    return status || "진행중"; // 기본값을 진행중으로 변경
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
    (r) =>
      r.status === "진행중" || (!r.status && r.routine_status !== "auto_failed")
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
            <button
              onClick={handleDeleteGoal}
              disabled={deletingGoal}
              className="delete-goal-btn"
              title="목표 삭제"
            >
              {deletingGoal ? "삭제중..." : "🗑️ 목표 삭제"}
            </button>
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
                    <div className="routine-header-actions">
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
                      {/* 삭제 버튼 제거 */}
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
    </div>
  );
};

export default GoalDetail;
