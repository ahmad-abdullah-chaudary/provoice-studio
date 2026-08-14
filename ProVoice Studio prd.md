ProVoice Studio

Version: 1.0

Status: Planning

License: MIT

Engine: Kokoro TTS

Platform:

Windows
Linux
macOS
Vision

Create the most polished, professional, CPU-optimized offline desktop application for generating studio-quality AI narration using Kokoro TTS.

The application should feel like OBS Studio, VS Code, or DaVinci Resolve—professional, fast, and reliable.

Goals
Primary Goals

✅ 100% Offline

✅ CPU Optimized

✅ Studio Quality Output

✅ Modern Desktop UI

✅ Open Source

✅ Unlimited Voice Generation

✅ Batch Processing

✅ Stable Architecture

✅ Future Ready

Non Goals

No cloud API

No subscriptions

No internet required

No user accounts

No telemetry

No advertisements

No vendor lock-in

Target Users

YouTubers

Movie Explainers

Documentary Creators

Audiobook Creators

Teachers

Students

Businesses

Content Agencies

Podcasters

Developers

Tech Stack
Desktop

Next.js 15

TypeScript

Tailwind CSS

Tauri

shadcn/ui

Zustand

TanStack Query

Framer Motion

React Hook Form

Zod

Backend

Python

FastAPI

Kokoro TTS

FFmpeg

NumPy

SoundFile

Librosa

ONNX Runtime

Folder Structure
provoice-studio/

apps/
    desktop/

backend/

core/

engine/

voices/

projects/

exports/

cache/

logs/

settings/

temp/

plugins/      (Reserved)

docs/

tests/

scripts/
Software Architecture
UI Layer
      │
      ▼
Application Layer
      │
      ▼
Project Manager
      │
      ▼
Generation Manager
      │
      ▼
Kokoro Engine
      │
      ▼
Audio Processing
      │
      ▼
Export Manager

Every module should have a single responsibility.

Core Modules
Dashboard

Displays

Recent Projects

Recent Exports

Quick Generate

Recent Voices

Statistics

CPU Usage

Memory Usage

Generation Queue

Project Manager

Each project stores

Script

Voice

Settings

Audio

History

Notes

Pronunciation Rules

Export Presets

Auto Save

Script Editor

Features

Line Numbers

Undo

Redo

Auto Save

Find

Replace

Character Count

Word Count

Estimated Duration

Syntax Highlighting (optional SSML)

Zoom

Dark Mode

Fullscreen

Voice Library

Instead of engine selection

Only show voices.

Example

Deep Narrator

Movie Explainer

Storyteller

Calm Male

Documentary

Epic Voice

Dark Voice

News Voice

Warm Voice

Friendly Voice

Every voice should display

Preview

Description

Speaking Style

Language

Quality

CPU Speed

Recommended Use

Voice Settings

Speed

Pitch

Volume

Pause Length

Paragraph Gap

Sentence Gap

Breath Strength (if supported)

Seed

Output Sample Rate

Audio Processing

Automatically process generated speech.

Pipeline

Kokoro

↓

Silence Trim

↓

Noise Gate

↓

Equalizer

↓

Compressor

↓

Limiter

↓

Normalize

↓

Fade

↓

Export
Audio Effects

Equalizer

Compressor

Limiter

Loudness

Normalize

Noise Gate

Silence Removal

Fade In

Fade Out

Bass Boost

Presence Boost

Treble

Batch Generation

Import

txt

md

csv

json

Generate hundreds of files.

Queue system

Pause

Resume

Cancel

Retry

Subtitle Support

Supported

SRT

VTT

ASS

SSA

Automatically convert subtitles into narration.

Pronunciation Dictionary

Global Rules

SQL

↓

Sequel


Project Rules

Hermione

↓

Her-my-oh-nee

Import

Export

JSON Support

Export

Formats

MP3

WAV

FLAC

OGG

Quality

Draft

Standard

Studio

Lossless

History

Every generation

Date

Voice

Settings

Output

Duration

Time Taken

File Size

Queue Manager

Professional queue.

Movie1

Rendering

████████

Movie2

Waiting

Movie3

Paused

Movie4

Completed
Settings

Theme

Language

Cache

CPU Threads

Memory Limit

Auto Save

Default Export Folder

Default Voice

Audio Quality

Logging

Generation Logs

Error Logs

Performance Logs

Crash Logs

Debug Logs

Export Logs

Performance

Use ONNX Runtime optimizations

Lazy loading

Background workers

Streaming generation (where supported)

Memory cleanup

Thread pooling

Caching

Incremental rendering

Robust Error Handling

Invalid model

Corrupted voice

Missing files

Out of memory

Permission denied

Disk full

Export failure

Interrupted generation

Graceful recovery

Security

No telemetry

No internet

Local storage only

Sandboxed desktop app

Signed releases

Input validation

Secure temp files

Testing

Unit Tests

Integration Tests

End-to-End Tests

Performance Tests

Regression Tests

Stress Tests

Accessibility

Keyboard shortcuts

High contrast

Screen reader support

Resizable UI

Scalable fonts

Color-blind friendly indicators