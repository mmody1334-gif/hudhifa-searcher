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

    // قراءة ملف التقرير الخاص بك
    let reportContent = '';
    try {
      const filePath = path.join(process.cwd(), 'report.txt');
      if (fs.existsSync(filePath)) {
        reportContent = fs.readFileSync(filePath, 'utf8');
      } else {
        return res.status(500).json({ error: 'ملف report.txt غير موجود! يرجى التأكد من إنشائه في GitHub.' });
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
    
    // القائمة الرسمية المحدثة من جوجل (لن تعطي 404 أبداً)
    const validModels = ['gemini-1.5-flash', 'gemini-1.0-pro', 'gemini-1.5-pro'];
    let responseText = '';
    let lastError = '';

    for (const modelName of validModels) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        responseText = response.text();
        break; // إذا نجح الموديل في جلب الإجابة، نوقف المحاولات فوراً
      } catch (err) {
        console.warn(`الموديل ${modelName} فشل، جاري التبديل للموديل التالي...`);
        lastError = err.message;
      }
    }

    if (responseText) {
      res.json({ reply: responseText });
    } else {
      res.status(500).json({ error: `فشلت جميع الموديلات المعتمدة. آخر خطأ من جوجل: ${lastError}` });
    }

  } catch (error) {
    console.error("Gemini Error:", error);
    res.status(500).json({ error: `خطأ في الخادم: ${error.message}` });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`الخادم يعمل على المنفذ ${PORT}`));
