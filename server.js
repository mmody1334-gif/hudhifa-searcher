const express = require("express");
const fs = require("fs");
const path = require("path");
const OpenAI = require("openai");

const app = express();
app.use(express.json({ limit: "20kb" }));
app.use(express.static(path.join(__dirname, "public")));

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const REPORT_PATH = path.join(__dirname, "report.txt");

const SYSTEM_PROMPT = `أنت المساعد الذكي الرسمي لمدرسة حذيفة بن محصن (5-12).
مهمتك الوحيدة الإجابة عن أسئلة الزائرين اعتماداً على "تقرير التقويم الذاتي" المرفق أدناه.

القواعد الصارمة:
1. أجب حصراً من نص التقرير. لا تؤلف ولا تخمّن ولا تستخدم معلومات من خارجه.
2. إذا لم تجد الإجابة في التقرير، قل بوضوح: "هذه المعلومة غير موجودة في التقرير."
3. أجب بالعربية الفصحى المبسطة، وبإيجاز ودقة.
4. استخدم نقاطاً عند وجود عدة عناصر، وجدول Markdown عند عرض أرقام أو مقارنات.
5. اذكر الأرقام والنسب كما وردت تماماً، وأشر إلى اسم القسم أو المعيار إن أمكن.
6. إذا كان السؤال لا علاقة له بالمدرسة أو التقرير، اعتذر بلطف ووجّه الزائر لسؤال متعلق بالتقرير.

===== نص التقرير =====
`;

// قراءة التقرير عند كل طلب، فيظهر أي تعديل على report.txt دون إعادة برمجة
function loadReport() {
  return fs.readFileSync(REPORT_PATH, "utf8");
}

app.post("/api/ask", async (req, res) => {
  const question = (req.body && req.body.question || "").toString().trim();
  if (!question) return res.status(400).json({ error: "اكتب سؤالك أولاً." });
  if (question.length > 1000) return res.status(400).json({ error: "السؤال طويل جداً." });

  try {
    const completion = await client.chat.completions.create({
      model: MODEL,
      temperature: 0.1,
      messages: [
        { role: "system", content: SYSTEM_PROMPT + loadReport() },
        { role: "user", content: question },
      ],
    });
    res.json({ answer: completion.choices[0].message.content });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "تعذّر الحصول على إجابة الآن. حاول مرة أخرى بعد قليل." });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on port " + PORT));
