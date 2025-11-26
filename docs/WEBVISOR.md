# Webvisor - Session Recording & Replay

Webvisor is a session recording system that captures user interactions on your website for later replay and analysis. It records DOM changes, mouse movements, clicks, scrolling, form inputs, and page navigation.

## Table of Contents

- [Features](#features)
- [Requirements](#requirements)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Client SDK](#client-sdk)
- [Server API](#server-api)
- [Privacy Controls](#privacy-controls)
- [Data Captured](#data-captured)
- [Architecture](#architecture)

---

## Features

- **DOM Recording** - Captures all DOM mutations using MutationObserver API
- **User Interactions** - Tracks mouse movements, clicks, scrolling, and resizing
- **Form Inputs** - Records input changes with automatic sensitive field masking
- **SPA Support** - Detects page transitions including History API navigation
- **Privacy First** - Built-in masking for passwords, credit cards, and sensitive data
- **Configurable Sampling** - Record only a percentage of sessions to manage volume
- **Auto Cleanup** - 15-day retention period with automatic session purging
- **Server-Side Storage** - Sessions stored on server for reconstruction

---

## Requirements

- **Node.js 22 LTS** or higher
- Modern browser with ES6+ support

---

## Installation

```bash
# Clone the repository
git clone https://github.com/Tools-For-Inrernet/Johniii_DooDooLTala.git
cd Johniii_DooDooLTala

# No dependencies required - uses native Node.js 22 features
```

---

## Quick Start

### 1. Start the Server

```bash
# Production
node src/server/index.js

# Development (with auto-reload)
npm run dev
```

Server starts at `http://localhost:3000` by default.

### 2. Add to Your Website

```html
<script type="module">
  import { Webvisor } from '/src/client/Webvisor.js';

  const webvisor = new Webvisor({
    endpoint: '/api/webvisor/events',
    samplingRate: 100
  });

  webvisor.start();
</script>
```

### 3. View the Demo

Open `http://localhost:3000` in your browser to see the interactive demo.

---

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `HOST` | `0.0.0.0` | Server host |
| `DATA_PATH` | `./data/sessions` | Session storage directory |
| `RETENTION_DAYS` | `15` | Days to retain sessions |

### Client Configuration

```javascript
const webvisor = new Webvisor({
  // Server endpoint for sending events
  endpoint: '/api/webvisor/events',

  // Percentage of sessions to record (0-100)
  samplingRate: 100,

  // Events per batch before sending
  batchSize: 50,

  // Milliseconds between batch sends
  batchInterval: 1000,

  // Mouse movement throttle (ms)
  mouseThrottle: 50,

  // Scroll event throttle (ms)
  scrollThrottle: 100,

  // Privacy settings
  privacy: {
    // Mask all input values
    maskAllInputs: false,

    // Auto-mask sensitive fields (password, credit card, etc.)
    maskSensitiveInputs: true,

    // Attribute to mark excluded elements
    excludeAttribute: 'data-ym-disable',

    // URL patterns to exclude (regex strings)
    excludePages: ['/admin/*', '/checkout/*']
  }
});
```

---

## Client SDK

### Basic Usage

```javascript
import { Webvisor } from './src/client/Webvisor.js';

const webvisor = new Webvisor();

// Start recording
webvisor.start();

// Check if recording
console.log(webvisor.isActive()); // true

// Get session ID
console.log(webvisor.getSessionId()); // "wv_abc123_xyz789"

// Stop recording
await webvisor.stop();
```

### Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `start()` | `boolean` | Starts recording. Returns `false` if page excluded or not sampled |
| `stop()` | `Promise<void>` | Stops recording and sends remaining events |
| `isActive()` | `boolean` | Returns `true` if currently recording |
| `getSessionId()` | `string\|null` | Returns current session ID |
| `getEvents()` | `object[]` | Returns all recorded events (for debugging) |

### Individual Recorders

You can use recorders independently:

```javascript
import { DOMRecorder } from './src/client/recorder/DOMRecorder.js';
import { InteractionRecorder } from './src/client/recorder/InteractionRecorder.js';
import { InputRecorder } from './src/client/recorder/InputRecorder.js';
import { NavigationRecorder } from './src/client/recorder/NavigationRecorder.js';

// Custom event handler
const handleEvent = (event) => {
  console.log(event);
};

// DOM mutations only
const domRecorder = new DOMRecorder({ onEvent: handleEvent });
domRecorder.captureSnapshot();
domRecorder.start();
```

---

## Server API

### Endpoints

#### POST `/api/webvisor/events`

Receives event batches from the client.

**Request Body:**
```json
{
  "sessionId": "wv_abc123_xyz789",
  "events": [...],
  "timestamp": 1700000000000,
  "meta": {
    "userAgent": "Mozilla/5.0...",
    "language": "en-US",
    "screen": { "width": 1920, "height": 1080 }
  }
}
```

**Response:**
```json
{
  "success": true,
  "eventsReceived": 50
}
```

#### GET `/api/webvisor/sessions`

Lists all recorded sessions.

**Query Parameters:**
- `limit` - Number of sessions (default: 50)
- `offset` - Pagination offset (default: 0)

**Response:**
```json
{
  "sessions": [
    { "sessionId": "wv_abc123", "updatedAt": 1700000000000, "size": 15234 }
  ],
  "total": 150,
  "limit": 50,
  "offset": 0
}
```

#### GET `/api/webvisor/sessions/:id`

Retrieves a specific session with all events.

**Response:**
```json
{
  "sessionId": "wv_abc123_xyz789",
  "meta": { ... },
  "events": [ ... ],
  "createdAt": 1700000000000,
  "updatedAt": 1700000000000
}
```

#### DELETE `/api/webvisor/sessions/:id`

Deletes a session.

**Response:**
```json
{
  "success": true
}
```

---

## Privacy Controls

### Automatic Field Masking

Sensitive fields are automatically detected and masked:

- `type="password"` inputs
- `type="email"` inputs
- `type="tel"` inputs
- Credit card fields (by name, id, or autocomplete)
- Fields matching patterns: `password`, `credit`, `card`, `cvv`, `ssn`, `secret`, `token`

**Example masked output:**
```json
{
  "type": 5,
  "data": {
    "selector": "#password",
    "value": "********************",
    "masked": true
  }
}
```

### Element Exclusion

Add `data-ym-disable` to exclude elements from recording:

```html
<!-- This entire section is excluded -->
<div data-ym-disable>
  <input type="text" id="secret-field">
  <button>Private Action</button>
</div>
```

### Manual Masking

Force masking on specific fields:

```html
<input type="text" data-ym-mask name="custom-sensitive-field">
```

### Page Exclusion

Exclude entire pages via regex patterns:

```javascript
const webvisor = new Webvisor({
  privacy: {
    excludePages: [
      '/admin/.*',      // All admin pages
      '/checkout',      // Checkout page
      '.*\\?debug=.*'   // Any page with debug param
    ]
  }
});
```

---

## Data Captured

### Event Types

| Type | Code | Description |
|------|------|-------------|
| `DOM_SNAPSHOT` | 0 | Initial page state |
| `DOM_MUTATION` | 1 | DOM changes |
| `MOUSE_MOVE` | 2 | Mouse position |
| `MOUSE_CLICK` | 3 | Click events |
| `SCROLL` | 4 | Scroll position |
| `INPUT` | 5 | Form input changes |
| `RESIZE` | 6 | Viewport resize |
| `PAGE_LOAD` | 7 | Initial page load |
| `PAGE_TRANSITION` | 8 | Navigation events |
| `SESSION_START` | 9 | Recording started |
| `SESSION_END` | 10 | Recording ended |

### Event Structure

```javascript
{
  type: 3,                    // EventType.MOUSE_CLICK
  timestamp: 1700000000000,   // Unix timestamp
  sessionId: "wv_abc123",     // Session identifier
  data: {
    x: 150,                   // Viewport X
    y: 200,                   // Viewport Y
    pageX: 150,               // Page X
    pageY: 800,               // Page Y
    selector: "button.submit",
    tagName: "BUTTON"
  }
}
```

### DOM Snapshot Structure

```javascript
{
  type: 0,
  timestamp: 1700000000000,
  data: {
    doctype: { name: "html", publicId: "", systemId: "" },
    html: {
      type: 1,
      name: "HTML",
      attrs: { lang: "en" },
      children: [...]
    },
    url: "https://example.com/page",
    title: "Page Title",
    viewport: { width: 1920, height: 1080 },
    scroll: { x: 0, y: 0 }
  }
}
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ DOMRecorder │  │ Interaction │  │   InputRecorder     │  │
│  │             │  │  Recorder   │  │  (with masking)     │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
│         │                │                     │             │
│         └────────────────┼─────────────────────┘             │
│                          ▼                                   │
│                   ┌──────────────┐                           │
│                   │   Webvisor   │                           │
│                   │  (batching)  │                           │
│                   └──────┬───────┘                           │
└──────────────────────────┼───────────────────────────────────┘
                           │ HTTP POST
                           ▼
┌──────────────────────────────────────────────────────────────┐
│                     Node.js Server                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐   │
│  │   Router    │──│   Routes    │──│    SessionStore     │   │
│  │             │  │  (API)      │  │  (file storage)     │   │
│  └─────────────┘  └─────────────┘  └─────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
                           │
                           ▼
                    ┌──────────────┐
                    │ data/sessions│
                    │  (JSON files)│
                    └──────────────┘
```

---

## License

MIT License - 2025 Tools for Internet

---

## Related Documentation

- [CLAUDE.md](../CLAUDE.md) - AI assistant guidelines
- [README.md](../README.md) - Project overview
