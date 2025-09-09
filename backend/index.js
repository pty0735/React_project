import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// 미들웨어
app.use(cors());
app.use(bodyParser.json());

// MySQL 연결
const db = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: "+09:00", // 한국 시간 설정
});

// 한국 시간 기준 날짜 함수들
const getKoreanDate = (date = new Date()) => {
  const koreaTime = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return koreaTime.toISOString().split("T")[0];
};

const getKoreanToday = () => {
  return getKoreanDate();
};

// JWT 인증 미들웨어
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "액세스 토큰이 필요합니다" });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: "유효하지 않은 토큰입니다" });
    }
    req.user = user;
    next();
  });
};

// Gemini AI API 호출 함수
async function generateRoutineWithGemini(
  goal,
  category,
  targetDate,
  userInfo,
  totalDays
) {
  const prompt = `
  사용자 정보:
  - 목표: ${goal}
  - 카테고리: ${category}
  - 목표 달성 날짜: ${targetDate}
  - 사용자 나이: ${userInfo.age}세
  - 총 계획 기간: ${totalDays}일
  
  위 정보를 바탕으로 ${totalDays}일간의 실용적이고 달성 가능한 일일 루틴을 자세하게 생성해주세요.
  그리고 **과 ##을 사용하지 마세요.
  다음 형식으로 응답해주세요:
  
  제목: [목표에 맞는 루틴 제목]
  
  일일 계획:
  1. x일차: [구체적인 활동] (예상 소요시간: X분)
  ...
  ${totalDays}. ${totalDays}일차: [구체적인 활동] (예상 소요시간: X분)
  
  추가 조언:
  [목표 달성을 위한 실용적인 조언]
  `;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
        }),
      }
    );

    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
  } catch (error) {
    console.error("Gemini API 오류:", error);
    throw new Error("AI 루틴 생성에 실패했습니다");
  }
}

// AI 루틴 텍스트를 파싱하여 개별 루틴으로 변환하는 함수 (한국 시간 기준)
function parseAIRoutineToDaily(aiRoutine, goalId, targetDate) {
  const routines = [];

  console.log("원본 AI 루틴:", aiRoutine);

  // 한국 시간 기준 오늘 날짜
  const today = getKoreanToday();
  const target = targetDate;

  // 총 일수 계산 (오늘부터 목표일까지)
  const todayDate = new Date(today);
  const targetDateObj = new Date(target);
  const totalDays =
    Math.ceil((targetDateObj - todayDate) / (1000 * 60 * 60 * 24)) + 1;

  console.log(`한국 시간 기준 오늘: ${today}`);
  console.log(`목표일: ${target}`);
  console.log(`총 ${totalDays}일간의 루틴을 생성합니다.`);

  // 각 일차별 루틴 추출
  for (let day = 1; day <= totalDays; day++) {
    // 더 유연한 정규식 패턴 사용
    const patterns = [
      new RegExp(
        `${day}\\. ${day}일차:\\s*([^(\\n]+)\\(예상 소요시간:\\s*(\\d+)분\\)`,
        "i"
      ),
      new RegExp(
        `${day}일차:\\s*([^(\\n]+)\\(예상 소요시간:\\s*(\\d+)분\\)`,
        "i"
      ),
      new RegExp(
        `${day}\\. \\s*([^(\\n]+)\\(예상 소요시간:\\s*(\\d+)분\\)`,
        "i"
      ),
      new RegExp(`${day}\\. ${day}일차:\\s*([^(\\n]+)\\((\\d+)분\\)`, "i"),
    ];

    let match = null;
    for (const pattern of patterns) {
      match = aiRoutine.match(pattern);
      if (match) break;
    }

    if (match) {
      const activity = match[1].trim();
      const estimatedDuration = parseInt(match[2]);

      // 각 일차에 해당하는 날짜 계산 (한국 시간 기준)
      const routineDate = new Date(todayDate);
      routineDate.setDate(todayDate.getDate() + (day - 1));

      const routine = {
        goal_id: goalId,
        date: routineDate.toISOString().split("T")[0],
        activity: activity,
        estimated_duration: estimatedDuration,
      };

      console.log(`${day}일차 파싱 결과:`, routine);
      routines.push(routine);
    } else {
      console.log(`${day}일차 파싱 실패, 패턴을 찾을 수 없습니다`);

      // 패턴을 찾지 못했을 때 기본 루틴 생성
      const routineDate = new Date(todayDate);
      routineDate.setDate(todayDate.getDate() + (day - 1));

      const routine = {
        goal_id: goalId,
        date: routineDate.toISOString().split("T")[0],
        activity: `${day}일차 활동 (상세 계획 필요)`,
        estimated_duration: 30, // 기본값
      };

      routines.push(routine);
    }
  }

  console.log("최종 파싱된 루틴들:", routines);
  return routines;
}

// 회원가입
app.post("/api/auth/register", async (req, res) => {
  try {
    const { email, password, name, age } = req.body;

    // 이메일 중복 검사
    const [existingUser] = await db.execute(
      "SELECT id FROM users WHERE email = ?",
      [email]
    );
    if (existingUser.length > 0) {
      return res.status(400).json({ error: "이미 존재하는 이메일입니다" });
    }

    // 비밀번호 해시화
    const hashedPassword = await bcrypt.hash(password, 10);

    // 사용자 생성
    const [result] = await db.execute(
      "INSERT INTO users (email, password, name, age) VALUES (?, ?, ?, ?)",
      [email, hashedPassword, name, age]
    );

    res
      .status(201)
      .json({ message: "회원가입이 완료되었습니다", userId: result.insertId });
  } catch (error) {
    console.error("회원가입 오류:", error);
    res.status(500).json({ error: "서버 오류가 발생했습니다" });
  }
});

// 로그인
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // 사용자 찾기
    const [users] = await db.execute("SELECT * FROM users WHERE email = ?", [
      email,
    ]);
    if (users.length === 0) {
      return res
        .status(401)
        .json({ error: "잘못된 이메일 또는 비밀번호입니다" });
    }

    const user = users[0];

    // 비밀번호 확인
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res
        .status(401)
        .json({ error: "잘못된 이메일 또는 비밀번호입니다" });
    }

    // JWT 토큰 생성
    const token = jwt.sign(
      { userId: user.id, email: user.email, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        age: user.age,
      },
    });
  } catch (error) {
    console.error("로그인 오류:", error);
    res.status(500).json({ error: "서버 오류가 발생했습니다" });
  }
});
// 사용자의 목표 목록 조회 (상태별 분류) - 수정된 분류 로직
app.get("/api/goals", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { status } = req.query; // 'completed', 'failed', 'in-progress'

    // 모든 목표와 관련 루틴 정보 조회
    const [goals] = await db.execute(
      `
      SELECT g.*, 
        COUNT(r.id) as total_routines,
        COUNT(CASE WHEN p.status = '완료' THEN 1 END) as completed_routines,
        COUNT(CASE WHEN p.status = '미완료' THEN 1 END) as failed_routines,
        COUNT(CASE WHEN r.date < DATE(CONVERT_TZ(NOW(), '+00:00', '+09:00')) AND p.status != '완료' AND p.status != '미완료' THEN 1 END) as auto_failed_routines,
        COUNT(CASE WHEN p.status = '진행중' THEN 1 END) as in_progress_routines
      FROM goals g
      LEFT JOIN routines r ON g.id = r.goal_id
      LEFT JOIN progress p ON r.id = p.routine_id
      WHERE g.user_id = ?
      GROUP BY g.id
      ORDER BY g.created_at DESC
    `,
      [userId]
    );

    // 목표 상태 분류 - 새로운 로직
    const categorizedGoals = {
      inProgress: [],
      completed: [],
      failed: [],
    };

    goals.forEach((goal) => {
      const totalRoutines = goal.total_routines || 0;
      const completedRoutines = goal.completed_routines || 0;
      const failedRoutines = goal.failed_routines || 0;
      const autoFailedRoutines = goal.auto_failed_routines || 0;
      const totalFailedRoutines = failedRoutines + autoFailedRoutines;

      console.log(
        `목표 ID ${goal.id}: 전체 ${totalRoutines}, 완료 ${completedRoutines}, 실패 ${failedRoutines}, 자동실패 ${autoFailedRoutines}, 총실패 ${totalFailedRoutines}`
      );

      if (totalRoutines === 0) {
        // 루틴이 없으면 진행중
        categorizedGoals.inProgress.push(goal);
      } else if (completedRoutines === totalRoutines) {
        // 모든 루틴 완료
        categorizedGoals.completed.push(goal);
      } else if (
        totalFailedRoutines === totalRoutines ||
        totalFailedRoutines >= 4
      ) {
        // 모든 루틴이 미완료이거나, 미완료 루틴이 4개 이상이면 실패한 목표
        categorizedGoals.failed.push(goal);
      } else {
        // 나머지는 모두 진행중
        categorizedGoals.inProgress.push(goal);
      }
    });

    if (status) {
      res.json(
        categorizedGoals[status === "in-progress" ? "inProgress" : status] || []
      );
    } else {
      res.json(categorizedGoals);
    }
  } catch (error) {
    console.error("목표 조회 오류:", error);
    res.status(500).json({ error: "목표 조회에 실패했습니다" });
  }
});

// Progress 테이블 초기화 시 디폴트 값을 '진행중'으로 변경
app.post("/api/goals", authenticateToken, async (req, res) => {
  try {
    const { category, description, target_date } = req.body;
    const userId = req.user.userId;

    // 사용자 정보 가져오기
    const [users] = await db.execute("SELECT age FROM users WHERE id = ?", [
      userId,
    ]);
    const userInfo = users[0];

    // 목표 저장
    const [goalResult] = await db.execute(
      "INSERT INTO goals (user_id, category, description, target_date) VALUES (?, ?, ?, ?)",
      [userId, category, description, target_date]
    );

    const goalId = goalResult.insertId;

    // 한국 시간 기준 오늘부터 목표일까지 총 일수 계산
    const today = getKoreanToday();
    const todayDate = new Date(today);
    const targetDateObj = new Date(target_date);
    const totalDays =
      Math.ceil((targetDateObj - todayDate) / (1000 * 60 * 60 * 24)) + 1;

    // AI로 루틴 생성
    const aiRoutine = await generateRoutineWithGemini(
      description,
      category,
      target_date,
      userInfo,
      totalDays
    );

    // AI 루틴을 개별 일일 루틴으로 파싱하여 데이터베이스에 저장
    const parsedRoutines = parseAIRoutineToDaily(
      aiRoutine,
      goalId,
      target_date
    );

    // 루틴들을 데이터베이스에 저장하고 progress 테이블도 초기화
    for (const routine of parsedRoutines) {
      // 루틴 저장
      const [routineResult] = await db.execute(
        "INSERT INTO routines (goal_id, date, activity, estimated_duration) VALUES (?, ?, ?, ?)",
        [
          routine.goal_id,
          routine.date,
          routine.activity,
          routine.estimated_duration,
        ]
      );

      // progress 테이블에 초기 상태로 저장 - 디폴트를 '진행중'으로 변경
      await db.execute(
        "INSERT INTO progress (routine_id, status) VALUES (?, ?)",
        [routineResult.insertId, "진행중"]
      );
    }

    res.json({
      goalId,
      message: "목표가 생성되었습니다",
      aiRoutine,
      routinesCreated: parsedRoutines.length,
      totalDays: totalDays,
    });
  } catch (error) {
    console.error("목표 생성 오류:", error);
    res.status(500).json({ error: "목표 생성에 실패했습니다" });
  }
});
// 특정 목표의 상세 정보 및 루틴 조회
app.get("/api/goals/:goalId", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { goalId } = req.params;

    // 목표 정보 조회
    const [goals] = await db.execute(
      "SELECT * FROM goals WHERE id = ? AND user_id = ?",
      [goalId, userId]
    );

    if (goals.length === 0) {
      return res.status(404).json({ error: "목표를 찾을 수 없습니다" });
    }

    const goal = goals[0];
    const koreanToday = getKoreanToday();

    // 루틴과 진행상황 조회 (한국 시간 기준)
    const [routines] = await db.execute(
      `
      SELECT r.*, p.status, p.actual_time_spent, p.feedback, p.completed_at,
        CASE 
          WHEN r.date = ? THEN 'today'
          WHEN r.date < ? AND p.status = '미완료' THEN 'auto_failed'
          WHEN r.date > ? THEN 'future'
          ELSE 'normal'
        END as routine_status
      FROM routines r
      LEFT JOIN progress p ON r.id = p.routine_id
      WHERE r.goal_id = ?
      ORDER BY r.date ASC
    `,
      [koreanToday, koreanToday, koreanToday, goalId]
    );

    res.json({
      goal,
      routines,
    });
  } catch (error) {
    console.error("목표 상세 조회 오류:", error);
    res.status(500).json({ error: "목표 상세 조회에 실패했습니다" });
  }
});

// 루틴 상태 업데이트 (한국 시간 기준)
app.put(
  "/api/routines/:routineId/progress",
  authenticateToken,
  async (req, res) => {
    try {
      const { routineId } = req.params;
      const { status, actualTimeSpent, feedback } = req.body;
      const userId = req.user.userId;

      // 루틴이 사용자의 것인지 확인
      const [routineCheck] = await db.execute(
        `
      SELECT r.*, g.user_id, r.date
      FROM routines r
      JOIN goals g ON r.goal_id = g.id
      WHERE r.id = ? AND g.user_id = ?
    `,
        [routineId, userId]
      );

      if (routineCheck.length === 0) {
        return res.status(404).json({ error: "루틴을 찾을 수 없습니다" });
      }

      const routine = routineCheck[0];
      const koreanToday = getKoreanToday();

      console.log(`루틴 날짜: ${routine.date}, 한국 오늘 날짜: ${koreanToday}`);

      // progress 테이블 업데이트 (이미 존재한다고 가정)
      await db.execute(
        "UPDATE progress SET status = ?, actual_time_spent = ?, feedback = ?, completed_at = ? WHERE routine_id = ?",
        [
          status,
          actualTimeSpent,
          feedback,
          status === "완료" ? new Date() : null,
          routineId,
        ]
      );

      res.json({
        message: "루틴 상태가 업데이트되었습니다",
        routineDate: routine.date,
        koreanToday: koreanToday,
      });
    } catch (error) {
      console.error("루틴 상태 업데이트 오류:", error);
      res.status(500).json({ error: "루틴 상태 업데이트에 실패했습니다" });
    }
  }
);

// 루틴 삭제
app.delete("/api/routines/:routineId", authenticateToken, async (req, res) => {
  try {
    const { routineId } = req.params;
    const userId = req.user.userId;

    // 루틴이 사용자의 것인지 확인
    const [routineCheck] = await db.execute(
      `
      SELECT r.*, g.user_id
      FROM routines r
      JOIN goals g ON r.goal_id = g.id
      WHERE r.id = ? AND g.user_id = ?
    `,
      [routineId, userId]
    );

    if (routineCheck.length === 0) {
      return res.status(404).json({ error: "루틴을 찾을 수 없습니다" });
    }

    // progress 레코드 삭제
    await db.execute("DELETE FROM progress WHERE routine_id = ?", [routineId]);

    // 루틴 삭제
    await db.execute("DELETE FROM routines WHERE id = ?", [routineId]);

    res.json({ message: "루틴이 삭제되었습니다" });
  } catch (error) {
    console.error("루틴 삭제 오류:", error);
    res.status(500).json({ error: "루틴 삭제에 실패했습니다" });
  }
});

// 사용자 정보 조회
app.get("/api/user/profile", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    const [users] = await db.execute(
      "SELECT id, email, name, age, created_at FROM users WHERE id = ?",
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: "사용자를 찾을 수 없습니다" });
    }

    res.json(users[0]);
  } catch (error) {
    console.error("프로필 조회 오류:", error);
    res.status(500).json({ error: "프로필 조회에 실패했습니다" });
  }
});

// 루틴 생성 API 추가
app.post("/api/goals/:goalId/routines", authenticateToken, async (req, res) => {
  try {
    const { goalId } = req.params;
    const { routines } = req.body; // routines는 배열 형태
    const userId = req.user.userId;

    // 목표가 사용자의 것인지 확인
    const [goalCheck] = await db.execute(
      "SELECT id FROM goals WHERE id = ? AND user_id = ?",
      [goalId, userId]
    );

    if (goalCheck.length === 0) {
      return res.status(404).json({ error: "목표를 찾을 수 없습니다" });
    }

    // 기존 루틴 삭제 (재생성의 경우)
    await db.execute("DELETE FROM routines WHERE goal_id = ?", [goalId]);

    // 새 루틴들 생성
    const insertPromises = routines.map((routine) => {
      return db.execute(
        "INSERT INTO routines (goal_id, title, description, date, estimated_time) VALUES (?, ?, ?, ?, ?)",
        [
          goalId,
          routine.title,
          routine.description,
          routine.date,
          routine.estimated_time,
        ]
      );
    });

    await Promise.all(insertPromises);

    res.json({ message: "루틴이 성공적으로 생성되었습니다" });
  } catch (error) {
    console.error("루틴 생성 오류:", error);
    res.status(500).json({ error: "루틴 생성에 실패했습니다" });
  }
});

// 목표 삭제
app.delete("/api/goals/:goalId", authenticateToken, async (req, res) => {
  try {
    const { goalId } = req.params;
    const userId = req.user.userId;

    // 목표가 사용자의 것인지 확인
    const [goalCheck] = await db.execute(
      "SELECT id FROM goals WHERE id = ? AND user_id = ?",
      [goalId, userId]
    );

    if (goalCheck.length === 0) {
      return res.status(404).json({ error: "목표를 찾을 수 없습니다" });
    }

    // 관련된 progress 레코드 삭제
    await db.execute(
      `
      DELETE p FROM progress p 
      INNER JOIN routines r ON p.routine_id = r.id 
      WHERE r.goal_id = ?
    `,
      [goalId]
    );

    // 루틴 삭제
    await db.execute("DELETE FROM routines WHERE goal_id = ?", [goalId]);

    // 목표 삭제
    await db.execute("DELETE FROM goals WHERE id = ?", [goalId]);

    res.json({ message: "목표가 삭제되었습니다" });
  } catch (error) {
    console.error("목표 삭제 오류:", error);
    res.status(500).json({ error: "목표 삭제에 실패했습니다" });
  }
});

// 에러 핸들링 미들웨어
app.use((error, req, res, next) => {
  console.error("서버 에러:", error);
  res.status(500).json({ error: "내부 서버 오류가 발생했습니다" });
});

// 404 핸들링
app.use((req, res) => {
  res.status(404).json({ error: "요청하신 경로를 찾을 수 없습니다" });
});

app.listen(PORT, () => {
  console.log(`서버가 포트 ${PORT}에서 실행중입니다`);
});
