# Written Discourse Lab

A React and TypeScript workbench for exploring cohesion, coherence, and rhetorical organization in English texts. The opening article is an original, illustrative classroom sample about feedback and revision.

## Run locally

Use Node 22.12+ or 24 and pnpm.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open the URL Vite prints. For a production build, use `pnpm build`, then `pnpm preview`. The local rule engine and document imports run in the browser.

## Use in class

- Paste text, or import TXT, DOCX, or text-based PDF. Separate paragraphs with blank lines. DOCX is extracted as raw text. PDF paragraph boundaries are estimated from line spacing and page breaks. Review multi-column PDFs and other complex layouts in the input before analyzing. Image-only PDFs need OCR first. The file limit is 20 MB and the extracted text limit is 80,000 UTF-16 code units.
- Run **Analyze text** after editing the input. Reanalysis replaces the current annotation set, so export first to retain any edits. Open a highlight or its entry in the annotation index to inspect evidence, related passages, confidence and alternatives. Overlapping annotations remain individually available in the index.
- Use **Edit**, **Delete** or **+ Add** to curate the analysis. When adding a new annotation, you can start with a selection in the article input. The editor and JSON export use zero-based, end-exclusive UTF-16 character offsets, the same as JavaScript string slicing. Imported line endings are normalized before analysis.
- Open **Structure map** for paragraph roles and clickable directed edges. Solid edges have an overt textual cue. Dashed edges reflect an inference. A cue can be explicit while its scope or interpretation remains uncertain.
- Select **Present** to start with a clean text. Use **←** and **→** to navigate, **Space** to toggle the interpretation, and **Escape** to leave presentation. The fullscreen overlay also works when native fullscreen is unavailable. Prediction mode adds a prompt for audience discussion. Presenter notes are shown on the same screen when enabled.
- Export a readable article with notes (TXT) or machine-readable analysis (JSON). Edits and presenter notes live in the current tab session. Traditional Chinese and English are available for the interface. The local engine's generated prose is English.

## Analytical framework

Michael McCarthy, *Discourse Analysis for Language Teachers* (Cambridge University Press, 1991). Chapter 6, **Written language**, anchors the workbench's focus on written text types, reader interpretation and classroom application. Chapter 2 informs grammatical cohesion and thematic progression. Chapter 3 informs lexical cohesion and text-organizing vocabulary. Clause relations and larger textual patterns also build on Chapter 1. [Publisher record](https://shop.cambridge.org/english/product/2700034562).

Rules model selected constructions, such as demonstrative anaphora, verbal substitution, verb phrase ellipsis, repeated vocabulary, candidate lexical chains and overt interclausal cues. The pattern layer requires a contextual trigger and supporting passage. These are bounded teaching heuristics. Coverage of implicit relations, general pronoun resolution and unmarked theme structures is limited. Confidence is a qualitative judgment. Use the related passages to assess an analysis and revise it as needed.

## Deploy to Cloudflare Pages

Connect this project as a Git repository in Cloudflare Pages. Use project root `/`, production build command `pnpm build`, output directory `dist`, and a build environment with Node 22.12+ or 24. Keep `functions/` at project root so Pages includes its API route. To test the route or deploy directly, run the following from the project root after building.

```sh
pnpm dlx wrangler pages dev dist
pnpm dlx wrangler pages deploy dist --project-name YOUR_PROJECT
```

Create the Pages project before deploying. See [Pages Functions setup](https://developers.cloudflare.com/pages/functions/get-started/) and [environment bindings](https://developers.cloudflare.com/pages/functions/bindings/).

## Optional server-side AI

The `POST /api/analyze` Pages Function uses an OpenAI-compatible chat completions endpoint that supports JSON object output. Set `AI_API_KEY` as a **secret** and `AI_MODEL` as a server environment variable. Optionally set `AI_BASE_URL` to the provider's API base, including its version path, such as `https://api.openai.com/v1`. Use a gitignored `.dev.vars` file with these variables for Wrangler local testing. Use the desired deployment environments when configuring bindings.

Only **Try AI** sends the text to the configured service. AI accepts at most 20,000 characters. The server verifies all returned quotes against the input and derives end offsets from exact substrings. If the provider is unavailable or the response fails validation, the browser falls back to local rules. The key stays in the Pages Function environment. When enabling a metered API on a shared deployment, place the route behind deployment-level access control or rate limiting to manage usage.
