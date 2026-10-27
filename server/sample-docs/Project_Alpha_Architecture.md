# Project Alpha: System Architecture & Engineering Blueprint

Author: Senior Principal Systems Architect
Date: October 15, 2025
Target System: Agentic Multi-Source Document Discovery & Retrieval Engine

## 1. Architectural Overview
Project Alpha is designed as an agentic AI document discovery subsystem operating across distributed endpoints (local filesystem, network shares, and multi-tenant Google Drive OAuth2 instances). The engine employs an autonomous Gemini Agent with Function Calling capabilities to decompose natural language queries into semantic file filters, metadata crawlers, and on-demand content inspection routines.

```
[ User Query ] ---> [ Express Backend Agent ]
                          |
             +------------+------------+
             |                         |
      [ localSearch ]            [ driveSearch ]
             |                         |
    [ File Crawler ]           [ Google Drive v3 ]
             |                         |
      [ parser.js ]              [ parser.js ]
  (PDF / DOCX / TXT / MD)    (Export / Streams)
             \                         /
              +-----------+-----------+
                          |
             [ Related Docs Discovery ]
                          |
                 [ JSON Response ]
```

## 2. Core Service Modules
- **geminiAgent.js**: Orchestrates the multi-step search trajectory using `@google/genai` tool schemas. Dynamically decides whether to invoke local disk crawlers, cloud Drive queries, or deep document text extraction.
- **localSearch.js**: Rapid recursive crawler with path exclusion, filetype filtering, and full-text keyword tokenization.
- **driveSearch.js**: Google Drive API v3 client managing OAuth2 tokens, multi-account credential switching, fullText query clauses, and Google Docs plain-text export streams.
- **parser.js**: In-memory parsing pipeline leveraging `pdf-parse` for binary PDFs, `mammoth` for Word DOCX formatting extraction, and native UTF-8 decoders for Markdown and plain text.

## 3. Performance & Latency Targets
- Local directory scanning (10,000 files): < 180ms metadata index.
- Document extraction latency: < 45ms per 5MB PDF.
- Gemini Tool Calling decision turnaround: < 800ms with Gemini Flash.
- End-to-end user query round-trip: < 1.2s.
