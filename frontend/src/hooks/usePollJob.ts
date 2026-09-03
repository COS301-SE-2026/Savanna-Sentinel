import { useEffect, useState } from "react";

const POLL_INTERVAL_MS = 2000;
const IN_FLIGHT_STATUSES = new Set(["queued", "processing"]);

export interface UsePollJobResult<T> {
    status: string;
    result: T | null;
}

export function usePollJob<T extends { status: string }>(
    jobId: string | null,
    fetchJob: (jobId: string) => Promise<T>,
): UsePollJobResult<T> {
    const [status, setStatus] = useState<string>("idle");
    const [result, setResult] = useState<T | null>(null);

    const [prevJobId, setPrevJobId] = useState<string | null>(null);
    if (jobId !== prevJobId) {
        setPrevJobId(jobId);
        setStatus(jobId ? "queued" : "idle");
        setResult(null);
    }

    useEffect(() => {
        if (!jobId) return;

        let isCancelled = false;
        let pollId = 0;

        const intervalId = setInterval(poll, POLL_INTERVAL_MS);

        async function poll() {
            const myPollId = ++pollId;
            try {
                const job = await fetchJob(jobId as string);
                if (isCancelled || myPollId !== pollId) return;

                setStatus(job.status);
                if (!IN_FLIGHT_STATUSES.has(job.status)) {
                    setResult(job);
                    clearInterval(intervalId);
                }
            } catch {
                if (!isCancelled && myPollId === pollId) {
                    setStatus("failed");
                    clearInterval(intervalId);
                }
            }
        }

        poll();

        return () => {
            isCancelled = true;
            clearInterval(intervalId);
        };
    }, [jobId, fetchJob]);

    return { status, result };
}
