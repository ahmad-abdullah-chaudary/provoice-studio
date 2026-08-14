ProVoice Studio – UI/UX Design Document

Version: 1.0
Design Language: Minimalism × Soft Neobrutalism
Theme: ☀️ Light Theme Only
Platform: Desktop (Windows, macOS, Linux)

1. Design Vision
Philosophy

ProVoice Studio is not a typical AI tool.

It is a professional creative desktop application built for creators who generate voiceovers every day.

The UI should feel like a combination of:

Apple Design
Linear
Raycast
Arc Browser
Notion (Light)
Vercel
Framer
Figma

The experience should communicate:

Fast.
Premium.
Professional.
Minimal.
Focused.

2. Design Principles
Minimalism First

Every element must serve a purpose.

No decorative graphics.

No unnecessary gradients.

No unnecessary animations.

No visual clutter.

Whitespace is a feature.

Focus First

The user should immediately know:

What project is open
Which voice is selected
What script is loaded
Whether generation is running
Where the exported audio is saved
Content Before UI

The interface should never overpower the user's work.

The script is always the most important element.

Professional Over Playful

Avoid:

Cartoon illustrations
Bright rainbow colors
Glassmorphism
Heavy gradients
Neon effects

Use:

Clean surfaces
Bold typography
Strong hierarchy
Simple shapes
Consistency

One spacing system.

One border radius system.

One icon style.

One typography scale.

One interaction style.

3. Theme
Light Theme Only

There is no dark mode.

Reason:

Better readability
Cleaner appearance
Better for long writing sessions
Consistent branding
Easier color consistency
Better print/export previews
4. Color System
Background
#FAFAFA
Secondary Background
#F5F5F5
Surface
#FFFFFF
Surface Hover
#F8F8F8
Borders
#E5E5E5
Divider
#EEEEEE
Primary Text
#111111
Secondary Text
#555555
Muted Text
#888888
Accent Color

Choose one brand accent.

Example:

#2563EB

Blue

OR

#10B981

Emerald

Never use multiple accent colors in the default theme.

Semantic Colors

Success

#22C55E

Warning

#F59E0B

Danger

#EF4444

Information

#3B82F6
5. Typography

Primary Font

Geist

Fallback

Inter

Code Font

JetBrains Mono

Scale

Hero

48px

Page Title

36px

Section

28px

Card Title

22px

Heading

20px

Body

16px

Small

14px

Caption

12px

Font Weight

Regular

Medium

SemiBold

Bold

Avoid ExtraBold.

6. Layout System

Maximum Width

1600px

Sidebar

280px

Inspector

340px

Top Navigation

72px

Content

Fluid

7. Grid

8-point spacing system

Allowed values

4

8

12

16

20

24

32

40

48

64

80

Never use arbitrary spacing.

8. Border Radius

Buttons

14px

Cards

16px

Inputs

12px

Dialogs

20px

Badges

999px

9. Shadows

Cards

0 4px 12px rgba(0,0,0,.06)

Dialogs

0 20px 60px rgba(0,0,0,.12)

Dropdown

0 12px 24px rgba(0,0,0,.08)
10. Soft Neobrutalism

Use sparingly.

Only on:

Primary Buttons

Selected Cards

Dialogs

Active Navigation

Primary Button

Background

Accent Color

Border

2px Black

Shadow

6px 6px 0 #111111

Hover

Move Up

translateY(-2px)

Pressed

Shadow disappears

Feels physical.

11. Navigation

Sidebar

Contains

Dashboard
Projects
Generate
Voice Library
Queue
History
Exports
Settings

Bottom Section

CPU Usage

Memory Usage

Current Voice

Version

12. Dashboard

Displays

Recent Projects

Quick Generate

Recent Exports

Generation Queue

Performance Stats

Storage Usage

Recent Activity

13. Script Editor

The largest area of the application.

Features

Auto Save
Line Numbers
Word Count
Character Count
Estimated Duration
Zoom
Find
Replace
Undo
Redo
14. Voice Library

Each voice displayed as a clean card.

Contains

Voice Name

Preview

Description

Recommended Use

Speaking Style

Language

Generation Speed

Quality Rating

15. Queue Panel

Displays

Current Job

Waiting Jobs

Completed Jobs

Progress

Estimated Time

Pause

Resume

Cancel

Retry

16. Audio Controls

Organized into collapsible sections.

Generation

Voice
Speed
Pitch
Volume

Timing

Sentence Pause
Paragraph Pause
Silence Trim

Processing

Normalize
Compressor
EQ
Limiter

Export

Format
Bitrate
Sample Rate
17. Cards

White background

Rounded corners

Thin border

Soft shadow

Large padding

No gradients

18. Inputs

Large

Clean

Rounded

Visible focus ring

Simple placeholder

No unnecessary icons

19. Icons

Lucide Icons

2px stroke

Outlined only

No filled icons

20. Motion

Duration

150–250ms

Use only:

Fade
Slide
Scale
Progress

Avoid:

Bounce
Elastic
Flash
Rotation
21. Empty States

Example

No projects yet.

Create your first voice generation project.

[ New Project ]

Every empty page should clearly guide the user.

22. Notifications

Toast

Bottom Right

Auto dismiss

Clean white background

Colored left border

23. Dialogs

Rounded

Centered

Minimal

Large action buttons

No excessive text

24. Accessibility
WCAG AA contrast
Keyboard navigation
Screen reader support
Visible focus indicators
Minimum touch target: 44×44 px
Resizable UI
High DPI support
25. Design Tokens
Radius
sm = 8px
md = 12px
lg = 16px
xl = 20px
full = 999px
Spacing
xs = 4
sm = 8
md = 16
lg = 24
xl = 32
2xl = 48
3xl = 64
Shadows
card
dialog
dropdown
button
Colors
background
surface
surfaceHover
border
primary
secondary
muted
accent
success
warning
danger
info
26. Overall Experience

When a user launches ProVoice Studio, they should immediately feel they're using a premium creative application—not a developer tool or an AI demo.

The interface should be calm, spacious, and distraction-free, allowing creators to focus on writing, generating, and refining narration. Every interaction should feel intentional, responsive, and tactile, with soft neobrutalist accents reserved for primary actions to provide visual confidence without overwhelming the minimalist aesthetic.

Design Goal:

"The simplest, most beautiful, and most professional offline AI voice generation software ever built."