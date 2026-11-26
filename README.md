

# Encodr Lite: Intern Take-Home

Thanks for taking the time on this. **Encodr Lite** is a small media-transcoding dashboard: a signed-in user creates an encode **job** from a media URL, presses **Start encode**, watches the progress update live, and sees the output files when it finishes.

The full brief, including the six tasks, what we look for, and the ground rules, is in `BRIEF.md`.

## Run it

```bash
npm install
npm run dev          # http://localhost:3000
npm run test:run    # tests
npm run typecheck    # tsc --noEmit
npm run build       # production build
```

Requires **Node 20+** (`.nvmrc` says 20).

**Demo login:** `demo@encodr.dev` / `password123`

Nothing here needs a database. State lives in memory, so restarting the dev server wipes your jobs.

## Where things are

```text
app/
  signin/page.tsx
  (app)/layout.tsx
  (app)/jobs/page.tsx
  (app)/jobs/[id]/page.tsx
  api/auth/login/route.ts
  api/jobs/route.ts
  api/jobs/[id]/route.ts
  api/runs/route.ts
  api/runs/[id]/route.ts

lib/
  types.ts
  schemas.ts
  server/auth.ts
  server/http.ts
  server/store.ts
  client/api.ts
  client/auth-context.tsx
  client/hooks.ts
  client/use-run-polling.ts

components/
  status-badge.tsx
  progress-bar.tsx

__tests__/
```

## What's working

All six tasks are completed:

- **Task 1:** Source URL validation using Zod, covering empty input, invalid URLs, unsupported protocols, and URLs without a file path.
- **Task 2:** Authenticated jobs API routes for listing and creating jobs, including request validation and error responses.
- **Task 3:** `computeRun()` implementation for the encoding state machine, progress, completion, and simulated failures.
- **Task 4:** Create-job form using React Hook Form and Zod, with validation, submission, and server error handling.
- **Task 5:** Run polling hook and job detail page with encoding controls, progress updates, logs, failure handling, retry, and completed renditions.
- **Task 6:** Tests covering schemas, API routes, run state transitions, hooks, form behavior, and the job detail page.
- **Job timestamps**: Displays relative creation timestamps in the jobs list (e.g., `5m ago`, `2h ago`, `3d ago`), falling back to a formatted date for jobs older than 7 days.

## How to see the failure path

Create a job using the following source URL:

`https://cdn.example.com/videos/corrupt.mp4`

Start encoding and navigate to the job detail page. The run will fail partway through the simulated encoding process. The failure state displays the error and provides an option to retry.

## Decisions and assumptions

On the job detail page, I modelled the run panel using four states: `idle`, `running`, `failed`, and `completed`. The state is derived from the current run's status and the mutation/polling state, allowing the UI to display the appropriate controls and information.

For polling, I implemented a timer-based approach to periodically fetch the latest state of an encoding run from the API. Rather than keeping the server responsible for pushing updates, the client requests the run's current state at regular intervals and updates the UI accordingly. This allows the progress, stage, and logs to reflect the run's latest state while the encoding is in progress.

Polling continues while the run is active and stops once it reaches a terminal state, either `COMPLETED` or `FAILED`, since no further updates are expected. I also handled timer cleanup using `clearTimeout` when the polling effect is re-executed or the component unmounts. This prevents previously scheduled polling callbacks from continuing after the run changes or the page is no longer active, avoiding unnecessary requests and potential issues from stale polling instances.

I introduced a separate `RunPanelState` type for the UI instead of reusing the existing `JobStatus` or `Stage` types. The existing types represent the API and encoding domain states, whereas `RunPanelState` represents the combined state of the UI, derived from the run status and mutation/polling state. Reusing the existing types would mix concerns and wouldn't accurately represent the panel's states, particularly `idle`, which isn't an encoding stage or job status.

I kept the implementation within the existing scaffold and used the provided types, API patterns, and timeline constants rather than introducing additional dependencies or changing the intended setup.

## What was hardest

The polling implementation was the most challenging part, mainly because managing asynchronous state at this level and the polling lifecycle was relatively new to me.

I took it as a challenge to implement as much of the logic as I could myself. I was able to work through most of it independently, although I used ChatGPT to explain unfamiliar concepts, provide hints, review my approach, and help me debug when I got stuck.

The assignment felt like revisiting Full Stack Open. The tasks were well-scoped, which made me want to work through them myself instead of immediately offloading the implementation to AI. It was a good opportunity to revisit concepts I had learned months ago but hadn't used recently, and to figure out where my understanding was rusty.

The implementation may not be the most optimal version of everything, but I learned a lot by working through the problems instead of just trying to get them done.

## What I'd do next

- Add end-to-end tests using Playwright for at least one complete user flow, such as job creation or encoding completion.
- Spend more time on UI polish and interaction details, even though functionality was the primary focus of this assignment.
- Preserve encoding logs across page refreshes and run restarts instead of relying on the current in-memory log state.
- Improve the polling experience further, potentially including smoother progress updates and handling polling when the browser tab is inactive, as mentioned in the extra tasks.

## Time spent

| Task | Approx. time | Notes |
|---|---:|---|
| Task 1: Source URL validation | 40 min | Zod was familiar, but some validation details were new. Also spent some time refactoring. |
| Task 2: Jobs API routes | 20 min | Relatively straightforward since the route patterns were already provided. |
| Task 3: Run state machine | 1 hr 15 min | More involved due to the different states, transitions, and timing boundaries. |
| Task 4: Create-job form | 1 hr | A little rusty with writing React code manually, so took some time getting back into the flow. |
| Task 5: Polling and job detail page | 2 hrs | The most challenging task, particularly the polling hook and asynchronous state management. |
| Task 6: Tests | 1 hr | Tests for the API and logic were written before the respective implementation; UI tests were written after implementation. |
| **Total** | **~6 hrs 15 min** | **Approximate focused time** |

