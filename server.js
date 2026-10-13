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

// تعليمات النظام (مفصولة عن التقرير لتوجيه الذكاء الاصطناعي بذكاء)
const SYSTEM_PROMPT = `أنت المساعد الذكي الرسمي لمدرسة حذيفة بن محصن (5-12).
مهمتك الأساسية هي الإجابة عن أسئلة الزائرين بناءً على "تقرير التقويم الذاتي" الذي سيقدمه لك المستخدم.

قواعد هامة جداً للبحث والاستنتاج:
1. التقرير مليء بالجداول والبيانات المتداخلة، ابحث بدقة واربط بين الصفوف والأعمدة (مثال: اربط اسم المعلم بمادته، أو اربط الصف بنسب النجاح الخاصة به).
2. افهم مرادفات الكلمات (إذا سأل عن "عدد الطلاب" ابحث عن "إجمالي الطلبة"، وهكذا).
3. أجب حصراً من المعلومات المرفقة في التقرير، ولا تستخدم معلومات من خارجه.
4. إذا سأل الزائر عن معلومة غير موجودة تماماً في التقرير حتى بعد البحث العميق، قل بلطف: "عذراً، هذه المعلومة غير متوفرة في تقرير التقويم الذاتي الحالي للمدرسة."
5. أجب بالعربية الفصحى المبسطة، واستخدم النقاط والجداول لتنسيق إجابتك بشكل مريح للعين.`;

// قراءة التقرير
function loadReport() {
  try {
    return fs.readFileSync(REPORT_PATH, "utf8");
  } catch (err) {
    console.error("خطأ في قراءة ملف التقرير:", err);
    return "لا يوجد تقرير مرفق.";
  }
}
// نقطة اتصال جديدة لقراءة التقرير مجاناً بدون الذكاء الاصطناعي
app.get("/api/report", (req, res) => {
  res.send(loadReport());
});
app.post("/api/ask", async (req, res) => {
  const question = (req.body && req.body.question || "").toString().trim();
  if (!question) return res.status(400).json({ error: "اكتب سؤالك أولاً." });
  if (question.length > 1000) return res.status(400).json({ error: "السؤال طويل جداً." });

  // سحب محتوى التقرير الحي
  const reportContent = loadReport();

  try {
    const completion = await client.chat.completions.create({
      model: MODEL,
      temperature: 0.3, // 0.3 ممتازة لتعطيه مرونة في فهم السؤال دون التأليف من خارج التقرير
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        // وضع التقرير كجزء من سياق المحادثة يجعله يركز في البيانات بشكل أفضل بكثير
        { role: "user", content: `إليك نص "تقرير التقويم الذاتي" الخاص بالمدرسة:\n\n${reportContent}\n\n================\nبناءً على التقرير السابق فقط، أجب عن هذا السؤال:\n${question}` }
      ],
    });
    res.json({ answer: completion.choices[0].message.content });
  } catch (err) {
    console.error("OpenAI Error:", err);
    res.status(500).json({ error: "تعذّر الحصول على إجابة الآن. حاول مرة أخرى بعد قليل." });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on port " + PORT));
