<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/144OW7AN3L-RQ9aXBJUJ-Uh93S46IIZ3-

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Create `.env.local` with backend credentials (choose one provider):

   ```bash
   # Provider: azure (default)
   LLM_PROVIDER=azure
   AZURE_OPENAI_ENDPOINT=https://YOUR-RESOURCE.openai.azure.com
   AZURE_OPENAI_API_KEY=your_azure_api_key
   AZURE_OPENAI_DEPLOYMENT_NAME=your_deployment
   AZURE_OPENAI_API_VERSION=2024-02-01

   # Or provider: gemini
   # LLM_PROVIDER=gemini
   # GEMINI_API_KEY=your_gemini_key
   # GEMINI_MODEL=gemini-2.0-flash
   ```

3. Start backend API (port `8787`):
   `npm run dev:api`
4. In another terminal, start frontend (port `3000`):
   `npm run dev`

Frontend requests go to `/api/chat` and are proxied to the backend, so API keys stay on the server side.

Or run both in one command:
`npm run dev:full`

Note: Admin Dashboard settings are now synced to backend via `/api/config`, so Azure values entered in the dashboard are used for chat calls.
