
# YouTube to 10 Shorts — MVP

## Overview
A web app where users paste a YouTube URL and AI automatically identifies the 10 best moments to turn into short-form content, complete with timestamps, titles, hook scripts, and descriptions.

## Pages & Features

### 1. Landing Page
- Clean hero section explaining the tool: "Turn any YouTube video into 10 viral shorts"
- Call-to-action to sign up or paste a URL
- Simple, modern design

### 2. Authentication (Sign Up / Login)
- Email + password authentication via Supabase
- User accounts to save past conversions

### 3. Dashboard
- List of past video analyses (history)
- "New Analysis" button to start a new conversion
- Each history item shows video thumbnail, title, and date

### 4. Analysis Page (Core Feature)
- **Input**: Paste a YouTube URL
- **Processing**: 
  - Extract the video transcript/captions from YouTube
  - Send transcript to AI (Lovable AI) to identify the 10 best moments
- **Output — 10 Short Cards**, each showing:
  - Start & end timestamps (e.g., 2:34 – 3:12)
  - Suggested short title (catchy, platform-ready)
  - Hook line (the first sentence to grab attention)
  - Brief description of why this moment works as a short
  - Estimated duration
- Users can copy all results or individual cards

### 5. Backend
- Supabase database to store users, videos, and generated shorts
- Edge function to fetch YouTube transcript
- Edge function using Lovable AI to analyze transcript and identify top 10 moments
- Row-level security so users only see their own data
