# 🐞 Pest Detective Agent

**Pest Detective Agent** is a Machine Learning-powered web application that helps farmers and agricultural professionals detect crop pests and diseases from plant leaf images. The system analyzes uploaded images, predicts the affected disease or pest, and provides treatment recommendations to improve crop health and reduce yield loss.

## 🌟 Features

- 🌿 Detect crop pests and diseases using Machine Learning
- 📸 Upload plant leaf images for analysis
- 🤖 AI-based prediction with confidence score
- 💊 Treatment and prevention recommendations
- 📊 Dashboard with scouting history and analytics
- 📍 Field location tracking
- 👤 Secure user authentication
- 📄 Downloadable scouting reports
- 📱 Responsive design for desktop and mobile

## 🛠️ Tech Stack

### Frontend
- Next.js 16
- React 19
- TypeScript
- Tailwind CSS

### Backend
- Next.js API routes
- PostgreSQL via Drizzle ORM

### Database
- PostgreSQL

## 📂 Project Structure

```
Pest-Detective-Agent/
│
├── frontend/
├── backend/
├── model/
├── dataset/
├── uploads/
├── database/
├── README.md
└── requirements.txt
```

## 🚀 How It Works

1. Register or log in.
2. Upload a crop leaf image.
3. The ML model processes the image.
4. The system predicts the pest or disease.
5. Treatment and prevention recommendations are displayed.
6. Prediction history is saved for future reference.

## 🎯 Objectives

- Enable early detection of crop pests and diseases.
- Reduce crop losses through timely diagnosis.
- Support farmers with AI-driven recommendations.
- Improve agricultural productivity using modern technology.

## 🔮 Future Enhancements

- Real-time camera detection
- Weather-based disease prediction
- GPS-based field monitoring
- Multi-language support
- Mobile application
- Offline prediction support

## � Deployment

### Backend on Render
1. Push this repository to GitHub.
2. Create a new Web Service on Render and connect the repository.
3. Set the build command to `npm install && npm run build`.
4. Set the start command to `npm run start`.
5. Add these environment variables:
   - `NODE_ENV=production`
   - `DATABASE_URL=<your-postgres-url>`
   - `JWT_SECRET=<a-long-random-secret>`
6. Deploy the service and copy the generated Render URL.

### Frontend on Vercel
1. Import the same GitHub repository into Vercel.
2. Set the project root to the Next.js app folder.
3. Add these environment variables:
   - `NEXT_PUBLIC_API_BASE_URL=<your-render-backend-url>`
   - `JWT_SECRET=<same-secret-as-render>`
4. Deploy the project.

### Important note
If you want the frontend and backend fully separated, the frontend should call the Render URL through `NEXT_PUBLIC_API_BASE_URL`. The app is already wired to use that value for API requests.

## �👨‍💻 Contributors

Developed as a Machine Learning and Full Stack project for smart agriculture.

---

⭐ If you find this project useful, consider giving it a star!
