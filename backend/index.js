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
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

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
// Gemini AI API 호출 함수 (수정된 버전)
async function generateRoutineWithGemini(goal, category, targetDate, userInfo) {
  const prompt = `
  사용자 정보:
  - 목표: ${goal}
  - 카테고리: ${category}
  - 목표 달성 날짜: ${targetDate}
  - 사용자 나이: ${userInfo.age}세
  
  위 정보를 바탕으로 실용적이고 달성 가능한 일일 루틴을 자세하게 생성해주세요.
  그리고 **을 사용하지 마세요.
  다음 형식으로 응답해주세요:
  
  제목: [목표에 맞는 루틴 제목]
  
  주간 계획:
  1. 월요일: [구체적인 활동] (예상 소요시간: X분)
  2. 화요일: [구체적인 활동] (예상 소요시간: X분)
  3. 수요일: [구체적인 활동] (예상 소요시간: X분)
  4. 목요일: [구체적인 활동] (예상 소요시간: X분)
  5. 금요일: [구체적인 활동] (예상 소요시간: X분)
  6. 토요일: [구체적인 활동] (예상 소요시간: X분)
  7. 일요일: [구체적인 활동] (예상 소요시간: X분)
  
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

    // HTTP 응답 상태 확인
    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini API HTTP 오류:", response.status, errorText);
      throw new Error(`Gemini API HTTP 오류: ${response.status}`);
    }

    const data = await response.json();

    // 응답 구조 로깅 (디버깅용)
    console.log("Gemini API 응답:", JSON.stringify(data, null, 2));

    // 응답 구조 검증
    if (!data) {
      throw new Error("Gemini API에서 빈 응답을 받았습니다");
    }

    if (
      !data.candidates ||
      !Array.isArray(data.candidates) ||
      data.candidates.length === 0
    ) {
      console.error("candidates 배열이 없거나 비어있습니다:", data);
      throw new Error("Gemini API 응답에서 candidates를 찾을 수 없습니다");
    }

    const candidate = data.candidates[0];
    if (
      !candidate ||
      !candidate.content ||
      !candidate.content.parts ||
      candidate.content.parts.length === 0
    ) {
      console.error("유효하지 않은 candidate 구조:", candidate);
      throw new Error("Gemini API 응답의 content 구조가 유효하지 않습니다");
    }

    const generatedText = candidate.content.parts[0].text;
    if (!generatedText) {
      throw new Error("Gemini API에서 빈 텍스트를 받았습니다");
    }

    return generatedText;
  } catch (error) {
    console.error("Gemini API 오류:", error);

    // API 키 확인 (보안상 일부만 로깅)
    if (!process.env.GEMINI_API_KEY) {
      console.error("GEMINI_API_KEY 환경변수가 설정되지 않았습니다");
      throw new Error("API 키가 설정되지 않았습니다");
    } else {
      console.log(
        "API 키가 설정되어 있습니다 (앞 10자):",
        process.env.GEMINI_API_KEY.substring(0, 10) + "..."
      );
    }

    // 네트워크 오류인지 확인
    if (error.message.includes("fetch")) {
      throw new Error("네트워크 연결 오류가 발생했습니다");
    }

    // 기본 오류 메시지로 대체하거나 재전송
    throw new Error("AI 루틴 생성에 실패했습니다: " + error.message);
  }
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

// 목표 생성 및 AI 루틴 생성
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

    // AI로 루틴 생성
    const aiRoutine = await generateRoutineWithGemini(
      description,
      category,
      target_date,
      userInfo
    );

    res.json({
      goalId,
      message: "목표가 생성되었습니다",
      aiRoutine,
    });
  } catch (error) {
    console.error("목표 생성 오류:", error);
    res.status(500).json({ error: "목표 생성에 실패했습니다" });
  }
});

// 사용자의 목표 목록 조회
app.get("/api/goals", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    const [goals] = await db.execute(
      "SELECT * FROM goals WHERE user_id = ? ORDER BY created_at DESC",
      [userId]
    );

    res.json(goals);
  } catch (error) {
    console.error("목표 조회 오류:", error);
    res.status(500).json({ error: "목표 조회에 실패했습니다" });
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

app.listen(PORT, () => {
  console.log(`서버가 포트 ${PORT}에서 실행중입니다`);
});
