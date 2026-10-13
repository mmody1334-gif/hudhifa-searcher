import express from 'express';
import cors from 'cors';
import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';

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
      return res.status(500).json({ error: 'مفتاح GEMINI_API_KEY غير موجود في إعدادات Render.' });
    }

    // قراءة ملف التقرير
    let reportContent = '';
    try {
      const filePath = path.join(process.cwd(), 'report.txt');
      if (fs.existsSync(filePath)) {
        reportContent = fs.readFileSync(filePath, 'utf8');
      } else {
        return res.status(500).json({ error: 'ملف report.txt غير موجود! يرجى إنشاؤه في GitHub ووضع نص التقرير بداخله.' });
      }
    } catch (err) {
      return res.status(500).json({ error: 'حدثت مشكلة في قراءة ملف report.txt' });
    }

    const SYSTEM_PROMPT = `أنت المساعد الذكي لمدرسة حذيفة بن محصن.
إليك النص الكامل حرفياً لتقرير المدرسة:
----------------------
${reportContent}
----------------------
مهمتك: اقرأ هذا التقرير جيداً، وأجب على أسئلة المستخدم بدقة متناهية بناءً على المعلومات الموجودة فيه فقط.
نسق الإجابة بشكل جميل وواضح بجداول ونقاط.`;

    const prompt = `${SYSTEM_PROMPT}\n\nسؤال المستخدم: ${message}`;
    let responseText = '';

    try {
      // المحاولة الأولى: أحدث موديل متاح
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash-latest' });
      const result = await model.generateContent(prompt);
      const response = await result.response;
      responseText = response.text();
    } catch (err1) {
      console.warn("الموديل الأول غير متاح، جاري التحويل للموديل المستقر تلقائياً...");
      // المحاولة الثانية: الموديل المستقر جداً (gemini-pro) المتاح لكل الحسابات بلا استثناء
      const fallbackModel = genAI.getGenerativeModel({ model: 'gemini-pro' });
      const result2 = await fallbackModel.generateContent(prompt);
      const response2 = await result2.response;
      responseText = response2.text();
    }

    res.json({ reply: responseText });

  } catch (error) {
    console.error("Gemini Error:", error);
    res.status(500).json({ 
      error: `الخطأ الحقيقي من جوجل: ${error.message}` 
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`الخادم يعمل على المنفذ ${PORT}`));
