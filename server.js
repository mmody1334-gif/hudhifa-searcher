import express from 'express';
import cors from 'cors';
import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs'; // مكتبة قراءة الملفات

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const apiKey = (process.env.GEMINI_API_KEY || '').trim();
const genAI = new GoogleGenerativeAI(apiKey);

app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'يرجى كتابة السؤال.' });

    if (!apiKey) {
      return res.status(500).json({ error: 'لم يتم العثور على المفتاح GEMINI_API_KEY.' });
    }

    // هنا الخادم بيقرأ ملف report.txt اللي انت حاطط فيه التقرير كامل حرفياً
    let reportContent = '';
    try {
      reportContent = fs.readFileSync('report.txt', 'utf8');
    } catch (err) {
      console.warn("تنبيه: ملف report.txt غير موجود.");
      reportContent = "لا يوجد تقرير مرفق.";
    }

    // تلقين الذكاء الاصطناعي وقراءة الملف
    const SYSTEM_PROMPT = `أنت المساعد الذكي لمدرسة حذيفة بن محصن.
إليك النص الكامل حرفياً لتقرير المدرسة:
----------------------
${reportContent}
----------------------
مهمتك: اقرأ هذا التقرير جيداً، وأجب على أسئلة المستخدم بدقة متناهية بناءً على المعلومات الموجودة فيه فقط.
إذا سألك عن أي تفصيلة، ابحث عنها في النص واستخرجها ونسق الإجابة بشكل جميل وواضح.`;

    // استخدام أحدث وأقوى نموذج مجاني مستقر
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const prompt = `${SYSTEM_PROMPT}\n\nسؤال المستخدم: ${message}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    res.json({ reply: response.text() });

  } catch (error) {
    console.error("Gemini Error:", error);
    res.status(500).json({ 
      error: `حدث خطأ أثناء معالجة السؤال. تأكد من أن مفتاح API صحيح.` 
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`الخادم يعمل على المنفذ ${PORT}`));
