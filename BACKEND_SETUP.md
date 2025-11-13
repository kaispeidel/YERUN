# Backend API Setup for Sign Language Helper

This backend service converts text to sign language videos and extracts text from documents.

## Installation

1. Install Python dependencies:
```bash
pip install -r requirements.txt
```

Or install individually:
```bash
pip install flask flask-cors requests numpy imageio imageio-ffmpeg Pillow pose-format PyPDF2 python-docx
```

2. Make sure you have FFmpeg installed (required for video encoding):
   - Linux: `sudo apt-get install ffmpeg` or `sudo pacman -S ffmpeg`
   - macOS: `brew install ffmpeg`
   - Windows: Download from https://ffmpeg.org/download.html

## Running the Backend

Start the Flask server:
```bash
python backend_api.py
```

The server will run on `http://localhost:5000` by default.

You can change the port by setting the `PORT` environment variable:
```bash
PORT=8000 python backend_api.py
```

## API Endpoints

### Health Check
```
GET /health
```
Returns server status and supported features.

### Extract Text from Document
```
POST /api/extract-text
Content-Type: multipart/form-data

Body: file (PDF, DOCX, or TXT file)
```
Returns extracted text from the document.

### Convert Text to Sign Language Video
```
POST /api/text-to-video
Content-Type: application/json

Body: {
  "text": "Hello world",
  "spoken": "en",
  "signed": "ase",
  "fps": 30
}
```
Returns MP4 video file.

## Frontend Configuration

Make sure your frontend has the backend URL configured. You can set it in a `.env` file:

```
VITE_BACKEND_URL=http://localhost:5000
```

Or the frontend will default to `http://localhost:5000`.

## Troubleshooting

- **FFmpeg not found**: Install FFmpeg system-wide
- **Pose format errors**: Make sure `pose-format` is installed correctly
- **CORS errors**: The backend has CORS enabled, but make sure the frontend URL is allowed
- **Video generation fails**: Check that the pose API is accessible and returning valid data

