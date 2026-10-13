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

    // قراءة ملف التقرير من جهازك
    let reportContent = '';
    const filePath = path.join(process.cwd(), 'report.txt');
    if (fs.existsSync(filePath)) {
      reportContent = fs.readFileSync(filePath, 'utf8');
    } else {
      return res.status(500).json({ error: 'ملف report.txt غير موجود!' });
    }

    const SYSTEM_PROMPT = `أنت المساعد الذكي لمدرسة حذيفة بن محصن.
إليك النص الكامل لتقرير المدرسة:
----------------------
${reportContent}
----------------------
أجب على أسئلة المستخدم بدقة متناهية بناءً على التقرير فقط. ونسق الإجابة بشكل واضح.`;

    // نستخدم الموديل السريع والمستقر
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const prompt = `${SYSTEM_PROMPT}\n\nسؤال المستخدم: ${message}`;
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    
    res.json({ reply: response.text() });

  } catch (error) {
    console.error("API Error:", error.message);
    
    // خطة الإنقاذ: لو سيرفر جوجل هنج، السيرفر بتاعك هيبحث في الملف ويجاوبك فوراً
    try {
        const filePath = path.join(process.cwd(), 'report.txt');
        const content = fs.readFileSync(filePath, 'utf8');
        
        // استخراج الكلمات المهمة من سؤالك والبحث عنها في التقرير
        const keywords = req.body.message.split(' ').filter(w => w.length > 3);
        const lines = content.split('\n');
        let foundLines = [];
        
        for (const line of lines) {
            if (keywords.some(k => line.includes(k))) {
                foundLines.push(line.trim());
            }
        }
        
        if (foundLines.length > 0) {
            // تصفية السطور المكررة وعرض أهم 5 سطور
            const uniqueLines = [...new Set(foundLines)].slice(0, 5);
            const fallbackReply = `⚠️ **سيرفرات الذكاء الاصطناعي عليها ضغط مؤقت، لكن بحثت لك في التقرير واستخرجت التالي:**\n\n` 
                                  + uniqueLines.map(l => `- ${l}`).join('\n\n');
            return res.json({ reply: fallbackReply });
        } else {
            return res.json({ reply: `⚠️ **السيرفر مشغول حالياً ولا يوجد تطابق مباشر لكلماتك في التقرير.**\nبرجاء الانتظار 10 ثوانٍ وإعادة المحاولة.` });
        }
    } catch(fallbackErr) {
        res.status(500).json({ error: `حدث خطأ غير متوقع: ${error.message}` });
    }
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
