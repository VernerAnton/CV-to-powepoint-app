# CV to PowerPoint Automator

Automate your recruitment workflow with AI-powered CV parsing and PowerPoint generation.

## 🚀 Features

- **PDF Parsing**: Upload a PDF containing multiple LinkedIn CVs
- **AI Extraction**: Uses Google Gemini (Flash or Pro) to extract candidate information
- **Smart Filtering**: Automatically excludes Board Member positions
- **PowerPoint Generation**: Creates professional presentations with customizable layout
- **Error Recovery**: Continues processing even if individual CVs fail
- **Retry Logic**: Automatically retries failed extractions with exponential backoff
- **Client-Side Processing**: All PDF parsing happens locally in your browser

## 🛠️ Tech Stack

- **React 19** + **TypeScript**
- **Vite** for fast builds
- **Google Gemini AI** for CV extraction
- **pdf.js** for client-side PDF parsing
- **pptxgenjs** for PowerPoint generation
- **TailwindCSS** for styling

## 📦 Installation

**Prerequisites:** Node.js 20+

1. Clone the repository:
   ```bash
   git clone https://github.com/VernerAnton/CV-to-powepoint-app.git
   cd CV-to-powepoint-app
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create `.env.local` file:
   ```bash
   echo "VITE_API_KEY=your_gemini_api_key_here" > .env.local
   ```

4. Run the development server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

## 🔑 Getting a Gemini API Key

1. Visit [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the key and add it to `.env.local`

## 🎯 Usage

1. **Select AI Model**: Choose between Gemini Flash (faster) or Pro (more accurate)
2. **Upload PDF**: Select a PDF containing multiple LinkedIn CVs
3. **Generate**: Click "Generate Presentation" and wait for processing
4. **Download**: Your PowerPoint file will download automatically

### Supported CV Format

The app expects CVs to have "Page 1 of" markers to identify individual candidates. LinkedIn PDF exports work perfectly!

## 🌐 Deployment to GitHub Pages

This app is configured for automatic deployment to GitHub Pages.

### Setup

1. Go to your repository settings
2. Navigate to **Pages** section
3. Under "Build and deployment", select **Source: GitHub Actions**
4. Push to the `main` branch to trigger deployment

The app will be available at: `https://yourusername.github.io/CV-to-powepoint-app/`

### Manual Build

```bash
npm run build
```

The built files will be in the `dist/` directory.

## 📐 Layout Configuration

Edit `layout.ts` to customize the PowerPoint layout (all measurements in centimeters):

```typescript
export const layout = {
  education: { x: 1.9, w: 10.02 },
  experience: { x: 12.22, w: 13.15 },
  rows: [
    { y: 1.75, h: 3.3 },
    { y: 5.05, h: 3.3 },
    { y: 8.35, h: 3.3 },
    { y: 11.65, h: 3.3 },
  ],
};
```

## 🔧 Configuration

### AI Model Selection

- **Gemini Flash**: Faster, lower cost, good for most CVs
- **Gemini Pro**: More accurate, better for complex CVs

### Board Member Filtering

The app automatically filters out positions containing "Board Member" from work history. This happens both in the AI prompt and client-side for reliability.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is open source and available under the MIT License.

## 🙏 Acknowledgments

- Built with [Vite](https://vitejs.dev/)
- AI powered by [Google Gemini](https://ai.google.dev/)
- PDF parsing by [pdf.js](https://mozilla.github.io/pdf.js/)
- PowerPoint generation by [PptxGenJS](https://gitbrent.github.io/PptxGenJS/)
